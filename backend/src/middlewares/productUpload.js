const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { logError } = require('../utils/logger');

const uploadDirectory = path.resolve(__dirname, '../../uploads/produtos');
fs.mkdirSync(uploadDirectory, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// A extensão gravada vem do tipo permitido, nunca do nome enviado.
const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function uploadError(message) {
    const error = new Error(message);
    error.code = 'UPLOAD_INVALIDO';
    return error;
}

/** Confere a assinatura binária (magic bytes) do arquivo. */
function matchesSignature(buffer, mimetype) {
    if (mimetype === 'image/jpeg') {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimetype === 'image/png') {
        const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        return buffer.length >= 8 && png.every((byte, index) => buffer[index] === byte);
    }
    if (mimetype === 'image/webp') {
        return buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP';
    }
    return false;
}

function readHeader(filePath) {
    const handle = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(12);
        const bytesRead = fs.readSync(handle, buffer, 0, 12, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        fs.closeSync(handle);
    }
}

function removeFile(file) {
    if (!file?.path) return;
    fs.unlink(file.path, (error) => {
        if (error && error.code !== 'ENOENT') {
            logError('Falha ao remover upload descartado', error);
        }
    });
}

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
        callback(null, `produto-${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`);
    }
});

const multerInstance = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
        fields: 30,
        fieldSize: 100 * 1024
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(String(file.originalname || '')).toLowerCase();
        if (!ALLOWED_TYPES[file.mimetype] || !ALLOWED_EXTENSIONS.has(extension)) {
            return callback(uploadError('A imagem deve ser JPG, PNG ou WebP.'));
        }
        return callback(null, true);
    }
});

/**
 * Recebe um único arquivo, valida o conteúdo real e garante que o arquivo
 * seja apagado se a requisição terminar com erro (validação, banco etc.).
 */
function single(fieldName) {
    const receive = multerInstance.single(fieldName);

    return (req, res, next) => {
        receive(req, res, (error) => {
            if (error) {
                removeFile(req.file);
                return next(error);
            }
            if (!req.file) return next();

            try {
                if (!matchesSignature(readHeader(req.file.path), req.file.mimetype)) {
                    removeFile(req.file);
                    req.file = undefined;
                    return next(uploadError('O arquivo enviado não é uma imagem JPG, PNG ou WebP válida.'));
                }
            } catch (readError) {
                removeFile(req.file);
                req.file = undefined;
                return next(readError);
            }

            const file = req.file;
            res.on('finish', () => {
                if (res.statusCode >= 400) removeFile(file);
            });
            return next();
        });
    };
}

module.exports = {
    single,
    matchesSignature,
    removeFile,
    MAX_FILE_SIZE
};
