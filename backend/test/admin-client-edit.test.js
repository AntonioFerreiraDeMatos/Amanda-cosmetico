const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const {
    atualizarClienteAdmin,
    excluirClienteAdmin,
    atualizarStatusClienteAdmin
} = require('../src/controllers/adminController');

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

test('atualiza contatos e cria endereço principal sem sobrescrever dados de entrega históricos', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    let committed = false;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });

    pool.getConnection = async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            const statement = sql.trim();
            statements.push({ statement, params });
            if (statement.startsWith('SELECT id, nome, email, telefone')) {
                return [[{ id: 8, nome: 'Nome anterior', email: 'old@example.com', telefone: null }], []];
            }
            if (statement.startsWith('SELECT id, nome_destinatario')) {
                return [[{ id: 5, nome_destinatario: 'Endereço anterior' }], []];
            }
            if (statement.startsWith('UPDATE clientes')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('UPDATE enderecos')) {
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO enderecos')) {
                return [{ insertId: 20 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 2 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const response = createResponse();
    await atualizarClienteAdmin({
        params: { id: '8' },
        admin: { administrador_id: 3 },
        body: {
            nome: 'Nome atualizado',
            email: 'new@example.com',
            telefone: '(85) 99999-9999',
            endereco: {
                nome_destinatario: 'Nome atualizado',
                telefone: '85999999999',
                cep: '60331020',
                rua: 'Rua nova',
                numero: '35',
                complemento: '',
                bairro: 'Centro',
                cidade: 'Fortaleza',
                estado: 'CE'
            }
        }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(committed, true);
    assert.deepEqual(statements[2].params, ['Nome atualizado', 'new@example.com', '85999999999', 8]);
    assert.ok(statements.some(({ statement }) => statement.startsWith('INSERT INTO enderecos')));
    assert.ok(statements.some(({ statement }) => statement.startsWith('INSERT INTO admin_auditoria')));
});

test('rejeita endereço parcial antes de iniciar uma transação', async (t) => {
    const originalGetConnection = pool.getConnection;
    t.after(() => {
        pool.getConnection = originalGetConnection;
    });
    pool.getConnection = async () => {
        throw new Error('Não deve acessar o banco.');
    };

    const response = createResponse();
    await atualizarClienteAdmin({
        params: { id: '8' },
        body: {
            nome: 'Cliente',
            email: 'cliente@example.com',
            endereco: { rua: 'Rua incompleta' }
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.mensagem, /endereço/i);
});

test('desativa e reativa cliente sem apagar cadastro nem histórico', async (t) => {
    const originalGetConnection = pool.getConnection;
    const statements = [];
    let activeState = 1;
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
            statements.push(statement);
            if (statement.startsWith('SELECT id, ativo FROM clientes')) {
                return [[{ id: 8, ativo: activeState }], []];
            }
            if (statement.startsWith('UPDATE clientes SET ativo')) {
                activeState = params[0] ? 1 : 0;
                return [{ affectedRows: 1 }, []];
            }
            if (statement.startsWith('INSERT INTO admin_auditoria')) {
                return [{ insertId: 3 }, []];
            }
            throw new Error(`Consulta não simulada no teste: ${statement}`);
        }
    });

    const deactivateResponse = createResponse();
    await excluirClienteAdmin({
        params: { id: '8' },
        admin: { administrador_id: 3 }
    }, deactivateResponse);
    assert.equal(deactivateResponse.statusCode, 200);
    assert.match(deactivateResponse.body.mensagem, /histórico foi preservado/i);

    const activateResponse = createResponse();
    await atualizarStatusClienteAdmin({
        params: { id: '8' },
        admin: { administrador_id: 3 },
        body: { ativo: true }
    }, activateResponse);
    assert.equal(activateResponse.statusCode, 200);
    assert.equal(statements.filter((statement) => statement.startsWith('INSERT INTO admin_auditoria')).length, 2);
    assert.equal(statements.some((statement) => statement.startsWith('DELETE FROM clientes')), false);
});
