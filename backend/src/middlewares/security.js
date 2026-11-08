const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { isProduction } = require('../config/env');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Cabeçalhos de segurança para uma API JSON.
 * - CORP "same-site": www.amandacosmeticos.com.br pode exibir imagens de
 *   api.amandacosmeticos.com.br; outros sites não.
 * - HSTS só em produção (HTTPS).
 */
function securityHeaders() {
    return helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'none'"],
                formAction: ["'none'"]
            }
        },
        crossOriginResourcePolicy: { policy: 'same-site' },
        crossOriginEmbedderPolicy: false,
        referrerPolicy: { policy: 'no-referrer' },
        strictTransportSecurity: isProduction()
            ? { maxAge: 31536000, includeSubDomains: true }
            : false
    });
}

function limitHandler(message) {
    return (req, res, next, options) => {
        res.status(options.statusCode).json({ sucesso: false, mensagem: message });
    };
}

function createLimiter({ windowMs = FIFTEEN_MINUTES, limit, message, ...rest }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: limitHandler(message),
        ...rest
    });
}

/** Login administrativo: 10 tentativas com falha por IP a cada 15 minutos. */
const adminLoginLimiter = createLimiter({
    limit: Number(process.env.RATE_LIMIT_ADMIN_LOGIN || 10),
    skipSuccessfulRequests: true,
    message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.'
});

/** Rotas administrativas autenticadas. */
const adminLimiter = createLimiter({
    limit: Number(process.env.RATE_LIMIT_ADMIN || 600),
    message: 'Muitas requisições ao painel. Aguarde alguns minutos.'
});

/** Login de clientes e criação de pedidos. */
const publicSensitiveLimiter = createLimiter({
    limit: Number(process.env.RATE_LIMIT_PUBLIC_SENSITIVE || 30),
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
});

/** Limite geral da API. */
const apiLimiter = createLimiter({
    limit: Number(process.env.RATE_LIMIT_API || 1000),
    message: 'Muitas requisições. Aguarde alguns minutos.'
});

module.exports = {
    securityHeaders,
    adminLoginLimiter,
    adminLimiter,
    publicSensitiveLimiter,
    apiLimiter
};
