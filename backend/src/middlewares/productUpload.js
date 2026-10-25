const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDirectory = path.resolve(__dirname, '../../uploads/produtos');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `produto-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    }
});

const uploadProductImage = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('A imagem deve ser JPG, PNG ou WebP.'));
        }
        callback(null, true);
    }
});

module.exports = uploadProductImage;
