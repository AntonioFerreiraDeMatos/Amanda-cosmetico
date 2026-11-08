function formatarNumeroPedido(sequencial) {
    const numero = Number(sequencial);
    if (!Number.isSafeInteger(numero) || numero < 1) {
        throw new Error('O banco retornou um número sequencial de pedido inválido.');
    }

    return `AM-${String(numero).padStart(6, '0')}`;
}

async function reservarNumeroPedido(connection) {
    const [result] = await connection.query(
        'INSERT INTO pedido_numeracao_sequencial (pedido_id) VALUES (NULL)'
    );

    return {
        sequencial: Number(result.insertId),
        numero: formatarNumeroPedido(result.insertId)
    };
}

async function vincularNumeroPedido(connection, sequencial, pedidoId) {
    const [result] = await connection.query(
        `UPDATE pedido_numeracao_sequencial
         SET pedido_id = ?
         WHERE sequencial = ? AND pedido_id IS NULL`,
        [pedidoId, sequencial]
    );

    if (result.affectedRows !== 1) {
        throw new Error('Não foi possível vincular o número sequencial ao pedido.');
    }
}

module.exports = {
    formatarNumeroPedido,
    reservarNumeroPedido,
    vincularNumeroPedido
};
