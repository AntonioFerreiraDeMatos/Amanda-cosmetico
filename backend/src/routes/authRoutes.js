const express = require('express');

const { loginGoogle } = require('../controllers/authController');
const { publicSensitiveLimiter } = require('../middlewares/security');

const router = express.Router();

// Login com Google
router.post('/google', publicSensitiveLimiter, loginGoogle);

// Desativado por segurança: emitia token apenas com nome + telefone, sem
// verificação. O código (loginTelefone) foi mantido no controller.
router.post('/telefone', (req, res) => {
    res.status(410).json({
        sucesso: false,
        mensagem: 'O acesso por nome e telefone foi desativado. Entre com sua conta Google.'
    });
});

module.exports = router;
