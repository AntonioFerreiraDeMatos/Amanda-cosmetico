const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token administrativo não informado.'
        });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (payload.tipo !== 'administrador') {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso restrito ao administrador.'
            });
        }

        req.admin = payload;
        next();
    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token administrativo inválido ou expirado.'
        });
    }
}

module.exports = requireAdmin;