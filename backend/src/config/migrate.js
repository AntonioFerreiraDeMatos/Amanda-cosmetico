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

        for (const file of files) {
            const sql = fs.readFileSync(path.join(directory, file), 'utf8')
                .replace(/^\uFEFF/, '');
            const statements = sql.split(/;\s*(?:\r?\n|$)/)
                .map((statement) => statement.trim())
                .filter(Boolean);

            for (const statement of statements) {
                await connection.query(statement);
            }
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
