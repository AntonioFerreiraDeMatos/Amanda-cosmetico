// Área "Minha Conta" do cliente.
//
// Regra de segurança: toda consulta usa o ID do cliente que vem do token
// (req.cliente.id). Nenhum ID de cliente enviado pelo navegador é aceito, e
// pedidos/endereços de outra conta respondem 404, como se não existissem.
// O cliente só lê o status do pagamento: confirmar ou reverter um Pix continua
// exclusivo do painel administrativo.

const pool = require('../config/database');
const { logError } = require('../utils/logger');
const { buscarPedido, normalizarEndereco } = require('./pedidoController');

const STATUS_AGUARDANDO = ['pendente', 'aguardando_pagamento'];
const STATUS_CONFIRMADO = ['pago', 'processando', 'enviado', 'entregue'];

// Eventos da auditoria administrativa que o cliente pode ver na linha do tempo.
// Nunca expomos quem fez a alteração, o motivo interno ou outros campos.
const EVENTOS_VISIVEIS = {
    'pagamento.pix_confirmado': 'pagamento_confirmado',
    'pagamento.pix_revertido_para_pendente': 'pagamento_pendente',
    'pedido.status_atualizado': 'status',
    'pedido.cancelado': 'status'
};

function idCliente(req) {
    const id = Number(req.cliente?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function idParametro(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function falha(res, status, mensagem) {
    return res.status(status).json({ sucesso: false, mensagem });
}

function dataIso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatarEndereco(row) {
    return {
        id: Number(row.id),
        nome_destinatario: row.nome_destinatario,
        telefone: row.telefone,
        cep: row.cep,
        rua: row.rua,
        numero: row.numero,
        complemento: row.complemento || '',
        bairro: row.bairro,
        cidade: row.cidade,
        estado: row.estado,
        principal: Boolean(row.principal)
    };
}

// ------------------------------------------------------------------
// PERFIL + RESUMO
// ------------------------------------------------------------------

async function obterConta(req, res) {
    const clienteId = idCliente(req);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');

    try {
        const [clientes] = await pool.query(
            `SELECT id, nome, email, telefone, foto_url, provedor_login, ativo, criado_em
             FROM clientes WHERE id = ? LIMIT 1`,
            [clienteId]
        );
        const cliente = clientes[0];
        if (!cliente || !cliente.ativo) {
            return falha(res, 401, 'Sua conta não está disponível. Entre novamente.');
        }

        const [[resumo]] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                COALESCE(SUM(status IN (?)), 0) AS aguardando,
                COALESCE(SUM(status IN (?)), 0) AS confirmados
             FROM pedidos WHERE cliente_id = ?`,
            [STATUS_AGUARDANDO, STATUS_CONFIRMADO, clienteId]
        );

        const [ultimos] = await pool.query(
            `SELECT id, numero_exibicao, status, total, criado_em
             FROM pedidos WHERE cliente_id = ?
             ORDER BY criado_em DESC, id DESC LIMIT 1`,
            [clienteId]
        );

        return res.json({
            sucesso: true,
            cliente: {
                id: Number(cliente.id),
                nome: cliente.nome,
                email: cliente.email,
                telefone: cliente.telefone,
                foto_url: cliente.foto_url,
                provedor_login: cliente.provedor_login,
                criado_em: dataIso(cliente.criado_em)
            },
            resumo: {
                total_pedidos: Number(resumo.total),
                aguardando_pagamento: Number(resumo.aguardando),
                pagamento_confirmado: Number(resumo.confirmados),
                ultimo_pedido: ultimos[0]
                    ? {
                        id: Number(ultimos[0].id),
                        numero_pedido: ultimos[0].numero_exibicao,
                        status: ultimos[0].status,
                        total: Number(ultimos[0].total),
                        criado_em: dataIso(ultimos[0].criado_em)
                    }
                    : null
            }
        });
    } catch (error) {
        logError('Erro ao carregar a conta do cliente', error);
        return falha(res, 500, 'Não foi possível carregar sua conta.');
    }
}

async function atualizarConta(req, res) {
    const clienteId = idCliente(req);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');

    const nome = String(req.body?.nome ?? '').trim().replace(/\s+/g, ' ');
    const telefone = String(req.body?.telefone ?? '').replace(/\D/g, '');

    if (nome.length < 2 || nome.length > 150) {
        return falha(res, 400, 'Informe seu nome com 2 a 150 caracteres.');
    }
    if (telefone.length < 10 || telefone.length > 11) {
        return falha(res, 400, 'Informe um celular válido com DDD.');
    }

    try {
        // E-mail e login vêm do Google e não podem ser trocados aqui.
        const [result] = await pool.query(
            'UPDATE clientes SET nome = ?, telefone = ? WHERE id = ? AND ativo = 1',
            [nome, telefone, clienteId]
        );
        if (!result.affectedRows) {
            return falha(res, 401, 'Sua conta não está disponível. Entre novamente.');
        }
        return res.json({
            sucesso: true,
            mensagem: 'Dados atualizados.',
            cliente: { nome, telefone }
        });
    } catch (error) {
        logError('Erro ao atualizar a conta do cliente', error);
        return falha(res, 500, 'Não foi possível salvar seus dados.');
    }
}

// ------------------------------------------------------------------
// PEDIDOS
// ------------------------------------------------------------------

async function listarPedidos(req, res) {
    const clienteId = idCliente(req);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');

    try {
        const [pedidos] = await pool.query(
            `SELECT
                p.id, p.numero_exibicao, p.status, p.total, p.criado_em, p.atualizado_em,
                (SELECT COALESCE(SUM(i.quantidade), 0) FROM itens_pedido i WHERE i.pedido_id = p.id) AS itens,
                (SELECT pg.status FROM pagamentos pg
                  WHERE pg.pedido_id = p.id AND pg.metodo = 'pix'
                  ORDER BY pg.id DESC LIMIT 1) AS pagamento_status
             FROM pedidos p
             WHERE p.cliente_id = ?
             ORDER BY p.criado_em DESC, p.id DESC
             LIMIT 200`,
            [clienteId]
        );

        return res.json({
            sucesso: true,
            pedidos: pedidos.map((p) => ({
                id: Number(p.id),
                numero_pedido: p.numero_exibicao,
                status: p.status,
                total: Number(p.total),
                itens: Number(p.itens),
                pagamento_status: p.pagamento_status || 'pendente',
                criado_em: dataIso(p.criado_em),
                atualizado_em: dataIso(p.atualizado_em)
            }))
        });
    } catch (error) {
        logError('Erro ao listar pedidos do cliente', error);
        return falha(res, 500, 'Não foi possível carregar seus pedidos.');
    }
}

async function detalharPedido(req, res) {
    const clienteId = idCliente(req);
    const pedidoId = idParametro(req.params.id);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');
    if (!pedidoId) return falha(res, 404, 'Pedido não encontrado.');

    let connection;
    try {
        connection = await pool.getConnection();

        // buscarPedido filtra por "p.id = ? AND p.cliente_id = ?".
        const dados = await buscarPedido(connection, pedidoId, clienteId, process.env.PIX_KEY);
        if (!dados) return falha(res, 404, 'Pedido não encontrado.');

        const [[datas]] = await connection.query(
            `SELECT p.criado_em,
                (SELECT pg.pago_em FROM pagamentos pg
                  WHERE pg.pedido_id = p.id AND pg.metodo = 'pix'
                  ORDER BY pg.id DESC LIMIT 1) AS pago_em
             FROM pedidos p WHERE p.id = ? AND p.cliente_id = ? LIMIT 1`,
            [pedidoId, clienteId]
        );

        const [eventos] = await connection.query(
            `SELECT acao, depois_json, criado_em
             FROM admin_auditoria
             WHERE entidade = 'pedido' AND entidade_id = ? AND acao IN (?)
             ORDER BY id ASC
             LIMIT 100`,
            [pedidoId, Object.keys(EVENTOS_VISIVEIS)]
        );

        const historico = [{ tipo: 'criado', status: 'pendente', em: dataIso(datas?.criado_em) }];
        for (const evento of eventos) {
            const tipo = EVENTOS_VISIVEIS[evento.acao];
            let status = null;
            try {
                status = JSON.parse(evento.depois_json || 'null')?.status || null;
            } catch {
                status = null;
            }
            historico.push({ tipo, status, em: dataIso(evento.criado_em) });
        }

        const { cliente, ...resto } = dados;
        return res.json({
            sucesso: true,
            ...resto,
            pagamento: {
                ...dados.pagamento,
                confirmado_em: dados.pagamento.status === 'aprovado'
                    ? dataIso(datas?.pago_em)
                    : null
            },
            historico
        });
    } catch (error) {
        logError('Erro ao detalhar pedido do cliente', error);
        if (/chave Pix/i.test(error.message || '')) {
            return falha(res, 503, 'O pagamento Pix está temporariamente indisponível.');
        }
        return falha(res, 500, 'Não foi possível carregar o pedido.');
    } finally {
        if (connection) connection.release();
    }
}

// ------------------------------------------------------------------
// ENDEREÇOS
// ------------------------------------------------------------------

async function listarEnderecos(req, res) {
    const clienteId = idCliente(req);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');

    try {
        const [rows] = await pool.query(
            `SELECT id, nome_destinatario, telefone, cep, rua, numero, complemento,
                    bairro, cidade, estado, principal
             FROM enderecos
             WHERE cliente_id = ? AND arquivado = 0
             ORDER BY principal DESC, id DESC
             LIMIT 50`,
            [clienteId]
        );
        return res.json({ sucesso: true, enderecos: rows.map(formatarEndereco) });
    } catch (error) {
        logError('Erro ao listar endereços do cliente', error);
        return falha(res, 500, 'Não foi possível carregar seus endereços.');
    }
}

async function inserirEndereco(connection, clienteId, endereco, principal) {
    if (principal) {
        await connection.query(
            'UPDATE enderecos SET principal = 0 WHERE cliente_id = ?',
            [clienteId]
        );
    }
    const [result] = await connection.query(
        `INSERT INTO enderecos
            (cliente_id, nome_destinatario, telefone, cep, rua, numero, complemento,
             bairro, cidade, estado, principal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            clienteId, endereco.nome_destinatario, endereco.telefone, endereco.cep,
            endereco.rua, endereco.numero, endereco.complemento || null,
            endereco.bairro, endereco.cidade, endereco.estado, principal ? 1 : 0
        ]
    );
    return result.insertId;
}

async function criarEndereco(req, res) {
    const clienteId = idCliente(req);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');

    const endereco = normalizarEndereco(req.body);
    if (!endereco) return falha(res, 400, 'Confira os dados do endereço.');

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[{ total }]] = await connection.query(
            'SELECT COUNT(*) AS total FROM enderecos WHERE cliente_id = ? AND arquivado = 0',
            [clienteId]
        );
        if (Number(total) >= 20) {
            await connection.rollback();
            return falha(res, 400, 'Você atingiu o limite de 20 endereços salvos.');
        }

        const principal = Boolean(req.body?.principal) || Number(total) === 0;
        const id = await inserirEndereco(connection, clienteId, endereco, principal);
        await connection.commit();
        return res.status(201).json({ sucesso: true, mensagem: 'Endereço salvo.', id: Number(id) });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logError('Erro ao criar endereço do cliente', error);
        return falha(res, 500, 'Não foi possível salvar o endereço.');
    } finally {
        if (connection) connection.release();
    }
}

async function carregarEnderecoProprio(connection, clienteId, enderecoId) {
    const [rows] = await connection.query(
        `SELECT e.id, e.principal,
                EXISTS(SELECT 1 FROM pedidos p WHERE p.endereco_id = e.id) AS usado
         FROM enderecos e
         WHERE e.id = ? AND e.cliente_id = ? AND e.arquivado = 0
         LIMIT 1 FOR UPDATE`,
        [enderecoId, clienteId]
    );
    return rows[0] || null;
}

async function atualizarEndereco(req, res) {
    const clienteId = idCliente(req);
    const enderecoId = idParametro(req.params.id);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');
    if (!enderecoId) return falha(res, 404, 'Endereço não encontrado.');

    const endereco = normalizarEndereco(req.body);
    if (!endereco) return falha(res, 400, 'Confira os dados do endereço.');

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const atual = await carregarEnderecoProprio(connection, clienteId, enderecoId);
        if (!atual) {
            await connection.rollback();
            return falha(res, 404, 'Endereço não encontrado.');
        }

        const principal = req.body?.principal === undefined
            ? Boolean(atual.principal)
            : Boolean(req.body.principal);
        let id = enderecoId;

        if (Number(atual.usado)) {
            // Preserva o endereço que aparece nos pedidos antigos.
            await connection.query(
                'UPDATE enderecos SET arquivado = 1, principal = 0 WHERE id = ? AND cliente_id = ?',
                [enderecoId, clienteId]
            );
            id = await inserirEndereco(connection, clienteId, endereco, principal);
        } else {
            if (principal) {
                await connection.query(
                    'UPDATE enderecos SET principal = 0 WHERE cliente_id = ?',
                    [clienteId]
                );
            }
            await connection.query(
                `UPDATE enderecos SET
                    nome_destinatario = ?, telefone = ?, cep = ?, rua = ?, numero = ?,
                    complemento = ?, bairro = ?, cidade = ?, estado = ?, principal = ?
                 WHERE id = ? AND cliente_id = ?`,
                [
                    endereco.nome_destinatario, endereco.telefone, endereco.cep,
                    endereco.rua, endereco.numero, endereco.complemento || null,
                    endereco.bairro, endereco.cidade, endereco.estado,
                    principal ? 1 : 0, enderecoId, clienteId
                ]
            );
        }

        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Endereço atualizado.', id: Number(id) });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logError('Erro ao atualizar endereço do cliente', error);
        return falha(res, 500, 'Não foi possível atualizar o endereço.');
    } finally {
        if (connection) connection.release();
    }
}

async function removerEndereco(req, res) {
    const clienteId = idCliente(req);
    const enderecoId = idParametro(req.params.id);
    if (!clienteId) return falha(res, 401, 'Sessão inválida.');
    if (!enderecoId) return falha(res, 404, 'Endereço não encontrado.');

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const atual = await carregarEnderecoProprio(connection, clienteId, enderecoId);
        if (!atual) {
            await connection.rollback();
            return falha(res, 404, 'Endereço não encontrado.');
        }

        if (Number(atual.usado)) {
            await connection.query(
                'UPDATE enderecos SET arquivado = 1, principal = 0 WHERE id = ? AND cliente_id = ?',
                [enderecoId, clienteId]
            );
        } else {
            await connection.query(
                'DELETE FROM enderecos WHERE id = ? AND cliente_id = ?',
                [enderecoId, clienteId]
            );
        }

        await connection.commit();
        return res.json({ sucesso: true, mensagem: 'Endereço removido.' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logError('Erro ao remover endereço do cliente', error);
        return falha(res, 500, 'Não foi possível remover o endereço.');
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    obterConta,
    atualizarConta,
    listarPedidos,
    detalharPedido,
    listarEnderecos,
    criarEndereco,
    atualizarEndereco,
    removerEndereco
};
