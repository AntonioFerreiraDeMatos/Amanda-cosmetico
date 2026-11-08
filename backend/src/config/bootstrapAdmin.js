const bcrypt = require('bcryptjs');
const pool = require('./database');
const { logInfo, logWarn } = require('../utils/logger');

/**
 * Cria o administrador inicial a partir de ADMIN_NAME, ADMIN_EMAIL e
 * ADMIN_PASSWORD.
 *
 * Primeira execução (sem a marca admin_inicial_configurado): comportamento
 * original preservado — desativa contas antigas (ex.: importadas de backup)
 * e cria o administrador informado.
 *
 * Execuções seguintes:
 * - conta inexistente: é criada (recuperação de acesso);
 * - conta desativada: só é reativada, com a senha do ambiente, se
 *   ADMIN_BOOTSTRAP_RESET=true. Isso impede que credenciais esquecidas no
 *   ambiente reativem uma conta desligada de propósito.
 */
async function bootstrapAdmin() {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    const providedValues = [ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD]
        .filter(Boolean)
        .length;

    if (providedValues === 0) {
        return;
    }

    if (providedValues !== 3) {
        throw new Error('A configuração do administrador inicial está incompleta.');
    }

    if (ADMIN_PASSWORD.length < 10) {
        logWarn('ADMIN_PASSWORD tem menos de 10 caracteres. Use uma senha mais longa.');
    }

    const email = ADMIN_EMAIL.trim().toLowerCase();
    const name = ADMIN_NAME.trim();

    const [bootstrapped] = await pool.query(
        `SELECT chave FROM configuracoes_sistema
         WHERE chave = 'admin_inicial_configurado'
         LIMIT 1`
    );

    if (bootstrapped.length) {
        const [admins] = await pool.query(
            'SELECT id, ativo FROM administradores WHERE email = ? LIMIT 1',
            [email]
        );

        if (admins.length && admins[0].ativo) {
            return;
        }

        if (admins.length && process.env.ADMIN_BOOTSTRAP_RESET !== 'true') {
            logWarn('O administrador do ambiente está desativado. Defina ADMIN_BOOTSTRAP_RESET=true para reativá-lo.');
            return;
        }

        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await pool.query(
            `INSERT INTO administradores (nome, email, senha_hash, ativo)
             VALUES (?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE
                nome = VALUES(nome),
                senha_hash = VALUES(senha_hash),
                ativo = TRUE`,
            [name, email, passwordHash]
        );
        logInfo(admins.length
            ? 'Administrador reativado com as credenciais do ambiente (ADMIN_BOOTSTRAP_RESET). Remova essa variável agora.'
            : 'Administrador criado com as credenciais do ambiente.');
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
            [name, email, passwordHash]
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

    logInfo('Administrador inicial configurado. Remova ADMIN_PASSWORD do ambiente.');
}

module.exports = bootstrapAdmin;
