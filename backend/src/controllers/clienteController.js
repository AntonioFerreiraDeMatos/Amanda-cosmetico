const pool = require('../config/database');

async function cadastrarCliente(req, res) {
    try {
        const {
            nome,
            email,
            provedor_login,
            provedor_id,
            foto_url,
            telefone
        } = req.body;

        if (!nome || !email || !provedor_login || !provedor_id || !telefone) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome, e-mail, provedor, identificador e telefone são obrigatórios.'
            });
        }

        if (!['google'].includes(provedor_login)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O provedor de login deve ser Google.'
            });
        }

        const [existentes] = await pool.query(
            `
            SELECT
                id,
                nome,
                email,
                provedor_login,
                provedor_id,
                foto_url,
                telefone,
                ativo,
                criado_em,
                atualizado_em
            FROM clientes
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

        if (existentes.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este cliente já está cadastrado.',
                cliente: existentes[0]
            });
        }

        const [resultado] = await pool.query(
            `
            INSERT INTO clientes
                (
                    nome,
                    email,
                    provedor_login,
                    provedor_id,
                    foto_url,
                    telefone
                )
            VALUES
                (?, ?, ?, ?, ?, ?)
            `,
            [
                nome,
                email,
                provedor_login,
                provedor_id,
                foto_url || null,
                telefone
            ]
        );

        const [clientes] = await pool.query(
            `
            SELECT
                id,
                nome,
                email,
                provedor_login,
                provedor_id,
                foto_url,
                telefone,
                ativo,
                criado_em,
                atualizado_em
            FROM clientes
            WHERE id = ?
            LIMIT 1
            `,
            [resultado.insertId]
        );

        res.status(201).json({
            sucesso: true,
            mensagem: 'Cliente cadastrado com sucesso.',
            cliente: clientes[0]
        });

    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cadastrar cliente.'
        });
    }
}

module.exports = {
    cadastrarCliente
};
