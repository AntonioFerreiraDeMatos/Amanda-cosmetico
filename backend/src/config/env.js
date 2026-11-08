const EXAMPLE_SECRETS = new Set([
    'troque-por-um-segredo-forte',
    'gere-um-segredo-longo-e-aleatorio'
]);

const DEFAULT_ORIGINS = {
    production: [
        'https://www.amandacosmeticos.com.br',
        'https://amandacosmeticos.com.br'
    ],
    development: ['http://localhost:5173']
};

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function allowedOrigins() {
    const configured = String(process.env.FRONTEND_URL || '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);

    // Os domínios oficiais (com e sem www) são sempre permitidos; FRONTEND_URL
    // apenas acrescenta origens. O site redireciona para www, então perder essa
    // origem bloqueia o login do painel.
    const base = isProduction()
        ? DEFAULT_ORIGINS.production
        : [...DEFAULT_ORIGINS.production, ...DEFAULT_ORIGINS.development];
    return [...new Set([...base, ...configured])];
}

function trustProxySetting() {
    const raw = String(process.env.TRUST_PROXY ?? '').trim().toLowerCase();
    if (raw === '') return isProduction() ? 1 : false;
    if (raw === 'false' || raw === '0') return false;
    if (raw === 'true') return true;
    const hops = Number(raw);
    return Number.isSafeInteger(hops) && hops > 0 ? hops : false;
}

/**
 * Valida as variáveis de ambiente na inicialização.
 * Nunca imprime valores, apenas os nomes das variáveis com problema.
 */
function validateEnv() {
    const errors = [];
    const warnings = [];

    for (const name of ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET']) {
        if (!String(process.env[name] || '').trim()) {
            errors.push(`${name} não está definida.`);
        }
    }

    const secret = String(process.env.JWT_SECRET || '');
    if (secret && (secret.length < 32 || EXAMPLE_SECRETS.has(secret))) {
        const message = 'JWT_SECRET precisa ter pelo menos 32 caracteres aleatórios e não pode ser o valor de exemplo.';
        if (isProduction()) errors.push(message);
        else warnings.push(message);
    }

    const offset = process.env.STORE_UTC_OFFSET;
    if (offset && !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset)) {
        errors.push('STORE_UTC_OFFSET deve estar no formato -03:00.');
    }

    if (isProduction() && !process.env.FRONTEND_URL) {
        warnings.push('FRONTEND_URL não definida; usando os domínios oficiais padrão.');
    }

    if (process.env.ADMIN_PASSWORD) {
        warnings.push('ADMIN_PASSWORD continua definida. Depois de criar o administrador, remova-a do ambiente.');
    }

    return { errors, warnings };
}

module.exports = {
    isProduction,
    allowedOrigins,
    trustProxySetting,
    validateEnv
};
