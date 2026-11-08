const jwt = require('jsonwebtoken');

function autenticarCliente(req, res, next) {
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

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Sessão expirada ou token inválido.'
        });
    }

    // Token administrativo nunca vale como sessão de cliente.
    if (
        !payload ||
        payload.tipo === 'administrador' ||
        !Number.isSafeInteger(Number(payload.cliente_id)) ||
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

    return next();
}

module.exports = {
    autenticarCliente
};
