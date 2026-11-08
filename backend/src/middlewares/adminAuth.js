const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { logError } = require('../utils/logger');

async function requireAdmin(req, res, next) {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : null;

    if (!token) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token administrativo não informado.'
        });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token administrativo inválido ou expirado.'
        });
    }

    if (payload.tipo !== 'administrador') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso restrito ao administrador.'
        });
    }

    const adminId = Number(payload.administrador_id);
    if (!Number.isSafeInteger(adminId) || adminId < 1) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Identidade administrativa inválida.'
        });
    }

    try {
        const [admins] = await pool.query(
            'SELECT id, nome, email, ativo FROM administradores WHERE id = ? LIMIT 1',
            [adminId]
        );
        if (!admins.length || !admins[0].ativo) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'A conta administrativa está inativa ou não existe.'
            });
        }

        req.admin = {
            administrador_id: Number(admins[0].id),
            nome: admins[0].nome,
            email: admins[0].email,
            tipo: 'administrador'
        };
        return next();
    } catch (error) {
        logError('Erro ao validar a conta administrativa', error);
        return res.status(503).json({
            sucesso: false,
            mensagem: 'Não foi possível validar a autorização administrativa.'
        });
    }
}

module.exports = requireAdmin;
