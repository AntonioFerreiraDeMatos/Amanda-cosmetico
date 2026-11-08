const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { atualizarProdutoAdmin } = require('../src/controllers/adminController');

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

test('registra em auditoria e no histórico toda alteração de estoque pelo editor de produto', async (t) => {
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
        query: async (sql, params = []) => {
            const statement = sql.trim();
            statements.push({ statement, params });
            if (statement.startsWith('SELECT id FROM categorias')) {
                return [[{ id: 2 }], []];
            }
            if (statement.startsWith('SELECT id, categoria_id, nome, descricao')) {
                return [[{
                    id: 14,
                    categoria_id: 2,
                    nome: 'Produto',
                    descricao: null,
                    sku: 'SKU-14',
                    preco: '20.00',
                    preco_promocional: null,
                    estoque: 4,
                    estoque_minimo: 2,
                    ativo: 1,
                    destaque: 0
                }], []];
            }
            if (statement.startsWith('UPDATE produtos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) {
                return [{ insertId: 5 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 6 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await atualizarProdutoAdmin({
        params: { id: '14' },
        admin: { administrador_id: 3 },
        body: {
            nome: 'Produto',
            categoria_id: 2,
            preco: '20.00',
            preco_promocional: '',
            estoque: 9,
            estoque_minimo: 2,
            sku: 'SKU-14',
            descricao: '',
            motivo_estoque: 'Reposição conferida.'
        }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
    const movement = statements.find(({ statement }) => statement.startsWith('INSERT INTO estoque_movimentacoes'));
    assert.deepEqual(movement.params, [14, 3, 4, 9, 5, 'Reposição conferida.']);
    assert.ok(statements.some(({ statement }) => statement.startsWith('INSERT INTO admin_auditoria')));
});
