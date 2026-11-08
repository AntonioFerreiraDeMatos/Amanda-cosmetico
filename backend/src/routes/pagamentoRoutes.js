const express = require('express');

const router = express.Router();

router.post('/checkout', (req, res) => {
    res.status(410).json({
        sucesso: false,
        mensagem: 'O checkout foi desativado. Registre o pedido em /api/pedidos e combine o Pix pelo WhatsApp.'
    });
});

module.exports = router;