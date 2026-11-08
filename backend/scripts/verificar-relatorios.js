/**
 * Executa os relatórios do dashboard contra um banco REAL, em modo somente
 * leitura, e mostra apenas status e contagens (sem dados pessoais).
 *
 * Uso (Git Bash, dentro de backend/):
 *   node scripts/verificar-relatorios.js .env.local
 *
 * Segurança:
 * - Recusa bancos fora de localhost/127.0.0.1, a menos que receba
 *   --permitir-remoto.
 * - Toda conexão roda com SET SESSION TRANSACTION READ ONLY: qualquer
 *   escrita acidental falha no próprio MySQL.
 * - Não executa as exportações CSV (elas gravam auditoria).
 */
const path = require('path');
const dotenv = require('dotenv');

const envFile = process.argv[2];
const permitirRemoto = process.argv.includes('--permitir-remoto');

if (!envFile || envFile.startsWith('--')) {
    console.error('Informe o arquivo de ambiente: node scripts/verificar-relatorios.js .env.local');
    process.exit(1);
}

const loaded = dotenv.config({ path: path.resolve(envFile), override: true, quiet: true });
if (loaded.error) {
    console.error(`Não foi possível ler ${envFile}.`);
    process.exit(1);
}

const host = String(process.env.DB_HOST || '');
if (!['localhost', '127.0.0.1', '::1'].includes(host) && !permitirRemoto) {
    console.error('Banco remoto detectado. Por segurança, use um banco local ou passe --permitir-remoto.');
    process.exit(1);
}

const pool = require('../src/config/database');

pool.pool.on('connection', (connection) => {
    connection.query('SET SESSION TRANSACTION READ ONLY');
});

const relatorios = require('../src/controllers/relatorioController');
const { listarClientesAdmin, listarPedidosAdmin } = require('../src/controllers/adminController');

function fakeResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        setHeader() {},
        send(body) { this.body = body; return this; }
    };
}

function resumir(nome, body) {
    if (!body?.sucesso) return body?.mensagem;
    switch (nome) {
        case 'vendas':
            return `dias=${body.serie.length} faturamento=${body.totais.atual.faturamento} pedidos_pagos=${body.totais.atual.pedidos_pagos} top=${body.top_produtos.length}`;
        case 'pedidos':
            return `criados=${body.totais.atual.criados} aprovados=${body.totais.atual.aprovados} taxa=${body.totais.atual.taxa_pagamento_aprovado}%`;
        case 'clientes':
            return `novos=${body.totais.atual.novos} compradores=${body.totais.atual.compradores} recorrentes=${body.totais.atual.recorrentes}`;
        case 'estoque':
            return `estoque_baixo=${body.estoque_baixo.length} parados=${body.parados.length}`;
        case 'atencao':
            return `aguardando_pix=${body.aguardando_pix.total} para_separar=${body.pagos_para_separar.total} parados=${body.parados.total} estoque_baixo=${body.estoque_baixo.total}`;
        case 'clientes-lista':
            return `clientes=${body.clientes.length} total=${body.total ?? '-'}`;
        case 'pedidos-lista':
            return `pedidos=${body.pedidos.length} total=${body.total}`;
        default:
            return 'ok';
    }
}

async function main() {
    const [[info]] = await pool.query('SELECT VERSION() AS versao, @@sql_mode AS sql_mode, @@session.time_zone AS fuso');
    console.log(`Banco: ${info.versao} | fuso da sessão: ${info.fuso}`);
    console.log(`sql_mode: ${info.sql_mode}`);

    const casos = [
        ['vendas', relatorios.relatorioVendas, { periodo: '30' }],
        ['vendas', relatorios.relatorioVendas, { periodo: '7' }],
        ['pedidos', relatorios.relatorioPedidos, { periodo: '30' }],
        ['clientes', relatorios.relatorioClientes, { periodo: '90' }],
        ['estoque', relatorios.relatorioEstoque, { dias_sem_venda: '30' }],
        ['atencao', relatorios.relatorioAtencao, { dias_parado: '3' }],
        ['clientes-lista', listarClientesAdmin, {}],
        ['clientes-lista', listarClientesAdmin, { page: '1', limit: '10' }],
        ['pedidos-lista', listarPedidosAdmin, { date_from: '2026-01-01', date_to: '2026-12-31' }]
    ];

    let falhas = 0;
    for (const [nome, handler, query] of casos) {
        const res = fakeResponse();
        await handler({ query, admin: { administrador_id: 1 } }, res);
        const ok = res.statusCode < 400;
        if (!ok) falhas += 1;
        console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome} ${JSON.stringify(query)} -> ${res.statusCode} ${resumir(nome, res.body)}`);
    }

    // Repete a consulta de clientes com ONLY_FULL_GROUP_BY forçado na sessão.
    const connection = await pool.getConnection();
    try {
        await connection.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ONLY_FULL_GROUP_BY')");
        const originalQuery = pool.query;
        pool.query = (...args) => connection.query(...args);
        const res = fakeResponse();
        await listarClientesAdmin({ query: {} }, res);
        pool.query = originalQuery;
        const ok = res.statusCode < 400;
        if (!ok) falhas += 1;
        console.log(`${ok ? 'OK  ' : 'FALHA'} clientes com ONLY_FULL_GROUP_BY -> ${res.statusCode}`);
    } finally {
        connection.release();
    }

    await pool.end();
    console.log(falhas ? `\n${falhas} verificação(ões) falharam. Veja os logs [erro] acima.` : '\nTodas as consultas rodaram sem erro.');
    process.exitCode = falhas ? 1 : 0;
}

main().catch(async (error) => {
    console.error('Falha na verificação:', error.code || '', error.message);
    await pool.end();
    process.exitCode = 1;
});
