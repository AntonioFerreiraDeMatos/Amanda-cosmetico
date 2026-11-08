const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    atualizarProdutoAdmin,
    criarCategoriaAdmin,
    excluirCategoriaAdmin,
    listarClientesAdmin,
    listarPedidosAdmin
} = require('../src/controllers/adminController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function mockConnection(t, handler) {
    const originalGetConnection = pool.getConnection;
    t.after(() => { pool.getConnection = originalGetConnection; });
    const state = { statements: [], committed: false, rolledBack: false };
    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { state.committed = true; },
        rollback: async () => { state.rolledBack = true; },
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.replace(/\s+/g, ' ').trim();
            state.statements.push({ statement, params });
            return handler(statement, params);
        }
    });
    return state;
}

function produtoHandler(ativoAtual) {
    return (statement) => {
        if (statement.startsWith('SELECT id FROM categorias')) return [[{ id: 2 }], []];
        if (statement.startsWith('SELECT id, categoria_id, nome, descricao')) {
            return [[{
                id: 14, categoria_id: 2, nome: 'Produto', descricao: null, sku: null,
                preco: '20.00', preco_promocional: null, estoque: 4, estoque_minimo: 2,
                ativo: ativoAtual, destaque: 0
            }], []];
        }
        if (statement.startsWith('UPDATE produtos')) return [{ affectedRows: 1 }, []];
        if (statement.startsWith('INSERT INTO admin_auditoria')) return [{ insertId: 1 }, []];
        throw new Error(`Consulta não simulada: ${statement}`);
    };
}

const corpoProduto = {
    nome: 'Produto',
    categoria_id: '2',
    preco: '25.00',
    preco_promocional: '',
    estoque: '4',
    estoque_minimo: '2'
};

test('editar produto desativado sem enviar "ativo" mantém o produto desativado', async (t) => {
    const state = mockConnection(t, produtoHandler(0));
    const res = createResponse();
    await atualizarProdutoAdmin({ params: { id: '14' }, admin: { administrador_id: 3 }, body: { ...corpoProduto } }, res);

    assert.equal(res.statusCode, 200);
    const update = state.statements.find(({ statement }) => statement.startsWith('UPDATE produtos'));
    // ativo é o penúltimo parâmetro (antes de destaque e id)
    assert.equal(update.params[8], 0);
});

test('multipart com ativo="false" desativa e destaque="false" não entra na vitrine', async (t) => {
    const state = mockConnection(t, produtoHandler(1));
    const res = createResponse();
    await atualizarProdutoAdmin({
        params: { id: '14' },
        admin: { administrador_id: 3 },
        body: { ...corpoProduto, ativo: 'false', destaque: 'false' }
    }, res);

    assert.equal(res.statusCode, 200);
    const update = state.statements.find(({ statement }) => statement.startsWith('UPDATE produtos'));
    assert.equal(update.params[8], 0);
    assert.equal(update.params[9], 0);
});

test('valor inválido em "ativo" é rejeitado', async (t) => {
    mockConnection(t, () => { throw new Error('não deveria consultar'); });
    const res = createResponse();
    await atualizarProdutoAdmin({ params: { id: '14' }, admin: { administrador_id: 3 }, body: { ...corpoProduto, ativo: 'talvez' } }, res);
    assert.equal(res.statusCode, 400);
});

test('criar categoria grava auditoria na mesma transação', async (t) => {
    const state = mockConnection(t, (statement) => {
        if (statement.startsWith('INSERT INTO categorias')) return [{ insertId: 11 }, []];
        if (statement.startsWith('INSERT INTO admin_auditoria')) return [{ insertId: 1 }, []];
        throw new Error(`Consulta não simulada: ${statement}`);
    });
    const res = createResponse();
    await criarCategoriaAdmin({ admin: { administrador_id: 3 }, body: { nome: 'Cuidados Faciais' } }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(state.committed, true);
    const audit = state.statements.find(({ statement }) => statement.startsWith('INSERT INTO admin_auditoria'));
    assert.equal(audit.params[1], 'categoria.criada');
    assert.equal(audit.params[3], 11);
});

test('não exclui categoria com produtos e não grava auditoria', async (t) => {
    const state = mockConnection(t, (statement) => {
        if (statement.startsWith('SELECT id, nome, slug, descricao, ativo FROM categorias')) {
            return [[{ id: 4, nome: 'Perfumes', slug: 'perfumes', descricao: null, ativo: 1 }], []];
        }
        if (statement.startsWith('SELECT COUNT(*) AS total FROM produtos')) return [[{ total: 2 }], []];
        throw new Error(`Consulta não simulada: ${statement}`);
    });
    const res = createResponse();
    await excluirCategoriaAdmin({ params: { id: '4' }, admin: { administrador_id: 3 } }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(state.rolledBack, true);
    assert.ok(!state.statements.some(({ statement }) => statement.startsWith('DELETE')));
});

test('lista de clientes não usa GROUP BY na consulta externa e aceita paginação', async (t) => {
    const originalQuery = pool.query;
    t.after(() => { pool.query = originalQuery; });
    const calls = [];
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        calls.push({ statement, params });
        if (statement.startsWith('SELECT COUNT(*) AS total FROM clientes')) return [[{ total: 30 }], []];
        return [[{ id: 1, nome: 'Ana', anotacao_admin: 'VIP', total_pedidos: 2, total_gasto: '50.00' }], []];
    };

    const res = createResponse();
    await listarClientesAdmin({ query: { page: '2', limit: '10', q: 'Ana' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, 30);
    assert.equal(res.body.totalPaginas, 3);
    const list = calls[1];
    // Depois do último ") gasto ON ..." não pode haver GROUP BY (consulta externa).
    const outer = list.statement.slice(list.statement.lastIndexOf('gasto.cliente_id = c.id'));
    assert.ok(!/GROUP BY/.test(outer));
    assert.match(list.statement, /c\.anotacao_admin/);
    assert.deepEqual(list.params.slice(-2), [10, 10]);
});

test('filtro de datas dos pedidos usa o dia inteiro no horário de Brasília', async (t) => {
    const originalQuery = pool.query;
    t.after(() => { pool.query = originalQuery; });
    let countParams;
    pool.query = async (sql, params = []) => {
        if (sql.includes('SELECT COUNT(*) AS total')) {
            countParams = params;
            return [[{ total: 0 }], []];
        }
        return [[], []];
    };
    const res = createResponse();
    await listarPedidosAdmin({ query: { date_from: '2026-11-01', date_to: '2026-11-01' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(countParams, ['2026-11-01 03:00:00', '2026-11-02 03:00:00']);
});
