const express = require('express');

const {
    listarCategorias
} = require('../controllers/categoriaController');

const router = express.Router();

router.get('/', listarCategorias);

module.exports = router;
