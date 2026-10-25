const express = require('express');
const requireAdmin = require('../middlewares/adminAuth');
const uploadProductImage = require('../middlewares/productUpload');
const {
    loginAdmin,
    resumoAdmin,
    dashboardAdmin,
    listarClientesAdmin,
    excluirClienteAdmin,
    atualizarAnotacaoClienteAdmin,
    listarHistoricoClienteAdmin,
    listarProdutosAdmin,
    listarCategoriasAdmin,
    criarCategoriaAdmin,
    excluirCategoriaAdmin,
    criarProdutoAdmin,
    atualizarProdutoAdmin,
    excluirProdutoAdmin,
    excluirProdutoDefinitivoAdmin
} = require('../controllers/adminController');

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/resumo', requireAdmin, resumoAdmin);
router.get('/dashboard', requireAdmin, dashboardAdmin);
router.get('/clientes', requireAdmin, listarClientesAdmin);
router.get('/clientes/:id/historico', requireAdmin, listarHistoricoClienteAdmin);
router.delete('/clientes/:id', requireAdmin, excluirClienteAdmin);
router.put('/clientes/:id/anotacao', requireAdmin, atualizarAnotacaoClienteAdmin);
router.get('/produtos', requireAdmin, listarProdutosAdmin);
router.get('/categorias', requireAdmin, listarCategoriasAdmin);
router.post('/categorias', requireAdmin, criarCategoriaAdmin);
router.delete('/categorias/:id', requireAdmin, excluirCategoriaAdmin);
router.post('/produtos', requireAdmin, uploadProductImage.single('imagem'), criarProdutoAdmin);
router.put('/produtos/:id', requireAdmin, uploadProductImage.single('imagem'), atualizarProdutoAdmin);
router.delete('/produtos/:id', requireAdmin, excluirProdutoAdmin);
router.delete('/produtos/:id/permanente', requireAdmin, excluirProdutoDefinitivoAdmin);

module.exports = router;