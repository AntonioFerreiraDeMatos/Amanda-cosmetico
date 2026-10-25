const pool = require('../config/database');

const fallbackProdutos = [
    {
        id: 1,
        nome: 'Hidra Glow Serum',
        slug: 'hidra-glow-serum',
        descricao: 'Sérum leve para hidratação intensa e pele luminosa.',
        sku: 'SK-001',
        preco: 89.9,
        preco_promocional: 69.9,
        estoque: 25,
        destaque: true,
        categoria_id: 1,
        categoria: 'Skincare',
        imagem_principal: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'
    },
    {
        id: 2,
        nome: 'Kit de Maquiagem Essentials',
        slug: 'kit-maquiagem-essentials',
        descricao: 'Base, blush e brilho para um acabamento impecável.',
        sku: 'MK-002',
        preco: 149.9,
        preco_promocional: 129.9,
        estoque: 18,
        destaque: true,
        categoria_id: 2,
        categoria: 'Maquiagem',
        imagem_principal: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'
    },
    {
        id: 3,
        nome: 'Tratamento Capilar Repair',
        slug: 'tratamento-capilar-repair',
        descricao: 'Nutrição profunda para fios bonitos, fortes e hidratados.',
        sku: 'CL-003',
        preco: 99.9,
        preco_promocional: 0,
        estoque: 30,
        destaque: false,
        categoria_id: 3,
        categoria: 'Cabelos',
        imagem_principal: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80'
    },
    {
        id: 4,
        nome: 'Óleo Corporal de Rosas',
        slug: 'oleo-corporal-rosas',
        descricao: 'Hidratação e aroma delicado para uma rotina de autocuidado.',
        sku: 'CO-004',
        preco: 79.9,
        preco_promocional: 59.9,
        estoque: 22,
        destaque: true,
        categoria_id: 4,
        categoria: 'Cosméticos',
        imagem_principal: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80'
    },
    {
        id: 5,
        nome: 'Perfume Floral Intense',
        slug: 'perfume-floral-intense',
        descricao: 'Uma fragrância marcante e sofisticada para todos os dias.',
        sku: 'PF-005',
        preco: 179.9,
        preco_promocional: 159.9,
        estoque: 14,
        destaque: true,
        categoria_id: 5,
        categoria: 'Perfumes',
        imagem_principal: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80'
    }
];

async function listarProdutos(req, res) {
    try {
        const [produtos] = await pool.query(`
            SELECT
                p.id,
                p.nome,
                p.slug,
                p.descricao,
                p.sku,
                p.preco,
                p.preco_promocional,
                p.estoque,
                p.destaque,
                c.id AS categoria_id,
                c.nome AS categoria,
                (
                    SELECT pi.imagem_url
                    FROM produto_imagens pi
                    WHERE pi.produto_id = p.id
                      AND pi.principal = TRUE
                    ORDER BY pi.ordem ASC
                    LIMIT 1
                ) AS imagem_principal
            FROM produtos p
            INNER JOIN categorias c
                ON c.id = p.categoria_id
            WHERE p.ativo = TRUE
              AND c.ativo = TRUE
            ORDER BY p.destaque DESC, p.id DESC
        `);

        res.json({
            sucesso: true,
            total: produtos.length,
            produtos
        });

    } catch (error) {
        console.error('Erro ao listar produtos:', error);

        res.status(200).json({
            sucesso: true,
            total: fallbackProdutos.length,
            produtos: fallbackProdutos,
            fallback: true,
            mensagem: 'Banco indisponível. Exibindo catálogo demonstrativo.'
        });
    }
}
async function buscarProdutoPorId(req, res) {
    try {
        const { id } = req.params;

        const [produtos] = await pool.query(`
            SELECT
                p.id,
                p.nome,
                p.slug,
                p.descricao,
                p.sku,
                p.preco,
                p.preco_promocional,
                p.estoque,
                p.estoque_minimo,
                p.peso,
                p.destaque,
                c.id AS categoria_id,
                c.nome AS categoria,
                c.slug AS categoria_slug
            FROM produtos p
            INNER JOIN categorias c
                ON c.id = p.categoria_id
            WHERE p.id = ?
              AND p.ativo = TRUE
              AND c.ativo = TRUE
            LIMIT 1
        `, [id]);

        if (produtos.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Produto não encontrado.'
            });
        }

        const produto = produtos[0];

        const [imagens] = await pool.query(`
            SELECT
                id,
                imagem_url,
                texto_alt,
                ordem,
                principal
            FROM produto_imagens
            WHERE produto_id = ?
            ORDER BY ordem ASC, id ASC
        `, [id]);

        produto.imagens = imagens;

        res.json({
            sucesso: true,
            produto
        });

    } catch (error) {
        console.error('Erro ao buscar produto:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar produto.'
        });
    }
}

module.exports = {
    listarProdutos,
    buscarProdutoPorId
};