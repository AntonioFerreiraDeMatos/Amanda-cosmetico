const express = require('express');
const requireAdmin = require('../middlewares/adminAuth');
const uploadProductImage = require('../middlewares/productUpload');
const { adminLoginLimiter, adminLimiter } = require('../middlewares/security');
const { zerarDadosAdmin } = require('../controllers/sistemaController');
const {
    loginAdmin,
    resumoAdmin,
    dashboardAdmin,
    criarPedidoAdmin,
    listarPedidosAdmin,
    detalhePedidoAdmin,
    atualizarDetalhesPedidoAdmin,
    atualizarStatusPedidoAdmin,
    confirmarPagamentoPixAdmin,
    reverterPagamentoPixAdmin,
    listarMovimentacoesEstoqueAdmin,
    listarAuditoriaAdmin,
    movimentarEstoqueAdmin,
    listarClientesAdmin,
    atualizarClienteAdmin,
    excluirClienteAdmin,
    atualizarStatusClienteAdmin,
    atualizarAnotacaoClienteAdmin,
    listarHistoricoClienteAdmin,
    listarProdutosAdmin,
    listarCategoriasAdmin,
    criarCategoriaAdmin,
    atualizarCategoriaAdmin,
    excluirCategoriaAdmin,
    criarProdutoAdmin,
    atualizarProdutoAdmin,
    excluirProdutoAdmin,
    excluirProdutoDefinitivoAdmin,
    excluirPedidoAdmin
} = require('../controllers/adminController');
const {
    relatorioVendas,
    relatorioPedidos,
    relatorioClientes,
    relatorioEstoque,
    relatorioAtencao,
    exportarPedidosCsv,
    exportarClientesCsv,
    exportarEstoqueCsv
} = require('../controllers/relatorioController');

const router = express.Router();

// Login: limite próprio, contando só tentativas com falha.
router.post('/login', adminLoginLimiter, loginAdmin);

// Todas as demais rotas: limite por IP + autenticação administrativa.
router.use(adminLimiter, requireAdmin);

// Apaga dados de teste; limitado como o login porque confere a senha.
router.post('/sistema/zerar-dados', adminLoginLimiter, zerarDadosAdmin);

router.get('/resumo', resumoAdmin);
router.get('/dashboard', dashboardAdmin);

// Relatórios do dashboard (somente leitura)
router.get('/relatorios/vendas', relatorioVendas);
router.get('/relatorios/pedidos', relatorioPedidos);
router.get('/relatorios/clientes', relatorioClientes);
router.get('/relatorios/estoque', relatorioEstoque);
router.get('/relatorios/atencao', relatorioAtencao);

// Exportações CSV
router.get('/exportar/pedidos.csv', exportarPedidosCsv);
router.get('/exportar/clientes.csv', exportarClientesCsv);
router.get('/exportar/estoque.csv', exportarEstoqueCsv);

// Pedidos
router.post('/pedidos', criarPedidoAdmin);
router.get('/pedidos', listarPedidosAdmin);
router.get('/pedidos/:id', detalhePedidoAdmin);
router.patch('/pedidos/:id/dados', atualizarDetalhesPedidoAdmin);
router.patch('/pedidos/:id/status', atualizarStatusPedidoAdmin);
router.post('/pedidos/:id/confirmar-pix', confirmarPagamentoPixAdmin);
router.post('/pedidos/:id/reverter-pix', reverterPagamentoPixAdmin);
router.delete('/pedidos/:id', excluirPedidoAdmin);

// Estoque e auditoria
router.get('/estoque/movimentacoes', listarMovimentacoesEstoqueAdmin);
router.post('/estoque/movimentacoes', movimentarEstoqueAdmin);
router.get('/auditoria', listarAuditoriaAdmin);

// Clientes
router.get('/clientes', listarClientesAdmin);
router.get('/clientes/:id/historico', listarHistoricoClienteAdmin);
router.put('/clientes/:id', atualizarClienteAdmin);
router.delete('/clientes/:id', excluirClienteAdmin);
router.patch('/clientes/:id/status', atualizarStatusClienteAdmin);
router.put('/clientes/:id/anotacao', atualizarAnotacaoClienteAdmin);

// Catálogo
router.get('/produtos', listarProdutosAdmin);
router.get('/categorias', listarCategoriasAdmin);
router.post('/categorias', criarCategoriaAdmin);
router.put('/categorias/:id', atualizarCategoriaAdmin);
router.delete('/categorias/:id', excluirCategoriaAdmin);
router.post('/produtos', uploadProductImage.single('imagem'), criarProdutoAdmin);
router.put('/produtos/:id', uploadProductImage.single('imagem'), atualizarProdutoAdmin);
router.delete('/produtos/:id', excluirProdutoAdmin);
router.delete('/produtos/:id/permanente', excluirProdutoDefinitivoAdmin);

module.exports = router;
