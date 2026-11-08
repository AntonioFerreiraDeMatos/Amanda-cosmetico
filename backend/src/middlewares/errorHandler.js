const { logError } = require('../utils/logger');

function notFound(req, res) {
    res.status(404).json({
        sucesso: false,
        mensagem: 'Recurso não encontrado.'
    });
}

/**
 * Tratamento global de erros. Mensagens internas nunca chegam ao cliente:
 * só erros conhecidos (JSON inválido, upload, CORS) têm mensagem própria.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    let status = 500;
    let mensagem = 'Erro interno do servidor.';

    if (error?.code === 'CORS_ORIGIN_DENIED') {
        status = 403;
        mensagem = 'Origem não autorizada.';
    } else if (error?.type === 'entity.parse.failed') {
        status = 400;
        mensagem = 'O corpo da requisição não é um JSON válido.';
    } else if (error?.type === 'entity.too.large') {
        status = 413;
        mensagem = 'A requisição é maior que o permitido.';
    } else if (error?.name === 'MulterError') {
        status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        mensagem = error.code === 'LIMIT_FILE_SIZE'
            ? 'A imagem deve ter no máximo 5 MB.'
            : 'Não foi possível receber o arquivo enviado.';
    } else if (error?.code === 'UPLOAD_INVALIDO') {
        status = 400;
        mensagem = error.message;
    } else if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
        status = error.status;
        mensagem = 'Requisição inválida.';
    }

    if (status >= 500) {
        logError(`${req.method} ${req.originalUrl.split('?')[0]}`, error);
    }

    return res.status(status).json({ sucesso: false, mensagem });
}

module.exports = {
    notFound,
    errorHandler
};
