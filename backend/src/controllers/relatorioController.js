/**
 * Relatórios do dashboard administrativo e exportações CSV.
 * Somente leitura: nenhum endpoint daqui altera dados.
 *
 * Definições usadas em todos os relatórios:
 * - "Pagamento vigente" de um pedido = o registro mais recente em
 *   `pagamentos` (MAX(id)), o mesmo critério do restante do painel.
 * - Faturamento = soma dos pagamentos vigentes aprovados, pela data de
 *   aprovação (pago_em), excluindo pedidos cancelados.
 * - Pedidos criados = pedidos registrados no período (pela data de criação).
 * - Datas são dias no horário da loja (STORE_UTC_OFFSET, padrão -03:00).
 */
const pool = require('../config/database');
const { logError } = require('../utils/logger');
const { registrarAuditoria } = require('../utils/auditoria');
const { buildCsv, sendCsv, moneyCell } = require('../utils/csv');
const {
    resolverPeriodo,
    listarDias,
    dateKey,
    offsetMinutes,
    toUtcSql,
    todayInStore,
    formatarDataHora,
    formatarData
} = require('../utils/periodo');

const ORDER_STATUSES = ['pendente', 'aguardando_pagamento', 'pago', 'processando', 'enviado', 'entregue', 'cancelado'];
const PAYMENT_STATUSES = ['pendente', 'processando', 'aprovado', 'recusado', 'cancelado', 'estornado'];
const STATUS_LABELS = {
    pendente: 'Pendente',
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pago',
    processando: 'Em separação',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    estornado: 'Estornado'
};
const CSV_ROW_LIMIT = 10000;

// Subconsulta do pagamento vigente (mais recente) de um pedido.
const ULTIMO_PAGAMENTO = '(SELECT MAX(x.id) FROM pagamentos x WHERE x.pedido_id = p.id)';

function badRequest(res, mensagem) {
    return res.status(400).json({ sucesso: false, mensagem });
}

function serverError(res, context, error, mensagem) {
    logError(context, error);
    return res.status(500).json({ sucesso: false, mensagem });
}

function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
    return Math.round(toNumber(value) * 100) / 100;
}

/** Variação percentual com 1 casa; null quando não há base de comparação. */
function variacao(atual, anterior) {
    const base = toNumber(anterior);
    if (base === 0) return null;
    return Math.round(((toNumber(atual) - base) / base) * 1000) / 10;
}

function intParam(value, { padrao, min, max }) {
    if (value === undefined || value === '') return padrao;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

function descreverPeriodo(periodo) {
    return {
        tipo: periodo.periodo,
        inicio: periodo.atual.inicio,
        fim: periodo.atual.fim,
        dias: periodo.atual.dias,
        anterior: {
            inicio: periodo.anterior.inicio,
            fim: periodo.anterior.fim
        },
        fuso: process.env.STORE_UTC_OFFSET || '-03:00'
    };
}

// ------------------------------------------------------------------
// Consultas reutilizadas
// ------------------------------------------------------------------

async function totaisVendas(range) {
    const [[row]] = await pool.query(`
        SELECT
            COALESCE(SUM(pg.valor), 0) AS faturamento,
            COUNT(DISTINCT pg.pedido_id) AS pedidos_pagos
        FROM pedidos p
        INNER JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
        WHERE pg.status = 'aprovado'
          AND p.status <> 'cancelado'
          AND pg.pago_em >= ? AND pg.pago_em < ?
    `, [range.inicioUtc, range.fimExclusivoUtc]);

    const faturamento = roundMoney(row.faturamento);
    const pedidosPagos = toNumber(row.pedidos_pagos);
    return {
        faturamento,
        pedidos_pagos: pedidosPagos,
        ticket_medio: pedidosPagos ? roundMoney(faturamento / pedidosPagos) : 0
    };
}

async function totaisPedidos(range) {
    const [[row]] = await pool.query(`
        SELECT
            COUNT(*) AS criados,
            COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN 1 ELSE 0 END), 0) AS nao_cancelados,
            COALESCE(SUM(CASE WHEN pg.status = 'aprovado' AND p.status <> 'cancelado' THEN 1 ELSE 0 END), 0) AS aprovados,
            COALESCE(SUM(CASE WHEN pg.status = 'aprovado' AND p.status <> 'cancelado' THEN pg.valor ELSE 0 END), 0) AS valor_aprovado,
            COALESCE(SUM(CASE WHEN p.status = 'cancelado' THEN 1 ELSE 0 END), 0) AS cancelados
        FROM pedidos p
        LEFT JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
        WHERE p.criado_em >= ? AND p.criado_em < ?
    `, [range.inicioUtc, range.fimExclusivoUtc]);

    const criados = toNumber(row.criados);
    const aprovados = toNumber(row.aprovados);
    const valorAprovado = roundMoney(row.valor_aprovado);
    return {
        criados,
        nao_cancelados: toNumber(row.nao_cancelados),
        cancelados: toNumber(row.cancelados),
        aprovados,
        ticket_medio: aprovados ? roundMoney(valorAprovado / aprovados) : 0,
        // Conversão do Pix: pedidos criados no período cujo Pix foi aprovado.
        taxa_pagamento_aprovado: criados ? Math.round((aprovados / criados) * 1000) / 10 : 0
    };
}

async function totaisClientes(range) {
    const [[novos]] = await pool.query(
        'SELECT COUNT(*) AS total FROM clientes WHERE criado_em >= ? AND criado_em < ?',
        [range.inicioUtc, range.fimExclusivoUtc]
    );

    // Compradores do período e, entre eles, quem já tinha (ou fez) 2+ compras aprovadas até o fim do período.
    const [[compradores]] = await pool.query(`
        SELECT
            COUNT(*) AS compradores,
            COALESCE(SUM(CASE WHEN t.compras_ate_fim >= 2 THEN 1 ELSE 0 END), 0) AS recorrentes
        FROM (
            SELECT
                p.cliente_id,
                (
                    SELECT COUNT(*)
                    FROM pedidos p3
                    INNER JOIN pagamentos u3 ON u3.id = (
                        SELECT MAX(x3.id) FROM pagamentos x3 WHERE x3.pedido_id = p3.id
                    )
                    WHERE p3.cliente_id = p.cliente_id
                      AND p3.status <> 'cancelado'
                      AND u3.status = 'aprovado'
                      AND p3.criado_em < ?
                ) AS compras_ate_fim
            FROM pedidos p
            INNER JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
            WHERE pg.status = 'aprovado'
              AND p.status <> 'cancelado'
              AND p.criado_em >= ? AND p.criado_em < ?
            GROUP BY p.cliente_id
        ) t
    `, [range.fimExclusivoUtc, range.inicioUtc, range.fimExclusivoUtc]);

    return {
        novos: toNumber(novos.total),
        compradores: toNumber(compradores.compradores),
        recorrentes: toNumber(compradores.recorrentes)
    };
}

function compararTotais(atual, anterior, campos) {
    const resultado = {};
    for (const campo of campos) {
        resultado[campo] = variacao(atual[campo], anterior[campo]);
    }
    return resultado;
}

// ------------------------------------------------------------------
// a) Série de vendas por dia + comparação com o período anterior
// GET /api/admin/relatorios/vendas?periodo=7|30|90|personalizado&inicio=&fim=
// ------------------------------------------------------------------

async function relatorioVendas(req, res) {
    const periodo = resolverPeriodo(req.query);
    if (periodo.erro) return badRequest(res, periodo.erro);
    const { atual, anterior } = periodo;
    const minutos = offsetMinutes();

    try {
        const [faturamentoPorDia] = await pool.query(`
            SELECT
                DATE(DATE_ADD(pg.pago_em, INTERVAL ? MINUTE)) AS dia,
                COALESCE(SUM(pg.valor), 0) AS faturamento,
                COUNT(DISTINCT pg.pedido_id) AS pedidos_pagos
            FROM pedidos p
            INNER JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
            WHERE pg.status = 'aprovado'
              AND p.status <> 'cancelado'
              AND pg.pago_em >= ? AND pg.pago_em < ?
            GROUP BY dia
            ORDER BY dia
        `, [minutos, atual.inicioUtc, atual.fimExclusivoUtc]);

        const [pedidosPorDia] = await pool.query(`
            SELECT
                DATE(DATE_ADD(p.criado_em, INTERVAL ? MINUTE)) AS dia,
                COUNT(*) AS pedidos_criados
            FROM pedidos p
            WHERE p.status <> 'cancelado'
              AND p.criado_em >= ? AND p.criado_em < ?
            GROUP BY dia
            ORDER BY dia
        `, [minutos, atual.inicioUtc, atual.fimExclusivoUtc]);

        const [topProdutos] = await pool.query(`
            SELECT
                i.produto_id,
                MAX(i.nome_produto) AS nome,
                SUM(i.quantidade) AS unidades,
                SUM(i.subtotal) AS faturamento
            FROM itens_pedido i
            INNER JOIN pedidos p ON p.id = i.pedido_id
            INNER JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
            WHERE pg.status = 'aprovado'
              AND p.status <> 'cancelado'
              AND pg.pago_em >= ? AND pg.pago_em < ?
            GROUP BY i.produto_id
            ORDER BY unidades DESC, faturamento DESC
            LIMIT 5
        `, [atual.inicioUtc, atual.fimExclusivoUtc]);

        const totalAtual = await totaisVendas(atual);
        const totalAnterior = await totaisVendas(anterior);

        const faturamentoMap = new Map(faturamentoPorDia.map((row) => [dateKey(row.dia), row]));
        const pedidosMap = new Map(pedidosPorDia.map((row) => [dateKey(row.dia), row]));
        const serie = listarDias(atual.inicio, atual.fim).map((dia) => ({
            data: dia,
            faturamento: roundMoney(faturamentoMap.get(dia)?.faturamento),
            pedidos_pagos: toNumber(faturamentoMap.get(dia)?.pedidos_pagos),
            pedidos_criados: toNumber(pedidosMap.get(dia)?.pedidos_criados)
        }));

        return res.json({
            sucesso: true,
            periodo: descreverPeriodo(periodo),
            serie,
            totais: {
                atual: totalAtual,
                anterior: totalAnterior,
                variacao: compararTotais(totalAtual, totalAnterior, ['faturamento', 'pedidos_pagos', 'ticket_medio'])
            },
            top_produtos: topProdutos.map((row) => ({
                produto_id: Number(row.produto_id),
                nome: row.nome,
                unidades: toNumber(row.unidades),
                faturamento: roundMoney(row.faturamento)
            }))
        });
    } catch (error) {
        return serverError(res, 'Erro no relatório de vendas', error, 'Não foi possível carregar o relatório de vendas.');
    }
}

// ------------------------------------------------------------------
// b) Pedidos por status, ticket médio e taxa de pagamento aprovado
// GET /api/admin/relatorios/pedidos?periodo=...
// ------------------------------------------------------------------

async function relatorioPedidos(req, res) {
    const periodo = resolverPeriodo(req.query);
    if (periodo.erro) return badRequest(res, periodo.erro);

    try {
        const [porStatus] = await pool.query(`
            SELECT p.status, COUNT(*) AS total
            FROM pedidos p
            WHERE p.criado_em >= ? AND p.criado_em < ?
            GROUP BY p.status
        `, [periodo.atual.inicioUtc, periodo.atual.fimExclusivoUtc]);

        const contagem = new Map(porStatus.map((row) => [row.status, toNumber(row.total)]));
        const totalAtual = await totaisPedidos(periodo.atual);
        const totalAnterior = await totaisPedidos(periodo.anterior);

        return res.json({
            sucesso: true,
            periodo: descreverPeriodo(periodo),
            por_status: ORDER_STATUSES.map((status) => ({
                status,
                rotulo: STATUS_LABELS[status],
                total: contagem.get(status) || 0
            })),
            totais: {
                atual: totalAtual,
                anterior: totalAnterior,
                variacao: compararTotais(totalAtual, totalAnterior, [
                    'criados',
                    'nao_cancelados',
                    'aprovados',
                    'ticket_medio',
                    'taxa_pagamento_aprovado'
                ])
            }
        });
    } catch (error) {
        return serverError(res, 'Erro no relatório de pedidos', error, 'Não foi possível carregar o relatório de pedidos.');
    }
}

// ------------------------------------------------------------------
// c) Clientes novos e recorrentes
// GET /api/admin/relatorios/clientes?periodo=...
// ------------------------------------------------------------------

async function relatorioClientes(req, res) {
    const periodo = resolverPeriodo(req.query);
    if (periodo.erro) return badRequest(res, periodo.erro);

    try {
        const totalAtual = await totaisClientes(periodo.atual);
        const totalAnterior = await totaisClientes(periodo.anterior);

        const [novosRecentes] = await pool.query(`
            SELECT id, nome, criado_em
            FROM clientes
            WHERE criado_em >= ? AND criado_em < ?
            ORDER BY criado_em DESC
            LIMIT 10
        `, [periodo.atual.inicioUtc, periodo.atual.fimExclusivoUtc]);

        return res.json({
            sucesso: true,
            periodo: descreverPeriodo(periodo),
            totais: {
                atual: totalAtual,
                anterior: totalAnterior,
                variacao: compararTotais(totalAtual, totalAnterior, ['novos', 'compradores', 'recorrentes'])
            },
            novos_recentes: novosRecentes.map((row) => ({
                id: Number(row.id),
                nome: row.nome,
                criado_em: row.criado_em
            }))
        });
    } catch (error) {
        return serverError(res, 'Erro no relatório de clientes', error, 'Não foi possível carregar o relatório de clientes.');
    }
}

// ------------------------------------------------------------------
// d) Estoque baixo e produtos parados
// GET /api/admin/relatorios/estoque?dias_sem_venda=30
// ------------------------------------------------------------------

async function relatorioEstoque(req, res) {
    const dias = intParam(req.query?.dias_sem_venda, { padrao: 30, min: 1, max: 365 });
    if (dias === null) return badRequest(res, 'Informe dias sem venda entre 1 e 365.');
    const corte = toUtcSql(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));

    try {
        const [estoqueBaixo] = await pool.query(`
            SELECT p.id, p.nome, p.sku, p.estoque, p.estoque_minimo, c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE p.ativo = TRUE AND p.estoque <= p.estoque_minimo
            ORDER BY p.estoque ASC, p.nome ASC
            LIMIT 200
        `);

        // Ativos, com estoque, cadastrados antes do corte e sem venda (pedido não cancelado) desde então.
        const [parados] = await pool.query(`
            SELECT
                p.id, p.nome, p.sku, p.estoque, p.preco, c.nome AS categoria,
                (
                    SELECT MAX(pe.criado_em)
                    FROM itens_pedido i
                    INNER JOIN pedidos pe ON pe.id = i.pedido_id
                    WHERE i.produto_id = p.id AND pe.status <> 'cancelado'
                ) AS ultima_venda
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE p.ativo = TRUE
              AND p.estoque > 0
              AND p.criado_em < ?
              AND NOT EXISTS (
                  SELECT 1
                  FROM itens_pedido i
                  INNER JOIN pedidos pe ON pe.id = i.pedido_id
                  WHERE i.produto_id = p.id
                    AND pe.status <> 'cancelado'
                    AND pe.criado_em >= ?
              )
            ORDER BY ultima_venda IS NULL DESC, ultima_venda ASC, p.nome ASC
            LIMIT 200
        `, [corte, corte]);

        return res.json({
            sucesso: true,
            dias_sem_venda: dias,
            estoque_baixo: estoqueBaixo.map((row) => ({
                id: Number(row.id),
                nome: row.nome,
                sku: row.sku,
                categoria: row.categoria,
                estoque: toNumber(row.estoque),
                estoque_minimo: toNumber(row.estoque_minimo)
            })),
            parados: parados.map((row) => ({
                id: Number(row.id),
                nome: row.nome,
                sku: row.sku,
                categoria: row.categoria,
                estoque: toNumber(row.estoque),
                preco: roundMoney(row.preco),
                valor_parado: roundMoney(toNumber(row.preco) * toNumber(row.estoque)),
                ultima_venda: row.ultima_venda
            }))
        });
    } catch (error) {
        return serverError(res, 'Erro no relatório de estoque', error, 'Não foi possível carregar o relatório de estoque.');
    }
}

// ------------------------------------------------------------------
// "Precisa da sua atenção hoje"
// GET /api/admin/relatorios/atencao?dias_parado=3
// ------------------------------------------------------------------

async function relatorioAtencao(req, res) {
    const diasParado = intParam(req.query?.dias_parado, { padrao: 3, min: 1, max: 60 });
    if (diasParado === null) return badRequest(res, 'Informe dias parado entre 1 e 60.');
    const corte = toUtcSql(new Date(Date.now() - diasParado * 24 * 60 * 60 * 1000));

    const listaPedidos = (where, params, order) => pool.query(`
        SELECT
            p.id, p.numero_exibicao, p.status, p.total, p.criado_em, p.atualizado_em,
            c.nome AS cliente_nome, c.telefone AS cliente_telefone,
            pg.status AS pagamento_status
        FROM pedidos p
        INNER JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
        WHERE ${where}
        ORDER BY ${order}
        LIMIT 10
    `, params);

    const contar = async (where, params = []) => {
        const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM pedidos p WHERE ${where}`, params);
        return toNumber(row.total);
    };

    try {
        const [aguardandoPix] = await listaPedidos("p.status = 'aguardando_pagamento'", [], 'p.criado_em ASC');
        const [paraSeparar] = await listaPedidos("p.status = 'pago'", [], 'p.atualizado_em ASC');
        const [parados] = await listaPedidos(
            "p.status IN ('aguardando_pagamento', 'pago', 'processando') AND p.atualizado_em < ?",
            [corte],
            'p.atualizado_em ASC'
        );
        const [[estoqueBaixo]] = await pool.query(
            'SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE AND estoque <= estoque_minimo'
        );

        const formatar = (rows) => rows.map((row) => ({
            id: Number(row.id),
            numero_exibicao: row.numero_exibicao,
            status: row.status,
            pagamento_status: row.pagamento_status,
            total: roundMoney(row.total),
            cliente_nome: row.cliente_nome,
            cliente_telefone: row.cliente_telefone,
            criado_em: row.criado_em,
            atualizado_em: row.atualizado_em
        }));

        return res.json({
            sucesso: true,
            hoje: todayInStore(),
            dias_parado: diasParado,
            aguardando_pix: {
                total: await contar("p.status = 'aguardando_pagamento'"),
                pedidos: formatar(aguardandoPix)
            },
            pagos_para_separar: {
                total: await contar("p.status = 'pago'"),
                pedidos: formatar(paraSeparar)
            },
            parados: {
                total: await contar(
                    "p.status IN ('aguardando_pagamento', 'pago', 'processando') AND p.atualizado_em < ?",
                    [corte]
                ),
                pedidos: formatar(parados)
            },
            estoque_baixo: { total: toNumber(estoqueBaixo.total) }
        });
    } catch (error) {
        return serverError(res, 'Erro no resumo de atenção', error, 'Não foi possível carregar os alertas do dia.');
    }
}

// ------------------------------------------------------------------
// e) Exportações CSV (registradas na auditoria: contêm dados pessoais)
// ------------------------------------------------------------------

async function auditarExportacao(req, tipo, linhas, filtros) {
    const connection = await pool.getConnection();
    try {
        await registrarAuditoria(connection, req, {
            acao: `exportacao.${tipo}`,
            entidade: 'relatorio',
            entidadeId: 0,
            motivo: `Exportação CSV de ${tipo} (${linhas} linha(s)).`,
            antes: null,
            depois: { filtros, linhas }
        });
    } finally {
        connection.release();
    }
}

function emailVisivel(email) {
    // Clientes antigos por telefone têm e-mail técnico gerado pelo sistema.
    return /@cliente\.amanda\.local$/i.test(String(email || '')) ? '' : email;
}

// GET /api/admin/exportar/pedidos.csv?periodo=...&status=&payment_status=
async function exportarPedidosCsv(req, res) {
    const periodo = resolverPeriodo(req.query);
    if (periodo.erro) return badRequest(res, periodo.erro);
    const status = typeof req.query?.status === 'string' ? req.query.status : '';
    const paymentStatus = typeof req.query?.payment_status === 'string' ? req.query.payment_status : '';
    if ((status && !ORDER_STATUSES.includes(status)) || (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus))) {
        return badRequest(res, 'Filtros de status inválidos.');
    }

    const conditions = ['p.criado_em >= ?', 'p.criado_em < ?'];
    const params = [periodo.atual.inicioUtc, periodo.atual.fimExclusivoUtc];
    if (status) {
        conditions.push('p.status = ?');
        params.push(status);
    }
    if (paymentStatus) {
        conditions.push('pg.status = ?');
        params.push(paymentStatus);
    }

    try {
        const [pedidos] = await pool.query(`
            SELECT
                p.id, p.numero_exibicao, p.status, p.subtotal, p.desconto, p.frete, p.total, p.criado_em,
                c.nome AS cliente_nome, c.email AS cliente_email, c.telefone AS cliente_telefone,
                e.telefone AS telefone_entrega, e.cidade, e.estado,
                pg.status AS pagamento_status, pg.pago_em,
                (
                    SELECT GROUP_CONCAT(CONCAT(i.nome_produto, ' x', i.quantidade) ORDER BY i.id SEPARATOR ' | ')
                    FROM itens_pedido i
                    WHERE i.pedido_id = p.id
                ) AS itens
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN enderecos e ON e.id = p.endereco_id
            LEFT JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
            WHERE ${conditions.join(' AND ')}
            ORDER BY p.criado_em DESC, p.id DESC
            LIMIT ${CSV_ROW_LIMIT}
        `, params);

        const csv = buildCsv([
            { titulo: 'Número', valor: (r) => r.numero_exibicao },
            { titulo: 'Data', valor: (r) => formatarDataHora(r.criado_em) },
            { titulo: 'Cliente', valor: (r) => r.cliente_nome },
            { titulo: 'E-mail', valor: (r) => emailVisivel(r.cliente_email) },
            { titulo: 'WhatsApp', valor: (r) => r.telefone_entrega || r.cliente_telefone },
            { titulo: 'Status do pedido', valor: (r) => STATUS_LABELS[r.status] || r.status },
            { titulo: 'Status do Pix', valor: (r) => STATUS_LABELS[r.pagamento_status] || r.pagamento_status || '' },
            { titulo: 'Pago em', valor: (r) => formatarDataHora(r.pago_em) },
            { titulo: 'Itens', valor: (r) => r.itens },
            { titulo: 'Subtotal (R$)', valor: (r) => moneyCell(r.subtotal) },
            { titulo: 'Desconto (R$)', valor: (r) => moneyCell(r.desconto) },
            { titulo: 'Frete (R$)', valor: (r) => moneyCell(r.frete) },
            { titulo: 'Total (R$)', valor: (r) => moneyCell(r.total) },
            { titulo: 'Cidade', valor: (r) => r.cidade },
            { titulo: 'UF', valor: (r) => r.estado }
        ], pedidos);

        await auditarExportacao(req, 'pedidos', pedidos.length, {
            inicio: periodo.atual.inicio,
            fim: periodo.atual.fim,
            status: status || null,
            payment_status: paymentStatus || null
        });
        return sendCsv(res, `pedidos_${periodo.atual.inicio}_a_${periodo.atual.fim}.csv`, csv);
    } catch (error) {
        return serverError(res, 'Erro ao exportar pedidos', error, 'Não foi possível exportar os pedidos.');
    }
}

// GET /api/admin/exportar/clientes.csv
async function exportarClientesCsv(req, res) {
    try {
        const [clientes] = await pool.query(`
            SELECT
                c.id, c.nome, c.email, c.telefone, c.ativo, c.criado_em,
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
                SELECT p.cliente_id, SUM(pg.valor) AS total_gasto
                FROM pedidos p
                INNER JOIN pagamentos pg ON pg.id = ${ULTIMO_PAGAMENTO}
                WHERE pg.status = 'aprovado' AND p.status <> 'cancelado'
                GROUP BY p.cliente_id
            ) gasto ON gasto.cliente_id = c.id
            ORDER BY c.nome ASC
            LIMIT ${CSV_ROW_LIMIT}
        `);

        const csv = buildCsv([
            { titulo: 'ID', valor: (r) => Number(r.id) },
            { titulo: 'Nome', valor: (r) => r.nome },
            { titulo: 'E-mail', valor: (r) => emailVisivel(r.email) },
            { titulo: 'WhatsApp', valor: (r) => r.telefone },
            { titulo: 'Situação', valor: (r) => (Number(r.ativo) === 1 ? 'Ativo' : 'Desativado') },
            { titulo: 'Cadastro', valor: (r) => formatarData(r.criado_em) },
            { titulo: 'Pedidos', valor: (r) => toNumber(r.total_pedidos) },
            { titulo: 'Total gasto (R$)', valor: (r) => moneyCell(r.total_gasto) },
            { titulo: 'Última compra', valor: (r) => formatarData(r.ultima_compra) }
        ], clientes);

        await auditarExportacao(req, 'clientes', clientes.length, {});
        return sendCsv(res, `clientes_${todayInStore()}.csv`, csv);
    } catch (error) {
        return serverError(res, 'Erro ao exportar clientes', error, 'Não foi possível exportar os clientes.');
    }
}

// GET /api/admin/exportar/estoque.csv
async function exportarEstoqueCsv(req, res) {
    try {
        const [produtos] = await pool.query(`
            SELECT p.id, p.nome, p.sku, p.ativo, p.estoque, p.estoque_minimo,
                p.preco, p.preco_promocional, c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            ORDER BY p.nome ASC
            LIMIT ${CSV_ROW_LIMIT}
        `);

        const csv = buildCsv([
            { titulo: 'ID', valor: (r) => Number(r.id) },
            { titulo: 'Produto', valor: (r) => r.nome },
            { titulo: 'SKU', valor: (r) => r.sku },
            { titulo: 'Categoria', valor: (r) => r.categoria },
            { titulo: 'Situação', valor: (r) => (Number(r.ativo) === 1 ? 'Ativo' : 'Desativado') },
            { titulo: 'Estoque', valor: (r) => toNumber(r.estoque) },
            { titulo: 'Estoque mínimo', valor: (r) => toNumber(r.estoque_minimo) },
            { titulo: 'Alerta', valor: (r) => (toNumber(r.estoque) <= toNumber(r.estoque_minimo) ? 'Estoque baixo' : '') },
            { titulo: 'Preço (R$)', valor: (r) => moneyCell(r.preco) },
            { titulo: 'Preço promocional (R$)', valor: (r) => (r.preco_promocional == null ? '' : moneyCell(r.preco_promocional)) }
        ], produtos);

        await auditarExportacao(req, 'estoque', produtos.length, {});
        return sendCsv(res, `estoque_${todayInStore()}.csv`, csv);
    } catch (error) {
        return serverError(res, 'Erro ao exportar estoque', error, 'Não foi possível exportar o estoque.');
    }
}

module.exports = {
    relatorioVendas,
    relatorioPedidos,
    relatorioClientes,
    relatorioEstoque,
    relatorioAtencao,
    exportarPedidosCsv,
    exportarClientesCsv,
    exportarEstoqueCsv,
    variacao
};
