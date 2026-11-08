const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { excluirPedidoAdmin } = require('../src/controllers/adminController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function mockConnection(t, { pedido, pagos = 0 }) {
    const original = pool.getConnection;
    const state = { statements: [], committed: false };
    t.after(() => { pool.getConnection = original; });
    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { state.committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql) => {
            const s = sql.trim();
            state.statements.push(s);
            if (s.startsWith('SELECT id, numero_exibicao, status')) return [pedido ? [pedido] : [], []];
            if (s.startsWith('SELECT COUNT(*) AS total FROM pagamentos')) return [[{ total: pagos }], []];
            if (s.startsWith('INSERT INTO admin_auditoria')) return [{ insertId: 1 }, []];
            if (s.startsWith('DELETE FROM pedidos')) return [{ affectedRows: 1 }, []];
            throw new Error(`Consulta não simulada: ${s}`);
        }
    });
    return state;
}

const req = (id) => ({ params: { id }, admin: { administrador_id: 1 }, body: { motivo: 'Pedido de teste.' } });

test('exclui pedido cancelado sem pagamento aprovado, com auditoria', async (t) => {
    const state = mockConnection(t, { pedido: { id: 9, numero_exibicao: 'AM-000009', status: 'cancelado', total: '10.00', cliente_id: 2 } });
    const res = createResponse();
    await excluirPedidoAdmin(req('9'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(state.committed, true);
    assert.ok(state.statements.some((s) => s.startsWith('INSERT INTO admin_auditoria')));
    assert.ok(state.statements.some((s) => s.startsWith('DELETE FROM pedidos')));
});

test('recusa excluir pedido que não está cancelado', async (t) => {
    const state = mockConnection(t, { pedido: { id: 9, numero_exibicao: 'AM-000009', status: 'pago', total: '10.00', cliente_id: 2 } });
    const res = createResponse();
    await excluirPedidoAdmin(req('9'), res);
    assert.equal(res.statusCode, 400);
    assert.ok(!state.statements.some((s) => s.startsWith('DELETE')));
});

test('recusa excluir pedido com pagamento aprovado', async (t) => {
    const state = mockConnection(t, { pedido: { id: 9, numero_exibicao: 'AM-000009', status: 'cancelado', total: '10.00', cliente_id: 2 }, pagos: 1 });
    const res = createResponse();
    await excluirPedidoAdmin(req('9'), res);
    assert.equal(res.statusCode, 409);
    assert.ok(!state.statements.some((s) => s.startsWith('DELETE')));
});

test('retorna 404 para pedido inexistente e 400 para id inválido', async (t) => {
    mockConnection(t, { pedido: null });
    const res = createResponse();
    await excluirPedidoAdmin(req('9'), res);
    assert.equal(res.statusCode, 404);
    const bad = createResponse();
    await excluirPedidoAdmin(req('abc'), bad);
    assert.equal(bad.statusCode, 400);
});
