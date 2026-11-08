const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { consultarPedido } = require('../src/controllers/pedidoController');

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

test('recupera os dados e o Pix pendente somente para o cliente dono do pedido', async (t) => {
    const originalGetConnection = pool.getConnection;
    const originalPixKey = process.env.PIX_KEY;
    const queries = [];

    t.after(() => {
        pool.getConnection = originalGetConnection;
        if (originalPixKey === undefined) delete process.env.PIX_KEY;
        else process.env.PIX_KEY = originalPixKey;
    });

    process.env.PIX_KEY = '12345678000190';
    pool.getConnection = async () => ({
        release() {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            queries.push({ statement, params });
            if (statement.includes('p.id, p.cliente_id, p.numero_exibicao')) {
                return [[{
                    id: 101,
                    cliente_id: 7,
                    numero_pedido: 'AM-000001',
                    numero_pedido_pix: 'AM-20261101-123456',
                    numero_exibicao: 'AM-000001',
                    status: 'aguardando_pagamento',
                    subtotal: '49.80',
                    desconto: '0.00',
                    frete: '0.00',
                    total: '49.80',
                    criado_em: '2026-11-01 14:30:00',
                    cliente_nome: 'Cliente Teste',
                    cliente_email: 'cliente@example.com',
                    cliente_telefone: '85999999999',
                    nome_destinatario: 'Cliente Teste',
                    endereco_telefone: '85999999999',
                    cep: '60331020',
                    rua: 'Rua de Teste',
                    numero: '35',
                    complemento: 'Apto 2',
                    bairro: 'Barra do Ceará',
                    cidade: 'Fortaleza',
                    estado: 'CE',
                    pais: 'Brasil'
                }], []];
            }
            if (statement.includes('SELECT produto_id, nome_produto')) {
                return [[{
                    produto_id: 12,
                    nome_produto: 'Hidratante Corporal',
                    quantidade: 2,
                    preco_unitario: '24.90',
                    subtotal: '49.80'
                }], []];
            }
            if (statement.includes('SELECT metodo, status, valor')) {
                return [[{ metodo: 'pix', status: 'pendente', valor: '49.80' }], []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = criarResponse();
    await consultarPedido({ cliente: { id: 7 }, params: { id: '101' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pedido.numero_pedido, 'AM-000001');
    assert.equal(response.body.itens[0].subtotal, 49.8);
    assert.equal(response.body.endereco.cep, '60331020');
    assert.equal(response.body.pagamento.valor, 49.8);
    assert.ok(response.body.pagamento.codigo_copia_cola.startsWith('000201'));
    assert.equal(queries[0].params[1], 7);
});

test('não revela pedido pertencente a outro cliente', async (t) => {
    const originalGetConnection = pool.getConnection;

    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    let queries = 0;
    pool.getConnection = async () => ({
        release() {},
        query: async () => {
            queries += 1;
            return [[], []];
        }
    });

    const response = criarResponse();
    await consultarPedido({ cliente: { id: 8 }, params: { id: '101' } }, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.mensagem, 'Pedido não encontrado.');
    assert.equal(queries, 1);
});
