const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    relatorioVendas,
    relatorioPedidos,
    relatorioEstoque,
    relatorioAtencao,
    exportarPedidosCsv,
    variacao
} = require('../src/controllers/relatorioController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        send(body) { this.body = body; return this; }
    };
}

function mockPool(t, handler) {
    const originalQuery = pool.query;
    const originalGetConnection = pool.getConnection;
    t.after(() => {
        pool.query = originalQuery;
        pool.getConnection = originalGetConnection;
    });
    const calls = [];
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        calls.push({ statement, params });
        return handler(statement, params);
    };
    return calls;
}

test('variação percentual é nula sem base de comparação', () => {
    assert.equal(variacao(150, 100), 50);
    assert.equal(variacao(50, 100), -50);
    assert.equal(variacao(10, 0), null);
});

test('série de vendas preenche dias sem venda e compara com o período anterior', async (t) => {
    const calls = mockPool(t, (statement, params) => {
        if (statement.includes('DATE(DATE_ADD(pg.pago_em')) {
            assert.equal(params[0], -180);
            assert.equal(params[1], '2026-11-01 03:00:00');
            assert.equal(params[2], '2026-11-04 03:00:00');
            return [[{ dia: new Date('2026-11-02T00:00:00Z'), faturamento: '100.00', pedidos_pagos: 2 }], []];
        }
        if (statement.includes('DATE(DATE_ADD(p.criado_em')) {
            return [[{ dia: '2026-11-03', pedidos_criados: 4 }], []];
        }
        if (statement.includes('FROM itens_pedido i')) {
            return [[{ produto_id: 9, nome: 'Sérum', unidades: '3', faturamento: '90.00' }], []];
        }
        if (statement.startsWith('SELECT COALESCE(SUM(pg.valor), 0) AS faturamento')) {
            return params[0] === '2026-11-01 03:00:00'
                ? [[{ faturamento: '100.00', pedidos_pagos: 2 }], []]
                : [[{ faturamento: '50.00', pedidos_pagos: 1 }], []];
        }
        throw new Error(`Consulta não simulada: ${statement}`);
    });

    const res = createResponse();
    await relatorioVendas({ query: { periodo: 'personalizado', inicio: '2026-11-01', fim: '2026-11-03' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.serie, [
        { data: '2026-11-01', faturamento: 0, pedidos_pagos: 0, pedidos_criados: 0 },
        { data: '2026-11-02', faturamento: 100, pedidos_pagos: 2, pedidos_criados: 0 },
        { data: '2026-11-03', faturamento: 0, pedidos_pagos: 0, pedidos_criados: 4 }
    ]);
    assert.deepEqual(res.body.totais.atual, { faturamento: 100, pedidos_pagos: 2, ticket_medio: 50 });
    assert.deepEqual(res.body.totais.anterior, { faturamento: 50, pedidos_pagos: 1, ticket_medio: 50 });
    assert.equal(res.body.totais.variacao.faturamento, 100);
    assert.equal(res.body.top_produtos[0].unidades, 3);
    assert.equal(res.body.periodo.anterior.inicio, '2026-10-29');
    // Nenhuma consulta altera dados.
    assert.ok(calls.every(({ statement }) => statement.startsWith('SELECT')));
});

test('relatório de vendas rejeita período inválido sem consultar o banco', async (t) => {
    const calls = mockPool(t, () => { throw new Error('não deveria consultar'); });
    const res = createResponse();
    await relatorioVendas({ query: { periodo: 'personalizado', inicio: '2026-11-05', fim: '2026-11-01' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

test('pedidos por status lista todos os status e calcula taxa de Pix aprovado', async (t) => {
    mockPool(t, (statement) => {
        if (statement.startsWith('SELECT p.status, COUNT(*)')) {
            return [[{ status: 'pago', total: 3 }, { status: 'cancelado', total: 1 }], []];
        }
        if (statement.startsWith('SELECT COUNT(*) AS criados')) {
            return [[{ criados: 10, nao_cancelados: 9, aprovados: 4, valor_aprovado: '200.00', cancelados: 1 }], []];
        }
        throw new Error(`Consulta não simulada: ${statement}`);
    });

    const res = createResponse();
    await relatorioPedidos({ query: { periodo: '30' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.por_status.length, 7);
    assert.equal(res.body.por_status.find((s) => s.status === 'pago').total, 3);
    assert.equal(res.body.por_status.find((s) => s.status === 'enviado').total, 0);
    assert.equal(res.body.totais.atual.taxa_pagamento_aprovado, 40);
    assert.equal(res.body.totais.atual.ticket_medio, 50);
});

test('estoque valida dias sem venda', async (t) => {
    mockPool(t, () => { throw new Error('não deveria consultar'); });
    const res = createResponse();
    await relatorioEstoque({ query: { dias_sem_venda: '0' } }, res);
    assert.equal(res.statusCode, 400);
});

test('atenção do dia agrupa Pix pendente, pedidos para separar, parados e estoque baixo', async (t) => {
    mockPool(t, (statement) => {
        if (statement.startsWith('SELECT COUNT(*) AS total FROM produtos')) return [[{ total: 2 }], []];
        if (statement.startsWith('SELECT COUNT(*) AS total FROM pedidos')) return [[{ total: 1 }], []];
        if (statement.includes('FROM pedidos p INNER JOIN clientes c')) {
            return [[{
                id: 5, numero_exibicao: 'AM-000005', status: 'aguardando_pagamento', total: '30.00',
                cliente_nome: 'Ana', cliente_telefone: '85999999999', pagamento_status: 'pendente',
                criado_em: new Date(), atualizado_em: new Date()
            }], []];
        }
        throw new Error(`Consulta não simulada: ${statement}`);
    });

    const res = createResponse();
    await relatorioAtencao({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.dias_parado, 3);
    assert.equal(res.body.aguardando_pix.total, 1);
    assert.equal(res.body.aguardando_pix.pedidos[0].numero_exibicao, 'AM-000005');
    assert.equal(res.body.estoque_baixo.total, 2);
});

test('exportação de pedidos gera CSV seguro e registra a exportação na auditoria', async (t) => {
    const audits = [];
    mockPool(t, (statement) => {
        if (statement.includes('GROUP_CONCAT')) {
            return [[{
                id: 1, numero_exibicao: 'AM-000001', status: 'pago', subtotal: '10.00', desconto: '0.00',
                frete: '0.00', total: '10.00', criado_em: new Date('2026-11-02T12:00:00Z'),
                cliente_nome: '=cmd|calc', cliente_email: 'telefone-85@cliente.amanda.local',
                cliente_telefone: '85999999999', telefone_entrega: null, cidade: 'Fortaleza', estado: 'CE',
                pagamento_status: 'aprovado', pago_em: null, itens: 'Sérum x1'
            }], []];
        }
        throw new Error(`Consulta não simulada: ${statement}`);
    });
    pool.getConnection = async () => ({
        query: async (sql, params) => { audits.push(params); return [{ insertId: 1 }, []]; },
        release: () => {}
    });

    const res = createResponse();
    await exportarPedidosCsv({ query: { periodo: '7' }, admin: { administrador_id: 3 } }, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /attachment; filename="pedidos_/);
    assert.ok(res.body.startsWith('﻿Número;Data;Cliente'));
    assert.ok(res.body.includes("'=cmd|calc"));
    assert.ok(!res.body.includes('cliente.amanda.local'));
    assert.ok(res.body.includes('02/11/2026 09:00'));
    assert.equal(audits.length, 1);
    assert.equal(audits[0][1], 'exportacao.pedidos');
});
