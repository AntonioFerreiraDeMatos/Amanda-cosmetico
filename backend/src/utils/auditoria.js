/**
 * Registro de auditoria administrativa (tabela admin_auditoria).
 * Deve ser chamado dentro da mesma transação da alteração auditada.
 */
async function registrarAuditoria(connection, req, {
    acao,
    entidade,
    entidadeId,
    motivo = null,
    antes = null,
    depois = null
}) {
    const administradorId = Number(req.admin?.administrador_id);
    if (!Number.isSafeInteger(administradorId) || administradorId < 1) {
        throw new Error('A identidade do administrador não está disponível para auditoria.');
    }

    await connection.query(`
        INSERT INTO admin_auditoria
            (administrador_id, acao, entidade, entidade_id, motivo, antes_json, depois_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        administradorId,
        acao,
        entidade,
        entidadeId,
        motivo,
        JSON.stringify(antes),
        JSON.stringify(depois)
    ]);
}

module.exports = { registrarAuditoria };
