const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { atualizarDetalhesPedidoAdmin } = require('../src/controllers/adminController');

function criarResponse() {
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

test('salva observações e corrige entrega sem editar endereços históricos compartilhados', async (t) => {
    const originalGetConnection = pool.getConnection;
    let committed = false;
    let rolledBack = false;
    const statements = [];

    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => { rolledBack = true; },
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            statements.push({ statement, params });
            if (statement.startsWith('SELECT id, cliente_id FROM pedidos')) {
                return [[{ id: 45, cliente_id: 7 }], []];
            }
            if (statement.includes('SELECT p.observacoes, e.nome_destinatario')) {
                return [[{
                    observacoes: null,
                    nome_destinatario: 'Cliente anterior',
                    telefone: '85988888888',
                    cep: '60000000',
                    rua: 'Rua anterior',
                    numero: '10',
                    complemento: null,
                    bairro: 'Centro',
                    cidade: 'Fortaleza',
                    estado: 'CE'
                }], []];
            }
            if (statement.startsWith('INSERT INTO enderecos')) {
                return [{ insertId: 99 }, []];
            }
            if (statement.startsWith('UPDATE pedidos SET endereco_id')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 1 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = criarResponse();
    await atualizarDetalhesPedidoAdmin({
        params: { id: '45' },
        admin: { administrador_id: 3 },
        body: {
            observacoes: 'Entregar após as 18h.',
            endereco: {
                nome_destinatario: 'Cliente Teste',
                telefone: '(85) 99999-9999',
                cep: '60331-020',
                rua: 'Rua de Teste',
                numero: '35',
                complemento: 'Apto 2',
                bairro: 'Barra do Ceará',
                cidade: 'Fortaleza',
                estado: 'CE'
            }
        }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.equal(statements.length, 5);
    assert.equal(statements[2].params[2], '85999999999');
    assert.equal(statements[2].params[3], '60331020');
    assert.deepEqual(statements[3].params, [99, 'Entregar após as 18h.', 45]);
    assert.equal(statements[4].params[1], 'pedido.dados_atualizados');
});

test('rejeita endereço incompleto sem acessar o banco', async (t) => {
    const originalGetConnection = pool.getConnection;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => {
        throw new Error('Não deve consultar o banco.');
    };
    const response = criarResponse();

    await atualizarDetalhesPedidoAdmin({
        params: { id: '45' },
        body: { observacoes: '', endereco: { nome_destinatario: 'Cliente' } }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.mensagem, /endereço/i);
});
