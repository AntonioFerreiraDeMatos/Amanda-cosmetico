/**
 * Log de erros sem dados sensíveis.
 *
 * Erros do mysql2 carregam a propriedade `sql` com os valores já
 * interpolados (nomes, telefones, endereços). Por isso nunca registramos
 * o objeto de erro inteiro: apenas nome, código e mensagem. A pilha só é
 * registrada fora de produção.
 */
const SENSITIVE_PATTERN = /(senha|password|token|secret|authorization|bearer)\s*[:=]\s*\S+/gi;

function sanitizeText(value) {
    return String(value ?? '')
        .replace(SENSITIVE_PATTERN, '$1=[oculto]')
        .slice(0, 500);
}

function describeError(error) {
    if (!error || typeof error !== 'object') {
        return { mensagem: sanitizeText(error) };
    }

    const details = {
        nome: error.name,
        codigo: error.code,
        mensagem: sanitizeText(error.message)
    };

    if (error.errno) details.errno = error.errno;
    if (error.sqlState) details.sqlState = error.sqlState;
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        details.pilha = String(error.stack)
            .split('\n')
            .slice(1, 6)
            .map((line) => line.trim())
            .join(' | ');
    }

    return details;
}

function logError(context, error) {
    console.error(`[erro] ${context}`, JSON.stringify(describeError(error)));
}

function logWarn(message) {
    console.warn(`[aviso] ${sanitizeText(message)}`);
}

function logInfo(message) {
    console.log(`[info] ${sanitizeText(message)}`);
}

module.exports = {
    logError,
    logWarn,
    logInfo,
    describeError
};
