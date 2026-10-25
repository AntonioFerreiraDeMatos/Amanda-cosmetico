require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./config/database');
const migrate = require('./config/migrate');
const bootstrapAdmin = require('./config/bootstrapAdmin');

const authRoutes = require('./routes/authRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

const app = express();

app.disable('x-powered-by');

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// ==========================================
// CONFIGURAÇÕES
// ==========================================

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origem não autorizada.'));
    }
}));

app.use(express.json({ limit: '1mb' }));

app.use(
    '/uploads',
    express.static(
        path.resolve(__dirname, '../uploads')
    )
);

// ==========================================
// ROTAS DA API
// ==========================================

app.use('/api/produtos', produtoRoutes);

app.use('/api/categorias', categoriaRoutes);

app.use('/api/clientes', clienteRoutes);

app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/pagamentos', pagamentoRoutes);

app.use('/api/pedidos', pedidoRoutes);

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    console.error('Erro na API:', error.message);

    const status = error.name === 'MulterError' || error.message?.includes('A imagem deve ser')
        ? 400
        : 500;

    res.status(status).json({
        sucesso: false,
        mensagem: error.message || 'Erro interno do servidor.'
    });
});

// ==========================================
// ROTA PRINCIPAL
// ==========================================

app.get('/', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'API Amanda Cosméticos funcionando!'
    });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.query('SELECT 1');

        res.json({
            sucesso: true,
            api: 'online',
            banco: 'conectado',
            database: process.env.DB_NAME
        });

    } catch (error) {

        console.error(
            'Erro na conexão com o banco:',
            error.message
        );

        res.status(500).json({
            sucesso: false,
            api: 'online',
            banco: 'erro',
            mensagem: 'Não foi possível conectar ao banco de dados.'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

// ==========================================
// SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;

async function startServer() {
    await migrate();
    await bootstrapAdmin();

    app.listen(PORT, () => {
        console.log(`API Amanda Cosméticos rodando na porta ${PORT}`);
    });
}

startServer().catch(async (error) => {
    console.error('Não foi possível iniciar a API:', error.message);
    await pool.end();
    process.exitCode = 1;
});