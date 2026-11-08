// Testes HTTP reais contra o app Express (porta local aleatória), com o
// banco simulado. Não conecta a nenhum MySQL.
process.env.RATE_LIMIT_ADMIN_LOGIN = '3';
process.env.FRONTEND_URL = 'https://www.amandacosmeticos.com.br';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { app } = require('../src/server');

let server;
let baseUrl;

test.before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

function withQuery(t, handler) {
    const original = pool.query;
    t.after(() => { pool.query = original; });
    pool.query = handler;
}

test('health check responde sem expor o nome do banco', async (t) => {
    withQuery(t, async () => [[{ 1: 1 }], []]);
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.banco, 'conectado');
    assert.equal(body.database, undefined);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('health check devolve 503 quando o banco cai', async (t) => {
    withQuery(t, async () => { throw Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }); });
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 503);
});

test('rota inexistente devolve 404 em JSON', async () => {
    const response = await fetch(`${baseUrl}/api/nao-existe`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).sucesso, false);
});

test('JSON malformado devolve 400 sem mensagem interna', async () => {
    const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email":'
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.mensagem, 'O corpo da requisição não é um JSON válido.');
});

test('origem não autorizada é bloqueada pelo CORS', async () => {
    const response = await fetch(`${baseUrl}/api/produtos`, { headers: { Origin: 'https://site-malicioso.example' } });
    assert.equal(response.status, 403);
});

test('origem autorizada recebe o cabeçalho CORS', async (t) => {
    withQuery(t, async () => [[], []]);
    const response = await fetch(`${baseUrl}/api/categorias`, { headers: { Origin: 'https://www.amandacosmeticos.com.br' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://www.amandacosmeticos.com.br');
});

test('rotas públicas inseguras foram desativadas (410)', async () => {
    for (const path of ['/api/clientes', '/api/auth/telefone']) {
        const response = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: 'Teste', telefone: '85999999999', email: 'x@y.com' })
        });
        assert.equal(response.status, 410, path);
    }
});

test('rotas administrativas exigem token', async () => {
    for (const path of ['/api/admin/relatorios/vendas', '/api/admin/exportar/clientes.csv', '/api/admin/pedidos']) {
        const response = await fetch(`${baseUrl}${path}`);
        assert.equal(response.status, 401, path);
    }
});

test('login administrativo bloqueia após tentativas com falha', async (t) => {
    withQuery(t, async () => [[], []]);
    const tentar = () => fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invasor@example.com', senha: 'errada' })
    });

    for (let i = 0; i < 3; i += 1) {
        assert.equal((await tentar()).status, 401);
    }
    const blocked = await tentar();
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).mensagem, /Muitas tentativas/);
});
