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

module.exports = { zerarDadosAdmin, CONFIRMACAO, TABELAS };
