const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function loginAdmin(req, res) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ sucesso: false, mensagem: 'E-mail e senha são obrigatórios.' });
        }

        const [admins] = await pool.query(
            'SELECT id, nome, email, senha_hash, ativo FROM administradores WHERE email = ? LIMIT 1',
            [email.trim().toLowerCase()]
        );

        if (!admins.length || !admins[0].ativo || !(await bcrypt.compare(senha, admins[0].senha_hash))) {
            return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha inválidos.' });
        }

        const admin = admins[0];
        await pool.query('UPDATE administradores SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        const token = jwt.sign(
            { administrador_id: admin.id, email: admin.email, tipo: 'administrador' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            sucesso: true,
            token,
            administrador: { id: admin.id, nome: admin.nome, email: admin.email }
        });
    } catch (error) {
        console.error('Erro no login administrativo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível realizar o login.' });
    }
}

async function resumoAdmin(req, res) {
    try {
        const [[produtos]] = await pool.query('SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE');
        const [[categorias]] = await pool.query('SELECT COUNT(*) AS total FROM categorias WHERE ativo = TRUE');
        const [[clientes]] = await pool.query('SELECT COUNT(*) AS total FROM clientes WHERE ativo = TRUE');
        const [[estoqueBaixo]] = await pool.query('SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE AND estoque <= estoque_minimo');
        const [[pedidos]] = await pool.query('SELECT COUNT(*) AS total FROM pedidos WHERE status <> \'cancelado\'');
        const [[faturamento]] = await pool.query('SELECT COALESCE(SUM(total), 0) AS total FROM pedidos WHERE status <> \'cancelado\'');

        res.json({ sucesso: true, resumo: {
            produtos: produtos.total,
            categorias: categorias.total,
            clientes: clientes.total,
            estoqueBaixo: estoqueBaixo.total,
            pedidos: pedidos.total,
            faturamento: faturamento.total
        }});
    } catch (error) {
        console.error('Erro ao carregar resumo administrativo:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar resumo.' });
    }
}

async function dashboardAdmin(req, res) {
    try {
        const [[resumo]] = await pool.query(`
            SELECT
                (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE status <> 'cancelado') AS faturamento,
                (SELECT COUNT(*) FROM pedidos WHERE status <> 'cancelado') AS pedidos,
                (SELECT COUNT(*) FROM clientes WHERE ativo = TRUE) AS clientes,
                (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE) AS produtos,
                (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE AND estoque <= estoque_minimo) AS estoque_baixo
        `);

        const [pedidosRecentes] = await pool.query(`
            SELECT
                p.id, p.numero_pedido, p.status, p.total, p.criado_em,
                c.nome AS cliente
            FROM pedidos p
            INNER JOIN clientes c ON c.id = p.cliente_id
            ORDER BY p.criado_em DESC
            LIMIT 8
        `);

        const [estoqueBaixo] = await pool.query(`
            SELECT p.id, p.nome, p.estoque, p.estoque_minimo, c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE p.ativo = TRUE AND p.estoque <= p.estoque_minimo
            ORDER BY p.estoque ASC, p.nome ASC
            LIMIT 8
        `);

        const [maisVendidos] = await pool.query(`
            SELECT
                i.produto_id,
                i.nome_produto AS nome,
                SUM(i.quantidade) AS unidades,
                SUM(i.subtotal) AS faturamento
            FROM itens_pedido i
            INNER JOIN pedidos p ON p.id = i.pedido_id
            WHERE p.status <> 'cancelado'
            GROUP BY i.produto_id, i.nome_produto
            ORDER BY unidades DESC, faturamento DESC
            LIMIT 5
        `);

        const alertas = [];
        if (Number(resumo.estoque_baixo) > 0) {
            alertas.push({ tipo: 'estoque', titulo: `${resumo.estoque_baixo} produto(s) com estoque baixo`, acao: 'products' });
        }

        const pedidosAguardando = pedidosRecentes.filter((pedido) => pedido.status === 'aguardando_pagamento' || pedido.status === 'processando').length;
        if (pedidosAguardando > 0) {
            alertas.push({ tipo: 'pedido', titulo: `${pedidosAguardando} pedido(s) precisam de atenção`, acao: 'overview' });
        }

        return res.json({ sucesso: true, dashboard: { resumo, pedidosRecentes, estoqueBaixo, maisVendidos, alertas } });
    } catch (error) {
        console.error('Erro ao carregar dashboard administrativo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar visão geral.' });
    }
}

async function listarClientesAdmin(req, res) {
    try {
        const [clientes] = await pool.query(`
            SELECT
                c.id,
                c.nome,
                c.email,
                c.telefone,
                c.foto_url,
                c.anotacao_admin,
                c.ativo,
                c.criado_em,
                COUNT(DISTINCT CASE WHEN p.status <> 'cancelado' THEN p.id END) AS total_pedidos,
                COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.total ELSE 0 END), 0) AS total_gasto,
                MAX(CASE WHEN p.status <> 'cancelado' THEN p.criado_em END) AS ultima_compra
            FROM clientes c
            LEFT JOIN pedidos p ON p.cliente_id = c.id
            GROUP BY c.id, c.nome, c.email, c.telefone, c.foto_url, c.ativo, c.criado_em
            ORDER BY ultima_compra DESC, c.nome ASC
        `);

        return res.json({ sucesso: true, clientes });
    } catch (error) {
        console.error('Erro ao listar clientes no admin:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar clientes.' });
    }
}

async function excluirClienteAdmin(req, res) {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Cliente inválido.' });
    }

    try {
        const [[cliente]] = await pool.query(
            'SELECT id FROM clientes WHERE id = ? LIMIT 1',
            [id]
        );

        if (!cliente) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }

        const [[pedidos]] = await pool.query(
            'SELECT COUNT(*) AS total FROM pedidos WHERE cliente_id = ?',
            [id]
        );

        if (Number(pedidos.total) > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este cliente possui histórico de compras e não pode ser excluído.'
            });
        }

        await pool.query('DELETE FROM enderecos WHERE cliente_id = ?', [id]);
        await pool.query('DELETE FROM clientes WHERE id = ?', [id]);

        return res.json({ sucesso: true, mensagem: 'Cliente excluído.' });
    } catch (error) {
        console.error('Erro ao excluir cliente no admin:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir o cliente.' });
    }
}

async function atualizarAnotacaoClienteAdmin(req, res) {
    const id = Number(req.params.id);
    const anotacao = String(req.body.anotacao || '').trim();

    if (!Number.isInteger(id) || id < 1 || anotacao.length > 5000) {
        return res.status(400).json({ sucesso: false, mensagem: 'Anotação inválida.' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE clientes SET anotacao_admin = ? WHERE id = ?',
            [anotacao || null, id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }

        return res.json({ sucesso: true, mensagem: 'Anotação salva.' });
    } catch (error) {
        console.error('Erro ao salvar anotação do cliente:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível salvar a anotação.' });
    }
}

async function listarHistoricoClienteAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Cliente inválido.' });
    }

    try {
        const [[cliente]] = await pool.query(
            'SELECT id, nome, email, telefone, foto_url, anotacao_admin, ativo, criado_em FROM clientes WHERE id = ? LIMIT 1',
            [id]
        );

        if (!cliente) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
        }

        const [pedidos] = await pool.query(`
            SELECT id, numero_pedido, status, subtotal, desconto, frete, total, criado_em
            FROM pedidos
            WHERE cliente_id = ?
            ORDER BY criado_em DESC
        `, [id]);

        if (pedidos.length) {
            const pedidoIds = pedidos.map((pedido) => pedido.id);
            const placeholders = pedidoIds.map(() => '?').join(', ');
            const [itens] = await pool.query(`
                SELECT pedido_id, nome_produto, quantidade, preco_unitario, subtotal
                FROM itens_pedido
                WHERE pedido_id IN (${placeholders})
                ORDER BY id ASC
            `, pedidoIds);

            const itensPorPedido = new Map();
            itens.forEach((item) => {
                const lista = itensPorPedido.get(item.pedido_id) || [];
                lista.push(item);
                itensPorPedido.set(item.pedido_id, lista);
            });

            pedidos.forEach((pedido) => {
                pedido.itens = itensPorPedido.get(pedido.id) || [];
            });
        }

        return res.json({ sucesso: true, cliente, pedidos });
    } catch (error) {
        console.error('Erro ao carregar histórico do cliente:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar histórico do cliente.' });
    }
}

async function listarProdutosAdmin(req, res) {
    try {
        const [produtos] = await pool.query(`
                 SELECT p.id, p.nome, p.sku, p.preco, p.preco_promocional, p.estoque,
                     p.estoque_minimo, p.ativo, p.destaque, p.categoria_id, p.descricao,
                     (SELECT pi.imagem_url FROM produto_imagens pi WHERE pi.produto_id = p.id AND pi.principal = TRUE ORDER BY pi.ordem LIMIT 1) AS imagem_principal,
                     c.nome AS categoria
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            ORDER BY p.id DESC
        `);
        res.json({ sucesso: true, produtos });
    } catch (error) {
        console.error('Erro ao listar produtos no admin:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar produtos.' });
    }
}

async function listarCategoriasAdmin(req, res) {
    try {
        const [categorias] = await pool.query(
            'SELECT id, nome, slug, descricao, imagem_url, ativo FROM categorias ORDER BY nome ASC'
        );
        res.json({ sucesso: true, categorias });
    } catch (error) {
        console.error('Erro ao listar categorias no admin:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar categorias.' });
    }
}

async function criarCategoriaAdmin(req, res) {
    const nome = String(req.body.nome || '').trim();
    const descricao = String(req.body.descricao || '').trim() || null;

    if (!nome || nome.length > 100) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe um nome de categoria válido.' });
    }

    try {
        const slug = slugify(nome);
        if (!slug) {
            return res.status(400).json({ sucesso: false, mensagem: 'O nome da categoria não gera um slug válido.' });
        }

        const [result] = await pool.query(
            'INSERT INTO categorias (nome, slug, descricao, ativo) VALUES (?, ?, ?, TRUE)',
            [nome, slug, descricao]
        );

        return res.status(201).json({
            sucesso: true,
            id: result.insertId,
            mensagem: 'Categoria criada.'
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma categoria com esse nome ou slug.' });
        }

        console.error('Erro ao criar categoria no admin:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível criar a categoria.' });
    }
}

async function excluirCategoriaAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
    }

    try {
        const [[categoria]] = await pool.query(
            'SELECT id FROM categorias WHERE id = ? LIMIT 1',
            [id]
        );

        if (!categoria) {
            return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada.' });
        }

        const [[vinculo]] = await pool.query(
            'SELECT COUNT(*) AS total FROM produtos WHERE categoria_id = ?',
            [id]
        );

        if (Number(vinculo.total) > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Esta categoria possui produtos vinculados. Mova ou exclua os produtos antes de removê-la.'
            });
        }

        await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
        return res.json({ sucesso: true, mensagem: 'Categoria removida.' });
    } catch (error) {
        console.error('Erro ao excluir categoria no admin:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível remover a categoria.' });
    }
}

function slugify(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function validarProduto(body) {
    const nome = String(body.nome || '').trim();
    const categoriaId = Number(body.categoria_id);
    const preco = Number(body.preco);
    const promocional = body.preco_promocional === '' || body.preco_promocional == null
        ? null : Number(body.preco_promocional);
    const estoque = Number(body.estoque);
    const estoqueMinimo = Number(body.estoque_minimo ?? 5);
    if (!nome || !Number.isInteger(categoriaId) || categoriaId < 1 || !Number.isFinite(preco) || preco <= 0 ||
        (promocional !== null && (!Number.isFinite(promocional) || promocional <= 0 || promocional > preco)) ||
        !Number.isInteger(estoque) || estoque < 0 || !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
        return null;
    }
    return { nome, categoriaId, preco, promocional, estoque, estoqueMinimo, descricao: String(body.descricao || '').trim(), sku: String(body.sku || '').trim() || null, destaque: body.destaque ? 1 : 0, ativo: body.ativo === false ? 0 : 1 };
}

function imagemAnexada(req) {
    return req.file ? `/uploads/produtos/${req.file.filename}` : null;
}

async function criarProdutoAdmin(req, res) {
    const produto = validarProduto(req.body);
    if (!produto) return res.status(400).json({ sucesso: false, mensagem: 'Dados do produto inválidos.' });
    try {
        const [[categoria]] = await pool.query('SELECT id FROM categorias WHERE id = ? AND ativo = TRUE', [produto.categoriaId]);
        if (!categoria) return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
        const slug = slugify(produto.nome) + '-' + Date.now().toString(36);
        const [result] = await pool.query(
            `INSERT INTO produtos (categoria_id, nome, slug, descricao, sku, preco, preco_promocional, estoque, estoque_minimo, ativo, destaque)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [produto.categoriaId, produto.nome, slug, produto.descricao || null, produto.sku, produto.preco, produto.promocional, produto.estoque, produto.estoqueMinimo, produto.ativo, produto.destaque]
        );
        const imagemUrl = imagemAnexada(req);
        if (imagemUrl) {
            await pool.query(
                `INSERT INTO produto_imagens (produto_id, imagem_url, texto_alt, ordem, principal)
                 VALUES (?, ?, ?, 1, TRUE)`,
                [result.insertId, imagemUrl, produto.nome]
            );
        }
        return res.status(201).json({ sucesso: true, id: result.insertId, mensagem: 'Produto criado.' });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível criar o produto.' });
    }
}

async function atualizarProdutoAdmin(req, res) {
    const produto = validarProduto(req.body);
    const id = Number(req.params.id);
    if (!produto || !Number.isInteger(id) || id < 1) return res.status(400).json({ sucesso: false, mensagem: 'Dados do produto inválidos.' });
    try {
        const [[categoria]] = await pool.query('SELECT id FROM categorias WHERE id = ? AND ativo = TRUE', [produto.categoriaId]);
        if (!categoria) return res.status(400).json({ sucesso: false, mensagem: 'Categoria inválida.' });
        const [result] = await pool.query(
            `UPDATE produtos SET categoria_id = ?, nome = ?, descricao = ?, sku = ?, preco = ?, preco_promocional = ?, estoque = ?, estoque_minimo = ?, ativo = ?, destaque = ? WHERE id = ?`,
            [produto.categoriaId, produto.nome, produto.descricao || null, produto.sku, produto.preco, produto.promocional, produto.estoque, produto.estoqueMinimo, produto.ativo, produto.destaque, id]
        );
        if (!result.affectedRows) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        const imagemUrl = imagemAnexada(req);
        if (imagemUrl) {
            await pool.query('UPDATE produto_imagens SET principal = FALSE WHERE produto_id = ?', [id]);
            await pool.query(
                `INSERT INTO produto_imagens (produto_id, imagem_url, texto_alt, ordem, principal)
                 VALUES (?, ?, ?, 1, TRUE)`,
                [id, imagemUrl, produto.nome]
            );
        }
        return res.json({ sucesso: true, mensagem: 'Produto atualizado.' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o produto.' });
    }
}

async function excluirProdutoAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
    try {
        const [result] = await pool.query('UPDATE produtos SET ativo = FALSE WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Produto desativado.' });
    } catch (error) {
        console.error('Erro ao desativar produto:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível desativar o produto.' });
    }
}

async function excluirProdutoDefinitivoAdmin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[produto]] = await connection.query(
            'SELECT id, ativo FROM produtos WHERE id = ? LIMIT 1',
            [id]
        );

        if (!produto) {
            await connection.rollback();
            return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });
        }

        if (produto.ativo) {
            await connection.rollback();
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Desative o produto antes de excluí-lo definitivamente.'
            });
        }

        await connection.query('DELETE FROM produto_imagens WHERE produto_id = ?', [id]);
        await connection.query('DELETE FROM produtos WHERE id = ? AND ativo = FALSE', [id]);
        await connection.commit();

        return res.json({ sucesso: true, mensagem: 'Produto excluído definitivamente.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao excluir produto definitivamente:', error);

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este produto possui pedidos vinculados e não pode ser excluído.'
            });
        }

        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir o produto.' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
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
};