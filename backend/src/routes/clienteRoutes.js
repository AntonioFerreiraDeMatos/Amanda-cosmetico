const express = require('express');

const {
    cadastrarCliente
} = require('../controllers/clienteController');

const router = express.Router();

router.post('/', cadastrarCliente);

module.exports = router;
