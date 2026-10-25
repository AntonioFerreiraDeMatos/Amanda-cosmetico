const jwt = require('jsonwebtoken');

function autenticarCliente(req, res, next) {
    try {
        const authorization = req.headers.authorization || '';

        if (!authorization.startsWith('Bearer ')) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token de autenticação não informado.'
            });
        }

        const token = authorization.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token de autenticação inválido.'
            });
        }

        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (
            !payload ||
            !Number.isInteger(Number(payload.cliente_id)) ||
            Number(payload.cliente_id) < 1
        ) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token de cliente inválido.'
            });
        }

        req.cliente = {
            id: Number(payload.cliente_id),
            email: payload.email || null,
            provedor_login: payload.provedor_login || null
        };

        next();

    } catch (error) {
        console.error(
            'Erro na autenticação do cliente:',
            error.message
        );

        return res.status(401).json({
            sucesso: false,
            mensagem: 'Sessão expirada ou token inválido.'
        });
    }
}

module.exports = {
    autenticarCliente
};
