const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

/**
 * Toda conexão trabalha em UTC: a sessão do MySQL (SET time_zone) e a
 * conversão do mysql2 (timezone: 'Z'). Assim as colunas TIMESTAMP viram
 * instantes corretos em JS, independentemente do fuso do servidor.
 * Conversões para o horário da loja ficam em utils/periodo.js.
 */
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
});

pool.pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
});

module.exports = pool;
