const pool = require('../config/database');

const fallbackCategorias = [
    { id: 1, nome: 'Skincare', slug: 'skincare', descricao: 'Cuidados para uma pele radiante.', imagem_url: '' },
    { id: 2, nome: 'Maquiagem', slug: 'maquiagem', descricao: 'Beleza, cor e personalidade.', imagem_url: '' },
    { id: 3, nome: 'Cabelos', slug: 'cabelos', descricao: 'Tratamento e cuidado diário.', imagem_url: '' },
    { id: 4, nome: 'Cosméticos', slug: 'cosmeticos', descricao: 'Momentos de cuidado e bem-estar.', imagem_url: '' },
    { id: 5, nome: 'Perfumes', slug: 'perfumes', descricao: 'Fragrâncias marcantes e delicadas.', imagem_url: '' },
    { id: 6, nome: 'Kits e Presentes', slug: 'kits-e-presentes', descricao: 'Escolhas especiais para presentear.', imagem_url: '' },
    { id: 7, nome: 'Sessão de Dez', slug: 'sessao-de-10', descricao: 'Promoções especiais da loja.', imagem_url: '' },
    { id: 8, nome: 'Acessórios', slug: 'acessorios', descricao: 'Detalhes que completam seu estilo.', imagem_url: '' }
];

async function listarCategorias(req, res) {
    try {
        const [categorias] = await pool.query(`
            SELECT
                id,
                nome,
                slug,
                descricao,
                imagem_url
            FROM categorias
            WHERE ativo = TRUE
            ORDER BY nome ASC
        `);

        res.json({
            sucesso: true,
            total: categorias.length,
            categorias
        });

    } catch (error) {
        console.error('Erro ao listar categorias:', error);

        res.status(200).json({
            sucesso: true,
            total: fallbackCategorias.length,
            categorias: fallbackCategorias,
            fallback: true,
            mensagem: 'Banco indisponível. Exibindo categorias demonstrativas.'
        });
    }
}

module.exports = {
    listarCategorias
};
