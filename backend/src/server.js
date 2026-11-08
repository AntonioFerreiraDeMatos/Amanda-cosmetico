require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./config/database');
const migrate = require('./config/migrate');
const bootstrapAdmin = require('./config/bootstrapAdmin');
const { allowedOrigins, trustProxySetting, validateEnv } = require('./config/env');
const { logError, logWarn, logInfo } = require('./utils/logger');
const { securityHeaders, apiLimiter } = require('./middlewares/security');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

const app = express();

// Fica false só enquanto startServer() aplica migrations após o listen().
let appReady = true;
app.use((req, res, next) => {
    if (appReady) return next();
    return res.status(503).json({ erro: 'API iniciando, tente novamente em instantes.' });
});

app.disable('x-powered-by');
// Necessário atrás do proxy da Hostinger para o rate limit enxergar o IP real.
app.set('trust proxy', trustProxySetting());

// ==========================================
// SEGURANÇA E CORS
// ==========================================

const origins = allowedOrigins();

app.use(securityHeaders());

app.use(cors({
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
    origin(origin, callback) {
        // Sem Origin: requisições servidor-a-servidor, curl, health check.
        if (!origin || origins.includes(origin)) {
            return callback(null, true);
        }

        const error = new Error('Origem não autorizada.');
        error.code = 'CORS_ORIGIN_DENIED';
        return callback(error);
    }
}));

app.use(express.json({ limit: '1mb' }));

// ==========================================
// ARQUIVOS ENVIADOS (imagens de produtos)
// ==========================================

app.use(
    '/uploads',
    (req, res, next) => {
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
        next();
    },
    express.static(path.resolve(__dirname, '../uploads'), {
        dotfiles: 'deny',
        index: false,
        redirect: false,
        maxAge: '7d'
    })
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'API Amanda Cosméticos funcionando!'
    });
});

app.get('/api/health', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        await pool.query('SELECT 1');
        return res.json({
            sucesso: true,
            api: 'online',
            banco: 'conectado',
            horario: new Date().toISOString()
        });
    } catch (error) {
        logError('Health check: banco indisponível', error);
        return res.status(503).json({
            sucesso: false,
            api: 'online',
            banco: 'erro',
            mensagem: 'Não foi possível conectar ao banco de dados.'
        });
    }
});

// ==========================================
// ROTAS DA API
// ==========================================

app.use('/api', apiLimiter);
app.use('/api/produtos', produtoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pagamentos', pagamentoRoutes);
app.use('/api/pedidos', pedidoRoutes);

app.use(notFound);
app.use(errorHandler);

// ==========================================
// SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;

async function startServer() {
    const { errors, warnings } = validateEnv();
    warnings.forEach((warning) => logWarn(warning));
    if (errors.length) {
        throw new Error(`Configuração inválida: ${errors.join(' ')}`);
    }

    // A Hostinger exige listen() em até 3s; migrations rodam depois,
    // e as requisições recebem 503 até o banco estar pronto.
    appReady = false;
    await new Promise((resolve) => {
        app.listen(PORT, () => {
            logInfo(`API Amanda Cosméticos rodando na porta ${PORT}`);
            resolve();
        });
    });

    await migrate();
    await bootstrapAdmin();
    appReady = true;
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch(async (error) => {
        logError('Não foi possível iniciar a API', error);
        await pool.end();
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };
