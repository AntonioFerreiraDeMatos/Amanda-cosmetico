const express = require('express');

const router = express.Router();

// Desativado por segurança: era público e devolvia dados de clientes já
// cadastrados. O cadastro acontece pelo login Google (/api/auth/google).
// O código (cadastrarCliente) foi mantido no controller.
router.post('/', (req, res) => {
    res.status(410).json({
        sucesso: false,
        mensagem: 'O cadastro direto foi desativado. Entre com sua conta Google.'
    });
});

module.exports = router;
