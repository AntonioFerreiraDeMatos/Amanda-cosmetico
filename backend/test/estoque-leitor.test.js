const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    buscarProdutoPorCodigoAdmin,
    movimentarEstoqueLoteAdmin,
    lerLote
} = require('../src/controllers/estoqueLeitorController');
const { normalizarCodigoBarras } = require('../src/utils/codigoBarras');
const adminRoutes = require('../src/routes/adminRoutes');

const K1 = '11111111-1111-4111-8111-111111111111';
const K2 = '22222222-2222-4222-8222-222222222222';

function criarResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function mockConnection(t, handler) {
    const original = pool.getConnection;
    const originalQuery = pool.query;
    const log = { queries: [], committed: false, rolledBack: false };
    const conn = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            log.queries.push({ statement, params });
            return handler(statement, params);
        },
        beginTransaction: async () => {},
        commit: async () => { log.committed = true; },
        rollback: async () => { log.rolledBack = true; },
        release() {}
    };
    pool.getConnection = async () => conn;
    pool.query = conn.query;
    t.after(() => { pool.getConnection = original; pool.query = originalQuery; });
    return log;
}

const req = (body) => ({ body, admin: { administrador_id: 3 } });

test('normaliza códigos de barras de pistola e câmera', () => {
    assert.equal(normalizarCodigoBarras(' 7891234 567895 '), '7891234567895');
    assert.equal(normalizarCodigoBarras(''), null);
    assert.equal(normalizarCodigoBarras(undefined), null);
    assert.equal(normalizarCodigoBarras('<script>'), false);
    assert.equal(normalizarCodigoBarras('9'.repeat(65)), false);
});

test('rotas do leitor ficam atrás do login administrativo', () => {
    const stack = adminRoutes.stack;
    const authIndex = stack.findIndex((l) => !l.route && l.name !== 'router' && stack.indexOf(l) > 0 && /requireAdmin|autenticar|middleware/i.test(l.handle.name || '') );
    const loteIndex = stack.findIndex((l) => l.route?.path === '/estoque/lote');
    const codigoIndex = stack.findIndex((l) => l.route?.path === '/produtos/codigo/:codigo');
    assert.ok(loteIndex > 0 && codigoIndex > 0);
    const useIndex = stack.findIndex((l) => !l.route);
    assert.ok(useIndex >= 0 && useIndex < loteIndex && useIndex < codigoIndex, 'middleware de admin antes das rotas');
    void authIndex;
});

test('valida o lote antes de tocar no banco', () => {
    assert.match(lerLote({ tipo: 'roubo', motivo: 'abc', itens: [] }).erro, /entrada/);
    assert.match(lerLote({ tipo: 'entrada', motivo: 'ok', itens: [] }).erro, /motivo/);
    assert.match(lerLote({ tipo: 'entrada', motivo: 'Reposição', itens: [] }).erro, /Nenhum/);
    assert.match(lerLote({ tipo: 'entrada', motivo: 'Reposição', itens: [
        { produto_id: 1, quantidade: 1, chave: K1 }, { produto_id: 1, quantidade: 2, chave: K2 }
    ] }).erro, /duas vezes/);
    assert.match(lerLote({ tipo: 'saida', motivo: 'Avaria', itens: [{ produto_id: 1, quantidade: 0, chave: K1 }] }).erro, /Quantidade/);
    assert.match(lerLote({ tipo: 'entrada', motivo: 'Reposição', itens: [{ produto_id: 1, quantidade: 1, chave: 'x' }] }).erro, /Chave/);
    assert.equal(lerLote({ tipo: 'ajuste', motivo: 'Contagem', itens: [{ produto_id: 1, quantidade: 0, chave: K1 }] }).erro, undefined);
});

test('entrada em lote soma, registra movimentação e auditoria de cada item', async (t) => {
    const log = mockConnection(t, (s) => {
        if (s.startsWith('SELECT chave_idempotencia')) return [[]];
        if (s.startsWith('SELECT id, nome, estoque')) return [[{ id: 1, nome: 'Batom', estoque: 4 }, { id: 2, nome: 'Sérum', estoque: 0 }]];
        return [{ affectedRows: 1 }];
    });
    const res = criarResponse();
    await movimentarEstoqueLoteAdmin(req({
        tipo: 'entrada', motivo: 'Chegada do fornecedor',
        itens: [{ produto_id: 2, quantidade: 12, chave: K2 }, { produto_id: 1, quantidade: 3, chave: K1 }]
    }), res);

    assert.equal(res.statusCode, 200);
    assert.ok(log.committed);
    assert.deepEqual(res.body.itens.map((i) => [i.produto_id, i.estoque]), [[2, 12], [1, 7]]);
    const lock = log.queries.find((q) => q.statement.includes('FOR UPDATE'));
    assert.deepEqual(lock.params[0], [1, 2], 'trava em ordem de id');
    assert.equal(log.queries.filter((q) => q.statement.startsWith('INSERT INTO estoque_movimentacoes')).length, 2);
    assert.equal(log.queries.filter((q) => q.statement.startsWith('INSERT INTO admin_auditoria')).length, 2);
});

test('saída maior que o estoque cancela o lote inteiro', async (t) => {
    const log = mockConnection(t, (s) => {
        if (s.startsWith('SELECT chave_idempotencia')) return [[]];
        if (s.startsWith('SELECT id, nome, estoque')) return [[{ id: 1, nome: 'Batom', estoque: 10 }, { id: 2, nome: 'Sérum', estoque: 1 }]];
        return [{ affectedRows: 1 }];
    });
    const res = criarResponse();
    await movimentarEstoqueLoteAdmin(req({
        tipo: 'saida', motivo: 'Venda no balcão',
        itens: [{ produto_id: 1, quantidade: 2, chave: K1 }, { produto_id: 2, quantidade: 5, chave: K2 }]
    }), res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensagem, /Sérum/);
    assert.ok(log.rolledBack);
    assert.equal(log.committed, false);
});

test('reenviar o mesmo lote não duplica estoque', async (t) => {
    const log = mockConnection(t, (s) => {
        if (s.startsWith('SELECT chave_idempotencia')) return [[{ chave_idempotencia: K1 }, { chave_idempotencia: K2 }]];
        throw new Error('não deveria chegar aqui');
    });
    const res = criarResponse();
    await movimentarEstoqueLoteAdmin(req({
        tipo: 'entrada', motivo: 'Chegada do fornecedor',
        itens: [{ produto_id: 1, quantidade: 3, chave: K1 }, { produto_id: 2, quantidade: 1, chave: K2 }]
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.reutilizado, true);
    assert.equal(log.committed, false);
});

test('busca por código encontra pelo código de barras ou SKU', async (t) => {
    const log = mockConnection(t, () => [[{ id: 5, nome: 'Perfume', codigo_barras: '7891234567895', estoque: 3 }]]);
    const res = criarResponse();
    await buscarProdutoPorCodigoAdmin({ params: { codigo: '7891234567895' } }, res);
    assert.equal(res.body.produto.id, 5);
    assert.deepEqual(log.queries[0].params, ['7891234567895', '7891234567895', '7891234567895']);

    const nao = criarResponse();
    mockConnection(t, () => [[]]);
    await buscarProdutoPorCodigoAdmin({ params: { codigo: '000' } }, nao);
    assert.equal(nao.statusCode, 404);
});
