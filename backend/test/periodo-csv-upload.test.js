const test = require('node:test');
const assert = require('node:assert/strict');
const {
    resolverPeriodo,
    startOfDayUtc,
    listarDias,
    formatarDataHora,
    todayInStore
} = require('../src/utils/periodo');
const { buildCsv, escapeCell, moneyCell } = require('../src/utils/csv');
const { matchesSignature } = require('../src/middlewares/productUpload');

test('converte o início do dia em Brasília para UTC', () => {
    assert.equal(startOfDayUtc('2026-11-01'), '2026-11-01 03:00:00');
});

test('dia da loja vira o dia seguinte só após 21h UTC-3', () => {
    assert.equal(todayInStore(new Date('2026-11-09T02:59:00Z')), '2026-11-08');
    assert.equal(todayInStore(new Date('2026-11-09T03:00:00Z')), '2026-11-09');
});

test('período de 7 dias termina hoje e compara com os 7 dias anteriores', () => {
    const periodo = resolverPeriodo({ periodo: '7' }, { now: new Date('2026-11-08T15:00:00Z') });
    assert.equal(periodo.atual.inicio, '2026-11-02');
    assert.equal(periodo.atual.fim, '2026-11-08');
    assert.equal(periodo.atual.dias, 7);
    assert.equal(periodo.atual.inicioUtc, '2026-11-02 03:00:00');
    assert.equal(periodo.atual.fimExclusivoUtc, '2026-11-09 03:00:00');
    assert.equal(periodo.anterior.inicio, '2026-10-26');
    assert.equal(periodo.anterior.fim, '2026-11-01');
});

test('período personalizado valida datas, ordem e tamanho máximo', () => {
    assert.ok(resolverPeriodo({ periodo: 'personalizado', inicio: '2026-02-30', fim: '2026-03-01' }).erro);
    assert.ok(resolverPeriodo({ periodo: 'personalizado', inicio: '2026-03-10', fim: '2026-03-01' }).erro);
    assert.ok(resolverPeriodo({ periodo: 'personalizado', inicio: '2024-01-01', fim: '2026-01-01' }).erro);
    assert.ok(resolverPeriodo({ periodo: '15' }).erro);

    const ok = resolverPeriodo({ inicio: '2026-01-01', fim: '2026-01-31' });
    assert.equal(ok.periodo, 'personalizado');
    assert.equal(ok.atual.dias, 31);
    assert.equal(ok.anterior.fim, '2025-12-31');
    assert.equal(ok.anterior.inicio, '2025-12-01');
});

test('lista os dias do período inclusive e formata data no padrão brasileiro', () => {
    assert.deepEqual(listarDias('2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
    assert.equal(formatarDataHora(new Date('2026-11-01T02:30:00Z')), '31/10/2026 23:30');
});

test('CSV usa BOM, ponto e vírgula, aspas e bloqueia fórmulas', () => {
    assert.equal(escapeCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(escapeCell('+5511'), "'+5511");
    assert.equal(escapeCell(-5), '-5');
    assert.equal(escapeCell('Rua A; 10'), '"Rua A; 10"');
    assert.equal(moneyCell('1234.5'), '1234,50');

    const csv = buildCsv(
        [{ titulo: 'Nome', valor: (r) => r.nome }, { titulo: 'Total', valor: (r) => moneyCell(r.total) }],
        [{ nome: 'Ana', total: 10 }]
    );
    assert.equal(csv, '﻿Nome;Total\r\nAna;10,00\r\n');
});

test('upload confere a assinatura real da imagem', () => {
    assert.equal(matchesSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
    assert.equal(matchesSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true);
    assert.equal(matchesSignature(Buffer.from('RIFF0000WEBP', 'ascii'), 'image/webp'), true);
    assert.equal(matchesSignature(Buffer.from('<html><script>', 'ascii'), 'image/png'), false);
    assert.equal(matchesSignature(Buffer.from('<svg xmlns=', 'ascii'), 'image/jpeg'), false);
});
