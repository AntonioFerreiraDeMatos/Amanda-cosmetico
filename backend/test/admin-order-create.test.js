const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { criarPedidoAdmin } = require('../src/controllers/adminController');

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

function createRequest(overrides = {}) {
    return {
        admin: { administrador_id: 3 },
        get: () => 'f2d12149-8a47-4a1b-844a-0f47bc82a761',
        body: {
            cliente_id: 7,
            cliente: null,
            endereco: {
                nome_destinatario: 'Cliente Teste',
                telefone: '85999999999',
                cep: '60331020',
                rua: 'Rua de Teste',
                numero: '35',
                complemento: '',
                bairro: 'Centro',
                cidade: 'Fortaleza',
                estado: 'CE'
            },
            itens: [{ produto_id: 21, quantidade: 2 }],
            observacoes: 'Entregar pela manhã.',
            ...overrides
        }
    };
}

test('cadastra pedido administrativo e reserva estoque em uma transação', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    let committed = false;
    let rolledBack = false;
    let idempotencyRecord = null;
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
            if (statement.startsWith('SELECT id, nome, email, telefone, ativo FROM clientes')) {
                return [[{ id: 7, nome: 'Cliente Teste', email: 'cliente@example.com', telefone: '85999999999', ativo: 1 }], []];
            }
            if (statement.startsWith('INSERT INTO enderecos')) return [{ insertId: 30 }, []];
            if (statement.startsWith('SELECT id, nome, preco, preco_promocional, estoque')) {
                return [[{ id: 21, nome: 'Creme', preco: '28.00', preco_promocional: null, estoque: 8 }], []];
            }
            if (statement.startsWith('UPDATE produtos SET estoque = estoque -')) return [{ affectedRows: 1 }, []];
            if (statement.startsWith('INSERT INTO pedido_numeracao_sequencial')) return [{ insertId: 12 }, []];
            if (statement.startsWith('INSERT INTO pedidos')) return [{ insertId: 50 }, []];
            if (statement.startsWith('UPDATE pedido_numeracao_sequencial')) return [{ affectedRows: 1 }, []];
            if (statement.startsWith('INSERT INTO itens_pedido')) return [{ insertId: 1 }, []];
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) return [{ insertId: 1 }, []];
            if (statement.startsWith('INSERT INTO pagamentos')) return [{ insertId: 1 }, []];
            if (statement.startsWith('SELECT pedido_id, request_hash')) {
                return [idempotencyRecord ? [idempotencyRecord] : [], []];
            }
            if (statement.startsWith('SELECT p.id, p.numero_exibicao AS numero_pedido')) {
                return [[{
                    id: 50,
                    numero_pedido: 'AM-000012',
                    total: '56.00',
                    status: 'aguardando_pagamento',
                    cliente_id: 7,
                    cliente_nome: 'Cliente Teste',
                    pagamento_status: 'pendente'
                }], []];
            }
            if (statement.startsWith('INSERT INTO pedido_idempotencia')) {
                idempotencyRecord = { pedido_id: params[2], request_hash: params[3] };
                return [{ insertId: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) return [{ insertId: 1 }, []];
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await criarPedidoAdmin(createRequest(), response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.pedido.total, 56);
    assert.equal(response.body.pedido.status, 'aguardando_pagamento');
    assert.equal(response.body.pedido.pagamento_status, 'pendente');
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    const stockUpdate = statements.find(({ statement }) => statement.startsWith('UPDATE produtos SET estoque = estoque -'));
    assert.deepEqual(stockUpdate.params, [2, 21, 2]);
    assert.ok(statements.some(({ statement }) => statement.startsWith('INSERT INTO admin_auditoria')));

    const retryResponse = createResponse();
    await criarPedidoAdmin(createRequest(), retryResponse);
    assert.equal(retryResponse.statusCode, 200);
    assert.equal(retryResponse.body.reutilizado, true);
    assert.equal(statements.filter(({ statement }) => statement.startsWith('UPDATE produtos SET estoque = estoque -')).length, 1);
});

test('cadastra novo cliente por nome e telefone junto com o pedido', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            statements.push({ statement, params });
            if (statement.startsWith('SELECT id, nome, email, telefone, ativo FROM clientes') &&
                statement.includes('WHERE email = ?')) return [[], []];
            if (statement.startsWith('INSERT INTO clientes')) return [{ insertId: 71 }, []];
            if (statement.startsWith('INSERT INTO enderecos')) return [{ insertId: 30 }, []];
            if (statement.startsWith('SELECT id, nome, preco, preco_promocional, estoque')) {
                return [[{ id: 21, nome: 'Creme', preco: '28.00', preco_promocional: null, estoque: 8 }], []];
            }
            if (statement.startsWith('UPDATE produtos SET estoque = estoque -')) return [{ affectedRows: 1 }, []];
            if (statement.startsWith('INSERT INTO pedido_numeracao_sequencial')) return [{ insertId: 13 }, []];
            if (statement.startsWith('INSERT INTO pedidos')) return [{ insertId: 51 }, []];
            if (statement.startsWith('UPDATE pedido_numeracao_sequencial')) return [{ affectedRows: 1 }, []];
            if (statement.startsWith('INSERT INTO itens_pedido')) return [{ insertId: 1 }, []];
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) return [{ insertId: 1 }, []];
            if (statement.startsWith('INSERT INTO pagamentos')) return [{ insertId: 1 }, []];
            if (statement.startsWith('SELECT pedido_id, request_hash')) return [[], []];
            if (statement.startsWith('INSERT INTO pedido_idempotencia')) return [{ insertId: 1 }, []];
            if (statement.startsWith('INSERT INTO admin_auditoria')) return [{ insertId: 1 }, []];
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await criarPedidoAdmin(createRequest({
        cliente_id: null,
        cliente: { nome: 'Nova Cliente', email: '', telefone: '(85) 98888-7777' }
    }), response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.pedido.cliente_id, 71);
    const customerInsert = statements.find(({ statement }) => statement.startsWith('INSERT INTO clientes'));
    assert.deepEqual(customerInsert.params, [
        'Nova Cliente',
        'telefone-85988887777@cliente.amanda.local',
        '85988887777',
        '85988887777'
    ]);
});

test('rejeita pedido sem endereço válido antes de acessar o banco', async (t) => {
    const originalGetConnection = pool.getConnection;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });
    pool.getConnection = async () => {
        throw new Error('Não deve consultar o banco.');
    };

    const response = createResponse();
    await criarPedidoAdmin(createRequest({
        endereco: { nome_destinatario: 'Incompleto' }
    }), response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.mensagem, /endereço/i);
});
