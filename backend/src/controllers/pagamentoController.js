const pool = require('../config/database');
const {
    reservarNumeroPedido,
    vincularNumeroPedido
} = require('../utils/pedidoNumero');

async function criarCheckout(req, res) {
    let connection;

    try {
        const { items, endereco_id = null } = req.body;
        const cliente_id = Number(req.cliente?.id);
        const pixKey = process.env.PIX_KEY?.trim();

        if (!Number.isInteger(cliente_id) || cliente_id < 1) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Cliente não autenticado.'
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O carrinho está vazio.'
            });
        }

        const quantities = new Map();

        for (const item of items) {
            const id = Number(item?.id);
            const quantity = Number(item?.quantity);

            if (
                !Number.isInteger(id) ||
                id < 1 ||
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Itens do carrinho inválidos.'
                });
            }

            quantities.set(id, (quantities.get(id) || 0) + quantity);
        }

        const requestedItems = Array.from(
            quantities,
            ([id, quantity]) => ({ id, quantity })
        );

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [clientes] = await connection.query(
            `
            SELECT id, ativo
            FROM clientes
            WHERE id = ?
            LIMIT 1
            FOR SHARE
            `,
            [cliente_id]
        );

        if (!clientes.length) {
            await connection.rollback();
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Cliente não encontrado.'
            });
        }

        if (!clientes[0].ativo) {
            await connection.rollback();
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Cliente desativado.'
            });
        }

        if (endereco_id !== null) {
            const [enderecos] = await connection.query(
                `
                SELECT id
                FROM enderecos
                WHERE id = ?
                  AND cliente_id = ?
                LIMIT 1
                FOR SHARE
                `,
                [endereco_id, cliente_id]
            );

            if (!enderecos.length) {
                await connection.rollback();
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Endereço inválido.'
                });
            }
        }

        const ids = requestedItems.map((item) => item.id);
        const placeholders = ids.map(() => '?').join(', ');
        const [products] = await connection.query(
            `
            SELECT id, nome, preco, preco_promocional, estoque
            FROM produtos
            WHERE id IN (${placeholders})
              AND ativo = TRUE
            FOR UPDATE
            `,
            ids
        );

        const productsById = new Map(
            products.map((product) => [Number(product.id), product])
        );
        const orderItems = [];
        let subtotal = 0;

        for (const item of requestedItems) {
            const product = productsById.get(item.id);

            if (!product) {
                await connection.rollback();
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Um dos produtos não está disponível.'
                });
            }

            if (item.quantity > Number(product.estoque)) {
                await connection.rollback();
                return res.status(400).json({
                    sucesso: false,
                    mensagem: `Estoque insuficiente para ${product.nome}.`
                });
            }

            const preco = Number(product.preco_promocional || product.preco);
            const itemSubtotal = preco * item.quantity;
            subtotal += itemSubtotal;
            orderItems.push({
                produto_id: Number(product.id),
                nome_produto: product.nome,
                quantidade: item.quantity,
                estoque_antes: Number(product.estoque),
                preco_unitario: preco,
                subtotal: itemSubtotal
            });
        }

        for (const item of orderItems) {
            const [result] = await connection.query(
                `
                UPDATE produtos
                SET estoque = estoque - ?
                WHERE id = ?
                  AND ativo = TRUE
                  AND estoque >= ?
                `,
                [item.quantidade, item.produto_id, item.quantidade]
            );

            if (!result.affectedRows) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `Estoque insuficiente para ${item.nome_produto}.`
                });
            }
        }

        const desconto = 0;
        const frete = 0;
        const total = subtotal - desconto + frete;
        const reservaNumero = await reservarNumeroPedido(connection);
        const [pedidoResult] = await connection.query(
            `
            INSERT INTO pedidos
            (
                cliente_id,
                endereco_id,
                numero_pedido,
                numero_exibicao,
                status,
                subtotal,
                desconto,
                frete,
                total
            )
            VALUES (?, ?, ?, ?, 'aguardando_pagamento', ?, ?, ?, ?)
            `,
            [
                cliente_id,
                endereco_id,
                reservaNumero.numero,
                reservaNumero.numero,
                subtotal,
                desconto,
                frete,
                total
            ]
        );

        const pedidoId = pedidoResult.insertId;
        await vincularNumeroPedido(connection, reservaNumero.sequencial, pedidoId);

        for (const item of orderItems) {
            await connection.query(
                `
                INSERT INTO itens_pedido
                (
                    pedido_id,
                    produto_id,
                    nome_produto,
                    quantidade,
                    preco_unitario,
                    subtotal
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    pedidoId,
                    item.produto_id,
                    item.nome_produto,
                    item.quantidade,
                    item.preco_unitario,
                    item.subtotal
                ]
            );
            await connection.query(`
                INSERT INTO estoque_movimentacoes
                    (produto_id, pedido_id, tipo, quantidade_anterior,
                     quantidade_nova, diferenca, motivo)
                VALUES (?, ?, 'baixa_pedido', ?, ?, ?, ?)
            `, [
                item.produto_id,
                pedidoId,
                item.estoque_antes,
                item.estoque_antes - item.quantidade,
                -item.quantidade,
                `Baixa automática do pedido ${reservaNumero.numero}.`
            ]);
        }

        await connection.query(
            `
            INSERT INTO pagamentos
            (
                pedido_id,
                metodo,
                status,
                valor
            )
            VALUES (?, 'pix', 'pendente', ?)
            `,
            [pedidoId, total]
        );

        await connection.commit();

        return res.status(201).json({
            sucesso: true,
            pedido: {
                id: Number(pedidoId),
                numero_pedido: reservaNumero.numero,
                numero_exibicao: reservaNumero.numero,
                total: Number(total.toFixed(2)),
                status: 'aguardando_pagamento',
                itens: orderItems.map((item) => ({
                    nome_produto: item.nome_produto,
                    quantidade: item.quantidade,
                    subtotal: Number(item.subtotal.toFixed(2))
                }))
            },
            pagamento: {
                metodo: 'pix',
                status: 'pendente',
                ...(pixKey ? { chave: pixKey } : {})
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Erro ao criar pedido Pix:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível iniciar o pagamento Pix.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    criarCheckout
};
