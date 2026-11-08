const bcrypt = require('bcryptjs');
const { createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { reservarNumeroPedido, vincularNumeroPedido } = require('../utils/pedidoNumero');
const { registrarAuditoria } = require('../utils/auditoria');
const { logError } = require('../utils/logger');
const { startOfDayUtc, addDays } = require('../utils/periodo');

// Hash usado quando o e-mail não existe, para o login levar o mesmo tempo
// e não revelar quais e-mails estão cadastrados.
let dummyPasswordHash = null;
function getDummyPasswordHash() {
    if (!dummyPasswordHash) {
        dummyPasswordHash = bcrypt.hashSync('senha-inexistente-para-tempo-constante', 12);
    }
    return dummyPasswordHash;
}

const ORDER_STATUSES = new Set([
    'pendente',
    'aguardando_pagamento',
    'pago',
    'processando',
    'enviado',
    'entregue',
    'cancelado'
]);
const PAYMENT_STATUSES = new Set([
    'pendente',
    'processando',
    'aprovado',
    'recusado',
    'cancelado',
    'estornado'
]);

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function loginAdmin(req, res) {
    try {
        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';
        const senha = typeof req.body?.senha === 'string'
            ? req.body.senha
            : '';

        if (!email || !senha || email.length > 255 || senha.length > 200) {
            return res.status(400).json({ sucesso: false, mensagem: 'E-mail e senha são obrigatórios.' });
        }

        const [admins] = await pool.query(
            'SELECT id, nome, email, senha_hash, ativo FROM administradores WHERE email = ? LIMIT 1',
            [email]
        );

        const passwordMatches = await bcrypt.compare(
            senha,
            admins.length ? admins[0].senha_hash : getDummyPasswordHash()
        );
        if (!admins.length || !admins[0].ativo || !passwordMatches) {
            return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha inválidos.' });
        }

        const admin = admins[0];
        await pool.query('UPDATE administradores SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        const token = jwt.sign(
            { administrador_id: admin.id, email: admin.email, tipo: 'administrador' },
            process.env.JWT_SECRET,
            { algorithm: 'HS256', expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' }
        );

        return res.json({
            sucesso: true,
            token,
            administrador: { id: admin.id, nome: admin.nome, email: admin.email }
        });
    } catch (error) {
        logError('Erro no login administrativo', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível realizar o login.' });
    }
}

async function resumoAdmin(req, res) {
    try {
        const [[produtos]] = await pool.query('SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE');
        const [[categorias]] = await pool.query('SELECT COUNT(*) AS total FROM categorias WHERE ativo = TRUE');
        const [[clientes]] = await pool.query('SELECT COUNT(*) AS total FROM clientes WHERE ativo = TRUE');
        const [[estoqueBaixo]] = await pool.query('SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE AND estoque <= estoque_minimo');
        const [[pedidos]] = await pool.query(`
            SELECT
                COUNT(CASE WHEN p.status <> 'cancelado' THEN 1 END) AS total,
                COUNT(CASE WHEN p.status = 'aguardando_pagamento' THEN 1 END) AS aguardando_pagamento,
                COUNT(CASE WHEN p.status IN ('pago', 'processando', 'enviado', 'entregue') AND EXISTS (
                    SELECT 1 FROM pagamentos pg
                    WHERE pg.pedido_id = p.id AND pg.status = 'aprovado'
                ) THEN 1 END) AS pagos,
                COUNT(CASE WHEN p.status = 'processando' THEN 1 END) AS em_preparacao,
                COUNT(CASE WHEN p.status = 'enviado' THEN 1 END) AS enviados,
                COUNT(CASE WHEN p.status = 'cancelado' THEN 1 END) AS cancelados
            FROM pedidos p
        `);
        const [[faturamento]] = await pool.query(`
            SELECT COALESCE(SUM(pg.valor), 0) AS total
            FROM pagamentos pg
            INNER JOIN (
                SELECT pedido_id, MAX(id) AS pagamento_id
                FROM pagamentos
                GROUP BY pedido_id
            ) ultimo ON ultimo.pagamento_id = pg.id
            WHERE pg.status = 'aprovado'
        `);

        res.json({ sucesso: true, resumo: {
            produtos: produtos.total,
            categorias: categorias.total,
            clientes: clientes.total,
            estoqueBaixo: estoqueBaixo.total,
            pedidos: pedidos.total,
            pedidosAguardando: pedidos.aguardando_pagamento,
            pedidosPagos: pedidos.pagos,
            pedidosEmPreparacao: pedidos.em_preparacao,
            pedidosEnviados: pedidos.enviados,
            pedidosCancelados: pedidos.cancelados,
            faturamento: faturamento.total
        }});
    } catch (error) {
        logError('Erro ao carregar resumo administrativo', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar resumo.' });
    }
}

async function dashboardAdmin(req, res) {
    try {
        const [[resumo]] = await pool.query(`
            SELECT
                (
                    SELECT COALESCE(SUM(pg.valor), 0)
                    FROM pagamentos pg
                    INNER JOIN (
                        SELECT pedido_id, MAX(id) AS pagamento_id
                        FROM pagamentos
                        GROUP BY pedido_id
                    ) ultimo ON ultimo.pagamento_id = pg.id
                    WHERE pg.status = 'aprovado'
                ) AS faturamento,
                (SELECT COUNT(*) FROM pedidos WHERE status <> 'cancelado') AS pedidos,
                (SELECT COUNT(*) FROM clientes WHERE ativo = TRUE) AS clientes,
                (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE) AS produtos,
                (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE AND estoque <= estoque_minimo) AS estoque_baixo,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'aguardando_pagamento') AS pedidos_aguardando,
                (SELECT COUNT(*) FROM pedidos p WHERE p.status IN ('pago', 'processando', 'enviado', 'entregue') AND EXISTS (
                    SELECT 1 FROM pagamentos pg
                    WHERE pg.pedido_id = p.id AND pg.status = 'aprovado'
                )) AS pedidos_pagos,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'processando') AS pedidos_em_preparacao,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'enviado') AS pedidos_enviados,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'cancelado') AS pedidos_cancelados
        `);

        const [pedidosRecentes] = await pool.query(`
            SELECT
                p.id, p.numero_exibicao AS numero_pedido, p.numero_exibicao,
                p.status, p.total, p.criado_em,
                c.nome AS cliente
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            ORDER BY p.criado_em DESC
            LIMIT 8
        `);

        const [estoqueBaixo] = await pool.query(`
            SELECT p.id, p.nome, p.estoque, p.estoque_minimo, c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE p.ativo = TRUE AND p.estoque <= p.estoque_minimo
            ORDER BY p.estoque ASC, p.nome ASC
            LIMIT 8
        `);

        const [maisVendidos] = await pool.query(`
            SELECT
                i.produto_id,
                i.nome_produto AS nome,
                SUM(i.quantidade) AS unidades,
                SUM(i.subtotal) AS faturamento
            FROM itens_pedido i
            INNER JOIN pedidos p ON p.id = i.pedido_id
            WHERE EXISTS (
                SELECT 1 FROM pagamentos pg
                WHERE pg.pedido_id = p.id AND pg.status = 'aprovado'
            )
            GROUP BY i.produto_id, i.nome_produto
            ORDER BY unidades DESC, faturamento DESC
            LIMIT 5
        `);

        const alertas = [];
        if (Number(resumo.estoque_baixo) > 0) {
            alertas.push({ tipo: 'estoque', titulo: `${resumo.estoque_baixo} produto(s) com estoque baixo`, acao: 'products' });
        }

        const pedidosAguardando = Number(resumo.pedidos_aguardando);
        if (pedidosAguardando > 0) {
            alertas.push({ tipo: 'pedido', titulo: `${pedidosAguardando} pedido(s) precisam de atenção`, acao: 'overview' });
        }

        return res.json({ sucesso: true, dashboard: { resumo, pedidosRecentes, estoqueBaixo, maisVendidos, alertas } });
    } catch (error) {
        logError('Erro ao carregar dashboard administrativo', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar visão geral.' });
    }
}

async function listarPedidosAdmin(req, res) {
    try {
        const query = req.query || {};
        const page = Number(query.page || 1);
        const limit = Number(query.limit || 25);
        const search = typeof query.q === 'string' ? query.q.trim() : '';
        const status = typeof query.status === 'string' ? query.status : '';
        const paymentStatus = typeof query.payment_status === 'string' ? query.payment_status : '';
        const dateFrom = typeof query.date_from === 'string' ? query.date_from : '';
        const dateTo = typeof query.date_to === 'string' ? query.date_to : '';

        if (
            !Number.isSafeInteger(page) || page < 1 ||
            !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
            search.length > 100 ||
            (status && !ORDER_STATUSES.has(status)) ||
            (paymentStatus && !PAYMENT_STATUSES.has(paymentStatus)) ||
            (dateFrom && !isValidDate(dateFrom)) ||
            (dateTo && !isValidDate(dateTo)) ||
            (dateFrom && dateTo && dateFrom > dateTo)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Filtros de pedidos inválidos.'
            });
        }

        const conditions = [];
        const filterParams = [];
        if (search) {
            conditions.push(`(
                p.numero_exibicao LIKE ? OR p.numero_pedido LIKE ? OR c.nome LIKE ? OR c.telefone LIKE ?
                OR EXISTS (
                    SELECT 1 FROM enderecos e
                    WHERE e.id = p.endereco_id AND e.telefone LIKE ?
                )
            )`);
            filterParams.push(
                `%${search}%`,
                `%${search}%`,
                `%${search}%`,
                `%${search}%`,
                `%${search}%`
            );
        }
        if (status) {
            conditions.push('p.status = ?');
            filterParams.push(status);
        }
        if (paymentStatus) {
            conditions.push(`EXISTS (
                SELECT 1 FROM pagamentos pf
                WHERE pf.pedido_id = p.id AND pf.status = ?
            )`);
            filterParams.push(paymentStatus);
        }
        // Datas do filtro são dias no horário da loja; convertidas em limites UTC.
        if (dateFrom) {
            conditions.push('p.criado_em >= ?');
            filterParams.push(startOfDayUtc(dateFrom));
        }
        if (dateTo) {
            conditions.push('p.criado_em < ?');
            filterParams.push(startOfDayUtc(addDays(dateTo, 1)));
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;
        const [[countResult]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            ${whereClause}
        `, filterParams);

        const [pedidos] = await pool.query(`
            SELECT
                p.id,
                p.numero_exibicao AS numero_pedido,
                p.numero_exibicao,
                p.status,
                p.subtotal,
                p.desconto,
                p.frete,
                p.total,
                p.criado_em,
                p.atualizado_em,
                c.nome AS cliente_nome,
                c.email AS cliente_email,
                c.telefone AS cliente_telefone,
                e.nome_destinatario,
                e.telefone AS telefone_entrega,
                e.cep,
                e.rua,
                e.numero,
                e.complemento,
                e.bairro,
                e.cidade,
                e.estado,
                (
                    SELECT pg.status
                    FROM pagamentos pg
                    WHERE pg.pedido_id = p.id
                    ORDER BY pg.id DESC
                    LIMIT 1
                ) AS pagamento_status,
                (
                    SELECT pg.metodo
                    FROM pagamentos pg
                    WHERE pg.pedido_id = p.id
                    ORDER BY pg.id DESC
                    LIMIT 1
                ) AS pagamento_metodo
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN enderecos e ON e.id = p.endereco_id
            ${whereClause}
            ORDER BY p.criado_em DESC, p.id DESC
            LIMIT ? OFFSET ?
        `, [...filterParams, limit, offset]);

        if (pedidos.length) {
            const pedidoIds = pedidos.map((pedido) => pedido.id);
            const placeholders = pedidoIds.map(() => '?').join(', ');
            const [itens] = await pool.query(`
                SELECT pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal
                FROM itens_pedido
                WHERE pedido_id IN (${placeholders})
                ORDER BY pedido_id DESC, id ASC
            `, pedidoIds);
            const itensPorPedido = new Map();

            for (const item of itens) {
                const lista = itensPorPedido.get(Number(item.pedido_id)) || [];
                lista.push({
                    produto_id: Number(item.produto_id),
                    nome_produto: item.nome_produto,
                    quantidade: Number(item.quantidade),
                    preco_unitario: Number(item.preco_unitario),
                    subtotal: Number(item.subtotal)
                });
                itensPorPedido.set(Number(item.pedido_id), lista);
            }

            for (const pedido of pedidos) {
                pedido.itens = itensPorPedido.get(Number(pedido.id)) || [];
            }
        }

        return res.json({
            sucesso: true,
            pedidos,
            pagina: page,
            limite: limit,
            total: Number(countResult.total),
            totalPaginas: Math.ceil(Number(countResult.total) / limit)
        });
    } catch (error) {
        logError('Erro ao listar pedidos no admin', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar pedidos.'
        });
    }
}

async function criarPedidoAdmin(req, res) {
    const clienteId = req.body?.cliente_id == null || req.body.cliente_id === ''
        ? null
        : Number(req.body.cliente_id);
    const rawCustomer = req.body?.cliente;
    const rawAddress = req.body?.endereco;
    const rawItems = req.body?.itens;
    const idempotencyKey = typeof req.get === 'function'
        ? String(req.get('Idempotency-Key') || '').trim()
        : '';
    const observations = typeof req.body?.observacoes === 'string'
        ? req.body.observacoes.trim()
        : '';
    const phone = String(rawCustomer?.telefone || '').replace(/\D/g, '');
    const customer = {
        nome: String(rawCustomer?.nome || '').trim(),
        email: String(rawCustomer?.email || '').trim().toLowerCase(),
        telefone: phone
    };
    const addressText = (field) => String(rawAddress?.[field] || '').trim();
    const address = {
        nome_destinatario: addressText('nome_destinatario'),
        telefone: addressText('telefone').replace(/\D/g, ''),
        cep: addressText('cep').replace(/\D/g, ''),
        rua: addressText('rua'),
        numero: addressText('numero'),
        complemento: addressText('complemento'),
        bairro: addressText('bairro'),
        cidade: addressText('cidade'),
        estado: addressText('estado')
    };
    const quantities = new Map();
    if (Array.isArray(rawItems) && rawItems.length > 0 && rawItems.length <= 100) {
        for (const rawItem of rawItems) {
            const productId = Number(rawItem?.produto_id);
            const quantity = Number(rawItem?.quantidade);
            if (
                !Number.isSafeInteger(productId) || productId < 1 ||
                !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000
            ) {
                return res.status(400).json({ sucesso: false, mensagem: 'Confira os produtos e as quantidades do pedido.' });
            }
            quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        }
    } else {
        return res.status(400).json({ sucesso: false, mensagem: 'Adicione ao menos um produto ao pedido.' });
    }

    if (
        !/^[A-Za-z0-9._:-]{8,64}$/.test(idempotencyKey) ||
        (clienteId !== null && (!Number.isSafeInteger(clienteId) || clienteId < 1)) ||
        (clienteId === null && (
            customer.nome.length < 2 || customer.nome.length > 150 ||
            customer.telefone.length < 10 || customer.telefone.length > 13 ||
            customer.email.length > 255 ||
            (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
        )) ||
        address.nome_destinatario.length < 2 || address.nome_destinatario.length > 150 ||
        address.telefone.length < 10 || address.telefone.length > 13 ||
        address.cep.length !== 8 ||
        address.rua.length < 2 || address.rua.length > 200 ||
        address.numero.length < 1 || address.numero.length > 20 ||
        address.complemento.length > 100 ||
        address.bairro.length < 2 || address.bairro.length > 100 ||
        address.cidade.length < 2 || address.cidade.length > 100 ||
        address.estado.length < 2 || address.estado.length > 100 ||
        observations.length > 5000
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Confira os dados do cliente, endereço e observações.'
        });
    }

    const requestHash = createHash('sha256').update(JSON.stringify({
        cliente_id: clienteId,
        cliente: clienteId === null ? customer : null,
        endereco: address,
        itens: [...quantities.entries()]
            .sort(([left], [right]) => left - right)
            .map(([produto_id, quantidade]) => ({ produto_id, quantidade })),
        observacoes: observations
    })).digest('hex');

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let currentCustomer;
        let customerAlreadyExists = false;
        if (clienteId !== null) {
            const [customers] = await connection.query(
                'SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ? LIMIT 1 FOR UPDATE',
                [clienteId]
            );
            if (!customers.length || !customers[0].ativo) {
                await connection.rollback();
                return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado ou desativado.' });
            }
            currentCustomer = customers[0];
        } else {
            const email = customer.email || `telefone-${customer.telefone}@cliente.amanda.local`;
            const [existingCustomers] = await connection.query(`
                SELECT id, nome, email, telefone, ativo FROM clientes
                WHERE email = ?
                   OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') = ?
                LIMIT 1 FOR UPDATE
            `, [email, customer.telefone]);
            if (existingCustomers.length) {
                currentCustomer = existingCustomers[0];
                customerAlreadyExists = true;
            } else {
                const [createdCustomer] = await connection.query(`
                    INSERT INTO clientes (nome, email, provedor_login, provedor_id, telefone, ativo)
                    VALUES (?, ?, 'telefone', ?, ?, TRUE)
                `, [customer.nome, email, customer.telefone, customer.telefone]);
                currentCustomer = {
                    id: createdCustomer.insertId,
                    nome: customer.nome,
                    email,
                    telefone: customer.telefone,
                    ativo: 1
                };
            }
        }

        const [previousRequests] = await connection.query(`
            SELECT pedido_id, request_hash
            FROM pedido_idempotencia
            WHERE cliente_id = ? AND chave = ?
            LIMIT 1 FOR UPDATE
        `, [currentCustomer.id, idempotencyKey]);
        if (previousRequests.length) {
            if (previousRequests[0].request_hash !== requestHash) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Esta chave já foi usada para outro pedido. Atualize e tente novamente.'
                });
            }
            const [[existingOrder]] = await connection.query(`
                SELECT p.id, p.numero_exibicao AS numero_pedido, p.total, p.status,
                    c.id AS cliente_id, c.nome AS cliente_nome,
                    pg.status AS pagamento_status
                FROM pedidos p
                INNER JOIN clientes c ON c.id = p.cliente_id
                LEFT JOIN pagamentos pg ON pg.id = (
                    SELECT pg2.id FROM pagamentos pg2
                    WHERE pg2.pedido_id = p.id ORDER BY pg2.id DESC LIMIT 1
                )
                WHERE p.id = ? LIMIT 1
            `, [previousRequests[0].pedido_id]);
            if (!existingOrder) throw new Error('Pedido idempotente não encontrado.');
            await connection.commit();
            committed = true;
            return res.status(200).json({
                sucesso: true,
                mensagem: 'Este pedido já havia sido registrado.',
                reutilizado: true,
                pedido: {
                    ...existingOrder,
                    id: Number(existingOrder.id),
                    cliente_id: Number(existingOrder.cliente_id),
                    total: Number(existingOrder.total)
                }
            });
        }
        if (customerAlreadyExists) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este e-mail ou telefone já pertence a um cliente. Selecione-o na lista.'
            });
        }

        if (!address.telefone) address.telefone = String(currentCustomer.telefone || '').replace(/\D/g, '');
        if (address.telefone.length < 10 || address.telefone.length > 13) {
            await connection.rollback();
            return res.status(400).json({ sucesso: false, mensagem: 'Informe um WhatsApp válido para a entrega.' });
        }

        const [addressResult] = await connection.query(`
            INSERT INTO enderecos
                (cliente_id, nome_destinatario, telefone, cep, rua, numero,
                 complemento, bairro, cidade, estado, pais, principal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Brasil', FALSE)
        `, [
            currentCustomer.id,
            address.nome_destinatario,
            address.telefone,
            address.cep,
            address.rua,
            address.numero,
            address.complemento || null,
            address.bairro,
            address.cidade,
            address.estado
        ]);

        const productIds = [...quantities.keys()].sort((a, b) => a - b);
        const placeholders = productIds.map(() => '?').join(', ');
        const [products] = await connection.query(`
            SELECT id, nome, preco, preco_promocional, estoque
            FROM produtos
            WHERE id IN (${placeholders}) AND ativo = TRUE
            ORDER BY id ASC
            FOR UPDATE
        `, productIds);
        const productsById = new Map(products.map((product) => [Number(product.id), product]));
        const orderItems = [];
        let subtotalCents = 0;
        for (const productId of productIds) {
            const product = productsById.get(productId);
            const quantity = quantities.get(productId);
            if (!product) {
                await connection.rollback();
                return res.status(400).json({ sucesso: false, mensagem: 'Um dos produtos não está ativo ou não foi encontrado.' });
            }
            if (quantity > Number(product.estoque)) {
                await connection.rollback();
                return res.status(409).json({ sucesso: false, mensagem: `Estoque insuficiente para ${product.nome}.` });
            }
            const regularCents = Math.round(Number(product.preco) * 100);
            const promoCents = Math.round(Number(product.preco_promocional || 0) * 100);
            const unitCents = promoCents > 0 && promoCents < regularCents ? promoCents : regularCents;
            const itemCents = unitCents * quantity;
            if (!Number.isSafeInteger(itemCents) || itemCents < 1 || subtotalCents + itemCents > 9999999999) {
                await connection.rollback();
                return res.status(400).json({ sucesso: false, mensagem: 'O total do pedido excede o limite permitido.' });
            }
            subtotalCents += itemCents;
            orderItems.push({
                produto_id: productId,
                nome_produto: product.nome,
                quantidade: quantity,
                preco_unitario: unitCents / 100,
                subtotal: itemCents / 100,
                estoque_antes: Number(product.estoque)
            });
        }

        for (const item of orderItems) {
            const [stockUpdate] = await connection.query(`
                UPDATE produtos SET estoque = estoque - ?
                WHERE id = ? AND ativo = TRUE AND estoque >= ?
            `, [item.quantidade, item.produto_id, item.quantidade]);
            if (!stockUpdate.affectedRows) {
                await connection.rollback();
                return res.status(409).json({ sucesso: false, mensagem: `Estoque insuficiente para ${item.nome_produto}.` });
            }
        }

        const subtotal = subtotalCents / 100;
        const orderNumber = await reservarNumeroPedido(connection);
        const [orderResult] = await connection.query(`
            INSERT INTO pedidos
                (cliente_id, endereco_id, numero_pedido, numero_exibicao, status,
                 subtotal, desconto, frete, total, observacoes)
            VALUES (?, ?, ?, ?, 'aguardando_pagamento', ?, 0, 0, ?, ?)
        `, [
            currentCustomer.id,
            addressResult.insertId,
            orderNumber.numero,
            orderNumber.numero,
            subtotal,
            subtotal,
            observations || 'Pedido cadastrado pelo painel. Frete a confirmar pelo WhatsApp.'
        ]);
        const orderId = orderResult.insertId;
        await vincularNumeroPedido(connection, orderNumber.sequencial, orderId);

        for (const item of orderItems) {
            await connection.query(`
                INSERT INTO itens_pedido
                    (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                orderId,
                item.produto_id,
                item.nome_produto,
                item.quantidade,
                item.preco_unitario,
                item.subtotal
            ]);
            await connection.query(`
                INSERT INTO estoque_movimentacoes
                    (produto_id, administrador_id, pedido_id, tipo,
                     quantidade_anterior, quantidade_nova, diferenca, motivo)
                VALUES (?, ?, ?, 'baixa_pedido', ?, ?, ?, ?)
            `, [
                item.produto_id,
                req.admin.administrador_id,
                orderId,
                item.estoque_antes,
                item.estoque_antes - item.quantidade,
                -item.quantidade,
                `Baixa do pedido ${orderNumber.numero} cadastrado pelo painel.`
            ]);
        }
        await connection.query(
            "INSERT INTO pagamentos (pedido_id, metodo, status, valor) VALUES (?, 'pix', 'pendente', ?)",
            [orderId, subtotal]
        );
        await connection.query(`
            INSERT INTO pedido_idempotencia (cliente_id, chave, pedido_id, request_hash)
            VALUES (?, ?, ?, ?)
        `, [currentCustomer.id, idempotencyKey, orderId, requestHash]);
        await registrarAuditoria(connection, req, {
            acao: 'pedido.criado_admin',
            entidade: 'pedido',
            entidadeId: orderId,
            motivo: 'Pedido cadastrado pelo painel administrativo.',
            depois: {
                numero_pedido: orderNumber.numero,
                cliente_id: currentCustomer.id,
                subtotal,
                itens: orderItems.map(({ produto_id, quantidade, subtotal: itemSubtotal }) => ({
                    produto_id,
                    quantidade,
                    subtotal: itemSubtotal
                }))
            }
        });

        await connection.commit();
        committed = true;
        return res.status(201).json({
            sucesso: true,
            mensagem: 'Pedido cadastrado. O Pix está pendente de confirmação.',
            pedido: {
                id: Number(orderId),
                numero_pedido: orderNumber.numero,
                cliente_id: Number(currentCustomer.id),
                cliente_nome: currentCustomer.nome,
                total: subtotal,
                status: 'aguardando_pagamento',
                pagamento_status: 'pendente'
            }
        });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        logError('Erro ao cadastrar pedido pelo painel', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível cadastrar o pedido.' });
    } finally {
        if (connection) connection.release();
    }
}

async function detalhePedidoAdmin(req, res) {
    const pedidoId = Number(req.params.id);
    if (!Number.isSafeInteger(pedidoId) || pedidoId < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Pedido inválido.' });
    }

    try {
        const [[pedido]] = await pool.query(`
            SELECT
                p.id, p.numero_exibicao AS numero_pedido, p.numero_exibicao,
                p.status, p.subtotal, p.desconto, p.frete, p.total,
                p.observacoes, p.criado_em, p.atualizado_em,
                c.id AS cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
                c.telefone AS cliente_telefone,
                e.nome_destinatario, e.telefone AS telefone_entrega, e.cep, e.rua,
                e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.pais,
                pg.metodo AS pagamento_metodo, pg.status AS pagamento_status,
                pg.valor AS pagamento_valor, pg.transacao_id, pg.pago_em
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN enderecos e ON e.id = p.endereco_id
            LEFT JOIN pagamentos pg ON pg.id = (
                SELECT pg2.id FROM pagamentos pg2
                WHERE pg2.pedido_id = p.id
                ORDER BY pg2.id DESC
                LIMIT 1
            )
            WHERE p.id = ?
            LIMIT 1
        `, [pedidoId]);

        if (!pedido) {
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }

        const [itens] = await pool.query(`
            SELECT produto_id, nome_produto, quantidade, preco_unitario, subtotal
            FROM itens_pedido
            WHERE pedido_id = ?
            ORDER BY id ASC
        `, [pedidoId]);

        pedido.itens = itens.map((item) => ({
            produto_id: Number(item.produto_id),
            nome_produto: item.nome_produto,
            quantidade: Number(item.quantidade),
            preco_unitario: Number(item.preco_unitario),
            subtotal: Number(item.subtotal)
        }));
        return res.json({ sucesso: true, pedido });
    } catch (error) {
        logError('Erro ao carregar detalhes do pedido', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar detalhes do pedido.' });
    }
}

async function atualizarDetalhesPedidoAdmin(req, res) {
    const pedidoId = Number(req.params.id);
    const rawAddress = req.body?.endereco;
    const observations = req.body?.observacoes;
    if (!Number.isSafeInteger(pedidoId) || pedidoId < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Pedido inválido.' });
    }
    if (
        typeof observations !== 'string' ||
        observations.length > 5000 ||
        !rawAddress ||
        typeof rawAddress !== 'object' ||
        Array.isArray(rawAddress)
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe as observações e um endereço de entrega válido.'
        });
    }

    const text = (field) => String(rawAddress[field] || '').trim();
    const endereco = {
        nome_destinatario: text('nome_destinatario'),
        telefone: text('telefone').replace(/\D/g, ''),
        cep: text('cep').replace(/\D/g, ''),
        rua: text('rua'),
        numero: text('numero'),
        complemento: text('complemento'),
        bairro: text('bairro'),
        cidade: text('cidade'),
        estado: text('estado')
    };
    if (
        endereco.nome_destinatario.length < 2 || endereco.nome_destinatario.length > 150 ||
        endereco.telefone.length < 10 || endereco.telefone.length > 13 ||
        endereco.cep.length !== 8 ||
        endereco.rua.length < 2 || endereco.rua.length > 200 ||
        endereco.numero.length < 1 || endereco.numero.length > 20 ||
        endereco.complemento.length > 100 ||
        endereco.bairro.length < 2 || endereco.bairro.length > 100 ||
        endereco.cidade.length < 2 || endereco.cidade.length > 100 ||
        endereco.estado.length < 2 || endereco.estado.length > 100
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Confira os dados obrigatórios do endereço de entrega.'
        });
    }

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [orders] = await connection.query(
            'SELECT id, cliente_id FROM pedidos WHERE id = ? LIMIT 1 FOR UPDATE',
            [pedidoId]
        );
        if (!orders.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }
        const [[previousOrder]] = await connection.query(`
            SELECT p.observacoes, e.nome_destinatario, e.telefone, e.cep, e.rua,
                e.numero, e.complemento, e.bairro, e.cidade, e.estado
            FROM pedidos p
            LEFT JOIN enderecos e ON e.id = p.endereco_id
            WHERE p.id = ?
            LIMIT 1
            FOR UPDATE
        `, [pedidoId]);

        const [addressResult] = await connection.query(`
            INSERT INTO enderecos
            (
                cliente_id, nome_destinatario, telefone, cep, rua, numero,
                complemento, bairro, cidade, estado, pais, principal
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Brasil', FALSE)
        `, [
            orders[0].cliente_id,
            endereco.nome_destinatario,
            endereco.telefone,
            endereco.cep,
            endereco.rua,
            endereco.numero,
            endereco.complemento || null,
            endereco.bairro,
            endereco.cidade,
            endereco.estado
        ]);
        await connection.query(
            'UPDATE pedidos SET endereco_id = ?, observacoes = ? WHERE id = ?',
            [addressResult.insertId, observations.trim() || null, pedidoId]
        );
        await registrarAuditoria(connection, req, {
            acao: 'pedido.dados_atualizados',
            entidade: 'pedido',
            entidadeId: pedidoId,
            motivo: 'Correção administrativa de entrega/observações.',
            antes: {
                observacoes: previousOrder.observacoes,
                endereco: {
                    nome_destinatario: previousOrder.nome_destinatario,
                    telefone: previousOrder.telefone,
                    cep: previousOrder.cep,
                    rua: previousOrder.rua,
                    numero: previousOrder.numero,
                    complemento: previousOrder.complemento,
                    bairro: previousOrder.bairro,
                    cidade: previousOrder.cidade,
                    estado: previousOrder.estado
                }
            },
            depois: { observacoes: observations.trim() || null, endereco }
        });
        await connection.commit();
        committed = true;
        return res.json({
            sucesso: true,
            mensagem: 'Dados internos e endereço de entrega atualizados.'
        });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        logError('Erro ao atualizar dados do pedido', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível atualizar os dados do pedido.'
        });
    } finally {
        if (connection) connection.release();
    }
}

async function atualizarStatusPedidoAdmin(req, res) {
    const pedidoId = Number(req.params.id);
    const novoStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    const nextStatus = {
        pago: 'processando',
        processando: 'enviado',
        enviado: 'entregue'
    };
    let connection;
    let committed = false;

    if (!Number.isSafeInteger(pedidoId) || pedidoId < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Pedido inválido.' });
    }
    if (!['processando', 'enviado', 'entregue', 'cancelado'].includes(novoStatus)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Status solicitado inválido.' });
    }
    if (novoStatus === 'cancelado' && (motivo.length < 3 || motivo.length > 1000)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe o motivo do cancelamento (3 a 1000 caracteres).'
        });
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [pedidos] = await connection.query(
            'SELECT id, status FROM pedidos WHERE id = ? LIMIT 1 FOR UPDATE',
            [pedidoId]
        );

        if (!pedidos.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }

        const pedido = pedidos[0];
        if (novoStatus === 'cancelado') {
            if (pedido.status !== 'aguardando_pagamento') {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Somente pedidos aguardando pagamento podem ser cancelados por este painel.'
                });
            }

            const [pagamentos] = await connection.query(`
                SELECT id, status FROM pagamentos
                WHERE pedido_id = ? AND metodo = 'pix'
                ORDER BY id DESC LIMIT 1 FOR UPDATE
            `, [pedidoId]);
            if (!pagamentos.length || pagamentos[0].status !== 'pendente') {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'O pedido não possui Pix pendente; não é possível cancelar com segurança.'
                });
            }

            const [itens] = await connection.query(`
                SELECT produto_id, quantidade FROM itens_pedido
                WHERE pedido_id = ? ORDER BY produto_id ASC FOR UPDATE
            `, [pedidoId]);
            if (!itens.length) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'O pedido não possui itens para liberar o estoque.'
                });
            }

            for (const item of itens) {
                const [[produto]] = await connection.query(
                    'SELECT estoque FROM produtos WHERE id = ? LIMIT 1 FOR UPDATE',
                    [item.produto_id]
                );
                if (!produto) {
                    throw new Error(`Produto ${item.produto_id} do pedido não foi encontrado.`);
                }
                const estoqueAnterior = Number(produto.estoque);
                const estoqueNovo = estoqueAnterior + Number(item.quantidade);
                const [stockUpdate] = await connection.query(
                    'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
                    [item.quantidade, item.produto_id]
                );
                if (!stockUpdate.affectedRows) {
                    throw new Error(`Produto ${item.produto_id} do pedido não foi encontrado.`);
                }
                await connection.query(`
                    INSERT INTO estoque_movimentacoes
                        (produto_id, administrador_id, pedido_id, tipo,
                         quantidade_anterior, quantidade_nova, diferenca, motivo)
                    VALUES (?, ?, ?, 'devolucao_pedido', ?, ?, ?, ?)
                `, [
                    item.produto_id,
                    req.admin.administrador_id,
                    pedidoId,
                    estoqueAnterior,
                    estoqueNovo,
                    Number(item.quantidade),
                    `Devolução após cancelamento do pedido ${pedidoId}.`
                ]);
            }

            const [paymentUpdate] = await connection.query(
                "UPDATE pagamentos SET status = 'cancelado' WHERE id = ? AND status = 'pendente'",
                [pagamentos[0].id]
            );
            if (!paymentUpdate.affectedRows) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'O pagamento foi atualizado; o cancelamento foi interrompido.'
                });
            }
        } else {
            if (nextStatus[pedido.status] !== novoStatus) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'A transição solicitada não é permitida.'
                });
            }

            const [pagamentos] = await connection.query(`
                SELECT id FROM pagamentos
                WHERE pedido_id = ? AND status = 'aprovado'
                ORDER BY id DESC LIMIT 1 FOR UPDATE
            `, [pedidoId]);
            if (!pagamentos.length) {
                await connection.rollback();
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'O Pix precisa estar confirmado antes de avançar o pedido.'
                });
            }
        }

        const [orderUpdate] = await connection.query(
            'UPDATE pedidos SET status = ? WHERE id = ? AND status = ?',
            [novoStatus, pedidoId, pedido.status]
        );
        if (!orderUpdate.affectedRows) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'O status do pedido foi alterado. Atualize os dados e tente novamente.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: novoStatus === 'cancelado' ? 'pedido.cancelado' : 'pedido.status_atualizado',
            entidade: 'pedido',
            entidadeId: pedidoId,
            motivo: motivo || null,
            antes: { status: pedido.status },
            depois: { status: novoStatus }
        });

        await connection.commit();
        committed = true;
        return res.json({ sucesso: true, mensagem: 'Status do pedido atualizado.' });
    } catch (error) {
        if (connection && !committed) {
            await connection.rollback();
        }
        logError('Erro ao atualizar status do pedido', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível atualizar o status do pedido.'
        });
    } finally {
        if (connection) connection.release();
    }
}

async function confirmarPagamentoPixAdmin(req, res) {
    const pedidoId = Number(req.params.id);
    let connection;

    if (!Number.isInteger(pedidoId) || pedidoId < 1) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Pedido inválido.'
        });
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [pedidos] = await connection.query(
            `
            SELECT id, status
            FROM pedidos
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [pedidoId]
        );

        if (!pedidos.length) {
            await connection.rollback();
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Pedido não encontrado.'
            });
        }

        if (pedidos[0].status === 'pago') {
            await connection.rollback();
            return res.json({
                sucesso: true,
                mensagem: 'Este pedido já está pago.'
            });
        }

        if (pedidos[0].status !== 'aguardando_pagamento') {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este pedido não pode ser confirmado como pago.'
            });
        }

        const [pagamentos] = await connection.query(
            `
            SELECT id, status, valor, pago_em
            FROM pagamentos
            WHERE pedido_id = ?
              AND metodo = 'pix'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [pedidoId]
        );

        if (!pagamentos.length || pagamentos[0].status !== 'pendente') {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Não há um pagamento Pix pendente para este pedido.'
            });
        }

        const [paymentUpdate] = await connection.query(
            `
            UPDATE pagamentos
            SET status = 'aprovado',
                pago_em = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'pendente'
            `,
            [pagamentos[0].id]
        );

        if (!paymentUpdate.affectedRows) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'O pagamento já foi atualizado.'
            });
        }

        const [orderUpdate] = await connection.query(
            `
            UPDATE pedidos
            SET status = 'pago'
            WHERE id = ?
              AND status = 'aguardando_pagamento'
            `,
            [pedidoId]
        );

        if (!orderUpdate.affectedRows) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'O status do pedido foi alterado. Atualize o histórico.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: 'pagamento.pix_confirmado',
            entidade: 'pedido',
            entidadeId: pedidoId,
            motivo: 'Confirmação manual após conferência do recebimento.',
            antes: {
                status: pagamentos[0].status,
                valor: Number(pagamentos[0].valor),
                pago_em: pagamentos[0].pago_em
            },
            depois: {
                status: 'aprovado',
                valor: Number(pagamentos[0].valor),
                pedido_status: 'pago'
            }
        });

        await connection.commit();
        return res.json({
            sucesso: true,
            mensagem: 'Pagamento Pix confirmado.'
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        logError('Erro ao confirmar pagamento Pix no admin', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível confirmar o pagamento Pix.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function reverterPagamentoPixAdmin(req, res) {
    const pedidoId = Number(req.params.id);
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!Number.isSafeInteger(pedidoId) || pedidoId < 1 || motivo.length < 3 || motivo.length > 1000) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe um pedido válido e o motivo da correção (3 a 1000 caracteres).'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [pedidos] = await connection.query(
            'SELECT id, status FROM pedidos WHERE id = ? LIMIT 1 FOR UPDATE',
            [pedidoId]
        );
        if (!pedidos.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }
        if (pedidos[0].status !== 'pago') {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Só é possível reverter o Pix enquanto o pedido ainda estiver com status Pago.'
            });
        }

        const [pagamentos] = await connection.query(`
            SELECT id, status, valor, pago_em
            FROM pagamentos
            WHERE pedido_id = ? AND metodo = 'pix'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
        `, [pedidoId]);
        if (!pagamentos.length || pagamentos[0].status !== 'aprovado') {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Não há um pagamento Pix aprovado para corrigir.'
            });
        }

        const pagamento = pagamentos[0];
        const [paymentUpdate] = await connection.query(`
            UPDATE pagamentos
            SET status = 'pendente', pago_em = NULL
            WHERE id = ? AND status = 'aprovado'
        `, [pagamento.id]);
        if (!paymentUpdate.affectedRows) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'O pagamento foi atualizado por outra operação; recarregue o pedido.'
            });
        }

        const [orderUpdate] = await connection.query(`
            UPDATE pedidos
            SET status = 'aguardando_pagamento'
            WHERE id = ? AND status = 'pago'
        `, [pedidoId]);
        if (!orderUpdate.affectedRows) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'O pedido avançou de status; a correção foi cancelada.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: 'pagamento.pix_revertido_para_pendente',
            entidade: 'pedido',
            entidadeId: pedidoId,
            motivo,
            antes: {
                pagamento_status: pagamento.status,
                valor: Number(pagamento.valor),
                pago_em: pagamento.pago_em,
                pedido_status: pedidos[0].status
            },
            depois: {
                pagamento_status: 'pendente',
                valor: Number(pagamento.valor),
                pago_em: null,
                pedido_status: 'aguardando_pagamento'
            }
        });
        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Pagamento voltou para pendente.' });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao reverter pagamento Pix no admin', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível corrigir o pagamento Pix.'
        });
    } finally {
        if (connection) connection.release();
    }
}

async function listarMovimentacoesEstoqueAdmin(req, res) {
    const produtoId = req.query.produto_id ? Number(req.query.produto_id) : null;
    if (produtoId !== null && (!Number.isSafeInteger(produtoId) || produtoId < 1)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
    }

    try {
        const where = produtoId ? 'WHERE m.produto_id = ?' : '';
        const [movimentacoes] = await pool.query(`
            SELECT m.id, m.produto_id, p.nome AS produto_nome, m.administrador_id,
                a.nome AS administrador_nome, m.pedido_id, pe.numero_exibicao,
                m.tipo, m.quantidade_anterior, m.quantidade_nova, m.diferenca,
                m.motivo, m.criado_em
            FROM estoque_movimentacoes m
            INNER JOIN produtos p ON p.id = m.produto_id
            LEFT JOIN administradores a ON a.id = m.administrador_id
            LEFT JOIN pedidos pe ON pe.id = m.pedido_id
            ${where}
            ORDER BY m.id DESC
            LIMIT 100
        `, produtoId ? [produtoId] : []);
        return res.json({ sucesso: true, movimentacoes });
    } catch (error) {
        logError('Erro ao listar movimentações de estoque', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível carregar o histórico de estoque.'
        });
    }
}

async function listarAuditoriaAdmin(req, res) {
    try {
        const [registros] = await pool.query(`
            SELECT a.id, a.administrador_id, ad.nome AS administrador_nome,
                a.acao, a.entidade, a.entidade_id, a.motivo,
                a.antes_json, a.depois_json, a.criado_em
            FROM admin_auditoria a
            LEFT JOIN administradores ad ON ad.id = a.administrador_id
            ORDER BY a.id DESC
            LIMIT 200
        `);
        return res.json({ sucesso: true, registros });
    } catch (error) {
        logError('Erro ao listar auditoria administrativa', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível carregar o histórico administrativo.'
        });
    }
}

async function movimentarEstoqueAdmin(req, res) {
    const produtoId = Number(req.body?.produto_id);
    const tipo = req.body?.tipo;
    const quantidade = Number(req.body?.quantidade);
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    const chaveIdempotencia = typeof req.get === 'function'
        ? req.get('Idempotency-Key')
        : '';
    const tiposValidos = new Set(['entrada', 'saida', 'ajuste']);
    if (
        !Number.isSafeInteger(produtoId) || produtoId < 1 ||
        !tiposValidos.has(tipo) ||
        !Number.isSafeInteger(quantidade) || quantidade < 0 ||
        (tipo !== 'ajuste' && quantidade < 1) ||
        quantidade > 4294967295 ||
        motivo.length < 3 || motivo.length > 1000 ||
        typeof chaveIdempotencia !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chaveIdempotencia)
    ) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Confira o produto, o tipo, a quantidade, o motivo e a chave da movimentação.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [products] = await connection.query(
            'SELECT id, estoque FROM produtos WHERE id = ? LIMIT 1 FOR UPDATE',
            [produtoId]
        );
        if (!products.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        }

        const [previousMovements] = await connection.query(`
            SELECT produto_id, tipo, quantidade_anterior, quantidade_nova,
                diferenca, motivo
            FROM estoque_movimentacoes
            WHERE chave_idempotencia = ?
            LIMIT 1
        `, [chaveIdempotencia]);
        if (previousMovements.length) {
            const previousMovement = previousMovements[0];
            const sameRequest = Number(previousMovement.produto_id) === produtoId &&
                previousMovement.tipo === tipo &&
                previousMovement.motivo === motivo &&
                (tipo === 'ajuste'
                    ? Number(previousMovement.quantidade_nova) === quantidade
                    : Math.abs(Number(previousMovement.diferenca)) === quantidade);
            await connection.rollback();
            if (!sameRequest) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Esta chave já foi usada em outra movimentação.'
                });
            }
            return res.json({
                sucesso: true,
                estoque_anterior: Number(previousMovement.quantidade_anterior),
                estoque: Number(previousMovement.quantidade_nova),
                reutilizado: true,
                mensagem: 'Esta movimentação já havia sido registrada.'
            });
        }

        const estoqueAnterior = Number(products[0].estoque);
        const estoqueNovo = tipo === 'ajuste'
            ? quantidade
            : tipo === 'entrada'
                ? estoqueAnterior + quantidade
                : estoqueAnterior - quantidade;
        if (estoqueNovo < 0 || estoqueNovo > 4294967295) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: tipo === 'saida'
                    ? 'A saída é maior que o estoque disponível.'
                    : 'A quantidade resultante excede o limite permitido.'
            });
        }

        await connection.query('UPDATE produtos SET estoque = ? WHERE id = ?', [estoqueNovo, produtoId]);
        await connection.query(`
            INSERT INTO estoque_movimentacoes
                (produto_id, administrador_id, tipo, quantidade_anterior,
                 quantidade_nova, diferenca, motivo, chave_idempotencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            produtoId,
            req.admin.administrador_id,
            tipo,
            estoqueAnterior,
            estoqueNovo,
            estoqueNovo - estoqueAnterior,
            motivo,
            chaveIdempotencia
        ]);
        await registrarAuditoria(connection, req, {
            acao: `estoque.${tipo}`,
            entidade: 'produto',
            entidadeId: produtoId,
            motivo,
            antes: { estoque: estoqueAnterior },
            depois: { estoque: estoqueNovo }
        });
        await connection.commit();
        return res.json({
            sucesso: true,
            estoque_anterior: estoqueAnterior,
            estoque: estoqueNovo,
            mensagem: 'Estoque atualizado e movimentação registrada.'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'A movimentação foi recebida duas vezes. Atualize o histórico antes de tentar novamente.'
            });
        }
        logError('Erro ao movimentar estoque no admin', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível atualizar o estoque.'
        });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Lista clientes com total de pedidos, total gasto (Pix aprovado) e última compra.
 *
 * Sem GROUP BY na consulta externa: os totais vêm de agregações separadas,
 * o que funciona com ONLY_FULL_GROUP_BY no MySQL e no MariaDB e evita uma
 * subconsulta por cliente.
 *
 * Paginação e busca são opcionais (?page=&limit=&q=&ativo=). Sem esses
 * parâmetros a resposta continua igual à anterior (todos os clientes).
 */
async function listarClientesAdmin(req, res) {
    const query = req.query || {};
    const paginated = query.page !== undefined || query.limit !== undefined;
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 25);
    const search = typeof query.q === 'string' ? query.q.trim() : '';
    const ativo = typeof query.ativo === 'string' ? query.ativo : '';

    if (
        !Number.isSafeInteger(page) || page < 1 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
        search.length > 100 ||
        (ativo && !['true', 'false'].includes(ativo))
    ) {
        return res.status(400).json({ sucesso: false, mensagem: 'Filtros de clientes inválidos.' });
    }

    const conditions = [];
    const params = [];
    if (search) {
        conditions.push('(c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search.replace(/\D/g, '') || search}%`);
    }
    if (ativo) {
        conditions.push('c.ativo = ?');
        params.push(ativo === 'true' ? 1 : 0);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        let total = null;
        if (paginated) {
            const [[countResult]] = await pool.query(
                `SELECT COUNT(*) AS total FROM clientes c ${whereClause}`,
                params
            );
            total = Number(countResult.total);
        }

        const [clientes] = await pool.query(`
            SELECT
                c.id,
                c.nome,
                c.email,
                c.telefone,
                c.foto_url,
                c.anotacao_admin,
                c.ativo,
                c.criado_em,
                COALESCE(ped.total_pedidos, 0) AS total_pedidos,
                COALESCE(gasto.total_gasto, 0) AS total_gasto,
                ped.ultima_compra
            FROM clientes c
            LEFT JOIN (
                SELECT cliente_id, COUNT(*) AS total_pedidos, MAX(criado_em) AS ultima_compra
                FROM pedidos
                WHERE status <> 'cancelado'
                GROUP BY cliente_id
            ) ped ON ped.cliente_id = c.id
            LEFT JOIN (
                SELECT p2.cliente_id, SUM(pg.valor) AS total_gasto
                FROM pagamentos pg
                INNER JOIN (
                    SELECT pedido_id, MAX(id) AS pagamento_id
                    FROM pagamentos
                    GROUP BY pedido_id
                ) ultimo ON ultimo.pagamento_id = pg.id
                INNER JOIN pedidos p2 ON p2.id = pg.pedido_id
                WHERE pg.status = 'aprovado'
                GROUP BY p2.cliente_id
            ) gasto ON gasto.cliente_id = c.id
            ${whereClause}
            ORDER BY ped.ultima_compra DESC, c.nome ASC
            ${paginated ? 'LIMIT ? OFFSET ?' : ''}
        `, paginated ? [...params, limit, (page - 1) * limit] : params);

        if (!paginated) {
            return res.json({ sucesso: true, clientes });
        }

        return res.json({
            sucesso: true,
            clientes,
            pagina: page,
            limite: limit,
            total,
            totalPaginas: Math.ceil(total / limit)
        });
    } catch (error) {
        logError('Erro ao listar clientes no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar clientes.' });
    }
}

async function atualizarClienteAdmin(req, res) {
    const id = Number(req.params.id);
    const body = req.body || {};
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.replace(/\D/g, '') : '';
    const rawAddress = body.endereco;
    if (
        !Number.isSafeInteger(id) || id < 1 ||
        nome.length < 2 || nome.length > 150 ||
        email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        (telefone && (telefone.length < 10 || telefone.length > 13)) ||
        (rawAddress !== undefined && (!rawAddress || typeof rawAddress !== 'object' || Array.isArray(rawAddress)))
    ) {
        return res.status(400).json({ sucesso: false, mensagem: 'Confira o nome, e-mail, WhatsApp e endereço do cliente.' });
    }

    let address = null;
    if (rawAddress) {
        const text = (field) => String(rawAddress[field] || '').trim();
        const addressFieldsProvided = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado']
            .some((field) => text(field));
        if (addressFieldsProvided) {
            address = {
                nome_destinatario: text('nome_destinatario') || nome,
                telefone: text('telefone').replace(/\D/g, '') || telefone,
                cep: text('cep').replace(/\D/g, ''),
                rua: text('rua'),
                numero: text('numero'),
                complemento: text('complemento'),
                bairro: text('bairro'),
                cidade: text('cidade'),
                estado: text('estado')
            };
            if (
                address.nome_destinatario.length < 2 || address.nome_destinatario.length > 150 ||
                (address.telefone && (address.telefone.length < 10 || address.telefone.length > 13)) ||
                address.cep.length !== 8 || address.rua.length < 2 || address.rua.length > 200 ||
                address.numero.length < 1 || address.numero.length > 20 || address.complemento.length > 100 ||
                address.bairro.length < 2 || address.bairro.length > 100 ||
                address.cidade.length < 2 || address.cidade.length > 100 ||
                address.estado.length < 2 || address.estado.length > 100
            ) {
                return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do endereço.' });
            }
        }
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [clients] = await connection.query(`
            SELECT id, nome, email, telefone
            FROM clientes
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        `, [id]);
        if (!clients.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }

        const [previousAddresses] = await connection.query(`
            SELECT id, nome_destinatario, telefone, cep, rua, numero, complemento,
                bairro, cidade, estado
            FROM enderecos
            WHERE cliente_id = ? AND principal = TRUE
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
        `, [id]);
        const previous = clients[0];
        const previousAddress = previousAddresses[0] || null;
        if (address && previousAddress && [
            'nome_destinatario', 'telefone', 'cep', 'rua', 'numero',
            'complemento', 'bairro', 'cidade', 'estado'
        ].every((field) => String(address[field] || '') === String(previousAddress[field] || ''))) {
            address = null;
        }
        await connection.query(
            'UPDATE clientes SET nome = ?, email = ?, telefone = ? WHERE id = ?',
            [nome, email, telefone || null, id]
        );
        if (address) {
            await connection.query('UPDATE enderecos SET principal = FALSE WHERE cliente_id = ?', [id]);
            await connection.query(`
                INSERT INTO enderecos
                    (cliente_id, nome_destinatario, telefone, cep, rua, numero,
                     complemento, bairro, cidade, estado, pais, principal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Brasil', TRUE)
            `, [
                id,
                address.nome_destinatario,
                address.telefone || null,
                address.cep,
                address.rua,
                address.numero,
                address.complemento || null,
                address.bairro,
                address.cidade,
                address.estado
            ]);
        }
        await registrarAuditoria(connection, req, {
            acao: 'cliente.dados_atualizados',
            entidade: 'cliente',
            entidadeId: id,
            motivo: 'Correção administrativa de cadastro.',
            antes: {
                nome: previous.nome,
                email: previous.email,
                telefone: previous.telefone,
                endereco: previousAddress
            },
            depois: {
                nome,
                email,
                telefone: telefone || null,
                endereco: address || previousAddress
            }
        });
        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Cadastro do cliente atualizado.' });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Este e-mail já pertence a outro cliente.' });
        }
        logError('Erro ao atualizar cliente no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o cliente.' });
    } finally {
        if (connection) connection.release();
    }
}

async function setClienteAtivoAdmin(req, res, ativo) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Cliente inválido.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [clients] = await connection.query(
            'SELECT id, ativo FROM clientes WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );
        if (!clients.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }
        const ativoAnterior = Number(clients[0].ativo) === 1;
        if (ativoAnterior === ativo) {
            await connection.rollback();
            return res.json({
                sucesso: true,
                mensagem: ativo ? 'Cliente já está ativo.' : 'Cliente já está desativado.'
            });
        }
        await connection.query('UPDATE clientes SET ativo = ? WHERE id = ?', [ativo, id]);
        await registrarAuditoria(connection, req, {
            acao: ativo ? 'cliente.reativado' : 'cliente.desativado',
            entidade: 'cliente',
            entidadeId: id,
            motivo: ativo ? 'Reativação solicitada no painel.' : 'Desativação solicitada no painel.',
            antes: { ativo: ativoAnterior },
            depois: { ativo }
        });
        await connection.commit();
        return res.json({
            sucesso: true,
            mensagem: ativo ? 'Cliente reativado; o histórico foi preservado.' : 'Cliente desativado; o histórico foi preservado.'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao atualizar status do cliente no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o cliente.' });
    } finally {
        if (connection) connection.release();
    }
}

async function excluirClienteAdmin(req, res) {
    return setClienteAtivoAdmin(req, res, false);
}

async function atualizarStatusClienteAdmin(req, res) {
    if (typeof req.body?.ativo !== 'boolean') {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe se o cliente deve ficar ativo ou inativo.' });
    }
    return setClienteAtivoAdmin(req, res, req.body.ativo);
}

async function atualizarAnotacaoClienteAdmin(req, res) {
    const id = Number(req.params.id);
    const anotacao = typeof req.body?.anotacao === 'string' ? req.body.anotacao.trim() : '';

    if (!Number.isInteger(id) || id < 1 || anotacao.length > 5000) {
        return res.status(400).json({ sucesso: false, mensagem: 'Anotação inválida.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [clients] = await connection.query(
            'SELECT id, anotacao_admin FROM clientes WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );
        if (!clients.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }
        await connection.query(
            'UPDATE clientes SET anotacao_admin = ? WHERE id = ?',
            [anotacao || null, id]
        );
        await registrarAuditoria(connection, req, {
            acao: 'cliente.anotacao_atualizada',
            entidade: 'cliente',
            entidadeId: id,
            motivo: 'Atualização de anotação interna.',
            antes: { anotacao: clients[0].anotacao_admin },
            depois: { anotacao: anotacao || null }
        });
        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Anotação salva.' });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao salvar anotação do cliente', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível salvar a anotação.' });
    } finally {
        if (connection) connection.release();
    }
}

async function listarHistoricoClienteAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Cliente inválido.' });
    }

    try {
        const [[cliente]] = await pool.query(
            'SELECT id, nome, email, telefone, foto_url, anotacao_admin, ativo, criado_em FROM clientes WHERE id = ? LIMIT 1',
            [id]
        );

        if (!cliente) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }

        const [enderecos] = await pool.query(`
            SELECT id, nome_destinatario, telefone, cep, rua, numero, complemento,
                bairro, cidade, estado, pais, principal, criado_em
            FROM enderecos
            WHERE cliente_id = ?
            ORDER BY principal DESC, atualizado_em DESC, id DESC
        `, [id]);

        const [pedidos] = await pool.query(`
            SELECT
                p.id,
                p.numero_exibicao AS numero_pedido,
                p.numero_exibicao,
                p.status,
                p.subtotal,
                p.desconto,
                p.frete,
                p.total,
                p.criado_em,
                e.nome_destinatario,
                e.telefone AS telefone_entrega,
                e.cep,
                e.rua,
                e.numero,
                e.complemento,
                e.bairro,
                e.cidade,
                e.estado,
                (
                    SELECT pg.status
                    FROM pagamentos pg
                    WHERE pg.pedido_id = p.id
                    ORDER BY pg.id DESC
                    LIMIT 1
                ) AS pagamento_status
            FROM pedidos p
            LEFT JOIN enderecos e ON e.id = p.endereco_id
            WHERE p.cliente_id = ?
            ORDER BY p.criado_em DESC
        `, [id]);

        if (pedidos.length) {
            const pedidoIds = pedidos.map((pedido) => pedido.id);
            const placeholders = pedidoIds.map(() => '?').join(', ');
            const [itens] = await pool.query(`
                SELECT pedido_id, nome_produto, quantidade, preco_unitario, subtotal
                FROM itens_pedido
                WHERE pedido_id IN (${placeholders})
                ORDER BY id ASC
            `, pedidoIds);

            const itensPorPedido = new Map();
            itens.forEach((item) => {
                const lista = itensPorPedido.get(item.pedido_id) || [];
                lista.push(item);
                itensPorPedido.set(item.pedido_id, lista);
            });

            pedidos.forEach((pedido) => {
                pedido.itens = itensPorPedido.get(pedido.id) || [];
            });
        }

        return res.json({ sucesso: true, cliente, enderecos, pedidos });
    } catch (error) {
        logError('Erro ao carregar histórico do cliente', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar histórico do cliente.' });
    }
}

async function listarProdutosAdmin(req, res) {
    try {
        const [produtos] = await pool.query(`
                 SELECT p.id, p.nome, p.sku, p.preco, p.preco_promocional, p.estoque,
                     p.estoque_minimo, p.ativo, p.destaque, p.categoria_id, p.descricao,
                     (SELECT pi.imagem_url FROM produto_imagens pi WHERE pi.produto_id = p.id AND pi.principal = TRUE ORDER BY pi.ordem LIMIT 1) AS imagem_principal,
                     c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            ORDER BY p.id DESC
        `);
        res.json({ sucesso: true, produtos });
    } catch (error) {
        logError('Erro ao listar produtos no admin', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar produtos.' });
    }
}

async function listarCategoriasAdmin(req, res) {
    try {
        const [categorias] = await pool.query(
            'SELECT id, nome, slug, descricao, imagem_url, ativo FROM categorias ORDER BY nome ASC'
        );
        res.json({ sucesso: true, categorias });
    } catch (error) {
        logError('Erro ao listar categorias no admin', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar categorias.' });
    }
}

function lerDadosCategoria(body = {}) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
    if (nome.length < 2 || nome.length > 100 || descricao.length > 2000) return null;
    const slug = slugify(nome);
    if (!slug) return null;
    return { nome, slug, descricao: descricao || null };
}

async function criarCategoriaAdmin(req, res) {
    const categoria = lerDadosCategoria(req.body);
    if (!categoria) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe um nome de categoria válido (2 a 100 caracteres).' });
    }

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [result] = await connection.query(
            'INSERT INTO categorias (nome, slug, descricao, ativo) VALUES (?, ?, ?, TRUE)',
            [categoria.nome, categoria.slug, categoria.descricao]
        );
        await registrarAuditoria(connection, req, {
            acao: 'categoria.criada',
            entidade: 'categoria',
            entidadeId: result.insertId,
            motivo: 'Cadastro de categoria.',
            antes: null,
            depois: { ...categoria, ativo: true }
        });
        await connection.commit();
        committed = true;

        return res.status(201).json({
            sucesso: true,
            id: result.insertId,
            mensagem: 'Categoria criada.'
        });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma categoria com esse nome.' });
        }

        logError('Erro ao criar categoria no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível criar a categoria.' });
    } finally {
        if (connection) connection.release();
    }
}

async function atualizarCategoriaAdmin(req, res) {
    const id = Number(req.params.id);
    const categoria = lerDadosCategoria(req.body);
    const ativo = req.body?.ativo;
    if (!Number.isSafeInteger(id) || id < 1 || !categoria || (ativo !== undefined && typeof ativo !== 'boolean')) {
        return res.status(400).json({ sucesso: false, mensagem: 'Confira o nome, a descrição e a situação da categoria.' });
    }

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[anterior]] = await connection.query(
            'SELECT id, nome, slug, descricao, ativo FROM categorias WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );
        if (!anterior) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada.' });
        }
        const novoAtivo = ativo === undefined ? Number(anterior.ativo) === 1 : ativo;
        await connection.query(
            'UPDATE categorias SET nome = ?, slug = ?, descricao = ?, ativo = ? WHERE id = ?',
            [categoria.nome, categoria.slug, categoria.descricao, novoAtivo, id]
        );
        await registrarAuditoria(connection, req, {
            acao: 'categoria.atualizada',
            entidade: 'categoria',
            entidadeId: id,
            motivo: novoAtivo === (Number(anterior.ativo) === 1)
                ? 'Edição de categoria.'
                : (novoAtivo ? 'Categoria reativada.' : 'Categoria desativada; seus produtos saem da loja.'),
            antes: {
                nome: anterior.nome,
                slug: anterior.slug,
                descricao: anterior.descricao,
                ativo: Number(anterior.ativo) === 1
            },
            depois: { ...categoria, ativo: novoAtivo }
        });
        await connection.commit();
        committed = true;
        return res.json({ sucesso: true, mensagem: 'Categoria atualizada.' });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma categoria com esse nome.' });
        }
        logError('Erro ao atualizar categoria no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar a categoria.' });
    } finally {
        if (connection) connection.release();
    }
}

async function excluirCategoriaAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
    }

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[categoria]] = await connection.query(
            'SELECT id, nome, slug, descricao, ativo FROM categorias WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (!categoria) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada.' });
        }

        const [[vinculo]] = await connection.query(
            'SELECT COUNT(*) AS total FROM produtos WHERE categoria_id = ?',
            [id]
        );

        if (Number(vinculo.total) > 0) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Esta categoria possui produtos vinculados. Mova os produtos ou desative a categoria.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: 'categoria.excluida',
            entidade: 'categoria',
            entidadeId: id,
            motivo: 'Exclusão de categoria sem produtos.',
            antes: {
                nome: categoria.nome,
                slug: categoria.slug,
                descricao: categoria.descricao,
                ativo: Number(categoria.ativo) === 1
            },
            depois: null
        });
        await connection.query('DELETE FROM categorias WHERE id = ?', [id]);
        await connection.commit();
        committed = true;
        return res.json({ sucesso: true, mensagem: 'Categoria removida.' });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        logError('Erro ao excluir categoria no admin', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível remover a categoria.' });
    } finally {
        if (connection) connection.release();
    }
}

function slugify(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Lê booleanos vindos de JSON ou de multipart (onde tudo chega como texto).
 * Retorna undefined quando o campo não foi enviado e null quando é inválido.
 */
function lerBooleano(value) {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') return true;
    if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off') return false;
    return null;
}

function validarProduto(body = {}) {
    const ativoInformado = lerBooleano(body.ativo);
    const destaqueInformado = lerBooleano(body.destaque);
    if (ativoInformado === null || destaqueInformado === null) return null;
    const nome = String(body.nome || '').trim();
    const sku = String(body.sku || '').trim();
    const descricao = String(body.descricao || '').trim();
    if (nome.length > 200 || sku.length > 100 || descricao.length > 20000) return null;
    const categoriaId = Number(body.categoria_id);
    const preco = Number(body.preco);
    const promocional = body.preco_promocional === '' || body.preco_promocional == null
        ? null : Number(body.preco_promocional);
    const estoque = Number(body.estoque);
    const estoqueMinimo = Number(body.estoque_minimo ?? 5);
    if (!nome || !Number.isInteger(categoriaId) || categoriaId < 1 || !Number.isFinite(preco) || preco <= 0 ||
        (promocional !== null && (!Number.isFinite(promocional) || promocional <= 0 || promocional > preco)) ||
        !Number.isInteger(estoque) || estoque < 0 || estoque > 4294967295 ||
        !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0 || estoqueMinimo > 4294967295) {
        return null;
    }
    return {
        nome,
        categoriaId,
        preco,
        promocional,
        estoque,
        estoqueMinimo,
        descricao,
        sku: sku || null,
        // Checkbox desmarcado não é enviado: ausência de "destaque" = fora da vitrine.
        destaque: destaqueInformado ? 1 : 0,
        // Ausência de "ativo" = manter o valor atual (na criação, ativo).
        ativo: ativoInformado === undefined ? null : (ativoInformado ? 1 : 0)
    };
}

function imagemAnexada(req) {
    return req.file ? `/uploads/produtos/${req.file.filename}` : null;
}

async function criarProdutoAdmin(req, res) {
    const produto = validarProduto(req.body);
    if (!produto) return res.status(400).json({ sucesso: false, mensagem: 'Dados do produto inválidos.' });
    if (produto.ativo === null) produto.ativo = 1;
    const motivoEstoqueInformado = typeof req.body.motivo_estoque === 'string'
        ? req.body.motivo_estoque.trim()
        : '';
    if (motivoEstoqueInformado.length === 1 || motivoEstoqueInformado.length === 2 || motivoEstoqueInformado.length > 1000) {
        return res.status(400).json({ sucesso: false, mensagem: 'O motivo do estoque precisa ter entre 3 e 1000 caracteres.' });
    }

    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[categoria]] = await connection.query('SELECT id FROM categorias WHERE id = ? AND ativo = TRUE FOR UPDATE', [produto.categoriaId]);
        if (!categoria) {
            await connection.rollback();
            return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
        }
        const slug = slugify(produto.nome) + '-' + Date.now().toString(36);
        const [result] = await connection.query(
            `INSERT INTO produtos (categoria_id, nome, slug, descricao, sku, preco, preco_promocional, estoque, estoque_minimo, ativo, destaque)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [produto.categoriaId, produto.nome, slug, produto.descricao || null, produto.sku, produto.preco, produto.promocional, produto.estoque, produto.estoqueMinimo, produto.ativo, produto.destaque]
        );
        const imagemUrl = imagemAnexada(req);
        if (imagemUrl) {
            await connection.query(
                `INSERT INTO produto_imagens (produto_id, imagem_url, texto_alt, ordem, principal)
                 VALUES (?, ?, ?, 1, TRUE)`,
                [result.insertId, imagemUrl, produto.nome]
            );
        }
        if (produto.estoque > 0) {
            await connection.query(`
                INSERT INTO estoque_movimentacoes
                    (produto_id, administrador_id, tipo, quantidade_anterior,
                     quantidade_nova, diferenca, motivo)
                VALUES (?, ?, 'entrada', 0, ?, ?, ?)
            `, [
                result.insertId,
                req.admin.administrador_id,
                produto.estoque,
                produto.estoque,
                motivoEstoqueInformado || 'Estoque inicial informado no cadastro do produto.'
            ]);
        }
        await registrarAuditoria(connection, req, {
            acao: 'produto.criado',
            entidade: 'produto',
            entidadeId: result.insertId,
            motivo: motivoEstoqueInformado || 'Cadastro de produto.',
            antes: null,
            depois: {
                categoria_id: produto.categoriaId,
                nome: produto.nome,
                sku: produto.sku,
                preco: produto.preco,
                preco_promocional: produto.promocional,
                estoque: produto.estoque,
                estoque_minimo: produto.estoqueMinimo,
                ativo: Boolean(produto.ativo),
                destaque: Boolean(produto.destaque)
            }
        });
        await connection.commit();
        committed = true;
        return res.status(201).json({ sucesso: true, id: result.insertId, mensagem: 'Produto criado.' });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe um produto com esse SKU.' });
        }
        logError('Erro ao criar produto', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível criar o produto.' });
    } finally {
        if (connection) connection.release();
    }
}

async function atualizarProdutoAdmin(req, res) {
    const produto = validarProduto(req.body);
    const id = Number(req.params.id);
    const motivoEstoque = typeof req.body.motivo_estoque === 'string'
        ? req.body.motivo_estoque.trim()
        : '';
    if (!produto || !Number.isInteger(id) || id < 1) return res.status(400).json({ sucesso: false, mensagem: 'Dados do produto inválidos.' });
    let connection;
    let committed = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[categoria]] = await connection.query(
            'SELECT id FROM categorias WHERE id = ? AND ativo = TRUE LIMIT 1 FOR UPDATE',
            [produto.categoriaId]
        );
        if (!categoria) {
            await connection.rollback();
            return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
        }
        const [[anterior]] = await connection.query(`
            SELECT id, categoria_id, nome, descricao, sku, preco,
                preco_promocional, estoque, estoque_minimo, ativo, destaque
            FROM produtos
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        `, [id]);
        if (!anterior) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        }
        if (produto.ativo === null) produto.ativo = Number(anterior.ativo) === 1 ? 1 : 0;
        const estoqueAnterior = Number(anterior.estoque);
        const estoqueAlterado = estoqueAnterior !== produto.estoque;
        if (estoqueAlterado && (motivoEstoque.length < 3 || motivoEstoque.length > 1000)) {
            await connection.rollback();
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe o motivo da alteração do estoque (3 a 1000 caracteres).'
            });
        }
        await connection.query(
            `UPDATE produtos SET categoria_id = ?, nome = ?, descricao = ?, sku = ?, preco = ?, preco_promocional = ?, estoque = ?, estoque_minimo = ?, ativo = ?, destaque = ? WHERE id = ?`,
            [produto.categoriaId, produto.nome, produto.descricao || null, produto.sku, produto.preco, produto.promocional, produto.estoque, produto.estoqueMinimo, produto.ativo, produto.destaque, id]
        );
        if (estoqueAlterado) {
            await connection.query(`
                INSERT INTO estoque_movimentacoes
                    (produto_id, administrador_id, tipo, quantidade_anterior,
                     quantidade_nova, diferenca, motivo)
                VALUES (?, ?, 'ajuste', ?, ?, ?, ?)
            `, [
                id,
                req.admin.administrador_id,
                estoqueAnterior,
                produto.estoque,
                produto.estoque - estoqueAnterior,
                motivoEstoque
            ]);
        }
        const imagemUrl = imagemAnexada(req);
        if (imagemUrl) {
            await connection.query('UPDATE produto_imagens SET principal = FALSE WHERE produto_id = ?', [id]);
            await connection.query(
                `INSERT INTO produto_imagens (produto_id, imagem_url, texto_alt, ordem, principal)
                 VALUES (?, ?, ?, 1, TRUE)`,
                [id, imagemUrl, produto.nome]
            );
        }
        await registrarAuditoria(connection, req, {
            acao: 'produto.atualizado',
            entidade: 'produto',
            entidadeId: id,
            motivo: estoqueAlterado ? motivoEstoque : 'Edição de catálogo.',
            antes: {
                categoria_id: Number(anterior.categoria_id),
                nome: anterior.nome,
                sku: anterior.sku,
                preco: Number(anterior.preco),
                preco_promocional: anterior.preco_promocional == null ? null : Number(anterior.preco_promocional),
                estoque: estoqueAnterior,
                estoque_minimo: Number(anterior.estoque_minimo),
                ativo: Number(anterior.ativo) === 1,
                destaque: Number(anterior.destaque) === 1
            },
            depois: {
                categoria_id: produto.categoriaId,
                nome: produto.nome,
                sku: produto.sku,
                preco: produto.preco,
                preco_promocional: produto.promocional,
                estoque: produto.estoque,
                estoque_minimo: produto.estoqueMinimo,
                ativo: Boolean(produto.ativo),
                destaque: Boolean(produto.destaque)
            }
        });
        await connection.commit();
        committed = true;
        return res.json({ sucesso: true, mensagem: 'Produto atualizado.' });
    } catch (error) {
        if (connection && !committed) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe um produto com esse SKU.' });
        }
        logError('Erro ao atualizar produto', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o produto.' });
    } finally {
        if (connection) connection.release();
    }
}

async function excluirProdutoAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [products] = await connection.query(
            'SELECT id, ativo FROM produtos WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );
        if (!products.length) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        }
        if (Number(products[0].ativo) !== 0) {
            await connection.query('UPDATE produtos SET ativo = FALSE WHERE id = ?', [id]);
            await registrarAuditoria(connection, req, {
                acao: 'produto.desativado',
                entidade: 'produto',
                entidadeId: id,
                motivo: 'Desativação solicitada no painel.',
                antes: { ativo: true },
                depois: { ativo: false }
            });
        }
        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Produto desativado.' });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao desativar produto', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível desativar o produto.' });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Exclui definitivamente um pedido. Só aceita pedidos cancelados (o
 * cancelamento já devolveu o estoque) e sem pagamento aprovado, para não
 * apagar receita real. Itens, pagamentos e idempotência saem por CASCADE;
 * o número sequencial e as movimentações de estoque ficam (pedido_id NULL).
 */
async function excluirPedidoAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Pedido inválido.' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[pedido]] = await connection.query(
            'SELECT id, numero_exibicao, status, total, cliente_id FROM pedidos WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (!pedido) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }

        if (pedido.status !== 'cancelado') {
            await connection.rollback();
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Cancele o pedido antes de excluí-lo. O cancelamento devolve os itens ao estoque.'
            });
        }

        const [[pagos]] = await connection.query(
            "SELECT COUNT(*) AS total FROM pagamentos WHERE pedido_id = ? AND status = 'aprovado'",
            [id]
        );
        if (Number(pagos.total) > 0) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este pedido tem pagamento confirmado. Volte o Pix para pendente antes de excluir.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: 'pedido.excluido',
            entidade: 'pedido',
            entidadeId: id,
            motivo: String(req.body?.motivo || 'Exclusão definitiva solicitada no painel.').slice(0, 1000),
            antes: {
                id: pedido.id,
                numero: pedido.numero_exibicao,
                status: pedido.status,
                total: pedido.total,
                cliente_id: pedido.cliente_id
            },
            depois: null
        });
        await connection.query("DELETE FROM pedidos WHERE id = ? AND status = 'cancelado'", [id]);
        await connection.commit();

        return res.json({ sucesso: true, mensagem: 'Pedido excluído definitivamente.' });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao excluir pedido', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir o pedido.' });
    } finally {
        if (connection) connection.release();
    }
}

async function excluirProdutoDefinitivoAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[produto]] = await connection.query(
            'SELECT id, ativo FROM produtos WHERE id = ? LIMIT 1',
            [id]
        );

        if (!produto) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        }

        if (produto.ativo) {
            await connection.rollback();
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Desative o produto antes de excluí-lo definitivamente.'
            });
        }

        const [[movimentos]] = await connection.query(
            'SELECT COUNT(*) AS total FROM estoque_movimentacoes WHERE produto_id = ?',
            [id]
        );
        if (Number(movimentos.total) > 0) {
            await connection.rollback();
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este produto possui histórico de estoque e deve ser mantido desativado para preservar a auditoria.'
            });
        }

        await registrarAuditoria(connection, req, {
            acao: 'produto.excluido',
            entidade: 'produto',
            entidadeId: id,
            motivo: 'Exclusão definitiva solicitada no painel.',
            antes: { id: produto.id, ativo: Boolean(produto.ativo) },
            depois: null
        });
        await connection.query('DELETE FROM produto_imagens WHERE produto_id = ?', [id]);
        await connection.query('DELETE FROM produtos WHERE id = ? AND ativo = FALSE', [id]);
        await connection.commit();

        return res.json({ sucesso: true, mensagem: 'Produto excluído definitivamente.' });
    } catch (error) {
        if (connection) await connection.rollback();
        logError('Erro ao excluir produto definitivamente', error);

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este produto possui pedidos vinculados e não pode ser excluído.'
            });
        }

        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir o produto.' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    loginAdmin,
    resumoAdmin,
    dashboardAdmin,
    criarPedidoAdmin,
    listarPedidosAdmin,
    detalhePedidoAdmin,
    atualizarDetalhesPedidoAdmin,
    atualizarStatusPedidoAdmin,
    confirmarPagamentoPixAdmin,
    reverterPagamentoPixAdmin,
    listarMovimentacoesEstoqueAdmin,
    listarAuditoriaAdmin,
    movimentarEstoqueAdmin,
    listarClientesAdmin,
    atualizarClienteAdmin,
    excluirClienteAdmin,
    atualizarStatusClienteAdmin,
    atualizarAnotacaoClienteAdmin,
    listarHistoricoClienteAdmin,
    listarProdutosAdmin,
    listarCategoriasAdmin,
    criarCategoriaAdmin,
    atualizarCategoriaAdmin,
    excluirCategoriaAdmin,
    criarProdutoAdmin,
    atualizarProdutoAdmin,
    excluirProdutoAdmin,
    excluirProdutoDefinitivoAdmin,
    excluirPedidoAdmin
};