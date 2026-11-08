const test = require('node:test');
const assert = require('node:assert/strict');
const {
    formatarNumeroPedido,
    reservarNumeroPedido,
    vincularNumeroPedido
} = require('../src/utils/pedidoNumero');

function criarAlocadorSimulado(initial = 0) {
    let sequencial = initial;
    const vinculacoes = [];

    return {
        vinculacoes,
        async query(sql, params = []) {
            if (sql.startsWith('INSERT INTO pedido_numeracao_sequencial')) {
                sequencial += 1;
                return [{ insertId: sequencial }, []];
            }
            if (sql.startsWith('UPDATE pedido_numeracao_sequencial')) {
                vinculacoes.push(params);
                return [{ affectedRows: 1 }, []];
            }
            throw new Error(`Consulta não simulada: ${sql}`);
        }
    };
}

test('formata números sequenciais com seis dígitos e cresce sem truncar', () => {
    assert.equal(formatarNumeroPedido(1), 'AM-000001');
    assert.equal(formatarNumeroPedido(42), 'AM-000042');
    assert.equal(formatarNumeroPedido(1000000), 'AM-1000000');
    assert.throws(() => formatarNumeroPedido(0), /inválido/);
});

test('aloca números consecutivos sem depender de data ou identificador interno', async () => {
    const allocator = criarAlocadorSimulado();
    const first = await reservarNumeroPedido(allocator);
    await vincularNumeroPedido(allocator, first.sequencial, 801);
    const second = await reservarNumeroPedido(allocator);
    await vincularNumeroPedido(allocator, second.sequencial, 802);
    const third = await reservarNumeroPedido(allocator);
    await vincularNumeroPedido(allocator, third.sequencial, 803);

    assert.deepEqual(
        [first.numero, second.numero, third.numero],
        ['AM-000001', 'AM-000002', 'AM-000003']
    );
    assert.deepEqual(allocator.vinculacoes, [[801, 1], [802, 2], [803, 3]]);
});

test('aloca números diferentes para pedidos simultâneos e continua após números já reservados', async () => {
    const allocator = criarAlocadorSimulado(12);
    const [first, second] = await Promise.all([
        reservarNumeroPedido(allocator),
        reservarNumeroPedido(allocator)
    ]);
    const following = await reservarNumeroPedido(allocator);

    assert.deepEqual(
        [first.numero, second.numero, following.numero].sort(),
        ['AM-000013', 'AM-000014', 'AM-000015']
    );
});
