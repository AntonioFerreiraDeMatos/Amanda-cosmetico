// =====================================================
// MINHA CONTA — área exclusiva do cliente
// Rota por hash: #minha-conta, #minha-conta/pedidos, #minha-conta/pedido/123 ...
// =====================================================

import './conta.css'

const TOKEN_KEY = 'amanda_customer_token'
const USER_KEY = 'amanda_customer_user'
const POLL_MS = 30000

const TABS = [
  { id: 'inicio', label: 'Início', icon: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>' },
  { id: 'pedidos', label: 'Meus pedidos', icon: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>' },
  { id: 'dados', label: 'Dados pessoais', icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>' },
  { id: 'enderecos', label: 'Endereços', icon: '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
  { id: 'seguranca', label: 'Segurança', icon: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>' },
]

const STEPS = [
  { key: 'recebido', label: 'Pedido recebido' },
  { key: 'aguardando', label: 'Aguardando pagamento' },
  { key: 'confirmado', label: 'Pagamento confirmado' },
  { key: 'preparacao', label: 'Em preparação' },
  { key: 'enviado', label: 'Saiu para entrega' },
  { key: 'entregue', label: 'Entregue' },
]

// Quantas etapas já foram concluídas para cada status do pedido.
const STEP_DONE = {
  pendente: 1,
  aguardando_pagamento: 1,
  pago: 3,
  processando: 4,
  enviado: 5,
  entregue: 6,
}

const STATUS_INFO = {
  pendente: { label: 'Aguardando pagamento', tone: 'warn' },
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warn' },
  pago: { label: 'Pagamento confirmado', tone: 'ok' },
  processando: { label: 'Em preparação', tone: 'info' },
  enviado: { label: 'Saiu para entrega', tone: 'info' },
  entregue: { label: 'Entregue', tone: 'done' },
  cancelado: { label: 'Cancelado', tone: 'cancel' },
}

const PAYMENT_INFO = {
  pendente: { label: 'Pix aguardando confirmação', tone: 'warn' },
  processando: { label: 'Pix em análise', tone: 'warn' },
  aprovado: { label: 'Pagamento confirmado', tone: 'ok' },
  recusado: { label: 'Pagamento recusado', tone: 'cancel' },
  cancelado: { label: 'Pagamento cancelado', tone: 'cancel' },
  estornado: { label: 'Pagamento estornado', tone: 'cancel' },
}

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function fmtDate(value, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return (withTime ? dateTimeFmt : dateFmt).format(d)
}

function fmtPhone(value) {
  const d = String(value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length < 3) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function fmtCep(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function svg(paths, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`
}

function badge(info) {
  return `<span class="acc-badge acc-badge--${info.tone}">${esc(info.label)}</span>`
}

function firstName(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'cliente'
}

export function getCustomerToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}

export function initAccount({ apiUrl }) {
  const state = {
    tab: 'inicio',
    pedidoId: null,
    conta: null,
    pedidos: null,
    pedido: null,
    enderecos: null,
    editingAddress: null,
    pollTimer: null,
    lastPayment: new Map(),
    loading: false,
  }

  // ---------- estrutura ----------
  const view = document.createElement('section')
  view.className = 'acc-view'
  view.id = 'minha-conta-view'
  view.hidden = true
  view.setAttribute('aria-label', 'Minha conta')
  view.innerHTML = `
    <div class="acc-bg" aria-hidden="true"><span></span><span></span></div>
    <div class="acc-shell">
      <aside class="acc-side">
        <div class="acc-profile">
          <div class="acc-avatar" aria-hidden="true"></div>
          <div>
            <strong class="acc-profile-name"></strong>
            <small class="acc-profile-mail"></small>
          </div>
        </div>
        <nav class="acc-nav" aria-label="Seções da conta">
          ${TABS.map((t) => `
            <a href="#minha-conta/${t.id}" data-tab="${t.id}">
              ${svg(t.icon)}<span>${t.label}</span>
            </a>`).join('')}
          <button type="button" class="acc-logout">
            ${svg('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>')}
            <span>Sair da conta</span>
          </button>
        </nav>
        <a href="#produtos" class="acc-back-store">← Voltar para a loja</a>
      </aside>
      <main class="acc-main" tabindex="-1">
        <div class="acc-content" aria-live="polite"></div>
      </main>
    </div>
    <div class="acc-toast" role="status" aria-live="polite" hidden></div>
  `
  document.body.appendChild(view)

  const content = view.querySelector('.acc-content')
  const main = view.querySelector('.acc-main')
  const toast = view.querySelector('.acc-toast')

  // ---------- API ----------
  async function api(path, options = {}) {
    const token = getCustomerToken()
    if (!token) {
      const error = new Error('Entre na sua conta para continuar.')
      error.status = 401
      throw error
    }
    const response = await fetch(`${apiUrl}/conta${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    })
    let data = {}
    try { data = await response.json() } catch { data = {} }
    if (!response.ok || data.sucesso === false) {
      const error = new Error(data.mensagem || 'Não foi possível concluir a ação.')
      error.status = response.status
      throw error
    }
    return data
  }

  function handleError(error) {
    if (error.status === 401) {
      logout('Sua sessão expirou. Entre novamente.')
      return true
    }
    return false
  }

  // ---------- header ----------
  const headerLink = document.querySelector('.header-login')

  function updateHeader() {
    if (!headerLink) return
    const user = getCachedUser()
    if (getCustomerToken() && user) {
      headerLink.href = '#minha-conta'
      headerLink.classList.add('is-logged')
      headerLink.innerHTML = `
        <span class="header-avatar" aria-hidden="true">${esc(firstName(user.nome).charAt(0).toUpperCase())}</span>
        <span class="header-login-text">Minha conta</span>`
      headerLink.setAttribute('aria-label', `Minha conta de ${user.nome || 'cliente'}`)
    } else {
      headerLink.href = '#login'
      headerLink.classList.remove('is-logged')
      headerLink.textContent = 'Entrar'
      headerLink.removeAttribute('aria-label')
    }
  }

  function updateProfile() {
    const user = state.conta?.cliente || getCachedUser() || {}
    const avatar = view.querySelector('.acc-avatar')
    if (user.foto_url && /^https:\/\//.test(user.foto_url)) {
      avatar.innerHTML = `<img src="${esc(user.foto_url)}" alt="" referrerpolicy="no-referrer">`
    } else {
      avatar.textContent = firstName(user.nome).charAt(0).toUpperCase()
    }
    view.querySelector('.acc-profile-name').textContent = user.nome || 'Cliente'
    view.querySelector('.acc-profile-mail').textContent = user.email || ''
  }

  // ---------- navegação ----------
  function parseHash() {
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (!hash.startsWith('minha-conta')) return null
    const parts = hash.split('/').slice(1)
    if (parts[0] === 'pedido' && /^\d+$/.test(parts[1] || '')) {
      return { tab: 'pedidos', pedidoId: Number(parts[1]) }
    }
    const tab = TABS.some((t) => t.id === parts[0]) ? parts[0] : 'inicio'
    return { tab, pedidoId: null }
  }

  function open(route) {
    if (!getCustomerToken()) {
      sessionStorage.setItem('amanda_after_login', window.location.hash)
      window.location.hash = '#login'
      return
    }
    const wasHidden = view.hidden
    state.tab = route.tab
    state.pedidoId = route.pedidoId
    view.hidden = false
    document.documentElement.classList.add('acc-open')
    view.querySelectorAll('.acc-nav a').forEach((a) => {
      const active = a.dataset.tab === state.tab
      a.classList.toggle('is-active', active)
      if (active) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
    if (wasHidden) {
      updateProfile()
      requestAnimationFrame(() => view.classList.add('is-visible'))
    }
    main.scrollTo?.({ top: 0 })
    render()
    loadCurrent()
    startPolling()
  }

  function close() {
    if (view.hidden) return
    view.classList.remove('is-visible')
    document.documentElement.classList.remove('acc-open')
    stopPolling()
    view.hidden = true
  }

  function onRoute() {
    const route = parseHash()
    if (route) open(route)
    else close()
  }

  window.addEventListener('hashchange', onRoute)

  // ---------- carregamento ----------
  async function loadCurrent({ silent = false } = {}) {
    if (!silent) state.loading = true
    try {
      if (state.pedidoId) {
        const data = await api(`/pedidos/${state.pedidoId}`)
        notifyPaymentChange(data.pedido.id, data.pagamento.status, data.pedido.numero_pedido)
        state.pedido = data
      } else if (state.tab === 'inicio') {
        const [conta, pedidos] = await Promise.all([api(''), api('/pedidos')])
        state.conta = conta
        trackPayments(pedidos.pedidos)
        state.pedidos = pedidos.pedidos
        cacheUser(conta.cliente)
      } else if (state.tab === 'pedidos') {
        const data = await api('/pedidos')
        trackPayments(data.pedidos)
        state.pedidos = data.pedidos
      } else if (state.tab === 'dados' || state.tab === 'seguranca') {
        state.conta = await api('')
        cacheUser(state.conta.cliente)
      } else if (state.tab === 'enderecos') {
        state.enderecos = (await api('/enderecos')).enderecos
      }
      state.loading = false
      if (!silent || !content.querySelector('form:focus-within')) render()
    } catch (error) {
      state.loading = false
      if (handleError(error)) return
      if (!silent) {
        content.innerHTML = `
          <div class="acc-empty">
            <h2>Não foi possível carregar</h2>
            <p>${esc(error.message)}</p>
            <button type="button" class="acc-btn acc-retry">Tentar novamente</button>
          </div>`
      }
    }
  }

  function cacheUser(cliente) {
    if (!cliente) return
    const cached = getCachedUser() || {}
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({ ...cached, ...cliente }))
    } catch { /* armazenamento indisponível */ }
    updateHeader()
    updateProfile()
  }

  // Avisa quando a Amanda confirma o Pix enquanto a cliente está com a conta aberta.
  function notifyPaymentChange(id, status, numero) {
    const before = state.lastPayment.get(id)
    if (before && before !== 'aprovado' && status === 'aprovado') {
      showToast(`Pagamento do pedido ${numero} confirmado! 💖`)
    }
    state.lastPayment.set(id, status)
  }

  function trackPayments(pedidos = []) {
    pedidos.forEach((p) => notifyPaymentChange(p.id, p.pagamento_status, p.numero_pedido))
  }

  function startPolling() {
    stopPolling()
    state.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && isLiveTab()) {
        loadCurrent({ silent: true })
      }
    }, POLL_MS)
  }

  function stopPolling() {
    clearInterval(state.pollTimer)
    state.pollTimer = null
  }

  // Só as telas de pedidos atualizam sozinhas; formulários nunca são recarregados.
  function isLiveTab() {
    return !view.hidden && (Boolean(state.pedidoId) || state.tab === 'inicio' || state.tab === 'pedidos')
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isLiveTab()) loadCurrent({ silent: true })
  })

  let toastTimer
  function showToast(message, isError = false) {
    toast.textContent = message
    toast.classList.toggle('is-error', isError)
    toast.hidden = false
    requestAnimationFrame(() => toast.classList.add('is-visible'))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible')
      setTimeout(() => { toast.hidden = true }, 300)
    }, 4200)
  }

  // ---------- renderização ----------
  function skeleton() {
    return `
      <div class="acc-skeleton">
        <span class="sk sk-title"></span>
        <div class="acc-stats">${'<span class="sk sk-card"></span>'.repeat(4)}</div>
        <span class="sk sk-block"></span>
      </div>`
  }

  function render() {
    if (state.pedidoId) {
      content.innerHTML = state.pedido && state.pedido.pedido.id === state.pedidoId
        ? renderPedido(state.pedido)
        : skeleton()
      return
    }
    const renderers = {
      inicio: renderInicio,
      pedidos: renderPedidos,
      dados: renderDados,
      enderecos: renderEnderecos,
      seguranca: renderSeguranca,
    }
    content.innerHTML = renderers[state.tab]()
  }

  function pageHead(kicker, title, subtitle = '') {
    return `
      <header class="acc-head">
        <span class="acc-kicker">${esc(kicker)}</span>
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </header>`
  }

  function renderInicio() {
    if (!state.conta || !state.pedidos) return skeleton()
    const { cliente, resumo } = state.conta
    const ultimo = resumo.ultimo_pedido
    const ativos = state.pedidos.filter((p) => !['entregue', 'cancelado'].includes(p.status)).slice(0, 3)

    return `
      ${pageHead('Sua área exclusiva', `Olá, ${esc(firstName(cliente.nome))}<span class="acc-dot">.</span>`,
        'Acompanhe seus pedidos e mantenha seus dados sempre em dia.')}

      <div class="acc-stats">
        ${statCard('Pedidos realizados', resumo.total_pedidos, 'rose', '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>')}
        ${statCard('Aguardando confirmação', resumo.aguardando_pagamento, 'warn', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}
        ${statCard('Pagamentos confirmados', resumo.pagamento_confirmado, 'ok', '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>')}
        <article class="acc-stat acc-stat--last">
          <span class="acc-stat-label">Último pedido</span>
          ${ultimo
            ? `<strong>${esc(ultimo.numero_pedido)}</strong>
               <small>${fmtDate(ultimo.criado_em)} · ${money.format(ultimo.total)}</small>
               <a href="#minha-conta/pedido/${ultimo.id}" class="acc-link">Ver detalhes →</a>`
            : '<strong>—</strong><small>Você ainda não fez pedidos</small>'}
        </article>
      </div>

      <section class="acc-panel">
        <div class="acc-panel-head">
          <h2>Pedidos em andamento</h2>
          <a href="#minha-conta/pedidos" class="acc-link">Ver todos</a>
        </div>
        ${ativos.length
          ? `<div class="acc-orders">${ativos.map(orderCard).join('')}</div>`
          : emptyOrders()}
      </section>`
  }

  function statCard(label, value, tone, icon) {
    return `
      <article class="acc-stat acc-stat--${tone}">
        <span class="acc-stat-icon">${svg(icon)}</span>
        <span class="acc-stat-label">${esc(label)}</span>
        <strong class="acc-stat-value">${Number(value) || 0}</strong>
      </article>`
  }

  function emptyOrders() {
    return `
      <div class="acc-empty">
        ${svg('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>', 'acc-empty-icon')}
        <h3>Nenhum pedido por aqui ainda</h3>
        <p>Quando você fizer um pedido, ele aparece aqui com o andamento em tempo real.</p>
        <a href="#produtos" class="acc-btn">Conhecer produtos</a>
      </div>`
  }

  function miniProgress(status) {
    if (status === 'cancelado') return ''
    const done = STEP_DONE[status] || 1
    return `
      <div class="acc-mini-progress" aria-hidden="true">
        ${STEPS.map((_, i) => `<span class="${i < done ? 'is-done' : i === done ? 'is-next' : ''}"></span>`).join('')}
      </div>`
  }

  function orderCard(p) {
    const status = STATUS_INFO[p.status] || STATUS_INFO.pendente
    return `
      <a class="acc-order" href="#minha-conta/pedido/${p.id}">
        <div class="acc-order-top">
          <div>
            <strong>${esc(p.numero_pedido)}</strong>
            <small>${fmtDate(p.criado_em)} · ${p.itens} ${p.itens === 1 ? 'item' : 'itens'}</small>
          </div>
          <span class="acc-order-total">${money.format(p.total)}</span>
        </div>
        ${miniProgress(p.status)}
        <div class="acc-order-bottom">
          ${badge(status)}
          ${p.pagamento_status === 'aprovado' && p.status !== 'cancelado'
            ? '<span class="acc-paid">✓ Pix confirmado</span>'
            : ''}
          <span class="acc-order-arrow" aria-hidden="true">→</span>
        </div>
      </a>`
  }

  function renderPedidos() {
    if (!state.pedidos) return skeleton()
    const ativos = state.pedidos.filter((p) => !['entregue', 'cancelado'].includes(p.status))
    const anteriores = state.pedidos.filter((p) => ['entregue', 'cancelado'].includes(p.status))
    return `
      ${pageHead('Histórico', 'Meus pedidos', 'O status atualiza sozinho assim que a Amanda confirma seu pagamento.')}
      ${!state.pedidos.length ? emptyOrders() : `
        ${ativos.length ? `
          <section class="acc-panel">
            <div class="acc-panel-head"><h2>Em andamento</h2><span class="acc-count">${ativos.length}</span></div>
            <div class="acc-orders">${ativos.map(orderCard).join('')}</div>
          </section>` : ''}
        ${anteriores.length ? `
          <section class="acc-panel">
            <div class="acc-panel-head"><h2>Pedidos anteriores</h2><span class="acc-count">${anteriores.length}</span></div>
            <div class="acc-orders">${anteriores.map(orderCard).join('')}</div>
          </section>` : ''}
      `}`
  }

  function timeline(pedido, pagamento, historico) {
    if (pedido.status === 'cancelado') {
      const quando = historico.filter((h) => h.status === 'cancelado').at(-1)?.em
      return `
        <ol class="acc-timeline">
          <li class="is-done"><span class="acc-tl-dot">✓</span><div><strong>Pedido recebido</strong><small>${fmtDate(pedido.criado_em, true)}</small></div></li>
          <li class="is-cancel"><span class="acc-tl-dot">✕</span><div><strong>Pedido cancelado</strong><small>${quando ? fmtDate(quando, true) : 'Fale com a loja se tiver dúvidas.'}</small></div></li>
        </ol>`
    }

    const done = STEP_DONE[pedido.status] || 1
    const dates = { recebido: pedido.criado_em, confirmado: pagamento.confirmado_em }
    for (const h of historico) {
      if (h.status === 'processando') dates.preparacao = h.em
      if (h.status === 'enviado') dates.enviado = h.em
      if (h.status === 'entregue') dates.entregue = h.em
    }

    return `
      <ol class="acc-timeline">
        ${STEPS.map((step, i) => {
          // "Aguardando pagamento" fica concluído assim que o Pix é confirmado.
          const isDone = i < done || (step.key === 'aguardando' && done >= 3)
          const isCurrent = !isDone && i === done
          const cls = isDone ? 'is-done' : isCurrent ? 'is-current' : ''
          const when = dates[step.key]
          let note = ''
          if (isDone && when) note = fmtDate(when, true)
          else if (isCurrent && step.key === 'aguardando') note = 'Pague o Pix abaixo. A Amanda confere e confirma.'
          else if (isCurrent) note = 'Próxima etapa'
          return `
            <li class="${cls}" ${isCurrent ? 'aria-current="step"' : ''}>
              <span class="acc-tl-dot">${isDone ? '✓' : i + 1}</span>
              <div><strong>${step.label}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>
            </li>`
        }).join('')}
      </ol>`
  }

  function renderPedido(data) {
    const { pedido, itens, endereco, pagamento, historico = [] } = data
    const status = STATUS_INFO[pedido.status] || STATUS_INFO.pendente
    const pay = PAYMENT_INFO[pagamento.status] || PAYMENT_INFO.pendente
    const pixPendente = pagamento.status === 'pendente' && pagamento.codigo_copia_cola && pedido.status !== 'cancelado'

    return `
      <a href="#minha-conta/pedidos" class="acc-back">← Meus pedidos</a>
      <header class="acc-head acc-head--order">
        <div>
          <span class="acc-kicker">Pedido</span>
          <h1>${esc(pedido.numero_pedido)}</h1>
          <p>Realizado em ${fmtDate(pedido.criado_em, true)}</p>
        </div>
        ${badge(status)}
      </header>

      ${pagamento.status === 'aprovado' ? `
        <div class="acc-paid-banner">
          <span class="acc-paid-seal">${svg('<path d="M12 2l2.4 2.2 3.2-.4.9 3.1 2.8 1.7-1.1 3 1.1 3-2.8 1.7-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1L2.7 15.4l1.1-3-1.1-3 2.8-1.7.9-3.1 3.2.4z"/><path d="M8.5 12.2l2.3 2.3 4.7-5"/>')}</span>
          <div>
            <strong>Pagamento confirmado</strong>
            <small>${pagamento.confirmado_em ? `Confirmado pela loja em ${fmtDate(pagamento.confirmado_em, true)}` : 'Confirmado pela loja'}</small>
          </div>
        </div>` : ''}

      <div class="acc-order-grid">
        <section class="acc-panel">
          <div class="acc-panel-head"><h2>Andamento</h2></div>
          ${timeline(pedido, pagamento, historico)}
        </section>

        <div class="acc-order-side">
          <section class="acc-panel">
            <div class="acc-panel-head"><h2>Pagamento</h2>${badge(pay)}</div>
            <p class="acc-muted">Pix · ${money.format(pagamento.valor)}</p>
            ${pixPendente ? `
              <label class="acc-label" for="acc-pix-code">Pix copia e cola</label>
              <div class="acc-pix">
                <input id="acc-pix-code" readonly value="${esc(pagamento.codigo_copia_cola)}">
                <button type="button" class="acc-btn acc-copy-pix">Copiar</button>
              </div>
              <p class="acc-hint">Depois de pagar, a confirmação é feita manualmente pela Amanda. Esta tela atualiza sozinha.</p>` : ''}
            <p class="acc-hint">O frete é combinado pelo WhatsApp e não está incluído no Pix.</p>
          </section>

          <section class="acc-panel">
            <div class="acc-panel-head"><h2>Entrega</h2></div>
            ${endereco ? `
              <address class="acc-address">
                <strong>${esc(endereco.nome_destinatario)}</strong>
                ${esc(endereco.rua)}, ${esc(endereco.numero)}${endereco.complemento ? ` · ${esc(endereco.complemento)}` : ''}<br>
                ${esc(endereco.bairro)} · ${esc(endereco.cidade)}/${esc(endereco.estado)}<br>
                CEP ${esc(fmtCep(endereco.cep))} · ${esc(fmtPhone(endereco.telefone))}
              </address>` : '<p class="acc-muted">Endereço não informado.</p>'}
          </section>
        </div>
      </div>

      <section class="acc-panel">
        <div class="acc-panel-head"><h2>Produtos</h2></div>
        <div class="acc-items">
          ${itens.map((item) => `
            <div class="acc-item">
              <span class="acc-item-qty">${item.quantidade}×</span>
              <span class="acc-item-name">${esc(item.nome_produto)}</span>
              <span class="acc-item-unit">${money.format(item.preco_unitario)} cada</span>
              <strong>${money.format(item.subtotal)}</strong>
            </div>`).join('')}
        </div>
        <dl class="acc-totals">
          <div><dt>Subtotal</dt><dd>${money.format(pedido.subtotal)}</dd></div>
          ${pedido.desconto ? `<div><dt>Desconto</dt><dd>− ${money.format(pedido.desconto)}</dd></div>` : ''}
          <div><dt>Frete</dt><dd>${pedido.frete ? money.format(pedido.frete) : 'A combinar'}</dd></div>
          <div class="acc-total"><dt>Total</dt><dd>${money.format(pedido.total)}</dd></div>
        </dl>
      </section>`
  }

  function renderDados() {
    if (!state.conta) return skeleton()
    const c = state.conta.cliente
    return `
      ${pageHead('Perfil', 'Dados pessoais', 'Usamos esses dados para falar com você sobre seus pedidos.')}
      <section class="acc-panel">
        <form class="acc-form acc-form-dados" novalidate>
          <div class="acc-field">
            <label for="acc-nome">Nome completo</label>
            <input id="acc-nome" name="nome" autocomplete="name" required minlength="2" maxlength="150" value="${esc(c.nome)}">
          </div>
          <div class="acc-field">
            <label for="acc-tel">Celular / WhatsApp</label>
            <input id="acc-tel" name="telefone" type="tel" inputmode="numeric" autocomplete="tel-national" required maxlength="16" value="${esc(fmtPhone(c.telefone))}" data-mask="phone">
          </div>
          <div class="acc-field">
            <label for="acc-mail">E-mail</label>
            <input id="acc-mail" value="${esc(c.email)}" disabled>
            <small>O e-mail vem da sua conta Google e não pode ser alterado aqui.</small>
          </div>
          <p class="acc-form-error" role="alert"></p>
          <div class="acc-form-actions">
            <button type="submit" class="acc-btn">Salvar alterações</button>
          </div>
        </form>
      </section>`
  }

  function addressForm(e = {}) {
    const isEdit = Boolean(e.id)
    return `
      <form class="acc-form acc-form-endereco" novalidate data-id="${e.id || ''}">
        <h3>${isEdit ? 'Editar endereço' : 'Novo endereço'}</h3>
        <div class="acc-grid">
          <div class="acc-field acc-span-2">
            <label for="acc-e-nome">Nome de quem recebe</label>
            <input id="acc-e-nome" name="nome_destinatario" required maxlength="150" value="${esc(e.nome_destinatario || state.conta?.cliente?.nome || getCachedUser()?.nome || '')}">
          </div>
          <div class="acc-field">
            <label for="acc-e-tel">Telefone</label>
            <input id="acc-e-tel" name="telefone" type="tel" inputmode="numeric" required maxlength="16" data-mask="phone" value="${esc(fmtPhone(e.telefone || getCachedUser()?.telefone || ''))}">
          </div>
          <div class="acc-field">
            <label for="acc-e-cep">CEP</label>
            <input id="acc-e-cep" name="cep" inputmode="numeric" required maxlength="9" data-mask="cep" value="${esc(fmtCep(e.cep))}">
          </div>
          <div class="acc-field acc-span-2">
            <label for="acc-e-rua">Rua</label>
            <input id="acc-e-rua" name="rua" required maxlength="200" autocomplete="address-line1" value="${esc(e.rua)}">
          </div>
          <div class="acc-field">
            <label for="acc-e-num">Número</label>
            <input id="acc-e-num" name="numero" required maxlength="20" value="${esc(e.numero)}">
          </div>
          <div class="acc-field">
            <label for="acc-e-comp">Complemento</label>
            <input id="acc-e-comp" name="complemento" maxlength="100" value="${esc(e.complemento)}">
          </div>
          <div class="acc-field">
            <label for="acc-e-bairro">Bairro</label>
            <input id="acc-e-bairro" name="bairro" required maxlength="100" value="${esc(e.bairro)}">
          </div>
          <div class="acc-field">
            <label for="acc-e-cidade">Cidade</label>
            <input id="acc-e-cidade" name="cidade" required maxlength="100" value="${esc(e.cidade || 'Fortaleza')}">
          </div>
          <div class="acc-field">
            <label for="acc-e-uf">Estado</label>
            <select id="acc-e-uf" name="estado" required>
              ${UFS.map((uf) => `<option ${uf === (e.estado || 'CE') ? 'selected' : ''}>${uf}</option>`).join('')}
            </select>
          </div>
          <label class="acc-check acc-span-2">
            <input type="checkbox" name="principal" ${e.principal ? 'checked' : ''}>
            <span>Usar como endereço principal</span>
          </label>
        </div>
        <p class="acc-form-error" role="alert"></p>
        <div class="acc-form-actions">
          <button type="button" class="acc-btn acc-btn--ghost acc-cancel-address">Cancelar</button>
          <button type="submit" class="acc-btn">${isEdit ? 'Salvar endereço' : 'Adicionar endereço'}</button>
        </div>
      </form>`
  }

  function renderEnderecos() {
    if (!state.enderecos) return skeleton()
    const editing = state.editingAddress
    return `
      ${pageHead('Entrega', 'Endereços', 'Salve seus endereços para agilizar as próximas compras.')}
      ${editing ? `<section class="acc-panel">${addressForm(editing === 'new' ? {} : editing)}</section>` : ''}
      <div class="acc-addresses">
        ${state.enderecos.map((e) => `
          <article class="acc-address-card ${e.principal ? 'is-main' : ''}">
            ${e.principal ? '<span class="acc-badge acc-badge--ok">Principal</span>' : ''}
            <address class="acc-address">
              <strong>${esc(e.nome_destinatario)}</strong>
              ${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ` · ${esc(e.complemento)}` : ''}<br>
              ${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.estado)}<br>
              CEP ${esc(fmtCep(e.cep))} · ${esc(fmtPhone(e.telefone))}
            </address>
            <div class="acc-address-actions">
              <button type="button" class="acc-link acc-edit-address" data-id="${e.id}">Editar</button>
              <button type="button" class="acc-link acc-link--danger acc-remove-address" data-id="${e.id}">Remover</button>
            </div>
          </article>`).join('')}
        ${!editing ? `
          <button type="button" class="acc-address-new acc-new-address">
            <span>+</span> Adicionar endereço
          </button>` : ''}
      </div>`
  }

  function renderSeguranca() {
    const c = state.conta?.cliente || getCachedUser() || {}
    return `
      ${pageHead('Proteção', 'Segurança', 'Sua conta é protegida pelo login do Google.')}
      <div class="acc-security">
        <article class="acc-panel acc-sec-item">
          <span class="acc-sec-icon">${svg('<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z"/>')}</span>
          <div>
            <strong>Entrada com Google</strong>
            <small>${esc(c.email || '')}</small>
            <p class="acc-muted">Não existe senha da loja para ser vazada ou esquecida. Para trocar sua senha ou ativar a verificação em duas etapas, use as configurações da sua conta Google.</p>
            <a class="acc-link" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Abrir segurança do Google ↗</a>
          </div>
        </article>
        <article class="acc-panel acc-sec-item">
          <span class="acc-sec-icon">${svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>')}</span>
          <div>
            <strong>Sessão neste aparelho</strong>
            <small>Expira automaticamente em até 7 dias</small>
            <p class="acc-muted">Se você usa um computador compartilhado, saia da conta ao terminar.</p>
            <button type="button" class="acc-btn acc-btn--ghost acc-logout-inline">Sair deste aparelho</button>
          </div>
        </article>
        <article class="acc-panel acc-sec-item">
          <span class="acc-sec-icon">${svg('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/>')}</span>
          <div>
            <strong>Seus dados</strong>
            <p class="acc-muted">Somente você vê seus pedidos e endereços. A Amanda acessa seus dados apenas para atender e entregar suas compras.</p>
          </div>
        </article>
      </div>`
  }

  // ---------- ações ----------
  function formData(form) {
    const data = Object.fromEntries(new FormData(form).entries())
    for (const key of Object.keys(data)) data[key] = String(data[key]).trim()
    return data
  }

  async function submitDados(form) {
    const error = form.querySelector('.acc-form-error')
    const data = formData(form)
    if (data.nome.length < 2) return (error.textContent = 'Informe seu nome.')
    const digits = data.telefone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) return (error.textContent = 'Informe um celular válido com DDD.')
    error.textContent = ''
    const button = form.querySelector('[type="submit"]')
    button.disabled = true
    try {
      const result = await api('', { method: 'PUT', body: JSON.stringify({ nome: data.nome, telefone: digits }) })
      state.conta.cliente = { ...state.conta.cliente, ...result.cliente }
      cacheUser(result.cliente)
      showToast('Dados atualizados com sucesso.')
      render()
    } catch (err) {
      if (!handleError(err)) error.textContent = err.message
    } finally {
      button.disabled = false
    }
  }

  async function submitEndereco(form) {
    const error = form.querySelector('.acc-form-error')
    const data = formData(form)
    const payload = {
      ...data,
      telefone: data.telefone.replace(/\D/g, ''),
      cep: data.cep.replace(/\D/g, ''),
      principal: form.elements.principal.checked,
    }
    if (payload.cep.length !== 8) return (error.textContent = 'Informe um CEP com 8 números.')
    if (payload.telefone.length < 10) return (error.textContent = 'Informe um telefone com DDD.')
    if (!payload.nome_destinatario || !payload.rua || !payload.numero || !payload.bairro || !payload.cidade) {
      return (error.textContent = 'Preencha todos os campos obrigatórios.')
    }
    error.textContent = ''
    const id = form.dataset.id
    const button = form.querySelector('[type="submit"]')
    button.disabled = true
    try {
      await api(id ? `/enderecos/${id}` : '/enderecos', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      state.editingAddress = null
      state.enderecos = (await api('/enderecos')).enderecos
      showToast(id ? 'Endereço atualizado.' : 'Endereço adicionado.')
      render()
    } catch (err) {
      if (!handleError(err)) error.textContent = err.message
    } finally {
      button.disabled = false
    }
  }

  async function lookupCep(input) {
    const cep = input.value.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()
      if (data.erro) return
      const form = input.form
      const set = (name, value) => {
        const field = form.elements[name]
        if (field && value && !field.value) field.value = value
      }
      set('rua', data.logradouro)
      set('bairro', data.bairro)
      if (data.localidade) form.elements.cidade.value = data.localidade
      if (data.uf) form.elements.estado.value = data.uf
      form.elements.numero?.focus()
    } catch { /* ViaCEP indisponível: a cliente preenche à mão */ }
  }

  function logout(message) {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch { /* ignore */ }
    try { window.google?.accounts?.id?.disableAutoSelect?.() } catch { /* ignore */ }
    state.conta = state.pedidos = state.pedido = state.enderecos = null
    state.lastPayment.clear()
    updateHeader()
    close()
    window.location.hash = message ? '#login' : '#inicio'
    if (message) {
      const feedback = document.querySelector('.auth-feedback-message')
      if (feedback) feedback.textContent = message
    }
    window.dispatchEvent(new CustomEvent('amanda:auth-changed', { detail: { loggedIn: false } }))
  }

  view.addEventListener('click', async (event) => {
    const target = event.target.closest('button, a')
    if (!target) return

    if (target.matches('.acc-logout, .acc-logout-inline')) return logout()
    if (target.matches('.acc-retry')) return loadCurrent()

    if (target.matches('.acc-copy-pix')) {
      const input = view.querySelector('#acc-pix-code')
      try {
        await navigator.clipboard.writeText(input.value)
      } catch {
        input.select()
        document.execCommand('copy')
      }
      target.textContent = 'Copiado ✓'
      setTimeout(() => { target.textContent = 'Copiar' }, 2200)
      return
    }

    if (target.matches('.acc-new-address')) {
      state.editingAddress = 'new'
      render()
      view.querySelector('#acc-e-cep')?.focus()
      return
    }
    if (target.matches('.acc-edit-address')) {
      state.editingAddress = state.enderecos.find((e) => e.id === Number(target.dataset.id)) || null
      render()
      view.querySelector('.acc-form-endereco')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (target.matches('.acc-cancel-address')) {
      state.editingAddress = null
      render()
      return
    }
    if (target.matches('.acc-remove-address')) {
      if (!window.confirm('Remover este endereço? Pedidos antigos continuam com o endereço registrado.')) return
      try {
        await api(`/enderecos/${target.dataset.id}`, { method: 'DELETE' })
        state.enderecos = (await api('/enderecos')).enderecos
        showToast('Endereço removido.')
        render()
      } catch (err) {
        if (!handleError(err)) showToast(err.message, true)
      }
    }
  })

  view.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.target
    if (form.matches('.acc-form-dados')) submitDados(form)
    if (form.matches('.acc-form-endereco')) submitEndereco(form)
  })

  view.addEventListener('input', (event) => {
    const input = event.target
    if (input.dataset.mask === 'phone') input.value = fmtPhone(input.value)
    if (input.dataset.mask === 'cep') {
      input.value = fmtCep(input.value)
      if (input.value.length === 9) lookupCep(input)
    }
  })

  // Efeito de profundidade nos cartões (só com mouse e sem redução de movimento).
  const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (canTilt) {
    view.addEventListener('pointermove', (event) => {
      const card = event.target.closest('.acc-stat, .acc-order')
      if (!card) return
      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      card.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`)
      card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`)
      card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`)
    })
    view.addEventListener('pointerout', (event) => {
      const card = event.target.closest('.acc-stat, .acc-order')
      if (card && !card.contains(event.relatedTarget)) {
        card.style.removeProperty('--rx')
        card.style.removeProperty('--ry')
      }
    })
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !view.hidden && !view.querySelector('form:focus-within')) {
      window.location.hash = '#inicio'
    }
  })

  window.addEventListener('amanda:auth-changed', (event) => {
    updateHeader()
    if (event.detail?.loggedIn) {
      state.conta = state.pedidos = state.pedido = state.enderecos = null
      state.lastPayment.clear()
    }
  })

  updateHeader()
  onRoute()

  return {
    afterLogin({ goToAccount = true } = {}) {
      window.dispatchEvent(new CustomEvent('amanda:auth-changed', { detail: { loggedIn: true } }))
      const pending = sessionStorage.getItem('amanda_after_login')
      sessionStorage.removeItem('amanda_after_login')
      if (pending) window.location.hash = pending
      else if (goToAccount) window.location.hash = '#minha-conta'
    },
  }
}
