const express = require('express');

const { autenticarCliente } = require('../middlewares/auth');
const conta = require('../controllers/contaController');

const router = express.Router();

// Todas as rotas exigem sessão de cliente. Token administrativo é recusado
// pelo próprio middleware. Não existe rota para o cliente alterar pagamento.
router.use(autenticarCliente);

router.get('/', conta.obterConta);
router.put('/', conta.atualizarConta);

router.get('/pedidos', conta.listarPedidos);
router.get('/pedidos/:id', conta.detalharPedido);

router.get('/enderecos', conta.listarEnderecos);
router.post('/enderecos', conta.criarEndereco);
router.put('/enderecos/:id', conta.atualizarEndereco);
router.delete('/enderecos/:id', conta.removerEndereco);

module.exports = router;
