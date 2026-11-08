const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { atualizarStatusPedidoAdmin } = require('../src/controllers/adminController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('cancels only an unpaid order and returns reserved stock atomically', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    let committed = false;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql) => {
            const statement = sql.trim();
            statements.push(statement);
            if (statement.startsWith('SELECT id, status FROM pedidos')) {
                return [[{ id: 8, status: 'aguardando_pagamento' }], []];
            }
            if (statement.startsWith('SELECT id, status FROM pagamentos')) {
                return [[{ id: 13, status: 'pendente' }], []];
            }
            if (statement.startsWith('SELECT produto_id, quantidade')) {
                return [[{ produto_id: 21, quantidade: 2 }], []];
            }
            if (statement.startsWith('SELECT estoque FROM produtos')) {
                return [[{ estoque: 4 }], []];
            }
            if (statement.startsWith('UPDATE produtos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('UPDATE pagamentos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('UPDATE pedidos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO estoque_movimentacoes') ||
                statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 1 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await atualizarStatusPedidoAdmin({
        params: { id: '8' },
        admin: { administrador_id: 3 },
        body: { status: 'cancelado', motivo: 'Cancelamento solicitado pelo cliente.' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
    assert.ok(statements.some((sql) => sql.includes('estoque = estoque + ?')));
    assert.ok(statements.some((sql) => sql.includes("status = 'cancelado'")));
});

test('does not let the generic status endpoint approve a Pix payment', async (t) => {
    const originalGetConnection = pool.getConnection;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });
    pool.getConnection = async () => {
        throw new Error('A confirmação do Pix deve permanecer em endpoint separado.');
    };

    const response = createResponse();
    await atualizarStatusPedidoAdmin({
        params: { id: '8' },
        body: { status: 'pago' }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.sucesso, false);
});

test('advances a paid order only when the Pix is approved', async (t) => {
    const originalGetConnection = pool.getConnection;
    let committed = false;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });
    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql) => {
            const statement = sql.trim();
            if (statement.startsWith('SELECT id, status FROM pedidos')) {
                return [[{ id: 8, status: 'pago' }], []];
            }
            if (statement.startsWith('SELECT id FROM pagamentos')) {
                return [[{ id: 13 }], []];
            }
            if (statement.startsWith('UPDATE pedidos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 1 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await atualizarStatusPedidoAdmin({
        params: { id: '8' },
        admin: { administrador_id: 3 },
        body: { status: 'processando' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
});
