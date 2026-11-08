const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { confirmarPagamentoPixAdmin } = require('../src/controllers/adminController');

test('confirma Pix pendente somente pelo fluxo administrativo', async (t) => {
    const originalGetConnection = pool.getConnection;
    const updates = [];
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
            if (statement.startsWith('SELECT id, status') && statement.includes('FROM pedidos')) {
                return [[{ id: 101, status: 'aguardando_pagamento' }], []];
            }
            if (statement.startsWith('SELECT id, status') && statement.includes('FROM pagamentos')) {
                return [[{
                    id: 303,
                    status: 'pendente',
                    valor: '25.50',
                    pago_em: null
                }], []];
            }
            if (statement.startsWith('UPDATE pagamentos')) {
                updates.push('pagamento');
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('UPDATE pedidos')) {
                updates.push('pedido');
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 1 }, []];
            }

            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = {
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

    await confirmarPagamentoPixAdmin({
        params: { id: '101' },
        admin: { administrador_id: 3 }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sucesso, true);
    assert.equal(response.body.mensagem, 'Pagamento Pix confirmado.');
    assert.deepEqual(updates, ['pagamento', 'pedido']);
    assert.equal(committed, true);
});
