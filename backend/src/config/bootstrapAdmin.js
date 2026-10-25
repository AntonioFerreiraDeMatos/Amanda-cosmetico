const bcrypt = require('bcryptjs');
const pool = require('./database');

async function bootstrapAdmin() {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    const providedValues = [ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD]
        .filter(Boolean)
        .length;

    if (providedValues === 0) {
        if (process.env.NODE_ENV === 'production') {
            await pool.query(
                'UPDATE administradores SET ativo = FALSE'
            );
        }

        console.warn('Administrador inicial não configurado; defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD.');
        return;
    }

    if (providedValues !== 3) {
        throw new Error('A configuração do administrador inicial está incompleta.');
    }

    const [bootstrapped] = await pool.query(
        `SELECT chave FROM configuracoes_sistema
         WHERE chave = 'admin_inicial_configurado'
         LIMIT 1`
    );

    if (bootstrapped.length) {
        return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await connection.query(
            'UPDATE administradores SET ativo = FALSE'
        );
        await connection.query(
            `INSERT INTO administradores (nome, email, senha_hash, ativo)
             VALUES (?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE
                nome = VALUES(nome),
                senha_hash = VALUES(senha_hash),
                ativo = TRUE`,
            [ADMIN_NAME.trim(), ADMIN_EMAIL.trim().toLowerCase(), passwordHash]
        );
        await connection.query(
            `INSERT INTO configuracoes_sistema (chave, valor)
             VALUES ('admin_inicial_configurado', '1')`
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    console.log('Administrador inicial configurado.');
}

module.exports = bootstrapAdmin;
