/**
 * Geração de CSV compatível com o Excel em português:
 * separador ";", BOM UTF-8, decimais com vírgula e proteção contra
 * injeção de fórmulas (valores de texto iniciados por = + - @ recebem ').
 */
const SEPARATOR = ';';
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value) {
    if (value === null || value === undefined) return '';

    let text = typeof value === 'number'
        ? String(value)
        : String(value);

    if (typeof value !== 'number' && FORMULA_START.test(text)) {
        text = `'${text}`;
    }

    if (/[";\r\n]/.test(text)) {
        text = `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function moneyCell(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toFixed(2).replace('.', ',') : '';
}

/**
 * @param {Array<{titulo: string, valor: (row) => unknown}>} columns
 * @param {Array<object>} rows
 */
function buildCsv(columns, rows) {
    const lines = [columns.map((column) => escapeCell(column.titulo)).join(SEPARATOR)];
    for (const row of rows) {
        lines.push(columns.map((column) => escapeCell(column.valor(row))).join(SEPARATOR));
    }
    return `﻿${lines.join('\r\n')}\r\n`;
}

function sendCsv(res, filename, content) {
    const safeName = String(filename).replace(/[^a-z0-9._-]/gi, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(content);
}

module.exports = {
    escapeCell,
    moneyCell,
    buildCsv,
    sendCsv
};
