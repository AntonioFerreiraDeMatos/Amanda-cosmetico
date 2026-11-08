const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { registrarAuditoria } = require('../utils/auditoria');
const { logError } = require('../utils/logger');

const CONFIRMACAO = 'ZERAR TUDO';
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/produtos');

// Ordem respeita as chaves estrangeiras (filhos antes dos pais).
// Mantidos: administradores, admin_auditoria, configuracoes_sistema, schema_migrations.
const TABELAS = [
    'estoque_movimentacoes',
    'pedido_idempotencia',
    'pagamentos',
    'itens_pedido',
    'pedido_numeracao_sequencial',
    'pedidos',
    'enderecos',
    'clientes',
    'produto_imagens',
    'produtos',
    'categorias',
    'cupons'
];

// Tabelas cujo contador volta a 1 (pedido AM-000001, IDs limpos).
const REINICIAR_CONTADOR = ['pedido_numeracao_sequencial', 'pedidos', 'clientes', 'produtos', 'categorias'];

async function limparUploads() {
    let removidos = 0;
    try {
        const arquivos = await fs.readdir(UPLOAD_DIR);
        for (const nome of arquivos) {
            if (nome.startsWith('.')) continue;
            try {
                await fs.unlink(path.join(UPLOAD_DIR, nome));
                removidos += 1;
            } catch { /* arquivo já removido ou diretório */ }
        }
    } catch { /* pasta ainda não existe */ }
    return removidos;
}

/**
 * Apaga todos os dados de loja (pedidos, clientes, produtos, categorias)
 * para começar a operação real. Exige a senha do administrador e a frase
 * de confirmação. A conta administrativa e a auditoria são preservadas.
 */
async function zerarDadosAdmin(req, res) {
    const senha = String(req.body?.senha || '');
    const confirmacao = String(req.body?.confirmacao || '').trim();

    if (confirmacao !== CONFIRMACAO) {
        return res.status(400).json({ sucesso: false, mensagem: `Digite ${CONFIRMACAO} para confirmar.` });
    }
    if (!senha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe sua senha para confirmar.' });
    }

    let connection;
    try {
        const [[admin]] = await pool.query(
            'SELECT id, senha_hash FROM administradores WHERE id = ? AND ativo = TRUE LIMIT 1',
            [req.admin.administrador_id]
        );
        if (!admin || !(await bcrypt.compare(senha, admin.senha_hash))) {
            return res.status(401).json({ sucesso: false, mensagem: 'Senha incorreta.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const contagem = {};
        for (const tabela of TABELAS) {
            const [result] = await connection.query(`DELETE FROM \`${tabela}\``);
            contagem[tabela] = Number(result.affectedRows || 0);
        }

        await registrarAuditoria(connection, req, {
            acao: 'sistema.dados_zerados',
            entidade: 'sistema',
            entidadeId: 0,
            motivo: 'Remoção dos dados de teste para iniciar a operação real.',
            antes: contagem,
            depois: null
        });
        await connection.commit();

        // ALTER TABLE faz commit implícito; por isso roda depois da transação.
        for (const tabela of REINICIAR_CONTADOR) {
            await connection.query(`ALTER TABLE \`${tabela}\` AUTO_INCREMENT = 1`);
        }

        const imagens = await limparUploads();

        return res.json({
            sucesso: true,
            mensagem: 'Dados de teste apagados. A loja está pronta para os dados reais.',
            removidos: { ...contagem, arquivos_imagem: imagens }
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch { /* já finalizada */ }
        }
        logError('Erro ao zerar dados da loja', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível apagar os dados. Nada foi alterado.' });
    } finally {
        if (connection) connection.release();
    }
}

// ------------------------------------------------------------------
// Exportação completa em Excel (.xlsx), uma aba por assunto.
// ------------------------------------------------------------------

const SIM_NAO = (v) => (Number(v) ? 'Sim' : 'Não');
const FORMULA_START = /^[=+\-@\t\r]/;
const texto = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return FORMULA_START.test(s) ? `'${s}` : s; // evita injeção de fórmulas
};
const dinheiro = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const data = (v) => (v ? new Date(v) : null);

const ABAS = [
    {
        nome: 'Pedidos',
        sql: `SELECT p.id, COALESCE(p.numero_exibicao, p.numero_pedido) AS numero, p.status,
                     c.nome AS cliente, c.telefone, c.email,
                     CONCAT_WS(', ', e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.cep) AS endereco,
                     p.subtotal, p.desconto, p.frete, p.total, p.observacoes, p.criado_em
              FROM pedidos p
              LEFT JOIN clientes c ON c.id = p.cliente_id
              LEFT JOIN enderecos e ON e.id = p.endereco_id
              ORDER BY p.id`,
        colunas: [
            ['Nº pedido', 'numero', texto, 14], ['Status', 'status', texto, 20], ['Cliente', 'cliente', texto, 28],
            ['WhatsApp', 'telefone', texto, 18], ['E-mail', 'email', texto, 28], ['Endereço', 'endereco', texto, 50],
            ['Subtotal', 'subtotal', dinheiro, 12, 'money'], ['Desconto', 'desconto', dinheiro, 12, 'money'],
            ['Frete', 'frete', dinheiro, 12, 'money'], ['Total', 'total', dinheiro, 12, 'money'],
            ['Observações', 'observacoes', texto, 40], ['Data', 'criado_em', data, 18, 'date'], ['ID interno', 'id', Number, 10]
        ]
    },
    {
        nome: 'Itens dos pedidos',
        sql: `SELECT COALESCE(p.numero_exibicao, p.numero_pedido) AS numero, i.nome_produto, pr.sku,
                     i.quantidade, i.preco_unitario, i.subtotal, p.criado_em
              FROM itens_pedido i
              JOIN pedidos p ON p.id = i.pedido_id
              LEFT JOIN produtos pr ON pr.id = i.produto_id
              ORDER BY p.id, i.id`,
        colunas: [
            ['Nº pedido', 'numero', texto, 14], ['Produto', 'nome_produto', texto, 36], ['SKU', 'sku', texto, 14],
            ['Quantidade', 'quantidade', Number, 12], ['Preço unitário', 'preco_unitario', dinheiro, 14, 'money'],
            ['Subtotal', 'subtotal', dinheiro, 12, 'money'], ['Data do pedido', 'criado_em', data, 18, 'date']
        ]
    },
    {
        nome: 'Pagamentos',
        sql: `SELECT COALESCE(p.numero_exibicao, p.numero_pedido) AS numero, pg.metodo, pg.status, pg.valor,
                     pg.pago_em, pg.criado_em
              FROM pagamentos pg
              JOIN pedidos p ON p.id = pg.pedido_id
              ORDER BY pg.id`,
        colunas: [
            ['Nº pedido', 'numero', texto, 14], ['Método', 'metodo', texto, 10], ['Status', 'status', texto, 14],
            ['Valor', 'valor', dinheiro, 12, 'money'], ['Pago em', 'pago_em', data, 18, 'date'],
            ['Criado em', 'criado_em', data, 18, 'date']
        ]
    },
    {
        nome: 'Clientes',
        sql: `SELECT c.id, c.nome, c.telefone, c.email, c.provedor_login, c.ativo, c.anotacao_admin,
                     CONCAT_WS(', ', e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.cep) AS endereco,
                     (SELECT COUNT(*) FROM pedidos x WHERE x.cliente_id = c.id AND x.status <> 'cancelado') AS pedidos,
                     (SELECT COALESCE(SUM(pg.valor), 0) FROM pagamentos pg JOIN pedidos x ON x.id = pg.pedido_id
                       WHERE x.cliente_id = c.id AND pg.status = 'aprovado') AS total_pago,
                     c.criado_em
              FROM clientes c
              LEFT JOIN enderecos e ON e.id = (
                  SELECT e2.id FROM enderecos e2 WHERE e2.cliente_id = c.id ORDER BY e2.principal DESC, e2.id DESC LIMIT 1)
              ORDER BY c.id`,
        colunas: [
            ['Nome', 'nome', texto, 28], ['WhatsApp', 'telefone', texto, 18], ['E-mail', 'email', texto, 28],
            ['Endereço', 'endereco', texto, 50], ['Login', 'provedor_login', texto, 10], ['Ativo', 'ativo', SIM_NAO, 8],
            ['Pedidos', 'pedidos', Number, 10], ['Total pago', 'total_pago', dinheiro, 14, 'money'],
            ['Anotação', 'anotacao_admin', texto, 40], ['Cadastro', 'criado_em', data, 18, 'date'], ['ID', 'id', Number, 8]
        ]
    },
    {
        nome: 'Produtos',
        sql: `SELECT p.id, p.nome, p.sku, c.nome AS categoria, p.preco, p.preco_promocional, p.estoque,
                     p.estoque_minimo, p.ativo, p.destaque, p.descricao,
                     (SELECT pi.imagem_url FROM produto_imagens pi WHERE pi.produto_id = p.id
                       ORDER BY pi.principal DESC, pi.ordem, pi.id LIMIT 1) AS imagem, p.criado_em
              FROM produtos p
              LEFT JOIN categorias c ON c.id = p.categoria_id
              ORDER BY p.nome`,
        colunas: [
            ['Nome', 'nome', texto, 36], ['SKU', 'sku', texto, 14], ['Categoria', 'categoria', texto, 20],
            ['Preço', 'preco', dinheiro, 12, 'money'], ['Promoção', 'preco_promocional', dinheiro, 12, 'money'],
            ['Estoque', 'estoque', Number, 10], ['Estoque mínimo', 'estoque_minimo', Number, 14],
            ['Ativo', 'ativo', SIM_NAO, 8], ['Destaque', 'destaque', SIM_NAO, 10], ['Descrição', 'descricao', texto, 60],
            ['Imagem', 'imagem', texto, 40], ['Cadastro', 'criado_em', data, 18, 'date'], ['ID', 'id', Number, 8]
        ]
    },
    {
        nome: 'Categorias',
        sql: `SELECT c.id, c.nome, c.descricao, c.ativo,
                     (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id) AS produtos
              FROM categorias c ORDER BY c.nome`,
        colunas: [
            ['Nome', 'nome', texto, 24], ['Descrição', 'descricao', texto, 50], ['Ativa', 'ativo', SIM_NAO, 8],
            ['Produtos', 'produtos', Number, 10], ['ID', 'id', Number, 8]
        ]
    },
    {
        nome: 'Movimentações de estoque',
        sql: `SELECT m.criado_em, p.nome AS produto, m.tipo, m.quantidade_anterior, m.quantidade_nova, m.diferenca,
                     m.motivo, COALESCE(x.numero_exibicao, x.numero_pedido) AS pedido, a.nome AS responsavel
              FROM estoque_movimentacoes m
              LEFT JOIN produtos p ON p.id = m.produto_id
              LEFT JOIN pedidos x ON x.id = m.pedido_id
              LEFT JOIN administradores a ON a.id = m.administrador_id
              ORDER BY m.id`,
        colunas: [
            ['Data', 'criado_em', data, 18, 'date'], ['Produto', 'produto', texto, 32], ['Tipo', 'tipo', texto, 14],
            ['Antes', 'quantidade_anterior', Number, 8], ['Depois', 'quantidade_nova', Number, 8],
            ['Diferença', 'diferenca', Number, 10], ['Motivo', 'motivo', texto, 40], ['Pedido', 'pedido', texto, 14],
            ['Responsável', 'responsavel', texto, 20]
        ]
    }
];

async function exportarTudoXlsx(req, res) {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Amanda Cosméticos';
        workbook.created = new Date();

        for (const aba of ABAS) {
            const [linhas] = await pool.query(aba.sql);
            const sheet = workbook.addWorksheet(aba.nome, { views: [{ state: 'frozen', ySplit: 1 }] });
            sheet.columns = aba.colunas.map(([header, key, , width, tipo]) => ({
                header,
                key,
                width,
                style: tipo === 'money'
                    ? { numFmt: '"R$" #,##0.00' }
                    : tipo === 'date' ? { numFmt: 'dd/mm/yyyy hh:mm' } : {}
            }));
            for (const linha of linhas) {
                const row = {};
                for (const [, key, fmt] of aba.colunas) {
                    const value = linha[key];
                    row[key] = value === null || value === undefined ? null : fmt(value);
                }
                sheet.addRow(row);
            }
            sheet.getRow(1).font = { bold: true };
            sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
        }

        const hoje = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="amanda-cosmeticos-dados-${hoje}.xlsx"`);
        res.setHeader('Cache-Control', 'no-store');
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        logError('Erro ao exportar dados em Excel', error);
        if (res.headersSent) return res.end();
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível gerar a planilha.' });
    }
}

module.exports = { zerarDadosAdmin, exportarTudoXlsx, ABAS, CONFIRMACAO, TABELAS };
