import { api, download } from '../api.js'
import { icon } from '../icons.js'
import { getClientes, getProdutos, invalidate } from '../data.js'
import {
  esc, money, number, dateTime, phoneLabel, statusBadge, skeleton, errorState, emptyState,
  toast, openDialog, confirmDialog, formError, withBusy, whatsappLink, addressFields, readAddress,
  validateAddress, uuid, ORDER_STATUS, PAYMENT_STATUS, isEmailTecnico,
} from '../ui.js'

const NEXT_STEP = {
  pago: { status: 'processando', label: 'Iniciar separação', ic: 'box' },
  processando: { status: 'enviado', label: 'Marcar como enviado', ic: 'truck' },
  enviado: { status: 'entregue', label: 'Marcar como entregue', ic: 'check' },
}

const AUDIT_LABEL = {
  'pedido.criado_admin': 'Pedido cadastrado pelo painel',
  'pedido.dados_atualizados': 'Entrega/observações atualizadas',
  'pedido.status_atualizado': 'Status atualizado',
  'pedido.cancelado': 'Pedido cancelado',
  'pedido.excluido': 'Pedido excluído',
  'pagamento.pix_confirmado': 'Pix confirmado',
  'pagamento.pix_revertido_para_pendente': 'Pix revertido para pendente',
}

export function whatsappMessage(order) {
  const nome = String(order.cliente_nome || '').split(' ')[0] || 'tudo bem'
  const num = order.numero_exibicao || order.numero_pedido
  const msgs = {
    aguardando_pagamento: `Olá, ${nome}! Recebemos seu pedido ${num}. Total dos produtos: ${money(order.total)}. O Pix está disponível na loja; o frete será confirmado por aqui.`,
    pago: `Olá, ${nome}! O pagamento do pedido ${num} foi confirmado. Já vamos separar seus produtos. Obrigada pela compra!`,
    processando: `Olá, ${nome}! Seu pedido ${num} está sendo separado com carinho. Avisamos assim que for enviado.`,
    enviado: `Olá, ${nome}! Seu pedido ${num} foi enviado. Qualquer dúvida sobre a entrega, é só chamar por aqui.`,
    entregue: `Olá, ${nome}! Seu pedido ${num} consta como entregue. Esperamos que você ame! Conte pra gente o que achou.`,
    cancelado: `Olá, ${nome}! O pedido ${num} foi cancelado. Se precisar de algo, estamos à disposição.`,
  }
  return msgs[order.status] || `Olá, ${nome}! Estou falando sobre o pedido ${num}.`
}

function itemsSummary(itens = []) {
  const qty = itens.reduce((s, i) => s + Number(i.quantidade || 0), 0)
  const names = itens.slice(0, 2).map((i) => `${i.nome_produto} × ${i.quantidade}`)
  if (itens.length > 2) names.push(`+${itens.length - 2}`)
  return { qty, text: names.join(', ') || '—' }
}

// =================================================================
// LISTA
// =================================================================

export async function renderList(root, ctx) {
  const f = {
    q: ctx.query.get('q') || '',
    status: ctx.query.get('status') || '',
    payment_status: ctx.query.get('payment_status') || '',
    date_from: ctx.query.get('date_from') || '',
    date_to: ctx.query.get('date_to') || '',
    page: Math.max(1, Number(ctx.query.get('page')) || 1),
  }

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Pedidos</h1><p class="muted">Acompanhe, filtre e atualize os pedidos da loja.</p></div>
      <div class="page-actions">
        <button class="btn" type="button" data-action="export">${icon('download', 16)}Exportar CSV</button>
        <button class="btn btn-primary" type="button" data-action="new">${icon('plus', 16)}Novo pedido</button>
      </div>
    </div>
    <form class="card filters" role="search" aria-label="Filtrar pedidos">
      <div class="field grow">
        <label for="f-q">Buscar</label>
        <input id="f-q" name="q" type="search" value="${esc(f.q)}" maxlength="100" placeholder="Número, cliente ou telefone">
      </div>
      <div class="field">
        <label for="f-status">Status</label>
        <select id="f-status" name="status"><option value="">Todos</option>
          ${Object.entries(ORDER_STATUS).filter(([k]) => k !== 'pendente').map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-pay">Pagamento</label>
        <select id="f-pay" name="payment_status"><option value="">Todos</option>
          ${['pendente', 'aprovado', 'cancelado'].map((k) => `<option value="${k}" ${f.payment_status === k ? 'selected' : ''}>${PAYMENT_STATUS[k]}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label for="f-from">De</label><input id="f-from" name="date_from" type="date" value="${esc(f.date_from)}"></div>
      <div class="field"><label for="f-to">Até</label><input id="f-to" name="date_to" type="date" value="${esc(f.date_to)}"></div>
      <div class="filters-actions">
        <button class="btn btn-primary" type="submit">${icon('search', 16)}Filtrar</button>
        <a class="btn btn-ghost" href="#/pedidos">Limpar</a>
      </div>
    </form>
    <div id="orders-result">${skeleton({ rows: 8 })}</div>`

  const form = root.querySelector('form.filters')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    if (data.get('date_from') && data.get('date_to') && data.get('date_from') > data.get('date_to')) {
      toast('A data inicial precisa ser anterior à final.', 'error')
      return
    }
    const q = new URLSearchParams()
    for (const [k, v] of data.entries()) if (String(v).trim()) q.set(k, String(v).trim())
    ctx.navigate(`#/pedidos${q.toString() ? `?${q}` : ''}`)
  })
  root.querySelector('[data-action="new"]').addEventListener('click', () => openNewOrder(ctx))
  root.querySelector('[data-action="export"]').addEventListener('click', (e) => {
    const q = new URLSearchParams()
    if (f.date_from && f.date_to) {
      q.set('periodo', 'personalizado'); q.set('inicio', f.date_from); q.set('fim', f.date_to)
    } else {
      q.set('periodo', '90')
    }
    if (f.status) q.set('status', f.status)
    if (f.payment_status) q.set('payment_status', f.payment_status)
    withBusy(e.currentTarget, 'Gerando...', async () => {
      try {
        await download(`/admin/exportar/pedidos.csv?${q}`, 'pedidos.csv')
        toast(f.date_from && f.date_to ? 'Planilha gerada.' : 'Planilha dos últimos 90 dias gerada. Use as datas para outro período.')
      } catch (error) { toast(error.message, 'error') }
    })
  })

  const box = root.querySelector('#orders-result')
  async function load() {
    box.innerHTML = skeleton({ rows: 8 })
    try {
      const q = new URLSearchParams({ page: String(f.page), limit: '20' })
      for (const k of ['q', 'status', 'payment_status', 'date_from', 'date_to']) if (f[k]) q.set(k, f[k])
      const data = await api(`/admin/pedidos?${q}`)
      if (!data.pedidos.length) {
        box.innerHTML = emptyState('Nenhum pedido encontrado', 'Ajuste os filtros ou cadastre um pedido manual.')
        return
      }
      box.innerHTML = `
        <div class="card table-card">
          <p class="table-meta">${number(data.total)} pedido(s)</p>
          <div class="table-scroll">
            <table class="table">
              <caption class="sr-only">Lista de pedidos</caption>
              <thead><tr>
                <th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Itens</th>
                <th scope="col" class="num">Total</th><th scope="col">Pagamento</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Ações</span></th>
              </tr></thead>
              <tbody>${data.pedidos.map((p) => {
                const s = itemsSummary(p.itens)
                return `<tr>
                  <td data-label="Pedido"><a href="#/pedidos/${Number(p.id)}" class="strong">${esc(p.numero_exibicao)}</a><small class="muted block">${dateTime(p.criado_em)}</small></td>
                  <td data-label="Cliente">${esc(p.cliente_nome)}<small class="muted block">${esc(phoneLabel(p.telefone_entrega || p.cliente_telefone))}</small></td>
                  <td data-label="Itens">${esc(s.text)}<small class="muted block">${s.qty} un.</small></td>
                  <td data-label="Total" class="num">${money(p.total)}</td>
                  <td data-label="Pagamento">${statusBadge(p.pagamento_status, 'payment')}</td>
                  <td data-label="Status">${statusBadge(p.status)}</td>
                  <td class="row-actions"><a class="btn btn-sm" href="#/pedidos/${Number(p.id)}">Abrir</a></td>
                </tr>`
              }).join('')}</tbody>
            </table>
          </div>
          ${pagination(f.page, data.totalPaginas, ctx)}
        </div>`
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }
  await load()
}

function pagination(page, total, ctx) {
  if (total <= 1) return ''
  const link = (p) => {
    const q = new URLSearchParams(ctx.query)
    q.set('page', String(p))
    return `#/pedidos?${q}`
  }
  return `
    <nav class="pagination" aria-label="Paginação">
      ${page > 1 ? `<a class="btn btn-sm" href="${link(page - 1)}">${icon('chevronLeft', 16)}Anterior</a>` : '<span></span>'}
      <span>Página ${page} de ${total}</span>
      ${page < total ? `<a class="btn btn-sm" href="${link(page + 1)}">Próxima${icon('chevronRight', 16)}</a>` : '<span></span>'}
    </nav>`
}

// =================================================================
// DETALHE
// =================================================================

export async function renderDetail(root, ctx) {
  const id = Number(ctx.params.id)
  root.innerHTML = skeleton({ rows: 8 })

  let order
  let audit = []
  try {
    const [detail, auditData] = await Promise.all([
      api(`/admin/pedidos/${id}`),
      api('/admin/auditoria').catch(() => ({ registros: [] })),
    ])
    order = detail.pedido
    audit = (auditData.registros || []).filter((r) => r.entidade === 'pedido' && Number(r.entidade_id) === id)
  } catch (error) {
    root.innerHTML = errorState(error.message)
    root.querySelector('[data-action="retry"]').addEventListener('click', () => renderDetail(root, ctx))
    return
  }

  ctx.setCrumbs([{ label: 'Pedidos', href: '#/pedidos' }, { label: order.numero_exibicao }])
  const reload = () => renderDetail(root, ctx)
  const next = NEXT_STEP[order.status]
  const pixPending = order.status === 'aguardando_pagamento' && order.pagamento_status === 'pendente'
  const canRevert = order.status === 'pago' && order.pagamento_status === 'aprovado'
  const phone = order.telefone_entrega || order.cliente_telefone
  const wa = whatsappLink(phone, whatsappMessage(order))

  const timeline = [
    { at: order.criado_em, title: 'Pedido registrado', text: `Total ${money(order.total)}` },
    ...audit.map((r) => ({
      at: r.criado_em,
      title: AUDIT_LABEL[r.acao] || r.acao,
      text: [
        r.administrador_nome ? `por ${r.administrador_nome}` : '',
        r.acao === 'pedido.status_atualizado' ? `${ORDER_STATUS[safeJson(r.antes_json)?.status] || ''} → ${ORDER_STATUS[safeJson(r.depois_json)?.status] || ''}` : '',
        r.motivo && !/^(Confirmação manual|Correção administrativa)/.test(r.motivo) ? `Motivo: ${r.motivo}` : '',
      ].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Pedido ${esc(order.numero_exibicao)}</h1>
        <p class="badges">${statusBadge(order.status)} ${statusBadge(order.pagamento_status, 'payment')} <small class="muted">Criado em ${dateTime(order.criado_em)}</small></p>
      </div>
      <div class="page-actions">
        ${wa ? `<a class="btn btn-whatsapp" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon('whatsapp', 16)}WhatsApp</a>` : '<button class="btn" disabled title="Telefone inválido">WhatsApp</button>'}
        <button class="btn" type="button" data-action="copy">${icon('copy', 16)}Copiar resumo</button>
      </div>
    </div>

    <section class="card action-bar" aria-label="Ações do pedido">
      ${pixPending ? `<button class="btn btn-primary" type="button" data-action="confirm-pix">${icon('check', 16)}Confirmar Pix recebido</button>` : ''}
      ${next ? `<button class="btn btn-primary" type="button" data-action="advance">${icon(next.ic, 16)}${esc(next.label)}</button>` : ''}
      ${canRevert ? `<button class="btn" type="button" data-action="revert-pix">${icon('refresh', 16)}Reverter Pix</button>` : ''}
      <button class="btn" type="button" data-action="edit-delivery" ${order.status === 'cancelado' ? 'disabled' : ''}>${icon('edit', 16)}Editar entrega</button>
      ${pixPending
        ? `<button class="btn btn-danger-ghost" type="button" data-action="cancel">${icon('x', 16)}Cancelar pedido</button>`
        : order.status !== 'cancelado' && order.status !== 'entregue'
          ? `<button class="btn btn-danger-ghost" type="button" disabled aria-describedby="cancel-help">${icon('x', 16)}Cancelar pedido</button>
             <small id="cancel-help" class="muted">Só é possível cancelar enquanto o Pix está pendente${order.status === 'pago' ? '. Reverta o Pix primeiro, se for o caso' : ''}.</small>`
          : ''}
      ${order.status === 'cancelado' ? `<button class="btn btn-danger-ghost" type="button" data-action="delete">${icon('trash', 16)}Excluir pedido</button>` : ''}
    </section>

    <div class="grid-2-1">
      <div class="stack">
        <article class="card">
          <h2 class="card-title">Itens</h2>
          <div class="table-scroll"><table class="table">
            <caption class="sr-only">Itens do pedido</caption>
            <thead><tr><th scope="col">Produto</th><th scope="col" class="num">Qtd.</th><th scope="col" class="num">Unitário</th><th scope="col" class="num">Subtotal</th></tr></thead>
            <tbody>${order.itens.map((i) => `<tr><td data-label="Produto">${esc(i.nome_produto)}</td><td data-label="Qtd." class="num">${number(i.quantidade)}</td><td data-label="Unitário" class="num">${money(i.preco_unitario)}</td><td data-label="Subtotal" class="num">${money(i.subtotal)}</td></tr>`).join('')}</tbody>
          </table></div>
          <dl class="totals">
            <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
            <div><dt>Desconto</dt><dd>${money(order.desconto)}</dd></div>
            <div><dt>Frete</dt><dd>${Number(order.frete) > 0 ? money(order.frete) : 'A confirmar pelo WhatsApp'}</dd></div>
            <div class="total"><dt>Total</dt><dd>${money(order.total)}</dd></div>
          </dl>
        </article>
        <article class="card">
          <h2 class="card-title">Linha do tempo</h2>
          <ol class="timeline">${timeline.map((t) => `
            <li><time datetime="${esc(t.at)}">${dateTime(t.at)}</time><strong>${esc(t.title)}</strong>${t.text ? `<span>${esc(t.text)}</span>` : ''}</li>`).join('')}
          </ol>
          ${audit.length === 0 ? '<p class="muted small">Ações anteriores à auditoria podem não aparecer aqui.</p>' : ''}
        </article>
      </div>
      <div class="stack">
        <article class="card">
          <h2 class="card-title">Cliente</h2>
          <p><a href="#/clientes/${Number(order.cliente_id)}" class="strong">${esc(order.cliente_nome)}</a></p>
          <p class="muted">${esc(phoneLabel(order.cliente_telefone))}${order.cliente_email && !isEmailTecnico(order.cliente_email) ? `<br>${esc(order.cliente_email)}` : ''}</p>
        </article>
        <article class="card">
          <h2 class="card-title">Entrega</h2>
          ${order.rua ? `
            <p><strong>${esc(order.nome_destinatario)}</strong><br>${esc(phoneLabel(order.telefone_entrega))}</p>
            <p>${esc(order.rua)}, ${esc(order.numero)}${order.complemento ? ` — ${esc(order.complemento)}` : ''}<br>
            ${esc(order.bairro)} · ${esc(order.cidade)}/${esc(order.estado)}<br>CEP ${esc(order.cep)}</p>`
            : '<p class="muted">Sem endereço cadastrado.</p>'}
          ${order.observacoes ? `<h3 class="small-title">Observações</h3><p class="pre">${esc(order.observacoes)}</p>` : ''}
        </article>
        <article class="card">
          <h2 class="card-title">Pagamento</h2>
          <dl class="kv">
            <div><dt>Método</dt><dd>${esc((order.pagamento_metodo || '—').toUpperCase())}</dd></div>
            <div><dt>Situação</dt><dd>${statusBadge(order.pagamento_status, 'payment')}</dd></div>
            <div><dt>Valor</dt><dd>${money(order.pagamento_valor)}</dd></div>
            <div><dt>Pago em</dt><dd>${dateTime(order.pago_em)}</dd></div>
          </dl>
        </article>
      </div>
    </div>`

  const on = (action, fn) => root.querySelector(`[data-action="${action}"]`)?.addEventListener('click', fn)

  on('copy', async () => {
    const text = [
      `Pedido ${order.numero_exibicao} — ${ORDER_STATUS[order.status] || order.status}`,
      `Cliente: ${order.cliente_nome} · ${phoneLabel(phone)}`,
      order.rua ? `Entrega: ${order.rua}, ${order.numero}${order.complemento ? ` (${order.complemento})` : ''}, ${order.bairro}, ${order.cidade}/${order.estado}, CEP ${order.cep}` : '',
      '', ...order.itens.map((i) => `${i.quantidade}x ${i.nome_produto} — ${money(i.subtotal)}`), '',
      `Total dos produtos: ${money(order.total)} · Frete a confirmar`,
    ].filter((l) => l !== null).join('\n')
    try { await navigator.clipboard.writeText(text); toast('Resumo copiado.') } catch { toast('Não foi possível copiar.', 'error') }
  })

  on('confirm-pix', async (e) => {
    const r = await confirmDialog({
      title: 'Confirmar Pix recebido?',
      message: `Confirme somente depois de ver ${money(order.total)} na sua conta. O pedido passa para "Pago — separar".`,
      confirmLabel: 'Sim, recebi o Pix',
    })
    if (!r.ok) return
    await withBusy(e.target, 'Confirmando...', async () => {
      try { await api(`/admin/pedidos/${id}/confirmar-pix`, { method: 'POST' }); toast('Pix confirmado.'); reload() } catch (error) { toast(error.message, 'error') }
    })
  })

  on('advance', async (e) => {
    const r = await confirmDialog({ title: `${next.label}?`, message: `O pedido passa para "${ORDER_STATUS[next.status]}".`, confirmLabel: next.label })
    if (!r.ok) return
    await withBusy(e.target, 'Salvando...', async () => {
      try { await api(`/admin/pedidos/${id}/status`, { method: 'PATCH', body: { status: next.status } }); toast('Status atualizado.'); reload() } catch (error) { toast(error.message, 'error') }
    })
  })

  on('revert-pix', async (e) => {
    const r = await confirmDialog({
      title: 'Reverter Pix para pendente?',
      message: 'Use quando o Pix foi confirmado por engano. O pedido volta para "Aguardando Pix".',
      confirmLabel: 'Reverter Pix', danger: true, reason: true, reasonLabel: 'Motivo da correção',
    })
    if (!r.ok) return
    await withBusy(e.target, 'Revertendo...', async () => {
      try { await api(`/admin/pedidos/${id}/reverter-pix`, { method: 'POST', body: { motivo: r.reason } }); toast('Pix voltou para pendente.'); reload() } catch (error) { toast(error.message, 'error') }
    })
  })

  on('cancel', async (e) => {
    const r = await confirmDialog({
      title: 'Cancelar este pedido?',
      message: 'O Pix pendente será cancelado e os produtos voltam para o estoque. Esta ação não pode ser desfeita.',
      confirmLabel: 'Cancelar pedido', danger: true, reason: true, reasonLabel: 'Motivo do cancelamento',
    })
    if (!r.ok) return
    await withBusy(e.target, 'Cancelando...', async () => {
      try {
        await api(`/admin/pedidos/${id}/status`, { method: 'PATCH', body: { status: 'cancelado', motivo: r.reason } })
        invalidate('produtos')
        toast('Pedido cancelado e estoque devolvido.')
        reload()
      } catch (error) { toast(error.message, 'error') }
    })
  })

  on('delete', async (e) => {
    const r = await confirmDialog({
      title: 'Excluir este pedido definitivamente?',
      message: 'O pedido some da lista e dos relatórios. O número dele não será reaproveitado e o histórico de estoque é mantido. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir pedido', danger: true, reason: true, reasonLabel: 'Motivo da exclusão',
    })
    if (!r.ok) return
    await withBusy(e.target, 'Excluindo...', async () => {
      try {
        await api(`/admin/pedidos/${id}`, { method: 'DELETE', body: { motivo: r.reason } })
        toast('Pedido excluído.')
        ctx.navigate('#/pedidos')
      } catch (error) { toast(error.message, 'error') }
    })
  })

  on('edit-delivery', () => openEditDelivery(order, reload))
}

function safeJson(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
}

function openEditDelivery(order, onSaved) {
  const { body, close } = openDialog({
    title: `Editar entrega — ${order.numero_exibicao}`,
    size: 'lg',
    content: `
      <form class="form" novalidate>
        ${addressFields('ed', {
          nome_destinatario: order.nome_destinatario, telefone: order.telefone_entrega, cep: order.cep, rua: order.rua,
          numero: order.numero, complemento: order.complemento, bairro: order.bairro, cidade: order.cidade, estado: order.estado,
        })}
        <div class="field">
          <label for="ed-obs">Observações internas</label>
          <textarea id="ed-obs" name="observacoes" rows="3" maxlength="5000">${esc(order.observacoes || '')}</textarea>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn btn-primary" type="submit">Salvar entrega</button>
        </div>
      </form>`,
  })
  const form = body.querySelector('form')
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const endereco = readAddress(form)
    const problem = validateAddress(endereco)
    if (problem) return formError(form, problem)
    formError(form, '')
    await withBusy(form.querySelector('[type="submit"]'), 'Salvando...', async () => {
      try {
        await api(`/admin/pedidos/${order.id}/dados`, { method: 'PATCH', body: { endereco, observacoes: form.elements.observacoes.value } })
        toast('Entrega atualizada.')
        close()
        onSaved()
      } catch (error) { formError(form, error.message) }
    })
  })
}

// =================================================================
// NOVO PEDIDO MANUAL
// =================================================================

export async function openNewOrder(ctx) {
  const idempotencyKey = uuid()
  const { body, close } = openDialog({ title: 'Novo pedido manual', size: 'lg', content: skeleton({ rows: 4 }) })
  let produtos
  let clientes
  try {
    [produtos, clientes] = await Promise.all([getProdutos(), getClientes()])
  } catch (error) {
    body.innerHTML = errorState(error.message)
    return
  }
  const ativos = produtos.filter((p) => Number(p.ativo) === 1 && Number(p.estoque) > 0)
  const clientesAtivos = clientes.filter((c) => Number(c.ativo) === 1)
  const price = (p) => (p.preco_promocional && Number(p.preco_promocional) < Number(p.preco) ? Number(p.preco_promocional) : Number(p.preco))

  if (!ativos.length) {
    body.innerHTML = emptyState('Nenhum produto disponível', 'Cadastre ou reponha um produto ativo antes de criar pedidos.', '<a class="btn" href="#/produtos" data-close>Ir para produtos</a>')
    return
  }

  const productOptions = ativos.map((p) => `<option value="${Number(p.id)}">${esc(p.nome)} · ${money(price(p))} · ${number(p.estoque)} em estoque</option>`).join('')
  body.innerHTML = `
    <form class="form" novalidate>
      <fieldset class="fieldset">
        <legend>Cliente</legend>
        <div class="segmented" role="radiogroup" aria-label="Tipo de cliente">
          <label class="seg-btn"><input type="radio" name="tipo_cliente" value="existente" checked> Cliente cadastrado</label>
          <label class="seg-btn"><input type="radio" name="tipo_cliente" value="novo"> Cliente novo</label>
        </div>
        <div data-cliente="existente" class="field">
          <label for="no-cliente">Escolha o cliente <span class="req" aria-hidden="true">*</span></label>
          <select id="no-cliente" name="cliente_id"><option value="">Selecione...</option>
            ${clientesAtivos.map((c) => `<option value="${Number(c.id)}">${esc(c.nome)} · ${esc(phoneLabel(c.telefone))}</option>`).join('')}
          </select>
        </div>
        <div data-cliente="novo" class="form-grid" hidden>
          <div class="field span-2"><label for="no-nome">Nome <span class="req" aria-hidden="true">*</span></label><input id="no-nome" name="novo_nome" maxlength="150"></div>
          <div class="field"><label for="no-tel">WhatsApp <span class="req" aria-hidden="true">*</span></label><input id="no-tel" name="novo_telefone" inputmode="tel" maxlength="20" placeholder="(85) 99999-9999"></div>
          <div class="field"><label for="no-email">E-mail</label><input id="no-email" name="novo_email" type="email" maxlength="255"></div>
        </div>
      </fieldset>
      <fieldset class="fieldset">
        <legend>Produtos</legend>
        <div class="items-editor" id="items-editor"></div>
        <button class="btn btn-sm" type="button" data-action="add-item">${icon('plus', 14)}Adicionar produto</button>
        <p class="order-total">Total dos produtos: <strong id="no-total">${money(0)}</strong> <small class="muted">· frete a confirmar</small></p>
      </fieldset>
      <fieldset class="fieldset">
        <legend>Entrega</legend>
        ${addressFields('no', {})}
      </fieldset>
      <div class="field">
        <label for="no-obs">Observações</label>
        <textarea id="no-obs" name="observacoes" rows="2" maxlength="5000" placeholder="Ex.: combinado pelo WhatsApp"></textarea>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="submit">Cadastrar pedido</button>
      </div>
    </form>`

  const form = body.querySelector('form')
  const editor = form.querySelector('#items-editor')
  const byId = new Map(ativos.map((p) => [String(p.id), p]))

  function addRow() {
    const row = document.createElement('div')
    row.className = 'item-row'
    const n = editor.children.length + 1
    row.innerHTML = `
      <div class="field grow"><label for="it-p-${n}">Produto</label><select id="it-p-${n}" name="produto"><option value="">Selecione...</option>${productOptions}</select></div>
      <div class="field qty"><label for="it-q-${n}">Qtd.</label><input id="it-q-${n}" name="quantidade" type="number" min="1" step="1" value="1" inputmode="numeric"></div>
      <button class="icon-btn" type="button" data-remove aria-label="Remover produto">${icon('trash', 18)}</button>`
    editor.append(row)
    updateTotal()
  }
  function updateTotal() {
    let total = 0
    editor.querySelectorAll('.item-row').forEach((row) => {
      const p = byId.get(row.querySelector('select').value)
      const q = Number(row.querySelector('input').value)
      if (p && q > 0) total += price(p) * q
    })
    form.querySelector('#no-total').textContent = money(total)
  }
  addRow()
  editor.addEventListener('input', updateTotal)
  editor.addEventListener('click', (e) => {
    if (e.target.closest('[data-remove]') && editor.children.length > 1) {
      e.target.closest('.item-row').remove()
      updateTotal()
    }
  })
  form.querySelector('[data-action="add-item"]').addEventListener('click', addRow)
  form.addEventListener('change', (e) => {
    if (e.target.name === 'tipo_cliente') {
      form.querySelector('[data-cliente="existente"]').hidden = e.target.value !== 'existente'
      form.querySelector('[data-cliente="novo"]').hidden = e.target.value !== 'novo'
    }
    if (e.target.name === 'cliente_id') {
      const c = clientesAtivos.find((x) => String(x.id) === e.target.value)
      if (c) {
        if (!form.elements.nome_destinatario.value) form.elements.nome_destinatario.value = c.nome
        if (!form.elements.telefone.value) form.elements.telefone.value = c.telefone || ''
      }
    }
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const tipo = form.elements.tipo_cliente.value
    const payload = { endereco: readAddress(form), observacoes: form.elements.observacoes.value.trim() }
    if (tipo === 'existente') {
      if (!form.elements.cliente_id.value) return formError(form, 'Escolha o cliente.')
      payload.cliente_id = Number(form.elements.cliente_id.value)
    } else {
      const cliente = {
        nome: form.elements.novo_nome.value.trim(),
        telefone: form.elements.novo_telefone.value.replace(/\D/g, ''),
        email: form.elements.novo_email.value.trim(),
      }
      if (cliente.nome.length < 2) return formError(form, 'Informe o nome do cliente.')
      if (cliente.telefone.length < 10 || cliente.telefone.length > 13) return formError(form, 'Informe o WhatsApp do cliente com DDD.')
      if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) return formError(form, 'E-mail inválido.')
      payload.cliente = cliente
    }
    const itens = []
    for (const row of editor.querySelectorAll('.item-row')) {
      const pid = row.querySelector('select').value
      const q = Number(row.querySelector('input').value)
      if (!pid) return formError(form, 'Escolha o produto em todas as linhas (ou remova a linha vazia).')
      if (!Number.isInteger(q) || q < 1) return formError(form, 'A quantidade precisa ser um número inteiro maior que zero.')
      if (q > Number(byId.get(pid).estoque)) return formError(form, `Estoque insuficiente para ${byId.get(pid).nome}.`)
      itens.push({ produto_id: Number(pid), quantidade: q })
    }
    payload.itens = itens
    const problem = validateAddress(payload.endereco)
    if (problem) return formError(form, problem)
    formError(form, '')

    await withBusy(form.querySelector('[type="submit"]'), 'Cadastrando...', async () => {
      try {
        const data = await api('/admin/pedidos', { method: 'POST', body: payload, idempotencyKey })
        invalidate('produtos', 'clientes')
        toast(data.reutilizado ? 'Este pedido já havia sido cadastrado.' : `Pedido ${data.pedido.numero_pedido} cadastrado. Pix pendente.`)
        close()
        ctx.navigate(`#/pedidos/${data.pedido.id}`)
      } catch (error) { formError(form, error.message) }
    })
  })
}
