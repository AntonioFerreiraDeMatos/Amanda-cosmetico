function obterChavePix(value) {
    const key = String(value || '').trim();

    if (!key) {
        throw new Error('A chave Pix da loja não está configurada.');
    }

    if (!/^[\x21-\x7e]+$/.test(key)) {
        throw new Error('A chave Pix da loja não está em um formato válido.');
    }

    if (/^[\d./-]+$/.test(key)) {
        const digits = key.replace(/\D/g, '');
        if (digits.length === 11 || digits.length === 14) {
            return digits;
        }
    }

    if (/^\+55\d{10,11}$/.test(key)) {
        return key;
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) && Buffer.byteLength(key, 'utf8') <= 77) {
        return key;
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
        return key;
    }

    throw new Error('A chave Pix da loja não está em um formato válido.');
}

function crc16(payload) {
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

function campo(id, value) {
    const length = Buffer.byteLength(value, 'utf8');

    if (length > 99) {
        throw new Error(`Campo Pix ${id} excede o tamanho permitido.`);
    }

    return `${id}${String(length).padStart(2, '0')}${value}`;
}

function gerarPixCopiaECola({ chave, valor, numeroPedido }) {
    const key = obterChavePix(chave);
    const cents = Math.round(Number(valor) * 100);
    const txid = String(numeroPedido || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 9999999999) {
        throw new Error('O valor do pedido não é válido para pagamento Pix.');
    }

    if (!txid || txid.length > 25) {
        throw new Error('O identificador do pedido não é válido para pagamento Pix.');
    }

    const merchantName = 'AMANDA COSMETICOS';
    const merchantCity = 'FORTALEZA';
    const merchantAccount = campo(
        '26',
        campo('00', 'BR.GOV.BCB.PIX') + campo('01', key)
    );
    const additionalData = campo('62', campo('05', txid));
    const amount = (cents / 100).toFixed(2);
    const payload = [
        campo('00', '01'),
        campo('01', '11'),
        merchantAccount,
        campo('52', '0000'),
        campo('53', '986'),
        campo('54', amount),
        campo('58', 'BR'),
        campo('59', merchantName),
        campo('60', merchantCity),
        additionalData,
        '6304'
    ].join('');

    return `${payload}${crc16(payload)}`;
}

module.exports = {
    obterChavePix,
    gerarPixCopiaECola,
    crc16
};
