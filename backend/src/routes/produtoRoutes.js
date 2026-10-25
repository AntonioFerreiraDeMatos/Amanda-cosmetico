const express = require('express');

const {
    listarProdutos,
    buscarProdutoPorId
} = require('../controllers/produtoController');

const router = express.Router();

router.get('/', listarProdutos);

router.get('/:id', buscarProdutoPorId);

module.exports = router;