// Painel administrativo Amanda Cosméticos — estrutura, rotas, login e busca.
import './admin.css'
import brandImage from './assets/images/amanddda.jfif'
import { api, session } from './admin/api.js'
import { icon } from './admin/icons.js'
import { esc, toast, debounce, money, phoneLabel } from './admin/ui.js'
import { getProdutos, getClientes, invalidate } from './admin/data.js'
import * as dashboard from './admin/views/dashboard.js'
import * as pedidos from './admin/views/pedidos.js'
import * as clientes from './admin/views/clientes.js'
import * as produtos from './admin/views/produtos.js'
import * as estoque from './admin/views/estoque.js'
import * as categorias from './admin/views/categorias.js'
import * as historico from './admin/views/historico.js'
import * as pagamentos from './admin/views/pagamentos.js'
import * as faturamento from './admin/views/faturamento.js'
import * as sistema from './admin/views/sistema.js'

const app = document.querySelector('#admin-app')

const NAV = [
  { group: 'Visão geral', items: [{ path: '', label: 'Resumo', icon: 'home' }] },
  {
    group: 'Vendas',
    items: [
      { path: 'pedidos', label: 'Pedidos', icon: 'cart' },
      { path: 'clientes', label: 'Clientes', icon: 'users' },
      { path: 'pagamentos', label: 'Pagamentos', icon: 'card' },
      { path: 'faturamento', label: 'Faturamento', icon: 'chart' },
      { path: 'historico', label: 'Histórico', icon: 'clock' },
    ],
  },
  {
    group: 'Catálogo',
    items: [
      { path: 'produtos', label: 'Produtos', icon: 'box' },
      { path: 'estoque', label: 'Estoque', icon: 'layers' },
      { path: 'categorias', label: 'Categorias', icon: 'tag' },
    ],
  },
  { group: 'Sistema', items: [{ path: 'sistema', label: 'Sistema', icon: 'settings' }] },
]

const ROUTES = [
  { re: /^$/, view: dashboard.render, crumbs: [] },
  { re: /^pedidos$/, view: pedidos.renderList, crumbs: [{ label: 'Pedidos' }] },
  { re: /^pedidos\/(?<id>\d+)$/, view: pedidos.renderDetail, crumbs: [{ label: 'Pedidos', href: '#/pedidos' }, { label: 'Detalhe' }] },
  { re: /^clientes$/, view: clientes.renderList, crumbs: [{ label: 'Clientes' }] },
  { re: /^clientes\/(?<id>\d+)$/, view: clientes.renderDetail, crumbs: [{ label: 'Clientes', href: '#/clientes' }, { label: 'Perfil' }] },
  { re: /^pagamentos$/, view: pagamentos.render, crumbs: [{ label: 'Pagamentos' }] },
  { re: /^faturamento$/, view: faturamento.render, crumbs: [{ label: 'Faturamento' }] },
  { re: /^historico$/, view: historico.render, crumbs: [{ label: 'Histórico' }] },
  { re: /^produtos$/, view: produtos.render, crumbs: [{ label: 'Produtos' }] },
  { re: /^estoque$/, view: estoque.render, crumbs: [{ label: 'Estoque' }] },
  { re: /^categorias$/, view: categorias.render, crumbs: [{ label: 'Categorias' }] },
  { re: /^sistema$/, view: sistema.render, crumbs: [{ label: 'Sistema' }] },
]

// ---------------------------------------------------------------
// Tema
// ---------------------------------------------------------------
function storedTheme() {
  try { return localStorage.getItem('amanda_admin_tema') } catch { return null }
}
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
}
function currentTheme() {
  return document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}
applyTheme(storedTheme())

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------
function renderLogin(message = '') {
  document.title = 'Entrar | Painel Amanda Cosméticos'
  app.innerHTML = `
    <main class="login-page">
      <form class="login-card" novalidate>
        <img src="${brandImage}" alt="Amanda Cosméticos" class="login-logo">
        <h1>Painel da loja</h1>
        <p class="muted">Entre com seu e-mail e senha de administrador.</p>
        <div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="login-senha">Senha</label><input id="login-senha" name="senha" type="password" autocomplete="current-password" required></div>
        <p class="form-error" role="alert" ${message ? '' : 'hidden'}>${esc(message)}</p>
        <button class="btn btn-primary btn-block" type="submit">Entrar ${icon('arrowRight', 16)}</button>
        <a class="link back-link" href="/">${icon('chevronLeft', 14)}Voltar para a loja</a>
      </form>
    </main>`
  const form = app.querySelector('form')
  const err = form.querySelector('.form-error')
  form.elements.email.focus()
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = form.elements.email.value.trim()
    const senha = form.elements.senha.value
    if (!email || !senha) {
      err.textContent = 'Informe e-mail e senha.'
      err.hidden = false
      return
    }
    const btn = form.querySelector('button')
    btn.disabled = true
    btn.textContent = 'Entrando...'
    try {
      const data = await api('/admin/login', { method: 'POST', body: { email, senha } })
      session.save(data.token, data.administrador)
      renderShell()
    } catch (error) {
      err.textContent = error.message
      err.hidden = false
      btn.disabled = false
      btn.innerHTML = `Entrar ${icon('arrowRight', 16)}`
      form.elements.senha.select()
    }
  })
}

function logout(message = '') {
  session.clear()
  invalidate()
  history.replaceState(null, '', '#/')
  renderLogin(message)
}
window.addEventListener('admin:logout', () => logout('Sua sessão expirou. Entre novamente.'))

// ---------------------------------------------------------------
// Estrutura (sidebar + topbar)
// ---------------------------------------------------------------
function navHtml() {
  return NAV.map((g) => `
    <div class="nav-group">
      <p class="nav-group-title">${esc(g.group)}</p>
      <ul>${g.items.map((i) => `
        <li><a class="nav-link" href="#/${i.path}" data-path="${i.path}" title="${esc(i.label)}">${icon(i.icon, 20)}<span class="nav-label">${esc(i.label)}</span></a></li>`).join('')}</ul>
    </div>`).join('')
}

function renderShell() {
  const admin = session.admin || {}
  let collapsed = false
  try { collapsed = localStorage.getItem('amanda_admin_sidebar') === 'collapsed' } catch { /* */ }
  app.innerHTML = `
    <a class="skip-link" href="#main">Pular para o conteúdo</a>
    <div class="shell ${collapsed ? 'is-collapsed' : ''}">
      <aside class="sidebar" id="sidebar" aria-label="Menu principal">
        <div class="sidebar-brand">
          <img src="${brandImage}" alt="">
          <span class="nav-label">Amanda <small>Painel</small></span>
        </div>
        <nav>${navHtml()}</nav>
        <div class="sidebar-foot">
          <a class="nav-link" href="/" target="_blank" rel="noopener">${icon('store', 20)}<span class="nav-label">Ver loja</span></a>
          <button class="nav-link collapse-btn" type="button" data-action="collapse" aria-label="Recolher menu" aria-pressed="${collapsed}">${icon('chevronLeft', 20)}<span class="nav-label">Recolher</span></button>
        </div>
      </aside>
      <div class="backdrop" data-action="close-drawer" hidden></div>
      <div class="content">
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" data-action="drawer" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false">${icon('menu', 22)}</button>
          <nav class="breadcrumbs" aria-label="Você está em"><ol id="crumbs"></ol></nav>
          <button class="search-trigger" type="button" data-action="search" aria-label="Busca global (Ctrl+K)">${icon('search', 18)}<span>Buscar...</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn" type="button" data-action="theme" aria-label="Alternar tema claro/escuro">${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)}</button>
          <div class="user-menu">
            <button class="user-btn" type="button" data-action="user" aria-haspopup="true" aria-expanded="false">
              <span class="avatar avatar-sm">${esc((admin.nome || 'A').charAt(0).toUpperCase())}</span>
              <span class="user-name">${esc(admin.nome || 'Administrador')}</span>${icon('chevronDown', 16)}
            </button>
            <div class="user-dropdown" role="menu" hidden>
              <p class="user-email">${esc(admin.email || '')}</p>
              <a role="menuitem" href="#/sistema">${icon('settings', 16)}Sistema</a>
              <button role="menuitem" type="button" data-action="logout">${icon('logout', 16)}Sair</button>
            </div>
          </div>
        </header>
        <main id="main" class="main" tabindex="-1"></main>
      </div>
    </div>`

  const shell = app.querySelector('.shell')
  const sidebar = app.querySelector('#sidebar')
  const backdrop = app.querySelector('.backdrop')
  const drawerBtn = app.querySelector('[data-action="drawer"]')
  const dropdown = app.querySelector('.user-dropdown')
  const userBtn = app.querySelector('[data-action="user"]')

  const setDrawer = (open) => {
    shell.classList.toggle('drawer-open', open)
    backdrop.hidden = !open
    drawerBtn.setAttribute('aria-expanded', String(open))
    if (open) sidebar.querySelector('a')?.focus()
  }

  app.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action
    if (action === 'drawer') setDrawer(true)
    if (action === 'close-drawer') setDrawer(false)
    if (e.target.closest('.sidebar .nav-link')) setDrawer(false)
    if (action === 'collapse') {
      const now = !shell.classList.contains('is-collapsed')
      shell.classList.toggle('is-collapsed', now)
      e.target.closest('button').setAttribute('aria-pressed', String(now))
      try { localStorage.setItem('amanda_admin_sidebar', now ? 'collapsed' : 'open') } catch { /* */ }
    }
    if (action === 'theme') {
      const next = currentTheme() === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try { localStorage.setItem('amanda_admin_tema', next) } catch { /* */ }
      e.target.closest('button').innerHTML = icon(next === 'dark' ? 'sun' : 'moon', 20)
      route()
    }
    if (action === 'user') {
      const open = dropdown.hidden
      dropdown.hidden = !open
      userBtn.setAttribute('aria-expanded', String(open))
      return
    }
    if (action === 'logout') logout()
    if (action === 'search') openSearch()
    if (!e.target.closest('.user-menu')) {
      dropdown.hidden = true
      userBtn.setAttribute('aria-expanded', 'false')
    }
  })

  route()
}

function setCrumbs(list) {
  const ol = document.querySelector('#crumbs')
  if (!ol) return
  const all = [{ label: 'Início', href: '#/' }, ...list]
  ol.innerHTML = all.map((c, i) => (i === all.length - 1
    ? `<li aria-current="page">${esc(c.label)}</li>`
    : `<li><a href="${c.href}">${esc(c.label)}</a></li>`)).join('')
  document.title = `${list.length ? list[list.length - 1].label : 'Resumo'} | Painel Amanda Cosméticos`
}

let routeToken = 0
async function route() {
  if (!session.token) return renderLogin()
  const main = document.querySelector('#main')
  if (!main) return renderShell()
  const raw = location.hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  const match = ROUTES.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m)
  const token = ++routeToken

  document.querySelectorAll('.nav-link[data-path]').forEach((a) => {
    const base = path.split('/')[0]
    if (a.dataset.path === base) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })

  if (!match) {
    setCrumbs([{ label: 'Não encontrado' }])
    main.innerHTML = '<div class="state state-empty"><h3>Página não encontrada</h3><a class="btn" href="#/">Voltar ao início</a></div>'
    return
  }
  setCrumbs(match.r.crumbs)
  const ctx = {
    params: match.m.groups || {},
    query: new URLSearchParams(qs),
    navigate: (hash) => { location.hash = hash },
    setCrumbs: (c) => { if (token === routeToken) setCrumbs(c) },
  }
  main.scrollTop = 0
  window.scrollTo(0, 0)
  try {
    await match.r.view(main, ctx)
  } catch (error) {
    if (token === routeToken) toast(error.message || 'Erro inesperado.', 'error')
  }
  if (token === routeToken) main.focus({ preventScroll: true })
}
window.addEventListener('hashchange', route)

// ---------------------------------------------------------------
// Busca global (Ctrl+K)
// ---------------------------------------------------------------
function openSearch() {
  if (document.querySelector('.search-dialog')) return
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog search-dialog'
  dialog.setAttribute('aria-label', 'Busca global')
  dialog.innerHTML = `
    <div class="search-box">
      ${icon('search', 20)}
      <label class="sr-only" for="global-search">Buscar pedidos, clientes, produtos ou telas</label>
      <input id="global-search" type="search" autocomplete="off" placeholder="Pedido, cliente, produto ou tela..." aria-controls="search-results">
      <kbd>Esc</kbd>
    </div>
    <ul id="search-results" class="search-results" role="listbox" aria-label="Resultados"></ul>`
  document.body.append(dialog)
  const input = dialog.querySelector('input')
  const list = dialog.querySelector('ul')
  const close = () => { dialog.close(); dialog.remove() }
  dialog.addEventListener('close', () => dialog.remove())
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close()
    if (e.target.closest('a')) close()
  })
  dialog.showModal()
  input.focus()

  const screens = NAV.flatMap((g) => g.items).map((i) => ({ type: 'Tela', label: i.label, href: `#/${i.path}`, ic: i.icon }))
  let active = 0
  const paint = (results) => {
    active = 0
    list.innerHTML = results.length
      ? results.map((r, i) => `<li role="option" aria-selected="${i === 0}"><a href="${r.href}">${icon(r.ic, 18)}<span><strong>${esc(r.label)}</strong>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><em>${esc(r.type)}</em></a></li>`).join('')
      : '<li class="search-empty">Nada encontrado.</li>'
  }
  paint(screens)

  const run = debounce(async () => {
    const term = input.value.trim().toLowerCase()
    if (!term) return paint(screens)
    const results = screens.filter((s) => s.label.toLowerCase().includes(term))
    try {
      const [prods, clis, peds] = await Promise.all([
        getProdutos().catch(() => []),
        getClientes().catch(() => []),
        term.length >= 2 ? api(`/admin/pedidos?limit=5&q=${encodeURIComponent(input.value.trim())}`).then((d) => d.pedidos).catch(() => []) : [],
      ])
      peds.forEach((p) => results.push({ type: 'Pedido', label: p.numero_exibicao, sub: `${p.cliente_nome} · ${money(p.total)}`, href: `#/pedidos/${p.id}`, ic: 'cart' }))
      clis.filter((c) => `${c.nome} ${c.telefone || ''} ${c.email || ''}`.toLowerCase().includes(term)).slice(0, 5)
        .forEach((c) => results.push({ type: 'Cliente', label: c.nome, sub: phoneLabel(c.telefone), href: `#/clientes/${c.id}`, ic: 'user' }))
      prods.filter((p) => `${p.nome} ${p.sku || ''}`.toLowerCase().includes(term)).slice(0, 5)
        .forEach((p) => results.push({ type: 'Produto', label: p.nome, sub: `${money(p.preco_promocional || p.preco)} · ${p.estoque} un.`, href: `#/produtos?q=${encodeURIComponent(p.nome)}`, ic: 'box' }))
    } catch { /* mantém resultados parciais */ }
    if (dialog.isConnected) paint(results)
  }, 250)
  input.addEventListener('input', run)
  input.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('[role="option"]')]
    if (!items.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items.forEach((li, i) => li.setAttribute('aria-selected', String(i === active)))
      items[active].scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const link = items[active]?.querySelector('a')
      if (link) { location.hash = link.getAttribute('href'); close() }
    }
  })
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && session.token) {
    e.preventDefault()
    openSearch()
  }
})

// ---------------------------------------------------------------
// Início
// ---------------------------------------------------------------
if (session.token) renderShell()
else renderLogin()
