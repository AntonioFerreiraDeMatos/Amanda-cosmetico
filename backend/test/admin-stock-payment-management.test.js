const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    reverterPagamentoPixAdmin,
    movimentarEstoqueAdmin
} = require('../src/controllers/adminController');

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

test('reverte Pix aprovado para pendente com auditoria e recalcula pedido', async (t) => {
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
                return [[{ id: 12, status: 'pago' }], []];
            }
            if (statement.startsWith('SELECT id, status, valor, pago_em')) {
                return [[{ id: 31, status: 'aprovado', valor: '49.90', pago_em: '2026-10-30 12:00:00' }], []];
            }
            if (statement.startsWith('UPDATE pagamentos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('UPDATE pedidos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 7 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await reverterPagamentoPixAdmin({
        params: { id: '12' },
        admin: { administrador_id: 3 },
        body: { motivo: 'Confirmação lançada por engano.' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
    assert.ok(statements.some((sql) => sql.includes("SET status = 'pendente', pago_em = NULL")));
    assert.ok(statements.some((sql) => sql.includes("SET status = 'aguardando_pagamento'")));
    assert.ok(statements.some((sql) => sql.startsWith('INSERT INTO admin_auditoria')));
});

test('registra entrada de estoque com quantidades e motivo na mesma transação', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    let committed = false;
    let stock = 4;
    let previousMovement = null;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            statements.push({ statement, params });
            if (statement.startsWith('SELECT id, estoque FROM produtos')) {
                return [[{ id: 21, estoque: stock }], []];
            }
            if (statement.startsWith('SELECT produto_id, tipo, quantidade_anterior')) {
                return [previousMovement ? [previousMovement] : [], []];
            }
            if (statement.startsWith('UPDATE produtos')) {
                stock = params[0];
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) {
                previousMovement = {
                    produto_id: params[0],
                    tipo: params[2],
                    quantidade_anterior: params[3],
                    quantidade_nova: params[4],
                    diferenca: params[5],
                    motivo: params[6]
                };
                return [{ insertId: 9 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 10 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    const request = {
        admin: { administrador_id: 3 },
        get: () => 'f2d12149-8a47-4a1b-844a-0f47bc82a761',
        body: { produto_id: 21, tipo: 'entrada', quantidade: 6, motivo: 'Reposição recebida.' }
    };
    await movimentarEstoqueAdmin(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.estoque_anterior, 4);
    assert.equal(response.body.estoque, 10);
    assert.equal(committed, true);
    const update = statements.find(({ statement }) => statement.startsWith('UPDATE produtos'));
    assert.deepEqual(update.params, [10, 21]);
    const movement = statements.find(({ statement }) => statement.startsWith('INSERT INTO estoque_movimentacoes'));
    assert.deepEqual(movement.params, [
        21, 3, 'entrada', 4, 10, 6, 'Reposição recebida.',
        'f2d12149-8a47-4a1b-844a-0f47bc82a761'
    ]);

    const retryResponse = createResponse();
    await movimentarEstoqueAdmin(request, retryResponse);
    assert.equal(retryResponse.statusCode, 200);
    assert.equal(retryResponse.body.reutilizado, true);
    assert.equal(statements.filter(({ statement }) => statement.startsWith('UPDATE produtos')).length, 1);
});

test('bloqueia saída maior que o estoque disponível', async (t) => {
    const originalGetConnection = pool.getConnection;
    let rolledBack = false;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => { rolledBack = true; },
        release: () => {},
        query: async (sql) => {
            if (sql.trim().startsWith('SELECT id, estoque FROM produtos')) {
                return [[{ id: 21, estoque: 4 }], []];
            }
            if (sql.trim().startsWith('SELECT produto_id, tipo, quantidade_anterior')) {
                return [[], []];
            }
            throw new Error(`Consulta não esperada no teste: ${sql}`);
        }
    });

    const response = createResponse();
    await movimentarEstoqueAdmin({
        admin: { administrador_id: 3 },
        get: () => 'f2d12149-8a47-4a1b-844a-0f47bc82a762',
        body: { produto_id: 21, tipo: 'saida', quantidade: 5, motivo: 'Uso interno.' }
    }, response);

    assert.equal(response.statusCode, 409);
    assert.equal(rolledBack, true);
});
