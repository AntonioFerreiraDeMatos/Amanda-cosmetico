const express = require('express');

const {
    criarPedido,
    consultarPedido
} = require('../controllers/pedidoController');

const {
    autenticarCliente
} = require('../middlewares/auth');
const { publicSensitiveLimiter } = require('../middlewares/security');

const router = express.Router();

// Criar pedido — somente cliente autenticado
router.post(
    '/',
    publicSensitiveLimiter,
    autenticarCliente,
    criarPedido
);

router.get(
    '/:id',
    autenticarCliente,
    consultarPedido
);

module.exports = router;
