const express = require('express');

const {
    criarCheckout,
    webhookInfinitePay
} = require('../controllers/pagamentoController');
const { autenticarCliente } = require('../middlewares/auth');

const router = express.Router();

// Criar checkout da InfinitePay
router.post('/checkout', autenticarCliente, criarCheckout);

// Webhook da InfinitePay
router.post(
    '/webhook',
    webhookInfinitePay
);

module.exports = router;