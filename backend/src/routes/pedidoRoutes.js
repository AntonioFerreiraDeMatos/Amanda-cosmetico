const express = require('express');

const {
    criarPedido
} = require('../controllers/pedidoController');

const {
    autenticarCliente
} = require('../middlewares/auth');

const router = express.Router();

// Criar pedido — somente cliente autenticado
router.post(
    '/',
    autenticarCliente,
    criarPedido
);

module.exports = router;
