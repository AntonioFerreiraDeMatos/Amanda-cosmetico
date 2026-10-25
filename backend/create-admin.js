require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

async function createAdmin() {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD antes de executar.');
    }

    const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await pool.query(
        `INSERT INTO administradores (nome, email, senha_hash)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha_hash = VALUES(senha_hash), ativo = TRUE`,
        [ADMIN_NAME, ADMIN_EMAIL.trim().toLowerCase(), senhaHash]
    );

    console.log(`Administrador ${ADMIN_EMAIL} configurado com sucesso.`);
    await pool.end();
}

createAdmin().catch(async (error) => {
    console.error('Não foi possível configurar o administrador:', error.message);
    await pool.end();
    process.exitCode = 1;
});