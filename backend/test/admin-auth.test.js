const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/database');
const requireAdmin = require('../src/middlewares/adminAuth');

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

test('autoriza JWT somente após confirmar a conta ativa no banco', async (t) => {
    const originalQuery = pool.query;
    const originalSecret = process.env.JWT_SECRET;
    t.after(() => {
        pool.query = originalQuery;
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    process.env.JWT_SECRET = 'test-secret';
    pool.query = async (sql, params) => {
        assert.match(sql, /FROM administradores WHERE id = \?/);
        assert.deepEqual(params, [12]);
        return [[{ id: 12, email: 'amanda@example.com', ativo: 1 }], []];
    };

    const req = {
        headers: {
            authorization: `Bearer ${jwt.sign({
                administrador_id: 12,
                email: 'email-controlado-pelo-token@example.com',
                tipo: 'administrador'
            }, process.env.JWT_SECRET)}`
        }
    };
    const response = criarResponse();
    let nextCalled = false;

    await requireAdmin(req, response, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.admin.administrador_id, 12);
    assert.equal(req.admin.email, 'amanda@example.com');
});

test('nega token ainda válido de administrador desativado', async (t) => {
    const originalQuery = pool.query;
    const originalSecret = process.env.JWT_SECRET;
    t.after(() => {
        pool.query = originalQuery;
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    process.env.JWT_SECRET = 'test-secret';
    pool.query = async () => [[{ id: 12, email: 'amanda@example.com', ativo: 0 }], []];

    const req = {
        headers: {
            authorization: `Bearer ${jwt.sign({
                administrador_id: 12,
                tipo: 'administrador'
            }, process.env.JWT_SECRET)}`
        }
    };
    const response = criarResponse();
    let nextCalled = false;

    await requireAdmin(req, response, () => { nextCalled = true; });

    assert.equal(response.statusCode, 401);
    assert.equal(nextCalled, false);
});
