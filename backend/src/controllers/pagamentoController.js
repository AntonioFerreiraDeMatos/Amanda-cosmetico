const pool = require('../config/database');

const INFINITEPAY_API = 'https://api.checkout.infinitepay.io';

function valorEmCentavos(valor) {
    return Math.round(Number(valor) * 100);
}

// =====================================================
// CRIAR CHECKOUT INFINITEPAY
// =====================================================

async function criarCheckout(req, res) {
    let connection;

    try {
        const {
            items,
            endereco_id = null
        } = req.body;

        // =================================================
        // CLIENTE AUTENTICADO PELO JWT
        // =================================================

        const cliente_id = req.cliente?.id;

        if (
            !Number.isInteger(Number(cliente_id)) ||
            Number(cliente_id) < 1
        ) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Cliente não autenticado.'
            });
        }

        // =================================================
        // VALIDAÇÃO DO CARRINHO
        // =================================================

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

        // =================================================
        // HANDLE INFINITEPAY
        // =================================================

        const handle = process.env.INFINITEPAY_HANDLE;

        if (!handle) {
            return res.status(503).json({
                sucesso: false,
                mensagem:
                    'InfinitePay ainda não está configurada no servidor.'
            });
        }

        // =================================================
        // CONEXÃO COM BANCO
        // =================================================

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // =================================================
        // CLIENTE
        // =================================================

        const [clientes] = await connection.query(
            `
            SELECT
                id,
                nome,
                email,
                telefone,
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

        // =================================================
        // ENDEREÇO
        // =================================================

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
                [
                    endereco_id,
                    cliente_id
                ]
            );

            if (!enderecos.length) {
                await connection.rollback();

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Endereço inválido.'
                });
            }
        }

        // =================================================
        // PRODUTOS
        // =================================================

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

        const [products] = await connection.query(
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

        const productsById = new Map(
            products.map(
                (product) => [
                    Number(product.id),
                    product
                ]
            )
        );

        // =================================================
        // ITENS DO PEDIDO
        // =================================================

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

        // =================================================
        // VALORES
        // =================================================

        const desconto = 0;
        const frete = 0;

        const total =
            subtotal -
            desconto +
            frete;

        // =================================================
        // CRIA PEDIDO
        // =================================================

        const numeroPedido =
            gerarNumeroPedido();

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

        // =================================================
        // ITENS DO PEDIDO
        // =================================================

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

        // =================================================
        // ITENS INFINITEPAY
        // =================================================

        const infinitePayItems =
            orderItems.map((item) => ({
                quantity:
                    item.quantidade,

                price:
                    valorEmCentavos(
                        item.preco_unitario
                    ),

                description:
                    item.nome_produto
            }));

        // =================================================
        // URLS
        // =================================================

        const frontendUrl =
            process.env.FRONTEND_URL ||
            'http://localhost:5173';

        const backendUrl =
            process.env.BACKEND_URL ||
            'http://localhost:3000';

        // =================================================
        // PAYLOAD INFINITEPAY
        // =================================================

        const payload = {
            handle,

            order_nsu:
                String(pedidoId),

            redirect_url:
                `${frontendUrl}/?pagamento=sucesso&pedido=${pedidoId}`,

            webhook_url:
                process.env.INFINITEPAY_WEBHOOK_URL ||
                `${backendUrl}/api/pagamentos/webhook`,

            items:
                infinitePayItems,

            customer: {
                name:
                    cliente.nome,

                email:
                    cliente.email,

                phone_number:
                    cliente.telefone || undefined
            }
        };

        // =================================================
        // ENVIA PARA INFINITEPAY
        // =================================================

        const response = await fetch(
            `${INFINITEPAY_API}/links`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify(payload)
            }
        );

        const data =
            await response.json();

        if (!response.ok || !data.url) {
            throw new Error(
                data.message ||
                'A InfinitePay não conseguiu criar o checkout.'
            );
        }

        // =================================================
        // FINALIZA TRANSAÇÃO
        // =================================================

        await connection.commit();

        // =================================================
        // RESPOSTA
        // =================================================

        return res.status(201).json({
            sucesso: true,

            pedido: {
                id:
                    Number(pedidoId),

                numero_pedido:
                    numeroPedido,

                total:
                    Number(
                        total.toFixed(2)
                    ),

                status:
                    'aguardando_pagamento'
            },

            checkoutUrl:
                data.url
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(
            'Erro ao criar checkout InfinitePay:',
            error
        );

        return res.status(500).json({
            sucesso: false,
            mensagem:
                'Não foi possível iniciar o pagamento.'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
}

// =====================================================
// WEBHOOK INFINITEPAY
// =====================================================

async function webhookInfinitePay(req, res) {
    let connection;

    try {
        const data = req.body || {};

        const orderNsu =
            String(
                data.order_nsu || ''
            );

        const transactionNsu =
            String(
                data.transaction_nsu || ''
            );

        if (!orderNsu || !transactionNsu) {
            return res.status(400).json({
                success: false,
                message:
                    'Dados do pagamento inválidos.'
            });
        }

        const pedidoId =
            Number(orderNsu);

        if (
            !Number.isInteger(pedidoId) ||
            pedidoId < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Pedido inválido.'
            });
        }

        connection =
            await pool.getConnection();

        await connection.beginTransaction();

        // =================================================
        // LOCALIZA PEDIDO
        // =================================================

        const [orders] =
            await connection.query(
                `
                SELECT
                    id,
                    total,
                    status
                FROM pedidos
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [pedidoId]
            );

        if (!orders.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'Pedido não encontrado.'
            });
        }

        const order =
            orders[0];

        // =================================================
        // EVITA DUPLICIDADE
        // =================================================

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM pagamentos
                WHERE transacao_id = ?
                LIMIT 1
                `,
                [transactionNsu]
            );

        if (existing.length) {
            await connection.rollback();

            return res.status(200).json({
                success: true,
                message: null
            });
        }

        // =================================================
        // MÉTODO DE PAGAMENTO
        // =================================================

        const captureMethod =
            String(
                data.capture_method || ''
            ).toLowerCase();

        const metodo =
            captureMethod === 'pix'
                ? 'pix'
                : 'cartao';

        // =================================================
        // VALOR
        // =================================================

        const valor =
            Number(
                data.amount || 0
            ) / 100;

        if (!Number.isFinite(valor) || Math.abs(valor - Number(order.total)) > 0.01) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'O valor recebido não corresponde ao pedido.'
            });
        }

        // =================================================
        // REGISTRA PAGAMENTO
        // =================================================

        await connection.query(
            `
            INSERT INTO pagamentos
            (
                pedido_id,
                metodo,
                status,
                valor,
                transacao_id,
                pago_em
            )
            VALUES
            (?, ?, 'aprovado', ?, ?, NOW())
            `,
            [
                pedidoId,
                metodo,
                valor,
                transactionNsu
            ]
        );

        // =================================================
        // ATUALIZA PEDIDO
        // =================================================

        if (
            order.status !== 'pago'
        ) {
            await connection.query(
                `
                UPDATE pedidos
                SET status = 'pago'
                WHERE id = ?
                  AND status IN
                  (
                      'pendente',
                      'aguardando_pagamento'
                  )
                `,
                [pedidoId]
            );
        }

        await connection.commit();

        console.log(
            `✅ Pagamento InfinitePay confirmado: pedido ${pedidoId}`
        );

        return res.status(200).json({
            success: true,
            message: null
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(
            'Erro no webhook InfinitePay:',
            error
        );

        return res.status(400).json({
            success: false,
            message:
                'Não foi possível processar o pagamento.'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
}

// =====================================================
// GERAR NÚMERO DO PEDIDO
// =====================================================

function gerarNumeroPedido() {
    const agora = new Date();

    const ano =
        agora.getFullYear();

    const mes =
        String(
            agora.getMonth() + 1
        ).padStart(2, '0');

    const dia =
        String(
            agora.getDate()
        ).padStart(2, '0');

    const aleatorio =
        Math.floor(
            100000 +
            Math.random() * 900000
        );

    return `AM-${ano}${mes}${dia}-${aleatorio}`;
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    criarCheckout,
    webhookInfinitePay
};