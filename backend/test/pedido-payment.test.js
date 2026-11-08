const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { criarPedido } = require('../src/controllers/pedidoController');

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

test('registra pedido transacional e retorna Pix pendente calculado com o total salvo', async (t) => {
    const originalGetConnection = pool.getConnection;
    const originalPixKey = process.env.PIX_KEY;
    const orderItems = [];
    const queryLog = [];
    let order;
    let paymentValue;
    let sequenceValue = 0;
    let committed = false;
    let rolledBack = false;

    t.after(() => {
        pool.getConnection = originalGetConnection;
        if (originalPixKey === undefined) {
            delete process.env.PIX_KEY;
        } else {
            process.env.PIX_KEY = originalPixKey;
        }
    });

    process.env.PIX_KEY = '12345678000190';
    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => { rolledBack = true; },
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            queryLog.push(statement);

            if (statement.startsWith('SELECT id, ativo')) {
                return [[{ id: 7, ativo: 1 }], []];
            }
            if (statement.startsWith('SELECT pedido_id, request_hash')) {
                return [[], []];
            }
            if (statement.startsWith('INSERT INTO enderecos')) {
                return [{ insertId: 22 }, []];
            }
            if (statement.startsWith('INSERT INTO pedido_numeracao_sequencial')) {
                sequenceValue += 1;
                return [{ insertId: sequenceValue }, []];
            }
            if (statement.startsWith('UPDATE pedido_numeracao_sequencial')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('SELECT id, nome, preco, preco_promocional, estoque')) {
                return [[{
                    id: 12,
                    nome: 'Produto de teste',
                    preco: '19.90',
                    preco_promocional: null,
                    estoque: 4
                }], []];
            }
            if (statement.startsWith('UPDATE produtos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO pedidos')) {
                order = {
                    id: 101,
                    cliente_id: 7,
                    numero_pedido: params[2],
                    numero_pedido_pix: params[2],
                    numero_exibicao: params[3],
                    status: 'aguardando_pagamento',
                    subtotal: params[4],
                    desconto: 0,
                    frete: 0,
                    total: params[5]
                };
                return [{ insertId: order.id }, []];
            }
            if (statement.startsWith('INSERT INTO itens_pedido')) {
                orderItems.push(params);
                return [{ insertId: orderItems.length }, []];
            }
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) {
                return [{ insertId: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO pagamentos')) {
                paymentValue = params[1];
                return [{ insertId: 303 }, []];
            }
            if (statement.startsWith('INSERT INTO pedido_idempotencia')) {
                return [{ insertId: 1 }, []];
            }
            if (statement.includes('p.id, p.cliente_id, p.numero_exibicao')) {
                return [[{
                    ...order,
                    cliente_nome: 'Cliente Teste',
                    cliente_email: 'cliente@example.com',
                    cliente_telefone: '85999999999'
                }], []];
            }
            if (statement.startsWith('SELECT produto_id, nome_produto, quantidade')) {
                return [[{
                    produto_id: 12,
                    nome_produto: 'Produto de teste',
                    quantidade: 2,
                    preco_unitario: '19.90',
                    subtotal: '39.80'
                }], []];
            }
            if (statement.startsWith('SELECT metodo, status, valor')) {
                return [[{
                    metodo: 'pix',
                    status: 'pendente',
                    valor: String(paymentValue)
                }], []];
            }

            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = criarResponse();
    await criarPedido({
        cliente: { id: 7 },
        body: {
            items: [{ id: 12, quantity: 2 }],
            endereco: {
                nome_destinatario: 'Cliente Teste',
                telefone: '85999999999',
                cep: '60331020',
                rua: 'Rua de Teste',
                numero: '10',
                bairro: 'Barra do Ceará',
                cidade: 'Fortaleza',
                estado: 'CE'
            }
        },
        get: (name) => name === 'Idempotency-Key' ? 'pedido-teste-123' : undefined
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.pedido.numero_pedido, 'AM-000001');
    assert.equal(response.body.pedido.numero_exibicao, 'AM-000001');
    assert.equal(response.body.pagamento.status, 'pendente');
    assert.equal(response.body.pagamento.valor, 39.8);
    assert.equal(response.body.cliente.nome, 'Cliente Teste');
    assert.ok(response.body.pagamento.codigo_copia_cola.startsWith('000201'));
    assert.equal(paymentValue, 39.8);
    assert.equal(orderItems.length, 1);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.ok(queryLog.some((query) => query.startsWith('INSERT INTO pagamentos')));
});

test('salva dois produtos com preços oficiais e subtotais históricos na mesma transação', async (t) => {
    const originalGetConnection = pool.getConnection;
    const originalPixKey = process.env.PIX_KEY;
    const insertedItems = [];
    const productStockUpdates = [];
    let sequenceValue = 4;
    let order;
    let paymentValue;
    let committed = false;

    t.after(() => {
        pool.getConnection = originalGetConnection;
        if (originalPixKey === undefined) delete process.env.PIX_KEY;
        else process.env.PIX_KEY = originalPixKey;
    });

    process.env.PIX_KEY = '12345678000190';
    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            if (statement.startsWith('SELECT id, ativo')) {
                return [[{ id: 7, ativo: 1 }], []];
            }
            if (statement.startsWith('SELECT pedido_id, request_hash')) {
                return [[], []];
            }
            if (statement.startsWith('INSERT INTO enderecos')) {
                return [{ insertId: 22 }, []];
            }
            if (statement.startsWith('INSERT INTO pedido_numeracao_sequencial')) {
                sequenceValue += 1;
                return [{ insertId: sequenceValue }, []];
            }
            if (statement.startsWith('UPDATE pedido_numeracao_sequencial')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('SELECT id, nome, preco, preco_promocional, estoque')) {
                return [[
                    { id: 12, nome: 'Sérum', preco: '19.90', preco_promocional: null, estoque: 4 },
                    { id: 13, nome: 'Hidratante', preco: '10.00', preco_promocional: '5.25', estoque: 5 }
                ], []];
            }
            if (statement.startsWith('UPDATE produtos')) {
                productStockUpdates.push(params);
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO pedidos')) {
                order = {
                    id: 105,
                    cliente_id: 7,
                    numero_pedido: params[2],
                    numero_pedido_pix: params[2],
                    numero_exibicao: params[3],
                    status: 'aguardando_pagamento',
                    subtotal: params[4],
                    desconto: 0,
                    frete: 0,
                    total: params[5]
                };
                return [{ insertId: order.id }, []];
            }
            if (statement.startsWith('INSERT INTO itens_pedido')) {
                insertedItems.push(params);
                return [{ insertId: insertedItems.length }, []];
            }
            if (statement.startsWith('INSERT INTO estoque_movimentacoes')) {
                return [{ insertId: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO pagamentos')) {
                paymentValue = params[1];
                return [{ insertId: 304 }, []];
            }
            if (statement.startsWith('INSERT INTO pedido_idempotencia')) {
                return [{ insertId: 2 }, []];
            }
            if (statement.includes('p.id, p.cliente_id, p.numero_exibicao')) {
                return [[{
                    ...order,
                    cliente_nome: 'Cliente Teste',
                    cliente_email: 'cliente@example.com',
                    cliente_telefone: '85999999999'
                }], []];
            }
            if (statement.startsWith('SELECT produto_id, nome_produto, quantidade')) {
                return [insertedItems.map((item) => ({
                    produto_id: item[1],
                    nome_produto: item[2],
                    quantidade: item[3],
                    preco_unitario: String(item[4]),
                    subtotal: String(item[5])
                })), []];
            }
            if (statement.startsWith('SELECT metodo, status, valor')) {
                return [[{ metodo: 'pix', status: 'pendente', valor: String(paymentValue) }], []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = criarResponse();
    await criarPedido({
        cliente: { id: 7 },
        body: {
            items: [{ id: 12, quantity: 2 }, { id: 13, quantity: 3 }],
            endereco: {
                nome_destinatario: 'Cliente Teste',
                telefone: '85999999999',
                cep: '60331020',
                rua: 'Rua de Teste',
                numero: '10',
                bairro: 'Barra do Ceará',
                cidade: 'Fortaleza',
                estado: 'CE'
            }
        },
        get: (name) => name === 'Idempotency-Key' ? 'pedido-teste-789' : undefined
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.pedido.numero_pedido, 'AM-000005');
    assert.equal(response.body.pedido.numero_exibicao, 'AM-000005');
    assert.equal(response.body.pedido.subtotal, 55.55);
    assert.equal(response.body.pedido.total, 55.55);
    assert.equal(response.body.pagamento.valor, 55.55);
    assert.equal(paymentValue, 55.55);
    assert.deepEqual(response.body.itens.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal
    })), [
        { produto_id: 12, quantidade: 2, preco_unitario: 19.9, subtotal: 39.8 },
        { produto_id: 13, quantidade: 3, preco_unitario: 5.25, subtotal: 15.75 }
    ]);
    assert.equal(insertedItems.length, 2);
    assert.equal(productStockUpdates.length, 2);
    assert.equal(committed, true);
});

test('não registra pedido se PIX_KEY não estiver configurada', async (t) => {
    const originalGetConnection = pool.getConnection;
    const originalPixKey = process.env.PIX_KEY;
    let connected = false;

    t.after(() => {
        pool.getConnection = originalGetConnection;
        if (originalPixKey === undefined) {
            delete process.env.PIX_KEY;
        } else {
            process.env.PIX_KEY = originalPixKey;
        }
    });

    delete process.env.PIX_KEY;
    pool.getConnection = async () => {
        connected = true;
        throw new Error('A conexão não deveria ser chamada.');
    };

    const response = criarResponse();
    await criarPedido({
        cliente: { id: 7 },
        body: {
            items: [{ id: 12, quantity: 1 }],
            endereco: {
                nome_destinatario: 'Cliente Teste',
                telefone: '85999999999',
                cep: '60331020',
                rua: 'Rua de Teste',
                numero: '10',
                bairro: 'Barra do Ceará',
                cidade: 'Fortaleza',
                estado: 'CE'
            }
        },
        get: () => 'pedido-teste-456'
    }, response);

    assert.equal(response.statusCode, 503);
    assert.match(response.body.mensagem, /chave Pix da loja não está configurada/);
    assert.equal(connected, false);
});
