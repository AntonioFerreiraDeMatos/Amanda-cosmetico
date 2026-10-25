const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// ==========================================
// LOGIN COM GOOGLE
// ==========================================

async function loginGoogle(req, res) {
  try {
    const { idToken, telefone } = req.body;

    if (!idToken) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Token do Google é obrigatório.'
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Token do Google inválido.'
      });
    }

    const {
      sub: provedor_id,
      email,
      name: nome,
      picture: foto_url
    } = payload;

    if (!provedor_id || !email) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'O Google não forneceu os dados necessários.'
      });
    }

    // ==========================================
    // PROCURA CLIENTE PELO GOOGLE
    // ==========================================

    const [clientes] = await pool.query(
      `
      SELECT
        id,
        nome,
        email,
        provedor_login,
        provedor_id,
        foto_url,
        telefone,
        ativo,
        criado_em,
        atualizado_em
      FROM clientes
      WHERE provedor_login = 'google'
        AND provedor_id = ?
      LIMIT 1
      `,
      [provedor_id]
    );

    let cliente;

    // ==========================================
    // CLIENTE JÁ EXISTE
    // ==========================================

    if (clientes.length > 0) {
      cliente = clientes[0];

      if (!cliente.ativo) {
        return res.status(403).json({
          sucesso: false,
          mensagem: 'Este cliente está desativado.'
        });
      }

      // Se o telefone foi informado e ainda não existe
      if (telefone && !cliente.telefone) {
        await pool.query(
          `
          UPDATE clientes
          SET telefone = ?
          WHERE id = ?
          `,
          [telefone, cliente.id]
        );

        cliente.telefone = telefone;
      }
    }

    // ==========================================
    // NOVO CLIENTE
    // ==========================================

    else {
      const [porEmail] = await pool.query(
        `
        SELECT
          id,
          nome,
          email,
          provedor_login,
          provedor_id,
          foto_url,
          telefone,
          ativo,
          criado_em,
          atualizado_em
        FROM clientes
        WHERE email = ?
        LIMIT 1
        `,
        [email]
      );

      if (porEmail.length > 0) {
        return res.status(409).json({
          sucesso: false,
          mensagem: 'Este e-mail já está cadastrado com outro provedor.',
          cliente: porEmail[0]
        });
      }

      // Telefone obrigatório no primeiro cadastro
      if (!telefone) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Telefone é obrigatório no primeiro cadastro.'
        });
      }

      const [resultado] = await pool.query(
        `
        INSERT INTO clientes
        (
          nome,
          email,
          provedor_login,
          provedor_id,
          foto_url,
          telefone
        )
        VALUES
        (?, ?, 'google', ?, ?, ?)
        `,
        [
          nome || 'Cliente Google',
          email,
          provedor_id,
          foto_url || null,
          telefone
        ]
      );

      const [novoCliente] = await pool.query(
        `
        SELECT
          id,
          nome,
          email,
          provedor_login,
          provedor_id,
          foto_url,
          telefone,
          ativo,
          criado_em,
          atualizado_em
        FROM clientes
        WHERE id = ?
        LIMIT 1
        `,
        [resultado.insertId]
      );

      cliente = novoCliente[0];
    }

    // ==========================================
    // GERA JWT
    // ==========================================

    const token = jwt.sign(
      {
        cliente_id: cliente.id,
        email: cliente.email,
        provedor_login: cliente.provedor_login
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    // ==========================================
    // RESPOSTA
    // ==========================================

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Login com Google realizado com sucesso.',
      token,
      cliente
    });

  } catch (error) {
    console.error('Erro no login Google:', error);

    return res.status(401).json({
      sucesso: false,
      mensagem: 'Não foi possível autenticar com o Google.'
    });
  }
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function loginTelefone(req, res) {
  const nome = String(req.body.nome || '').trim();
  const telefone = normalizePhone(req.body.telefone);

  if (nome.length < 2 || nome.length > 150 || telefone.length < 10 || telefone.length > 13) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Informe seu nome e um telefone válido.'
    });
  }

  try {
    const [clientes] = await pool.query(`
      SELECT id, nome, email, provedor_login, provedor_id, foto_url, telefone, ativo
      FROM clientes
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') = ?
      LIMIT 1
    `, [telefone]);

    let cliente = clientes[0];

    if (cliente && !cliente.ativo) {
      return res.status(403).json({ sucesso: false, mensagem: 'Este cliente está desativado.' });
    }

    if (cliente && cliente.nome.trim().toLowerCase() !== nome.toLowerCase()) {
      return res.status(401).json({ sucesso: false, mensagem: 'Nome e telefone não conferem.' });
    }

    if (!cliente) {
      const email = `telefone-${telefone}@cliente.amanda.local`;
      const [resultado] = await pool.query(`
        INSERT INTO clientes (nome, email, provedor_login, provedor_id, telefone, ativo)
        VALUES (?, ?, 'telefone', ?, ?, TRUE)
      `, [nome, email, telefone, telefone]);

      const [[novoCliente]] = await pool.query(
        'SELECT id, nome, email, provedor_login, provedor_id, foto_url, telefone, ativo FROM clientes WHERE id = ?',
        [resultado.insertId]
      );
      cliente = novoCliente;
    }

    const token = jwt.sign(
      { cliente_id: cliente.id, email: cliente.email, provedor_login: 'telefone' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ sucesso: true, mensagem: 'Entrada realizada com sucesso.', token, cliente });
  } catch (error) {
    console.error('Erro no acesso por nome e telefone:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível realizar sua entrada.' });
  }
}

// ==========================================
// EXPORTAÇÕES
// ==========================================

module.exports = {
  loginGoogle,
  loginTelefone
};