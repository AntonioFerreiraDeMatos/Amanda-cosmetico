import { api, download, imageUrl } from '../api.js'
import { icon } from '../icons.js'
import { invalidate } from '../data.js'
import {
  esc, money, number, date, dateTime, phoneLabel, statusBadge, skeleton, errorState, emptyState, toast,
  openDialog, confirmDialog, formError, withBusy, whatsappLink, addressFields, readAddress, validateAddress,
  isEmailTecnico,
} from '../ui.js'

export async function renderList(root, ctx) {
  const f = {
    q: ctx.query.get('q') || '',
    ativo: ctx.query.get('ativo') || '',
    page: Math.max(1, Number(ctx.query.get('page')) || 1),
  }
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Clientes</h1><p class="muted">Quem compra na loja, quanto já gastou e o histórico de cada um.</p></div>
      <div class="page-actions"><button class="btn" type="button" data-action="export">${icon('download', 16)}Exportar CSV</button></div>
    </div>
    <form class="card filters" role="search" aria-label="Filtrar clientes">
      <div class="field grow"><label for="c-q">Buscar</label><input id="c-q" name="q" type="search" maxlength="100" value="${esc(f.q)}" placeholder="Nome, e-mail ou telefone"></div>
      <div class="field"><label for="c-ativo">Situação</label>
        <select id="c-ativo" name="ativo">
          <option value="">Todos</option>
          <option value="true" ${f.ativo === 'true' ? 'selected' : ''}>Ativos</option>
          <option value="false" ${f.ativo === 'false' ? 'selected' : ''}>Desativados</option>
        </select></div>
      <div class="filters-actions"><button class="btn btn-primary" type="submit">${icon('search', 16)}Filtrar</button><a class="btn btn-ghost" href="#/clientes">Limpar</a></div>
    </form>
    <div id="clients-result">${skeleton({ rows: 8 })}</div>`

  const form = root.querySelector('form.filters')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = new URLSearchParams()
    for (const [k, v] of new FormData(form).entries()) if (String(v).trim()) q.set(k, String(v).trim())
    ctx.navigate(`#/clientes${q.toString() ? `?${q}` : ''}`)
  })
  root.querySelector('[data-action="export"]').addEventListener('click', (e) => withBusy(e.currentTarget, 'Gerando...', async () => {
    try { await download('/admin/exportar/clientes.csv', 'clientes.csv'); toast('Planilha de clientes gerada.') } catch (error) { toast(error.message, 'error') }
  }))

  const box = root.querySelector('#clients-result')
  async function load() {
    box.innerHTML = skeleton({ rows: 8 })
    try {
      const q = new URLSearchParams({ page: String(f.page), limit: '20' })
      if (f.q) q.set('q', f.q)
      if (f.ativo) q.set('ativo', f.ativo)
      const data = await api(`/admin/clientes?${q}`)
      if (!data.clientes.length) {
        box.innerHTML = emptyState('Nenhum cliente encontrado', 'Ajuste a busca ou os filtros.')
        return
      }
      const link = (p) => { const s = new URLSearchParams(ctx.query); s.set('page', String(p)); return `#/clientes?${s}` }
      box.innerHTML = `
        <div class="card table-card">
          <p class="table-meta">${number(data.total)} cliente(s)</p>
          <div class="table-scroll"><table class="table">
            <caption class="sr-only">Lista de clientes</caption>
            <thead><tr><th scope="col">Cliente</th><th scope="col">Contato</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">Total gasto</th><th scope="col">Última compra</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
            <tbody>${data.clientes.map((c) => `<tr>
              <td data-label="Cliente"><a class="strong" href="#/clientes/${Number(c.id)}">${esc(c.nome)}</a>${c.anotacao_admin ? `<small class="muted block">${icon('edit', 12)} Tem anotação</small>` : ''}</td>
              <td data-label="Contato">${esc(phoneLabel(c.telefone))}${c.email && !isEmailTecnico(c.email) ? `<small class="muted block">${esc(c.email)}</small>` : ''}</td>
              <td data-label="Pedidos" class="num">${number(c.total_pedidos)}</td>
              <td data-label="Total gasto" class="num">${money(c.total_gasto)}</td>
              <td data-label="Última compra">${date(c.ultima_compra)}</td>
              <td data-label="Situação">${Number(c.ativo) === 1 ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-muted">Desativado</span>'}</td>
              <td class="row-actions"><a class="btn btn-sm" href="#/clientes/${Number(c.id)}">Abrir</a></td>
            </tr>`).join('')}</tbody>
          </table></div>
          ${data.totalPaginas > 1 ? `<nav class="pagination" aria-label="Paginação">
            ${f.page > 1 ? `<a class="btn btn-sm" href="${link(f.page - 1)}">${icon('chevronLeft', 16)}Anterior</a>` : '<span></span>'}
            <span>Página ${f.page} de ${data.totalPaginas}</span>
            ${f.page < data.totalPaginas ? `<a class="btn btn-sm" href="${link(f.page + 1)}">Próxima${icon('chevronRight', 16)}</a>` : '<span></span>'}
          </nav>` : ''}
        </div>`
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }
  await load()
}

export async function renderDetail(root, ctx) {
  const id = Number(ctx.params.id)
  root.innerHTML = skeleton({ rows: 8 })
  let data
  try {
    data = await api(`/admin/clientes/${id}/historico`)
  } catch (error) {
    root.innerHTML = errorState(error.message)
    root.querySelector('[data-action="retry"]').addEventListener('click', () => renderDetail(root, ctx))
    return
  }
  const { cliente, enderecos, pedidos } = data
  ctx.setCrumbs([{ label: 'Clientes', href: '#/clientes' }, { label: cliente.nome }])
  const ativo = Number(cliente.ativo) === 1
  const pagos = pedidos.filter((p) => p.pagamento_status === 'aprovado' && p.status !== 'cancelado')
  const totalGasto = pagos.reduce((s, p) => s + Number(p.total || 0), 0)
  const principal = enderecos.find((e) => Number(e.principal) === 1) || enderecos[0]
  const wa = whatsappLink(cliente.telefone, `Olá, ${String(cliente.nome).split(' ')[0]}! Aqui é da Amanda Cosméticos.`)
  const reload = () => renderDetail(root, ctx)

  root.innerHTML = `
    <div class="page-head">
      <div class="profile-head">
        ${cliente.foto_url ? `<img class="avatar" src="${esc(imageUrl(cliente.foto_url))}" alt="">` : `<span class="avatar">${icon('user', 24)}</span>`}
        <div>
          <h1>${esc(cliente.nome)}</h1>
          <p class="badges">${ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-muted">Desativado</span>'} <small class="muted">Cliente desde ${date(cliente.criado_em)}</small></p>
        </div>
      </div>
      <div class="page-actions">
        ${wa ? `<a class="btn btn-whatsapp" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon('whatsapp', 16)}WhatsApp</a>` : ''}
        <button class="btn" type="button" data-action="edit">${icon('edit', 16)}Editar cadastro</button>
        <button class="btn ${ativo ? 'btn-danger-ghost' : ''}" type="button" data-action="toggle">${icon('power', 16)}${ativo ? 'Desativar' : 'Reativar'}</button>
      </div>
    </div>
    <div class="kpi-grid kpi-grid-3">
      <article class="card kpi"><h3>Total gasto</h3><p class="kpi-value">${money(totalGasto)}</p><small class="kpi-hint">Pix aprovados</small></article>
      <article class="card kpi"><h3>Pedidos</h3><p class="kpi-value">${number(pedidos.filter((p) => p.status !== 'cancelado').length)}</p><small class="kpi-hint">${number(pagos.length)} pago(s)</small></article>
      <article class="card kpi"><h3>Ticket médio</h3><p class="kpi-value">${money(pagos.length ? totalGasto / pagos.length : 0)}</p><small class="kpi-hint">Por pedido pago</small></article>
    </div>
    <div class="grid-2-1">
      <article class="card">
        <h2 class="card-title">Histórico de pedidos</h2>
        ${pedidos.length ? `<div class="table-scroll"><table class="table">
          <caption class="sr-only">Pedidos do cliente</caption>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Data</th><th scope="col">Itens</th><th scope="col" class="num">Total</th><th scope="col">Status</th></tr></thead>
          <tbody>${pedidos.map((p) => `<tr>
            <td data-label="Pedido"><a class="strong" href="#/pedidos/${Number(p.id)}">${esc(p.numero_exibicao)}</a></td>
            <td data-label="Data">${dateTime(p.criado_em)}</td>
            <td data-label="Itens">${esc((p.itens || []).map((i) => `${i.quantidade}x ${i.nome_produto}`).join(', ') || '—')}</td>
            <td data-label="Total" class="num">${money(p.total)}</td>
            <td data-label="Status">${statusBadge(p.status)}</td>
          </tr>`).join('')}</tbody></table></div>` : emptyState('Nenhum pedido ainda')}
      </article>
      <div class="stack">
        <article class="card">
          <h2 class="card-title">Contato</h2>
          <dl class="kv">
            <div><dt>WhatsApp</dt><dd>${esc(phoneLabel(cliente.telefone))}</dd></div>
            <div><dt>E-mail</dt><dd>${cliente.email && !isEmailTecnico(cliente.email) ? esc(cliente.email) : '—'}</dd></div>
          </dl>
        </article>
        <article class="card">
          <h2 class="card-title">Endereços</h2>
          ${enderecos.length ? `<ul class="mini-list">${enderecos.slice(0, 5).map((e) => `
            <li><span>${Number(e.principal) === 1 ? '<span class="badge badge-info">Principal</span> ' : ''}${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ` — ${esc(e.complemento)}` : ''} · ${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.estado)} · CEP ${esc(e.cep)}</span></li>`).join('')}</ul>`
            : '<p class="muted">Nenhum endereço cadastrado.</p>'}
        </article>
        <article class="card">
          <form class="form" data-note>
            <label class="card-title" for="note">Anotações internas</label>
            <textarea id="note" name="anotacao" rows="4" maxlength="5000" placeholder="Preferências, combinados, observações...">${esc(cliente.anotacao_admin || '')}</textarea>
            <small class="help">Só a equipe vê. Máximo de 5000 caracteres.</small>
            <div><button class="btn btn-sm btn-primary" type="submit">Salvar anotação</button></div>
          </form>
        </article>
      </div>
    </div>`

  root.querySelector('[data-note]').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = e.target.querySelector('button[type="submit"]')
    await withBusy(btn, 'Salvando...', async () => {
      try {
        await api(`/admin/clientes/${id}/anotacao`, { method: 'PUT', body: { anotacao: e.target.elements.anotacao.value } })
        toast('Anotação salva.')
      } catch (error) { toast(error.message, 'error') }
    })
  })

  root.querySelector('[data-action="toggle"]').addEventListener('click', async (e) => {
    const r = await confirmDialog({
      title: ativo ? 'Desativar cliente?' : 'Reativar cliente?',
      message: ativo
        ? 'O cliente não conseguirá fazer novos pedidos. O histórico é preservado e você pode reativar depois.'
        : 'O cliente volta a poder fazer pedidos.',
      confirmLabel: ativo ? 'Desativar' : 'Reativar',
      danger: ativo,
    })
    if (!r.ok) return
    await withBusy(e.currentTarget, 'Salvando...', async () => {
      try {
        await api(`/admin/clientes/${id}/status`, { method: 'PATCH', body: { ativo: !ativo } })
        invalidate('clientes')
        toast(ativo ? 'Cliente desativado.' : 'Cliente reativado.')
        reload()
      } catch (error) { toast(error.message, 'error') }
    })
  })

  root.querySelector('[data-action="edit"]').addEventListener('click', () => {
    const { body, close } = openDialog({
      title: 'Editar cadastro',
      size: 'lg',
      content: `
        <form class="form" novalidate>
          <div class="form-grid">
            <div class="field span-2"><label for="ce-nome">Nome <span class="req" aria-hidden="true">*</span></label><input id="ce-nome" name="nome" maxlength="150" required value="${esc(cliente.nome)}"></div>
            <div class="field"><label for="ce-email">E-mail <span class="req" aria-hidden="true">*</span></label><input id="ce-email" name="email" type="email" maxlength="255" required value="${esc(cliente.email)}"></div>
            <div class="field"><label for="ce-tel">WhatsApp</label><input id="ce-tel" name="telefone_cliente" inputmode="tel" maxlength="20" value="${esc(cliente.telefone || '')}"></div>
          </div>
          <fieldset class="fieldset">
            <legend>Endereço principal <small class="muted">(opcional — deixe em branco para manter)</small></legend>
            ${addressFields('ce', principal || {}, { required: false })}
          </fieldset>
          <p class="form-error" role="alert" hidden></p>
          <div class="dialog-actions"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div>
        </form>`,
    })
    const form = body.querySelector('form')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const payload = {
        nome: form.elements.nome.value.trim(),
        email: form.elements.email.value.trim(),
        telefone: form.elements.telefone_cliente.value.replace(/\D/g, ''),
      }
      if (payload.nome.length < 2) return formError(form, 'Informe o nome.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return formError(form, 'Informe um e-mail válido.')
      if (payload.telefone && (payload.telefone.length < 10 || payload.telefone.length > 13)) return formError(form, 'WhatsApp com DDD (10 ou 11 dígitos).')
      const endereco = readAddress(form)
      if (['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'].some((k) => endereco[k])) {
        if (!endereco.telefone) endereco.telefone = payload.telefone
        if (!endereco.nome_destinatario) endereco.nome_destinatario = payload.nome
        const problem = validateAddress(endereco)
        if (problem) return formError(form, problem)
        payload.endereco = endereco
      }
      formError(form, '')
      await withBusy(form.querySelector('[type="submit"]'), 'Salvando...', async () => {
        try {
          await api(`/admin/clientes/${id}`, { method: 'PUT', body: payload })
          invalidate('clientes')
          toast('Cadastro atualizado.')
          close()
          reload()
        } catch (error) { formError(form, error.message) }
      })
    })
  })
}
