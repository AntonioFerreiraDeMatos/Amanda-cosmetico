const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    listarPedidosAdmin,
    detalhePedidoAdmin
} = require('../src/controllers/adminController');

test('admin orders endpoint includes customer, delivery, payment and item details', async (t) => {
    const originalQuery = pool.query;
    const queries = [];

    t.after(() => {
        pool.query = originalQuery;
    });

    pool.query = async (sql, params = []) => {
        const statement = sql.trim();
        queries.push({ statement, params });

        if (statement.startsWith('SELECT COUNT(*) AS total')) {
            return [[{ total: 1 }], []];
        }

        if (statement.startsWith('SELECT') && statement.includes('FROM pedidos p')) {
            assert.deepEqual(params, [
                '%Cliente Teste%',
                '%Cliente Teste%',
                '%Cliente Teste%',
                '%Cliente Teste%',
                '%Cliente Teste%',
                'aguardando_pagamento',
                25,
                0
            ]);
            return [[{
                id: 45,
                numero_pedido: 'AM-000001',
                numero_exibicao: 'AM-000001',
                status: 'aguardando_pagamento',
                subtotal: '59.80',
                desconto: '0.00',
                frete: '0.00',
                total: '59.80',
                cliente_nome: 'Cliente Teste',
                cliente_email: 'cliente@example.com',
                cliente_telefone: '85999999999',
                nome_destinatario: 'Cliente Teste',
                telefone_entrega: '85999999999',
                cep: '60331020',
                rua: 'Rua de Teste',
                numero: '35',
                complemento: null,
                bairro: 'Barra do Ceará',
                cidade: 'Fortaleza',
                estado: 'CE',
                pagamento_status: 'pendente',
                pagamento_metodo: 'pix'
            }], []];
        }

        if (statement.startsWith('SELECT pedido_id, produto_id, nome_produto')) {
            assert.deepEqual(params, [45]);
            return [[{
                pedido_id: 45,
                produto_id: 8,
                nome_produto: 'Hidratante',
                quantidade: 2,
                preco_unitario: '29.90',
                subtotal: '59.80'
            }], []];
        }

        throw new Error(`Consulta não simulada no teste: ${statement}`);
    };

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

    await listarPedidosAdmin({
        query: {
            q: 'Cliente Teste',
            status: 'aguardando_pagamento'
        }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pedidos.length, 1);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.pagina, 1);
    assert.equal(response.body.totalPaginas, 1);
    assert.equal(response.body.pedidos[0].cliente_nome, 'Cliente Teste');
    assert.equal(response.body.pedidos[0].cep, '60331020');
    assert.equal(response.body.pedidos[0].pagamento_status, 'pendente');
    assert.deepEqual(response.body.pedidos[0].itens, [{
        produto_id: 8,
        nome_produto: 'Hidratante',
        quantidade: 2,
        preco_unitario: 29.9,
        subtotal: 59.8
    }]);
    assert.match(queries[0].statement, /p\.status = \?/);
    assert.match(queries[1].statement, /LIMIT \? OFFSET \?/);
});

test('rejects invalid order filters without querying the database', async (t) => {
    const originalQuery = pool.query;
    t.after(() => {
        pool.query = originalQuery;
    });

    pool.query = async () => {
        throw new Error('Não deve consultar a base para um filtro inválido.');
    };

    const response = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    await listarPedidosAdmin({ query: { status: 'status-inválido' } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.sucesso, false);
});

test('admin order details include customer, delivery, payment and item snapshots', async (t) => {
    const originalQuery = pool.query;
    t.after(() => {
        pool.query = originalQuery;
    });

    pool.query = async (sql, params = []) => {
        const statement = sql.trim();
        if (statement.includes('FROM pedidos p') && statement.includes('WHERE p.id = ?')) {
            assert.deepEqual(params, [45]);
            return [[{
                id: 45,
                numero_pedido: 'AM-000001',
                numero_exibicao: 'AM-000001',
                status: 'aguardando_pagamento',
                cliente_nome: 'Cliente Teste',
                cliente_email: 'cliente@example.com',
                cliente_telefone: '85999999999',
                pagamento_metodo: 'pix',
                pagamento_status: 'pendente',
                pagamento_valor: '59.80',
                rua: 'Rua de Teste',
                numero: '35',
                cep: '60331020'
            }], []];
        }
        if (statement.startsWith('SELECT produto_id, nome_produto')) {
            return [[{
                produto_id: 2,
                nome_produto: 'Hidratante',
                quantidade: 2,
                preco_unitario: '29.90',
                subtotal: '59.80'
            }], []];
        }
        throw new Error(`Consulta não simulada no teste: ${statement}`);
    };

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

    await detalhePedidoAdmin({ params: { id: '45' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pedido.cliente_nome, 'Cliente Teste');
    assert.equal(response.body.pedido.pagamento_status, 'pendente');
    assert.equal(response.body.pedido.itens[0].subtotal, 59.8);
});
