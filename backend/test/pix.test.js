const test = require('node:test');
const assert = require('node:assert/strict');
const {
    gerarPixCopiaECola,
    obterChavePix,
    crc16
} = require('../src/utils/pix');

function calcularCrc16(payload) {
    let crc = 0xffff;

    for (const byte of Buffer.from(payload, 'ascii')) {
        crc ^= byte << 8;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 0x8000) !== 0
                ? (crc << 1) ^ 0x1021
                : crc << 1;
            crc &= 0xffff;
        }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
}

test('CRC Pix usa CRC-16/CCITT-FALSE', () => {
    assert.equal(crc16('123456789'), '29B1');
});

test('gera BR Code Pix com valor, identificação do pedido e CRC válidos', () => {
    const payload = gerarPixCopiaECola({
        chave: '12.345.678/0001-90',
        valor: 42.5,
        numeroPedido: 'AM-20260310-123456'
    });

    assert.ok(payload.startsWith('000201010211'));
    assert.ok(payload.includes('540542.50'));
    assert.ok(payload.includes('AM20260310123456'));
    assert.match(payload, /6304[0-9A-F]{4}$/);
    assert.equal(
        payload.slice(-4),
        calcularCrc16(payload.slice(0, -4))
    );
});

test('normaliza chave CNPJ e rejeita chave ou valor inválidos', () => {
    assert.equal(obterChavePix('12.345.678/0001-90'), '12345678000190');
    assert.throws(() => obterChavePix('chave inválida'), /formato válido/);
    assert.throws(
        () => gerarPixCopiaECola({
            chave: '12345678000190',
            valor: 0,
            numeroPedido: 'AM-20260310-123456'
        }),
        /valor do pedido/
    );
});
