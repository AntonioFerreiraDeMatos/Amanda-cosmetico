/**
 * Código de barras: aceita o que pistolas e câmeras leem (EAN, UPC, Code128...).
 * Retorna null para vazio e false para inválido.
 */
function normalizarCodigoBarras(value) {
    if (value === undefined || value === null) return null;
    const codigo = String(value).replace(/\s+/g, '').trim();
    if (!codigo) return null;
    if (codigo.length > 64 || !/^[0-9A-Za-z.\-_/+]+$/.test(codigo)) return false;
    return codigo;
}

module.exports = { normalizarCodigoBarras };
