const { createHash } = require('crypto');
const pool = require('../config/database');
const { logError } = require('../utils/logger');
const { obterChavePix, gerarPixCopiaECola } = require('../utils/pix');
const {
    reservarNumeroPedido,
    vincularNumeroPedido
} = require('../utils/pedidoNumero');

const MAX_DECIMAL_CENTS = 9999999999;

function normalizarEndereco(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const texto = (field) => String(value[field] || '').trim();
    const telefone = texto('telefone').replace(/\D/g, '');
    const cep = texto('cep').replace(/\D/g, '');
    const endereco = {
        nome_destinatario: texto('nome_destinatario'),
        telefone,
        cep,
        rua: texto('rua'),
        numero: texto('numero'),
        complemento: texto('complemento'),
        bairro: texto('bairro'),
        cidade: texto('cidade'),
        estado: texto('estado')
    };

    if (
        endereco.nome_destinatario.length < 2 ||
        endereco.nome_destinatario.length > 150 ||
        telefone.length < 10 ||
        telefone.length > 13 ||
        cep.length !== 8 ||
        endereco.rua.length < 2 ||
        endereco.rua.length > 200 ||
        endereco.numero.length < 1 ||
        endereco.numero.length > 20 ||
        endereco.complemento.length > 100 ||
        endereco.bairro.length < 2 ||
        endereco.bairro.length > 100 ||
        endereco.cidade.length < 2 ||
        endereco.cidade.length > 100 ||
        endereco.estado.length < 2 ||
        endereco.estado.length > 100
    ) {
        return null;
    }

    return endereco;
}

function normalizarItens(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
        return null;
    }

    const quantities = new Map();

    for (const item of value) {
        const id = Number(item?.id);
        const quantity = Number(item?.quantity);

        if (
            !Number.isSafeInteger(id) ||
            id < 1 ||
            !Number.isSafeInteger(quantity) ||
            quantity < 1 ||
            quantity > 4294967295
        ) {
            return null;
        }

        const totalQuantity = (quantities.get(id) || 0) + quantity;

        if (!Number.isSafeInteger(totalQuantity) || totalQuantity > 4294967295) {
            return null;
        }

        quantities.set(id, totalQuantity);
    }

    return Array.from(quantities, ([id, quantity]) => ({ id, quantity }));
}

async function buscarPedido(connection, pedidoId, clienteId, pixKey) {
    const [pedidos] = await connection.query(
        `
        SELECT
            p.id, p.cliente_id, p.numero_exibicao AS numero_pedido,
            p.numero_exibicao,
            p.numero_pedido AS numero_pedido_pix, p.status, p.subtotal,
            p.desconto, p.frete, p.total, p.criado_em,
            c.nome AS cliente_nome, c.email AS cliente_email, c.telefone AS cliente_telefone,
            e.nome_destinatario, e.telefone AS endereco_telefone, e.cep, e.rua, e.numero,
            e.complemento, e.bairro, e.cidade, e.estado, e.pais
        FROM pedidos p
        INNER JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN enderecos e ON e.id = p.endereco_id
        WHERE p.id = ? AND p.cliente_id = ?
        LIMIT 1
        `,
        [pedidoId, clienteId]
    );

    if (!pedidos.length) {
        return null;
    }

    const pedido = pedidos[0];
    const [itens] = await connection.query(
        `
        SELECT produto_id, nome_produto, quantidade, preco_unitario, subtotal
        FROM itens_pedido
        WHERE pedido_id = ?
        ORDER BY id ASC
        `,
        [pedido.id]
    );
    const [pagamentos] = await connection.query(
        `
        SELECT metodo, status, valor
        FROM pagamentos
        WHERE pedido_id = ? AND metodo = 'pix'
        ORDER BY id DESC
        LIMIT 1
        `,
        [pedido.id]
    );

    if (!pagamentos.length) {
        throw new Error('Pagamento Pix do pedido não encontrado.');
    }

    const pagamento = {
        metodo: pagamentos[0].metodo,
        status: pagamentos[0].status,
        valor: Number(pagamentos[0].valor)
    };

    if (pagamento.status === 'pendente') {
        pagamento.codigo_copia_cola = gerarPixCopiaECola({
            chave: pixKey,
            valor: pagamento.valor,
            numeroPedido: pedido.numero_pedido_pix
        });
    }

    return {
        cliente: {
            id: Number(pedido.cliente_id),
            nome: pedido.cliente_nome,
            email: pedido.cliente_email,
            telefone: pedido.cliente_telefone
        },
        pedido: {
            id: Number(pedido.id),
            numero_pedido: pedido.numero_pedido,
            numero_exibicao: pedido.numero_pedido,
            cliente_id: Number(pedido.cliente_id),
            subtotal: Number(pedido.subtotal),
            desconto: Number(pedido.desconto),
            frete: Number(pedido.frete),
            total: Number(pedido.total),
            status: pedido.status,
            criado_em: pedido.criado_em,
            frete_status: 'a_confirmar_pelo_whatsapp'
        },
        endereco: pedido.nome_destinatario
            ? {
                nome_destinatario: pedido.nome_destinatario,
                telefone: pedido.endereco_telefone,
                cep: pedido.cep,
                rua: pedido.rua,
                numero: pedido.numero,
                complemento: pedido.complemento,
                bairro: pedido.bairro,
                cidade: pedido.cidade,
                estado: pedido.estado,
                pais: pedido.pais
            }
            : null,
        itens: itens.map((item) => ({
            produto_id: Number(item.produto_id),
            nome_produto: item.nome_produto,
            quantidade: Number(item.quantidade),
            preco_unitario: Number(item.preco_unitario),
            subtotal: Number(item.subtotal)
        })),
        pagamento
    };
}

async function criarPedido(req, res) {
    const clienteId = Number(req.cliente?.id);
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
    const requestedItems = normalizarItens(req.body?.items);
    const enderecoId = req.body?.endereco_id == null
        ? null
        : Number(req.body.endereco_id);
    const endereco = normalizarEndereco(req.body?.endereco);

    if (!Number.isSafeInteger(clienteId) || clienteId < 1) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Cliente não autenticado.'
        });
    }

    if (!/^[A-Za-z0-9._:-]{8,64}$/.test(idempotencyKey)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Chave de idempotência inválida.'
        });
    }

    if (!requestedItems) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Itens do carrinho inválidos ou vazios.'
        });
    }

    if (
        (enderecoId !== null && (!Number.isSafeInteger(enderecoId) || enderecoId < 1)) ||
        (enderecoId !== null && req.body?.endereco != null) ||
        (!endereco && enderecoId === null)
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe um endereço de entrega válido.'
        });
    }

    if (req.body?.endereco != null && !endereco) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Confira os dados de contato e entrega.'
        });
    }

    let pixKey;
    try {
        pixKey = obterChavePix(process.env.PIX_KEY);
    } catch (error) {
        return res.status(503).json({
            sucesso: false,
            mensagem: error.message
        });
    }

    const requestHash = createHash('sha256')
        .update(JSON.stringify({
            items: requestedItems,
            endereco_id: enderecoId,
            endereco
        }))
        .digest('hex');

    let connection;
    let transactionStarted = false;
    let transactionCommitted = false;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [clientes] = await connection.query(
            `
            SELECT id, ativo
            FROM clientes
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [clienteId]
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

        const [existingRequests] = await connection.query(
            `
            SELECT pedido_id, request_hash
            FROM pedido_idempotencia
            WHERE cliente_id = ? AND chave = ?
            LIMIT 1
            `,
            [clienteId, idempotencyKey]
        );

        if (existingRequests.length) {
            if (existingRequests[0].request_hash !== requestHash) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Esta chave já foi usada para outro pedido. Atualize e tente novamente.'
                });
            }

            const existingOrder = await buscarPedido(
                connection,
                existingRequests[0].pedido_id,
                clienteId,
                pixKey
            );

            if (!existingOrder) {
                throw new Error('Pedido idempotente não encontrado.');
            }

            await connection.commit();
            transactionCommitted = true;
            return res.status(200).json({
                sucesso: true,
                mensagem: 'Este pedido já havia sido registrado.',
                reutilizado: true,
                ...existingOrder
            });
        }

        let deliveryAddressId = enderecoId;

        if (deliveryAddressId !== null) {
            const [enderecos] = await connection.query(
                `
                SELECT id
                FROM enderecos
                WHERE id = ? AND cliente_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [deliveryAddressId, clienteId]
            );

            if (!enderecos.length) {
                await connection.rollback();
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Endereço de entrega inválido.'
                });
            }
        } else {
            const [addressResult] = await connection.query(
                `
                INSERT INTO enderecos
                (
                    cliente_id,
                    nome_destinatario,
                    telefone,
                    cep,
                    rua,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    clienteId,
                    endereco.nome_destinatario,
                    endereco.telefone,
                    endereco.cep,
                    endereco.rua,
                    endereco.numero,
                    endereco.complemento || null,
                    endereco.bairro,
                    endereco.cidade,
                    endereco.estado
                ]
            );
            deliveryAddressId = addressResult.insertId;
        }

        const ids = requestedItems.map((item) => item.id);
        const placeholders = ids.map(() => '?').join(', ');
        const [products] = await connection.query(
            `
            SELECT id, nome, preco, preco_promocional, estoque
            FROM produtos
            WHERE id IN (${placeholders}) AND ativo = TRUE
            FOR UPDATE
            `,
            ids
        );
        const productsById = new Map(
            products.map((product) => [Number(product.id), product])
        );
        const orderItems = [];
        let subtotalCents = 0;

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
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `Estoque insuficiente para ${product.nome}.`
                });
            }

            const regularPriceCents = Math.round(Number(product.preco) * 100);
            const promotionalPriceCents = Math.round(
                Number(product.preco_promocional || 0) * 100
            );
            const priceCents = promotionalPriceCents > 0 &&
                promotionalPriceCents < regularPriceCents
                ? promotionalPriceCents
                : regularPriceCents;
            const itemSubtotalCents = priceCents * item.quantity;

            if (
                !Number.isSafeInteger(priceCents) ||
                priceCents < 0 ||
                !Number.isSafeInteger(itemSubtotalCents) ||
                subtotalCents + itemSubtotalCents > MAX_DECIMAL_CENTS
            ) {
                await connection.rollback();
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O total do pedido excede o limite permitido.'
                });
            }

            subtotalCents += itemSubtotalCents;
            orderItems.push({
                produto_id: Number(product.id),
                nome_produto: product.nome,
                quantidade: item.quantity,
                estoque_antes: Number(product.estoque),
                preco_unitario: priceCents / 100,
                subtotal: itemSubtotalCents / 100
            });
        }

        if (subtotalCents < 1) {
            await connection.rollback();
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O total do pedido precisa ser maior que zero para pagamento Pix.'
            });
        }

        for (const item of orderItems) {
            const [result] = await connection.query(
                `
                UPDATE produtos
                SET estoque = estoque - ?
                WHERE id = ? AND ativo = TRUE AND estoque >= ?
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

        const subtotal = subtotalCents / 100;
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
                total,
                observacoes
            )
            VALUES (?, ?, ?, ?, 'aguardando_pagamento', ?, 0, 0, ?, ?)
            `,
            [
                clienteId,
                deliveryAddressId,
                reservaNumero.numero,
                reservaNumero.numero,
                subtotal,
                subtotal,
                'Frete a confirmar pelo WhatsApp.'
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
            INSERT INTO pagamentos (pedido_id, metodo, status, valor)
            VALUES (?, 'pix', 'pendente', ?)
            `,
            [pedidoId, subtotal]
        );
        await connection.query(
            `
            INSERT INTO pedido_idempotencia (cliente_id, chave, pedido_id, request_hash)
            VALUES (?, ?, ?, ?)
            `,
            [clienteId, idempotencyKey, pedidoId, requestHash]
        );

        const order = await buscarPedido(connection, pedidoId, clienteId, pixKey);
        await connection.commit();
        transactionCommitted = true;

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Pedido registrado. O pagamento Pix está disponível para pagamento; o frete será confirmado pelo WhatsApp.',
            reutilizado: false,
            ...order
        });
    } catch (error) {
        if (connection && transactionStarted && !transactionCommitted) {
            await connection.rollback();
        }

        logError('Erro ao criar pedido', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível registrar o pedido.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function consultarPedido(req, res) {
    const clienteId = Number(req.cliente?.id);
    const pedidoId = Number(req.params.id);
    if (
        !Number.isSafeInteger(clienteId) || clienteId < 1 ||
        !Number.isSafeInteger(pedidoId) || pedidoId < 1
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Pedido inválido.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const pedido = await buscarPedido(
            connection,
            pedidoId,
            clienteId,
            process.env.PIX_KEY
        );
        if (!pedido) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Pedido não encontrado.'
            });
        }

        return res.json({
            sucesso: true,
            ...pedido
        });
    } catch (error) {
        logError('Erro ao recuperar pedido do cliente', error);
        const pixConfigurationError = /chave Pix/i.test(error.message || '');
        return res.status(pixConfigurationError ? 503 : 500).json({
            sucesso: false,
            mensagem: pixConfigurationError
                ? error.message
                : 'Não foi possível carregar o pedido.'
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    criarPedido,
    consultarPedido
};
