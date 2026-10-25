const pool = require('../config/database');

function gerarNumeroPedido() {
    const agora = new Date();

    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');

    const aleatorio = Math.floor(100000 + Math.random() * 900000);

    return `AM-${ano}${mes}${dia}-${aleatorio}`;
}

async function criarPedido(req, res) {
    let connection;

    try {
        // ==========================================
        // CLIENTE VEM DO JWT
        // ==========================================

        const cliente_id = req.cliente?.id;

        const {
            items,
            endereco_id = null
        } = req.body;

        if (
            !Number.isInteger(Number(cliente_id)) ||
            Number(cliente_id) < 1
        ) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Cliente não autenticado.'
            });
        }

        // ==========================================
        // VALIDA CARRINHO
        // ==========================================

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O carrinho está vazio.'
            });
        }

        const requestedItems = Object.values(items.reduce((grouped, item) => {
            const id = Number(item.id);
            const quantity = Number(item.quantity);

            grouped[id] = grouped[id] || { id, quantity: 0 };
            grouped[id].quantity += quantity;
            return grouped;
        }, {}));

        if (
            requestedItems.some(
                (item) =>
                    !Number.isInteger(item.id) ||
                    item.id < 1 ||
                    !Number.isInteger(item.quantity) ||
                    item.quantity < 1
            )
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Itens do carrinho inválidos.'
            });
        }

        // ==========================================
        // CONEXÃO
        // ==========================================

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // ==========================================
        // CONFIRMA CLIENTE
        // ==========================================

        const [clientes] = await connection.query(
            `
            SELECT
                id,
                nome,
                email,
                ativo
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

        const cliente = clientes[0];

        if (!cliente.ativo) {
            await connection.rollback();

            return res.status(403).json({
                sucesso: false,
                mensagem: 'Cliente desativado.'
            });
        }

        // ==========================================
        // VALIDA ENDEREÇO
        // ==========================================

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

        // ==========================================
        // BUSCA PRODUTOS NO BANCO
        // ==========================================

        const ids = [
            ...new Set(
                requestedItems.map(
                    (item) => item.id
                )
            )
        ];

        const placeholders = ids
            .map(() => '?')
            .join(', ');

        const [products] =
            await connection.query(
                `
                SELECT
                    id,
                    nome,
                    preco,
                    preco_promocional,
                    estoque,
                    ativo
                FROM produtos
                WHERE id IN (${placeholders})
                  AND ativo = TRUE
                FOR UPDATE
                `,
                ids
            );

        const productsById =
            new Map(
                products.map(
                    (product) => [
                        Number(product.id),
                        product
                    ]
                )
            );

        // ==========================================
        // MONTA ITENS
        // ==========================================

        const orderItems = [];

        let subtotal = 0;

        for (const item of requestedItems) {
            const product =
                productsById.get(item.id);

            if (!product) {
                await connection.rollback();

                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'Um dos produtos não está disponível.'
                });
            }

            if (
                item.quantity >
                Number(product.estoque)
            ) {
                await connection.rollback();

                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        `Estoque insuficiente para ${product.nome}.`
                });
            }

            const preco = Number(
                product.preco_promocional ||
                product.preco
            );

            const itemSubtotal =
                preco * item.quantity;

            subtotal += itemSubtotal;

            orderItems.push({
                produto_id:
                    Number(product.id),

                nome_produto:
                    product.nome,

                quantidade:
                    item.quantity,

                preco_unitario:
                    preco,

                subtotal:
                    itemSubtotal
            });
        }

        for (const item of orderItems) {
            const [result] = await connection.query(
                `UPDATE produtos
                 SET estoque = estoque - ?
                 WHERE id = ? AND ativo = TRUE AND estoque >= ?`,
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

        // ==========================================
        // VALORES
        // ==========================================

        const frete = 0;
        const desconto = 0;

        const total =
            subtotal -
            desconto +
            frete;

        // ==========================================
        // NÚMERO DO PEDIDO
        // ==========================================

        const numeroPedido =
            gerarNumeroPedido();

        // ==========================================
        // CRIA PEDIDO
        // ==========================================

        const [pedidoResult] =
            await connection.query(
                `
                INSERT INTO pedidos
                (
                    cliente_id,
                    endereco_id,
                    numero_pedido,
                    status,
                    subtotal,
                    desconto,
                    frete,
                    total
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    'aguardando_pagamento',
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,
                [
                    cliente_id,
                    endereco_id,
                    numeroPedido,
                    subtotal,
                    desconto,
                    frete,
                    total
                ]
            );

        const pedidoId =
            pedidoResult.insertId;

        // ==========================================
        // CRIA ITENS DO PEDIDO
        // ==========================================

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
                VALUES
                (?, ?, ?, ?, ?, ?)
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
        }

        // ==========================================
        // FINALIZA TRANSAÇÃO
        // ==========================================

        await connection.commit();

        return res.status(201).json({
            sucesso: true,

            mensagem:
                'Pedido criado com sucesso.',

            pedido: {
                id: pedidoId,

                numero_pedido:
                    numeroPedido,

                cliente_id:
                    Number(cliente_id),

                subtotal:
                    Number(
                        subtotal.toFixed(2)
                    ),

                desconto:
                    Number(
                        desconto.toFixed(2)
                    ),

                frete:
                    Number(
                        frete.toFixed(2)
                    ),

                total:
                    Number(
                        total.toFixed(2)
                    ),

                status:
                    'aguardando_pagamento'
            },

            itens: orderItems
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(
            'Erro ao criar pedido:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem:
                'Não foi possível criar o pedido.'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    criarPedido
};