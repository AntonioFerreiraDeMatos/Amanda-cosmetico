const fs = require('fs');
const path = require('path');
const pool = require('./database');

async function migrate() {
    const directory = path.resolve(__dirname, '../migrations');
    const files = fs.readdirSync(directory)
        .filter((file) => /^\d+.*\.sql$/.test(file))
        .sort();

    if (!files.length) {
        throw new Error('Nenhuma migração de banco de dados foi encontrada.');
    }

    const connection = await pool.getConnection();

    try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename varchar(255) NOT NULL,
                aplicado_em timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (filename)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        for (const file of files) {
            const [applied] = await connection.query(
                'SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1',
                [file]
            );
            if (applied.length) continue;

            const sql = fs.readFileSync(path.join(directory, file), 'utf8')
                .replace(/^\uFEFF/, '');
            const statements = sql.split(/;\s*(?:\r?\n|$)/)
                .map((statement) => statement.trim())
                .filter(Boolean);

            for (const statement of statements) {
                await connection.query(statement);
            }
            await connection.query(
                'INSERT INTO schema_migrations (filename) VALUES (?)',
                [file]
            );
        }
    } finally {
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } finally {
            connection.release();
        }
    }
}

module.exports = migrate;
