require('dotenv').config();

const mysql = require('mysql2/promise');
const fs = require('fs');

async function backup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [tables] = await connection.query('SHOW TABLES');

    let sql = '';

    sql += `-- BACKUP AMANDA COSMÉTICOS\n`;
    sql += `-- Banco: ${process.env.DB_NAME}\n`;
    sql += `-- Data: ${new Date().toISOString()}\n\n`;

    sql += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    for (const row of tables) {
        const table = Object.values(row)[0];

        console.log(`Backup da tabela: ${table}`);

        const [create] = await connection.query(
            `SHOW CREATE TABLE \`${table}\``
        );

        sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
        sql += `${create[0]['Create Table']};\n\n`;

        const [data] = await connection.query(
            `SELECT * FROM \`${table}\``
        );

        for (const item of data) {
            const columns = Object.keys(item)
                .map(column => `\`${column}\``)
                .join(', ');

            const values = Object.values(item)
                .map(value => connection.escape(value))
                .join(', ');

            sql += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
        }

        sql += '\n';
    }

    sql += `SET FOREIGN_KEY_CHECKS=1;\n`;

    const backupDir = '../backup';

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const file = `${backupDir}/amanda_cosmeticos_backup.sql`;

    fs.writeFileSync(file, sql, 'utf8');

    await connection.end();

    console.log('');
    console.log('==========================================');
    console.log('✅ BACKUP CRIADO COM SUCESSO!');
    console.log(`📁 ${file}`);
    console.log('==========================================');
}

backup().catch(error => {
    console.error('');
    console.error('❌ ERRO AO CRIAR BACKUP');
    console.error(error);
    process.exit(1);
});
