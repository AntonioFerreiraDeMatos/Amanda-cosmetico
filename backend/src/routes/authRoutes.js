const express = require('express');

const {
  loginGoogle,
  loginTelefone
} = require('../controllers/authController');

const router = express.Router();

// Login com Google
router.post('/google', loginGoogle);
router.post('/telefone', loginTelefone);

module.exports = router;