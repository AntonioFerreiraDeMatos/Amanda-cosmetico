// Estoque por leitor de código de barras (pistola USB/Bluetooth ou câmera).
//
// - buscarPorCodigo: encontra o produto pelo código de barras ou SKU.
// - movimentarLote: aplica uma sessão inteira de leituras numa única transação.
//   Ou entra tudo, ou nada entra. Cada item tem sua própria chave de
//   idempotência, então reenviar o mesmo lote (internet caiu) não duplica nada.

const pool = require('../config/database');
const { registrarAuditoria } = require('../utils/auditoria');
const { logError } = require('../utils/logger');
const { normalizarCodigoBarras } = require('../utils/codigoBarras');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITENS = 500;
const MAX_QTD = 100000;

const PRODUTO_CAMPOS = `
    p.id, p.nome, p.sku, p.codigo_barras, p.preco, p.preco_promocional,
    p.estoque, p.estoque_minimo, p.ativo, c.nome AS categoria,
    (SELECT pi.imagem_url FROM produto_imagens pi
      WHERE pi.produto_id = p.id AND pi.principal = TRUE
      ORDER BY pi.ordem LIMIT 1) AS imagem_principal`;

async function buscarProdutoPorCodigoAdmin(req, res) {
    const codigo = normalizarCodigoBarras(req.params.codigo);
    if (!codigo) {
        return res.status(400).json({ sucesso: false, mensagem: 'Código inválido.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT ${PRODUTO_CAMPOS}
             FROM produtos p
             INNER JOIN categorias c ON c.id = p.categoria_id
             WHERE p.codigo_barras = ? OR p.sku = ?
             ORDER BY (p.codigo_barras = ?) DESC
             LIMIT 1`,
            [codigo, codigo, codigo]
        );
        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                codigo,
                mensagem: 'Nenhum produto cadastrado com este código.'
            });
        }
        return res.json({ sucesso: true, produto: rows[0] });
    } catch (error) {
        logError('Erro ao buscar produto por código', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível buscar o produto.' });
    }
}

function lerLote(body = {}) {
    const tipo = body.tipo;
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    const itens = Array.isArray(body.itens) ? body.itens : null;

    if (!['entrada', 'saida', 'ajuste'].includes(tipo)) return { erro: 'Escolha entrada, saída ou contagem.' };
    if (motivo.length < 3 || motivo.length > 1000) return { erro: 'Informe o motivo (mínimo de 3 caracteres).' };
    if (!itens || !itens.length) return { erro: 'Nenhum produto lido.' };
    if (itens.length > MAX_ITENS) return { erro: `Envie no máximo ${MAX_ITENS} produtos por lote.` };

    const vistos = new Set();
    const chaves = new Set();
    const lidos = [];
    for (const item of itens) {
        const produtoId = Number(item?.produto_id);
        const quantidade = Number(item?.quantidade);
        const chave = String(item?.chave || '');
        if (!Number.isSafeInteger(produtoId) || produtoId < 1) return { erro: 'Produto inválido no lote.' };
        if (!Number.isSafeInteger(quantidade) || quantidade < 0 || quantidade > MAX_QTD ||
            (tipo !== 'ajuste' && quantidade < 1)) {
            return { erro: 'Quantidade inválida no lote.' };
        }
        if (!UUID.test(chave)) return { erro: 'Chave de segurança inválida no lote.' };
        if (vistos.has(produtoId)) return { erro: 'O mesmo produto aparece duas vezes no lote.' };
        if (chaves.has(chave)) return { erro: 'Chave repetida no lote.' };
        vistos.add(produtoId);
        chaves.add(chave);
        lidos.push({ produtoId, quantidade, chave });
    }
    return { tipo, motivo, itens: lidos };
}

async function movimentarEstoqueLoteAdmin(req, res) {
    const lote = lerLote(req.body);
    if (lote.erro) return res.status(400).json({ sucesso: false, mensagem: lote.erro });
    const { tipo, motivo, itens } = lote;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lote já enviado antes? (reenvio após queda de conexão)
        const [anteriores] = await connection.query(
            'SELECT chave_idempotencia FROM estoque_movimentacoes WHERE chave_idempotencia IN (?)',
            [itens.map((i) => i.chave)]
        );
        if (anteriores.length) {
            await connection.rollback();
            if (anteriores.length === itens.length) {
                return res.json({
                    sucesso: true,
                    reutilizado: true,
                    mensagem: 'Este lote já havia sido registrado.'
                });
            }
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Parte deste lote já foi registrada. Atualize a tela antes de tentar novamente.'
            });
        }

        // Trava os produtos em ordem de ID para evitar bloqueio cruzado.
        const ids = itens.map((i) => i.produtoId).sort((a, b) => a - b);
        const [produtos] = await connection.query(
            'SELECT id, nome, estoque FROM produtos WHERE id IN (?) ORDER BY id FOR UPDATE',
            [ids]
        );
        const porId = new Map(produtos.map((p) => [Number(p.id), p]));
        if (porId.size !== ids.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Um dos produtos do lote não existe mais.' });
        }

        const resultado = [];
        for (const item of itens) {
            const produto = porId.get(item.produtoId);
            const anterior = Number(produto.estoque);
            const novo = tipo === 'ajuste'
                ? item.quantidade
                : tipo === 'entrada' ? anterior + item.quantidade : anterior - item.quantidade;

            if (novo < 0) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    produto_id: item.produtoId,
                    mensagem: `Saída maior que o estoque de "${produto.nome}" (${anterior} un.). Nada foi registrado.`
                });
            }
            if (novo > 4294967295) {
                await connection.rollback();
                return res.status(409).json({ sucesso: false, mensagem: 'Quantidade acima do limite permitido.' });
            }
            if (novo === anterior) {
                resultado.push({ produto_id: item.produtoId, nome: produto.nome, estoque_anterior: anterior, estoque: novo, sem_mudanca: true });
                continue;
            }

            await connection.query('UPDATE produtos SET estoque = ? WHERE id = ?', [novo, item.produtoId]);
            await connection.query(
                `INSERT INTO estoque_movimentacoes
                    (produto_id, administrador_id, tipo, quantidade_anterior,
                     quantidade_nova, diferenca, motivo, chave_idempotencia)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.produtoId, req.admin.administrador_id, tipo, anterior, novo, novo - anterior, motivo, item.chave]
            );
            await registrarAuditoria(connection, req, {
                acao: `estoque.${tipo}`,
                entidade: 'produto',
                entidadeId: item.produtoId,
                motivo: `${motivo} (leitor de código de barras)`,
                antes: { estoque: anterior },
                depois: { estoque: novo }
            });
            resultado.push({ produto_id: item.produtoId, nome: produto.nome, estoque_anterior: anterior, estoque: novo });
        }

        await connection.commit();
        const alterados = resultado.filter((r) => !r.sem_mudanca).length;
        return res.json({
            sucesso: true,
            itens: resultado,
            mensagem: `${alterados} produto(s) atualizado(s).`
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este lote foi recebido duas vezes. Atualize a tela antes de tentar novamente.'
            });
        }
        logError('Erro ao movimentar lote de estoque', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível registrar o lote. Nada foi alterado.' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    buscarProdutoPorCodigoAdmin,
    movimentarEstoqueLoteAdmin,
    lerLote
};
