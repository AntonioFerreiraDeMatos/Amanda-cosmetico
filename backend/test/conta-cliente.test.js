const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/database');
const conta = require('../src/controllers/contaController');
const { autenticarCliente } = require('../src/middlewares/auth');
const contaRoutes = require('../src/routes/contaRoutes');

function criarResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function mockPool(t, handler) {
    const originalQuery = pool.query;
    const originalGetConnection = pool.getConnection;
    const queries = [];
    const query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        queries.push({ statement, params });
        return handler(statement, params);
    };
    pool.query = query;
    pool.getConnection = async () => ({
        query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release() {}
    });
    t.after(() => {
        pool.query = originalQuery;
        pool.getConnection = originalGetConnection;
    });
    return queries;
}

test('rotas da conta exigem token de cliente e recusam token administrativo', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-com-mais-de-32-caracteres';

    const semToken = criarResponse();
    let chamou = false;
    autenticarCliente({ headers: {} }, semToken, () => { chamou = true; });
    assert.equal(semToken.statusCode, 401);
    assert.equal(chamou, false);

    const tokenAdmin = jwt.sign({ tipo: 'administrador', administrador_id: 1, cliente_id: 1 }, process.env.JWT_SECRET);
    const admin = criarResponse();
    autenticarCliente({ headers: { authorization: `Bearer ${tokenAdmin}` } }, admin, () => { chamou = true; });
    assert.equal(admin.statusCode, 401);
    assert.equal(chamou, false);

    const primeiraCamada = contaRoutes.stack[0];
    assert.equal(primeiraCamada.handle, autenticarCliente);
});

test('não existe rota de cliente para alterar pagamento ou status', () => {
    const rotas = contaRoutes.stack
        .filter((layer) => layer.route)
        .map((layer) => `${Object.keys(layer.route.methods).join(',')} ${layer.route.path}`);
    for (const rota of rotas) {
        assert.doesNotMatch(rota, /pagamento|status|confirmar|pix/i);
    }
    assert.ok(!rotas.some((r) => /^(put|patch|post|delete) \/pedidos/.test(r)));
});

test('detalhe de pedido de outro cliente responde 404 e consulta sempre com o ID do token', async (t) => {
    const queries = mockPool(t, (statement) => {
        if (statement.includes('p.id, p.cliente_id, p.numero_exibicao')) return [[]];
        return [[]];
    });

    const res = criarResponse();
    // O cliente 7 tenta abrir o pedido 999 (de outra pessoa) e ainda manda cliente_id falso.
    await conta.detalharPedido(
        { cliente: { id: 7 }, params: { id: '999' }, query: { cliente_id: '1' }, body: { cliente_id: 1 } },
        res
    );

    assert.equal(res.statusCode, 404);
    const busca = queries.find((q) => q.statement.includes('WHERE p.id = ? AND p.cliente_id = ?'));
    assert.deepEqual(busca.params, [999, 7]);
});

test('linha do tempo mostra a confirmação do Pix sem expor quem confirmou', async (t) => {
    process.env.PIX_KEY = '12345678000190';
    mockPool(t, (statement) => {
        if (statement.includes('p.id, p.cliente_id, p.numero_exibicao')) {
            return [[{
                id: 50, cliente_id: 7, numero_pedido: 'AM-000050', numero_pedido_pix: 'AM-X',
                status: 'pago', subtotal: '80.00', desconto: '0.00', frete: '0.00', total: '80.00',
                criado_em: '2026-11-01 10:00:00', cliente_nome: 'Cliente', cliente_email: 'c@x.com',
                cliente_telefone: '85999999999', nome_destinatario: null
            }]];
        }
        if (statement.startsWith('SELECT produto_id')) {
            return [[{ produto_id: 1, nome_produto: 'Batom', quantidade: 2, preco_unitario: '40.00', subtotal: '80.00' }]];
        }
        if (statement.startsWith('SELECT metodo, status, valor')) {
            return [[{ metodo: 'pix', status: 'aprovado', valor: '80.00' }]];
        }
        if (statement.includes('AS pago_em')) {
            return [[{ criado_em: new Date('2026-11-01T13:00:00Z'), pago_em: new Date('2026-11-01T15:30:00Z') }]];
        }
        if (statement.includes('FROM admin_auditoria')) {
            return [[{
                acao: 'pagamento.pix_confirmado',
                depois_json: JSON.stringify({ status: 'aprovado', administrador: 'Amanda' }),
                criado_em: new Date('2026-11-01T15:30:00Z')
            }]];
        }
        return [[]];
    });

    const res = criarResponse();
    await conta.detalharPedido({ cliente: { id: 7 }, params: { id: '50' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pagamento.status, 'aprovado');
    assert.equal(res.body.pagamento.confirmado_em, '2026-11-01T15:30:00.000Z');
    assert.equal(res.body.pagamento.codigo_copia_cola, undefined);
    assert.equal(res.body.cliente, undefined);
    assert.deepEqual(res.body.historico.map((h) => h.tipo), ['criado', 'pagamento_confirmado']);
    assert.doesNotMatch(JSON.stringify(res.body.historico), /Amanda|administrador/);
});

test('lista e resumo filtram pelo cliente do token', async (t) => {
    const queries = mockPool(t, (statement) => {
        if (statement.startsWith('SELECT id, nome, email')) {
            return [[{ id: 7, nome: 'Cliente', email: 'c@x.com', telefone: '85999999999', ativo: 1, criado_em: new Date() }]];
        }
        if (statement.includes('COUNT(*) AS total')) return [[{ total: 3, aguardando: 1, confirmados: 2 }]];
        return [[]];
    });

    const res = criarResponse();
    await conta.obterConta({ cliente: { id: 7 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.resumo.total_pedidos, 3);
    assert.equal(res.body.resumo.pagamento_confirmado, 2);
    for (const q of queries) assert.ok(q.params.includes(7), q.statement);

    const lista = criarResponse();
    await conta.listarPedidos({ cliente: { id: 7 } }, lista);
    assert.deepEqual(queries.at(-1).params, [7]);
});

test('atualizar dados aceita só nome e telefone válidos e nunca o e-mail', async (t) => {
    const queries = mockPool(t, () => [{ affectedRows: 1 }]);

    const invalido = criarResponse();
    await conta.atualizarConta({ cliente: { id: 7 }, body: { nome: 'A', telefone: '123' } }, invalido);
    assert.equal(invalido.statusCode, 400);

    const ok = criarResponse();
    await conta.atualizarConta({
        cliente: { id: 7 },
        body: { nome: '  Maria  Silva ', telefone: '(85) 99999-1234', email: 'hacker@x.com', id: 1 }
    }, ok);
    assert.equal(ok.statusCode, 200);
    const update = queries.at(-1);
    assert.match(update.statement, /SET nome = \?, telefone = \? WHERE id = \?/);
    assert.deepEqual(update.params, ['Maria Silva', '85999991234', 7]);
});

const enderecoValido = {
    nome_destinatario: 'Maria', telefone: '85999991234', cep: '60331020',
    rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE'
};

test('editar endereço usado em pedido arquiva o antigo e cria um novo', async (t) => {
    const queries = mockPool(t, (statement) => {
        if (statement.includes('AS usado')) return [[{ id: 5, principal: 1, usado: 1 }]];
        if (statement.startsWith('INSERT INTO enderecos')) return [{ insertId: 9 }];
        return [{ affectedRows: 1 }];
    });

    const res = criarResponse();
    await conta.atualizarEndereco({ cliente: { id: 7 }, params: { id: '5' }, body: enderecoValido }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.id, 9);
    assert.ok(queries.some((q) => q.statement.startsWith('UPDATE enderecos SET arquivado = 1')));
    assert.ok(!queries.some((q) => /^UPDATE enderecos SET nome_destinatario/.test(q.statement)));
});

test('endereço de outro cliente responde 404 ao editar ou remover', async (t) => {
    const queries = mockPool(t, (statement) => {
        if (statement.includes('AS usado')) return [[]];
        return [{ affectedRows: 0 }];
    });

    const editar = criarResponse();
    await conta.atualizarEndereco({ cliente: { id: 7 }, params: { id: '3' }, body: enderecoValido }, editar);
    assert.equal(editar.statusCode, 404);

    const remover = criarResponse();
    await conta.removerEndereco({ cliente: { id: 7 }, params: { id: '3' } }, remover);
    assert.equal(remover.statusCode, 404);

    assert.ok(queries.every((q) => !q.statement.startsWith('DELETE')));
    assert.ok(queries.filter((q) => q.statement.includes('AS usado')).every((q) => q.params[1] === 7));
});
