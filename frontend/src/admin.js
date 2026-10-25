import './admin.css'
import brandImage from './assets/images/amanddda.jfif'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '')
const app = document.querySelector('#admin-app')

function readStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem('amanda_admin_user') || 'null')
  } catch {
    localStorage.removeItem('amanda_admin_user')
    return null
  }
}

const state = {
  token: localStorage.getItem('amanda_admin_token'),
  admin: readStoredAdmin(),
  resumo: null,
  dashboard: null,
  produtos: [],
  categorias: [],
  clientes: [],
  historicoCliente: null,
  activeView: 'overview',
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character])
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function imageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const apiOrigin = new URL(API_URL, window.location.origin).origin
  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
}

async function responseData(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return {}
  }

  return response.json()
}

function errorMessage(error, fallback) {
  if (error instanceof TypeError) {
    return 'Não foi possível conectar à API. Verifique se o backend está rodando.'
  }

  return error.message || fallback
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <a class="brand login-brand" href="/">
          <img src="${brandImage}" alt="Amanda Cosméticos">
        </a>

        <span class="eyebrow">Área restrita</span>
        <h1>Painel administrativo.</h1>

        <p class="login-copy">
          Gerencie produtos, categorias e acompanhe sua loja em um único lugar.
        </p>

        <form id="login-form" class="login-form">
          <label>
            E-mail
            <input
              name="email"
              type="email"
              autocomplete="username"
              placeholder="admin@amandacosmeticos.com"
              required
            >
          </label>

          <label>
            Senha
            <input
              name="senha"
              type="password"
              autocomplete="current-password"
              placeholder="Sua senha"
              required
            >
          </label>

          <button class="primary-button" type="submit">
            Entrar no painel <span>→</span>
          </button>

          <p class="form-message" role="alert">${escapeHtml(message)}</p>
        </form>

        <a class="back-link" href="/">← Voltar para a loja</a>
      </section>

      <aside class="login-art">
        <div class="art-ring ring-one"></div>
        <div class="art-ring ring-two"></div>

        <img src="${brandImage}" alt="Amanda Cosméticos">

        <div class="art-copy">
          <span>AMANDA COSMÉTICOS</span>
          <strong>Beleza com intenção.</strong>
        </div>
      </aside>
    </main>
  `

  document
    .querySelector('#login-form')
    .addEventListener('submit', handleLogin)
}

async function handleLogin(event) {
  event.preventDefault()

  const form = new FormData(event.currentTarget)
  const message = event.currentTarget.querySelector('.form-message')
  const button = event.currentTarget.querySelector('button')

  button.disabled = true
  button.textContent = 'Entrando...'

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: form.get('email'),
        senha: form.get('senha'),
      }),
    })

    const data = await responseData(response)

    if (!response.ok) {
      throw new Error(data.mensagem || 'Não foi possível entrar.')
    }

    state.token = data.token
    state.admin = data.administrador

    localStorage.setItem('amanda_admin_token', state.token)
    localStorage.setItem(
      'amanda_admin_user',
      JSON.stringify(state.admin)
    )

    await loadDashboard()
  } catch (error) {
    message.textContent = errorMessage(error, 'Não foi possível entrar.')
    button.disabled = false
    button.innerHTML = 'Entrar no painel <span>→</span>'
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  })

  const data = await responseData(response)

  if (response.status === 401) {
    logout()
    throw new Error('Sua sessão expirou.')
  }

  if (!response.ok) {
    throw new Error(
      data.mensagem || 'Não foi possível carregar os dados.'
    )
  }

  return data
}

async function loadDashboard() {
  try {
    const [resumo, dashboard, produtos, categorias, clientes] = await Promise.all([
      api('/admin/resumo'),
      api('/admin/dashboard'),
      api('/admin/produtos'),
      api('/admin/categorias'),
      api('/admin/clientes'),
    ])

    state.resumo = resumo.resumo
    state.dashboard = dashboard.dashboard || null
    state.produtos = produtos.produtos || []
    state.categorias = categorias.categorias || []
    state.clientes = clientes.clientes || []

    renderDashboard()
  } catch (error) {
    if (state.token) {
      renderDashboard(errorMessage(error, 'Não foi possível carregar o painel.'))
    }
  }
}

function renderDashboard(message = '') {
  const adminName = escapeHtml(
    state.admin?.nome || 'Administração'
  )

  app.innerHTML = `
    <div class="admin-shell">

      <aside class="sidebar">

        <a class="brand sidebar-brand" href="/">
          <img src="${brandImage}" alt="Amanda Cosméticos">
        </a>

        <div class="sidebar-section">
          <span class="sidebar-label">Gestão</span>

          <nav class="side-nav">

            ${navButton(
              'overview',
              '⌂',
              'Visão geral'
            )}

            ${navButton(
              'products',
              '◈',
              'Produtos',
              state.produtos.length
            )}

            ${navButton(
              'clients',
              '○',
              'Clientes',
              state.clientes.length
            )}

          </nav>
        </div>

        <div class="sidebar-footer">

          <div class="store-status">
            <span class="status-dot"></span>
            <div>
              <strong>Loja online</strong>
              <small>API conectada</small>
            </div>
          </div>

          <a href="/">Ver loja ↗</a>

          <button id="logout-button">
            Sair da administração
          </button>

        </div>

      </aside>

      <main class="dashboard">

        <header class="dashboard-header">

          <div>
            <span class="eyebrow">Painel administrativo</span>
            <h1>Olá, ${adminName}.</h1>
            <p class="header-subtitle">
              Aqui está o resumo da sua operação.
            </p>
          </div>

          <div class="header-date">
            <span>STATUS</span>
            <strong><i></i> Sistema operacional</strong>
          </div>

        </header>

        ${
          message
            ? `<div class="dashboard-message">${escapeHtml(message)}</div>`
            : ''
        }

        <section id="dashboard-content"></section>

      </main>
    </div>
  `

  document
    .querySelector('#logout-button')
    .addEventListener('click', logout)

  document
    .querySelectorAll('[data-view]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        state.activeView = button.dataset.view
        renderDashboard()
      })
    })

  renderView()
    bindImageFallbacks()
}

  function bindImageFallbacks() {
    document.querySelectorAll('.product-cell img').forEach((image) => {
      image.addEventListener('error', () => {
        const placeholder = document.createElement('div')
        placeholder.className = 'product-placeholder'
        placeholder.textContent = '◈'
        image.replaceWith(placeholder)
      }, { once: true })
    })
  }

function navButton(view, icon, label, count = null) {
  return `
    <button
      class="nav-item ${state.activeView === view ? 'active' : ''}"
      data-view="${view}"
      type="button"
    >
      <span class="nav-label">
        <b class="nav-icon">${icon}</b>
        ${label}
      </span>

      ${
        count !== null
          ? `<strong class="nav-count">${count}</strong>`
          : ''
      }
    </button>
  `
}

function renderView() {
  const content = document.querySelector('#dashboard-content')

  if (!content) return

  if (state.activeView === 'products') {
    renderProducts(content)
    return
  }

  if (state.activeView === 'categories') {
    renderCategories(content)
    return
  }

  if (state.activeView === 'clients') {
    renderClients(content)
    return
  }

  renderOverview(content)
}

function renderOverview(content) {
  const totalProdutos = Number(state.resumo?.produtos || 0)
  const totalCategorias = Number(state.resumo?.categorias || 0)
  const totalClientes = Number(state.resumo?.clientes || 0)
  const estoqueBaixo = Number(state.resumo?.estoqueBaixo || 0)
  const totalPedidos = Number(state.resumo?.pedidos || 0)
  const faturamento = Number(state.resumo?.faturamento || 0)

  const recentes = state.produtos.slice(0, 6)
  const dashboard = state.dashboard || {}
  const pedidosRecentes = dashboard.pedidosRecentes || []
  const estoqueBaixoLista = dashboard.estoqueBaixo || []
  const maisVendidos = dashboard.maisVendidos || []
  const alertas = dashboard.alertas || []

  content.innerHTML = `

    <section class="metric-grid">

      ${metricCard(
        'Produtos ativos',
        totalProdutos,
        'Itens publicados no catálogo',
        '◈'
      )}

      ${metricCard(
        'Categorias',
        totalCategorias,
        'Organização do catálogo',
        '◇'
      )}

      ${metricCard(
        'Clientes',
        totalClientes,
        'Cadastros ativos',
        '○'
      )}

      ${metricCard(
        'Estoque baixo',
        estoqueBaixo,
        estoqueBaixo > 0
          ? 'Produtos precisam de atenção'
          : 'Nenhuma atenção necessária',
        '!'
      )}

      ${metricCard(
        'Pedidos',
        totalPedidos,
        'Compras não canceladas',
        '↗'
      )}

      ${metricCard(
        'Faturamento',
        money(faturamento),
        'Total de pedidos não cancelados',
        '$'
      )}

    </section>

    <section class="dashboard-grid overview-main-grid">

      <article class="panel large-panel">

        <div class="panel-heading">

          <div>
            <span class="eyebrow">Catálogo</span>
            <h2>Produtos recentes</h2>
          </div>

          <button
            class="text-button"
            data-view="products"
            type="button"
          >
            Ver catálogo →
          </button>

        </div>

        ${productRows(recentes)}

      </article>

      <article class="panel insight-panel">

        <span class="eyebrow">Resumo</span>

        <h2>
          Sua operação em ordem.
        </h2>

        <p>
          Acompanhe os principais indicadores da Amanda
          Cosméticos através deste painel.
        </p>

        <div class="summary-list">

          <div>
            <span>Produtos cadastrados</span>
            <strong>${totalProdutos}</strong>
          </div>

          <div>
            <span>Categorias ativas</span>
            <strong>${totalCategorias}</strong>
          </div>

          <div>
            <span>Clientes ativos</span>
            <strong>${totalClientes}</strong>
          </div>

          <div>
            <span>Estoque em atenção</span>
            <strong class="${estoqueBaixo > 0 ? 'danger-text' : ''}">
              ${estoqueBaixo}
            </strong>
          </div>

        </div>

      </article>

    </section>

    <section class="overview-data-grid">
      <article class="panel data-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Vendas</span>
            <h2>Pedidos recentes</h2>
          </div>
          <button class="text-button" data-view="clients" type="button">Ver clientes →</button>
        </div>

        ${pedidosRecentes.length ? `
          <div class="recent-orders-list">
            ${pedidosRecentes.map((pedido) => `
              <div class="recent-order-row">
                <div>
                  <strong>${escapeHtml(pedido.numero_pedido)}</strong>
                  <small>${escapeHtml(pedido.cliente)} · ${dateTime(pedido.criado_em)}</small>
                </div>
                <strong class="price">${money(pedido.total)}</strong>
                <span class="order-status status-${escapeHtml(pedido.status)}">${escapeHtml(orderStatus(pedido.status))}</span>
              </div>
            `).join('')}
          </div>
        ` : '<div class="dashboard-empty">Nenhum pedido registrado.</div>'}
      </article>

      <article class="panel data-panel attention-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Prioridades</span>
            <h2>Atenção necessária</h2>
          </div>
        </div>
        ${alertas.length ? `
          <div class="attention-list">
            ${alertas.map((alerta) => `
              <div class="attention-row">
                <span class="attention-icon">!</span>
                <div><strong>${escapeHtml(alerta.titulo)}</strong><small>Verificar agora</small></div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="dashboard-empty success-empty">Tudo em ordem por aqui.</div>'}
      </article>
    </section>

    <section class="overview-data-grid secondary-data-grid">
      <article class="panel data-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">Estoque</span><h2>Reposição necessária</h2></div>
          <button class="text-button" data-view="products" type="button">Ver produtos →</button>
        </div>
        ${estoqueBaixoLista.length ? `
          <div class="stock-alert-list">
            ${estoqueBaixoLista.map((produto) => `
              <div class="stock-alert-row"><div><strong>${escapeHtml(produto.nome)}</strong><small>${escapeHtml(produto.categoria)}</small></div><b>${produto.estoque} un.</b></div>
            `).join('')}
          </div>
        ` : '<div class="dashboard-empty success-empty">Nenhum estoque baixo.</div>'}
      </article>

      <article class="panel data-panel">
        <div class="panel-heading"><div><span class="eyebrow">Desempenho</span><h2>Mais vendidos</h2></div></div>
        ${maisVendidos.length ? `
          <div class="top-products-list">
            ${maisVendidos.map((produto, index) => `<div class="top-product-row"><span>${index + 1}</span><strong>${escapeHtml(produto.nome)}</strong><b>${produto.unidades} un.</b></div>`).join('')}
          </div>
        ` : '<div class="dashboard-empty">Ainda não há vendas suficientes.</div>'}
      </article>
    </section>

    <section class="quick-actions">

      <div>
        <span class="eyebrow">Ações rápidas</span>
        <h2>Gerencie sua loja</h2>
      </div>

      <div class="quick-buttons">

        <button
          data-view="products"
          type="button"
          class="quick-button"
        >
          <span>◈</span>
          <strong>Produtos</strong>
          <small>Gerenciar catálogo</small>
        </button>

        <a
          href="/"
          class="quick-button"
        >
          <span>↗</span>
          <strong>Ver loja</strong>
          <small>Abrir vitrine</small>
        </a>

      </div>

    </section>
  `

  content
    .querySelectorAll('[data-view]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        state.activeView = button.dataset.view
        renderDashboard()
      })
    })
}

function metricCard(label, value, detail, icon) {
  return `
    <article class="metric-card">

      <div class="metric-top">
        <span>${label}</span>
        <b>${icon}</b>
      </div>

      <strong>${value}</strong>

      <small>${detail}</small>

    </article>

  `
}

function productRows(products) {
  if (!products.length) {
    return `
      <div class="empty-state">
        <div>◈</div>
        <strong>Nenhum produto cadastrado</strong>
        <p>Comece adicionando o primeiro produto ao catálogo.</p>
      </div>
    `
  }

  return `
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          ${products
            .map((product) => {
              const image = imageUrl(product.imagem_principal)

              return `
                <tr>

                  <td>

                    <div class="product-cell">

                      ${
                        image
                          ? `
                            <img
                              src="${escapeHtml(image)}"
                              alt="${escapeHtml(product.nome)}"
                            >
                          `
                          : `
                            <div class="product-placeholder">
                              ◈
                            </div>
                          `
                      }

                      <div>
                        <strong>
                          ${escapeHtml(product.nome)}
                        </strong>

                        <small>
                          ${escapeHtml(product.sku || 'Sem SKU')}
                        </small>
                      </div>

                    </div>

                  </td>

                  <td>
                    ${escapeHtml(product.categoria || '—')}
                  </td>

                  <td>
                    <strong class="price">
                      ${money(
                        product.preco_promocional ||
                        product.preco
                      )}
                    </strong>
                  </td>

                  <td>
                    <span class="stock ${
                      product.estoque <= product.estoque_minimo
                        ? 'low'
                        : ''
                    }">
                      ${product.estoque}
                    </span>
                  </td>

                  <td>
                    <span class="tag ${
                      product.ativo ? 'on' : 'off'
                    }">
                      ${product.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>

                </tr>
              `
            })
            .join('')}

        </tbody>

      </table>

    </div>
  `
}

function renderProducts(content) {
  const activeProducts = state.produtos.filter((product) => product.ativo)
  const inactiveProducts = state.produtos.filter((product) => !product.ativo)

  content.innerHTML = `

    <section class="page-heading">

      <div>
        <span class="eyebrow">Catálogo</span>
        <h2>Produtos</h2>
        <p>
          Cadastre, edite e acompanhe os produtos da Amanda.
        </p>
      </div>

      <span class="count-label">
        ${activeProducts.length} ativos
      </span>

    </section>

    <article class="panel product-editor">

      <div class="editor-heading">

        <div>
          <span class="eyebrow">Catálogo</span>
          <h3>Adicionar produto</h3>
        </div>

        <span class="editor-hint">
          Campos com * são obrigatórios
        </span>

      </div>

      <form id="product-form" class="product-form">

        <label>
          Produto *
          <input
            name="nome"
            placeholder="Ex.: Sérum Facial Vitamina C"
            required
          >
        </label>

        <label>
          Categoria *
          <select name="categoria_id" required>
            <option value="">Selecione</option>

            ${state.categorias
              .filter((category) => category.ativo)
              .map(
                (category) => `
                  <option value="${category.id}">
                    ${escapeHtml(category.nome)}
                  </option>
                `
              )
              .join('')}

          </select>
        </label>

        <label>
          Preço *
          <input
            name="preco"
            type="text"
            inputmode="decimal"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            step="0.01"
            min="0.01"
            placeholder="Ex.: 59,90"
            title="Informe o preço em reais. Exemplo: 59,90"
            required
          >
        </label>

        <label>
          Preço promocional
          <input
            name="preco_promocional"
            type="text"
            inputmode="decimal"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            step="0.01"
            min="0.01"
            placeholder="Ex.: 49,90"
            title="Deixe vazio ou informe um valor menor que o preço normal"
          >
        </label>

        <label>
          Estoque *
          <input
            name="estoque"
            type="number"
            min="0"
            placeholder="0"
            required
          >
        </label>

        <label>
          Estoque mínimo
          <input
            name="estoque_minimo"
            type="number"
            min="0"
            value="5"
          >
        </label>

        <label>
          SKU
          <input
            name="sku"
            placeholder="Código interno"
          >
        </label>

        <label class="wide-field">
          Imagem
          <input
            name="imagem"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          >
          <small>JPG, PNG ou WebP.</small>
        </label>

        <label class="wide-field">
          Descrição
          <textarea
            name="descricao"
            rows="3"
            placeholder="Descrição do produto"
          ></textarea>
        </label>

        <div class="form-actions">

          <button
            class="primary-button"
            type="submit"
          >
            Cadastrar produto <span>→</span>
          </button>

          <p class="form-message"></p>

        </div>

      </form>

    </article>

    <article class="panel product-list-panel">

      <div class="editor-heading">

        <div>
          <span class="eyebrow">Catálogo publicado</span>
          <h3>Produtos cadastrados</h3>
        </div>

        <span class="editor-hint">
          ${activeProducts.length} ativos
        </span>

      </div>

      ${productRows(activeProducts)}

      ${
        activeProducts.length
          ? `
            <div class="product-actions">
              ${activeProducts
                .map(
                  (product) => `
                    <div class="product-action-row">

                      <span>
                        ${escapeHtml(product.nome)}
                      </span>

                      <div>
                        <button
                          class="table-action"
                          data-edit-product="${product.id}"
                          type="button"
                        >
                          Editar
                        </button>

                        ${
                          product.ativo
                            ? `
                              <button
                                class="table-action danger"
                                data-delete-product="${product.id}"
                                type="button"
                              >
                                Desativar
                              </button>
                            `
                            : ''
                        }

                      </div>

                    </div>
                  `
                )
                .join('')}
            </div>
          `
          : ''
      }

    </article>

    <article class="panel archived-products-panel">
      <div class="editor-heading">
        <div>
          <span class="eyebrow">Arquivo</span>
          <h3>Produtos desativados</h3>
        </div>
        <span class="editor-hint">${inactiveProducts.length} itens</span>
      </div>

      ${inactiveProducts.length ? `
        <div class="product-actions archived-actions">
          ${inactiveProducts.map((product) => `
            <div class="product-action-row">
              <span>
                ${escapeHtml(product.nome)}
                <small>Produto inativo</small>
              </span>
              <div>
                <button class="table-action" data-edit-product="${product.id}" type="button">
                  Editar
                </button>
                <button class="table-action danger" data-permanent-delete-product="${product.id}" type="button">
                  Excluir definitivamente
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="archive-empty">Nenhum produto desativado.</div>'}
    </article>
  `

  content
    .querySelector('#product-form')
    .addEventListener('submit', handleProductCreate)

  content
    .querySelectorAll('[data-edit-product]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        editProduct(button.dataset.editProduct)
      })
    })

  content
    .querySelectorAll('[data-delete-product]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        deleteProduct(button.dataset.deleteProduct)
      })
    })

  content
    .querySelectorAll('[data-permanent-delete-product]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        deleteProductPermanently(button.dataset.permanentDeleteProduct)
      })
    })
}

async function handleProductCreate(event) {
  event.preventDefault()

  const form = event.currentTarget
  const message = form.querySelector('.form-message')
  const button = form.querySelector('button[type="submit"]')

  const regularPrice = normalizeMoneyInput(form.querySelector('[name="preco"]').value)
  const promotionalPrice = normalizeMoneyInput(form.querySelector('[name="preco_promocional"]').value)

  if (!regularPrice || (promotionalPrice && Number(promotionalPrice) >= Number(regularPrice))) {
    message.textContent = 'Confira os preços: a promoção deve ser menor que o preço normal.'
    return
  }

  form.querySelector('[name="preco"]').value = regularPrice
  form.querySelector('[name="preco_promocional"]').value = promotionalPrice
  const data = new FormData(form)

  try {
    button.disabled = true
    button.textContent = 'Salvando...'

    const editingId = form.dataset.editingId

    await api(
      editingId
        ? `/admin/produtos/${editingId}`
        : '/admin/produtos',
      {
        method: editingId ? 'PUT' : 'POST',
        body: data,
      }
    )

    message.textContent = editingId
      ? 'Produto atualizado com sucesso.'
      : 'Produto cadastrado com sucesso.'

    state.activeView = 'products'

    await loadDashboard()
  } catch (error) {
    message.textContent = error.message

    button.disabled = false
    button.innerHTML = editingId
      ? 'Salvar alterações <span>→</span>'
      : 'Cadastrar produto <span>→</span>'
  }
}

function normalizeMoneyInput(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/R\$\s?/g, '')
    .replace(',', '.')

  if (!normalized) return ''

  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : ''
}

function editProduct(id) {
  const product = state.produtos.find(
    (item) => String(item.id) === String(id)
  )

  if (!product) return

  const form = document.querySelector('#product-form')

  if (!form) return

  form.dataset.editingId = id

  form.querySelector('[name="nome"]').value =
    product.nome || ''

  form.querySelector('[name="categoria_id"]').value =
    product.categoria_id || ''

  form.querySelector('[name="preco"]').value =
    String(product.preco || '').replace('.', ',')

  form.querySelector('[name="preco_promocional"]').value =
    String(product.preco_promocional || '').replace('.', ',')

  form.querySelector('[name="estoque"]').value =
    product.estoque ?? 0

  form.querySelector('[name="estoque_minimo"]').value =
    product.estoque_minimo ?? 5

  form.querySelector('[name="sku"]').value =
    product.sku || ''

  form.querySelector('[name="descricao"]').value =
    product.descricao || ''

  form.querySelector(
    'button[type="submit"]'
  ).innerHTML = 'Salvar alterações <span>→</span>'

  form.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function deleteProduct(id) {
  if (
    !window.confirm(
      'Desativar este produto? Ele não será apagado do histórico.'
    )
  ) {
    return
  }

  try {
    await api(`/admin/produtos/${id}`, {
      method: 'DELETE',
    })

    await loadDashboard()

    state.activeView = 'products'
    renderDashboard()
  } catch (error) {
    window.alert(error.message)
  }
}

async function deleteProductPermanently(id) {
  if (!window.confirm('Excluir definitivamente este produto? Esta ação não pode ser desfeita.')) {
    return
  }

  try {
    await api(`/admin/produtos/${id}/permanente`, { method: 'DELETE' })
    await loadDashboard()
    state.activeView = 'products'
    renderDashboard()
  } catch (error) {
    window.alert(error.message)
  }
}

async function handleCategoryCreate(event) {
  event.preventDefault()

  const form = event.currentTarget
  const message = form.querySelector('.form-message')
  const button = form.querySelector('button[type="submit"]')

  try {
    button.disabled = true
    button.textContent = 'Salvando...'

    await api('/admin/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.elements.nome.value.trim(),
        descricao: form.elements.descricao.value.trim(),
      }),
    })

    state.activeView = 'categories'
    await loadDashboard()
  } catch (error) {
    message.textContent = error.message
    button.disabled = false
    button.textContent = 'Adicionar categoria'
  }
}

async function deleteCategory(id, name) {
  if (!window.confirm(`Remover a categoria "${name}"?`)) return

  try {
    await api(`/admin/categorias/${id}`, { method: 'DELETE' })
    state.activeView = 'categories'
    await loadDashboard()
  } catch (error) {
    window.alert(error.message)
  }
}

function renderCategories(content) {
  content.innerHTML = `

    <section class="page-heading">

      <div>
        <span class="eyebrow">Organização</span>
        <h2>Categorias</h2>
        <p>
          Categorias utilizadas para organizar seu catálogo.
        </p>
      </div>

      <span class="count-label">
        ${state.categorias.length} categorias
      </span>

    </section>

    <article class="panel category-editor">

      <div class="editor-heading">
        <div>
          <span class="eyebrow">Catálogo</span>
          <h3>Adicionar categoria</h3>
        </div>
        <span class="editor-hint">Organize seus produtos</span>
      </div>

      <form id="category-form" class="category-form">
        <label>
          Nome da categoria *
          <input name="nome" maxlength="100" placeholder="Ex.: Acessórios" required>
        </label>

        <label>
          Descrição
          <input name="descricao" maxlength="255" placeholder="Ex.: Itens para complementar sua beleza">
        </label>

        <div class="form-actions">
          <button class="primary-button" type="submit">Adicionar categoria <span>→</span></button>
          <p class="form-message"></p>
        </div>
      </form>
    </article>

    <article class="panel full-panel">

      ${
        state.categorias.length
          ? `
            <div class="category-list">

              ${state.categorias
                .map(
                  (category) => `
                    <div class="category-row">

                      <span class="category-mark">
                        ${escapeHtml(
                          category.nome.slice(0, 1)
                        )}
                      </span>

                      <div class="category-info">

                        <strong>
                          ${escapeHtml(category.nome)}
                        </strong>

                        <small>
                          ${escapeHtml(
                            category.descricao ||
                              'Sem descrição'
                          )}
                        </small>

                        <span class="category-slug">
                          /${escapeHtml(category.slug || '')}
                        </span>

                      </div>

                      <div class="category-row-actions">
                        <span class="tag ${
                          category.ativo
                            ? 'on'
                            : 'off'
                        }">
                          ${
                            category.ativo
                              ? 'Ativa'
                              : 'Inativa'
                          }
                        </span>

                        <button
                          class="table-action danger"
                          data-delete-category="${category.id}"
                          data-category-name="${escapeHtml(category.nome)}"
                          type="button"
                        >
                          Remover
                        </button>
                      </div>

                    </div>
                  `
                )
                .join('')}

            </div>
          `
          : `
            <div class="empty-state">
              <div>◇</div>
              <strong>Nenhuma categoria cadastrada</strong>
              <p>
                Cadastre categorias no banco para organizar seus produtos.
              </p>
            </div>
          `
      }

    </article>
  `

  content
    .querySelector('#category-form')
    .addEventListener('submit', handleCategoryCreate)

  content
    .querySelectorAll('[data-delete-category]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        deleteCategory(
          button.dataset.deleteCategory,
          button.dataset.categoryName
        )
      })
    })
}

function dateTime(value) {
  if (!value) return 'Sem compras'
  return new Date(value).toLocaleDateString('pt-BR')
}

function whatsappHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  const international = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${international}`
}

function orderStatus(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

async function loadClientHistory(id) {
  try {
    state.historicoCliente = await api(`/admin/clientes/${id}/historico`)
    renderDashboard()
  } catch (error) {
    window.alert(error.message)
  }
}

async function deleteClient(id, name) {
  if (!window.confirm(`Excluir o cliente "${name}"? Essa ação não pode ser desfeita.`)) return

  try {
    await api(`/admin/clientes/${id}`, { method: 'DELETE' })
    state.historicoCliente = null
    await loadDashboard()
  } catch (error) {
    window.alert(error.message)
  }
}

function renderClientHistory(history) {
  if (!history) return ''

  const { cliente, pedidos } = history

  return `
    <article class="panel client-history-panel">
      <div class="editor-heading">
        <div>
          <span class="eyebrow">Histórico do cliente</span>
          <h3>${escapeHtml(cliente.nome)}</h3>
          <p class="client-history-contact">
            ${escapeHtml(cliente.email)}${cliente.telefone ? ` · ${escapeHtml(cliente.telefone)}` : ''}
          </p>
        </div>
        <button class="table-action" data-close-history type="button">Fechar</button>
      </div>

      <form class="client-note-form" data-client-note-form="${cliente.id}">
        <label for="client-note-${cliente.id}">Anotação interna</label>
        <textarea id="client-note-${cliente.id}" name="anotacao" maxlength="5000" rows="3" placeholder="Endereço, preferência ou observação importante...">${escapeHtml(cliente.anotacao_admin || '')}</textarea>
        <div class="client-note-actions">
          <button class="table-action" type="submit">Salvar anotação</button>
          <span class="form-message" role="status"></span>
        </div>
      </form>

      ${pedidos.length ? pedidos.map((pedido) => `
        <div class="order-history-item">
          <div class="order-history-top">
            <div>
              <strong>${escapeHtml(pedido.numero_pedido)}</strong>
              <small>${dateTime(pedido.criado_em)} · ${escapeHtml(orderStatus(pedido.status))}</small>
            </div>
            <strong class="history-total">${money(pedido.total)}</strong>
          </div>
          <div class="order-items">
            ${(pedido.itens || []).map((item) => `
              <span>${escapeHtml(item.nome_produto)} × ${item.quantidade} <b>${money(item.subtotal)}</b></span>
            `).join('')}
          </div>
        </div>
      `).join('') : `
        <div class="empty-state compact-empty">
          <strong>Nenhuma compra registrada</strong>
          <p>Este cliente ainda não possui pedidos.</p>
        </div>
      `}
    </article>
  `
}

function renderClients(content) {
  content.innerHTML = `
    <section class="page-heading">
      <div>
        <span class="eyebrow">Relacionamento</span>
        <h2>Clientes</h2>
        <p>Veja quem se cadastrou, quanto comprou e o histórico de pedidos.</p>
      </div>
      <span class="count-label">${state.clientes.length} clientes</span>
    </section>

    <article class="panel clients-panel">
      ${state.clientes.length ? `
        <div class="clients-desktop table-wrap">
          <table class="clients-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contato</th>
                <th>Pedidos</th>
                <th>Total comprado</th>
                <th>Última compra</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${state.clientes.map((client) => `
                <tr>
                  <td>
                    <div class="client-cell">
                      ${client.foto_url ? `<img src="${escapeHtml(client.foto_url)}" alt="">` : '<span class="client-avatar">○</span>'}
                      <div>
                        <strong>${escapeHtml(client.nome)}</strong>
                        <small>Desde ${dateTime(client.criado_em)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>${escapeHtml(client.email)}</strong>
                    ${client.telefone
                      ? `<a class="client-phone" href="${whatsappHref(client.telefone)}" target="_blank" rel="noreferrer" aria-label="Conversar com ${escapeHtml(client.nome)} pelo WhatsApp">${escapeHtml(client.telefone)}</a>`
                      : '<small>Sem telefone</small>'}
                  </td>
                  <td><strong>${Number(client.total_pedidos || 0)}</strong></td>
                  <td><strong class="price">${money(client.total_gasto)}</strong></td>
                  <td>${dateTime(client.ultima_compra)}</td>
                  <td>
                    <button class="table-action" data-client-history="${client.id}" type="button">
                      Ver histórico
                    </button>
                    <button class="table-action danger" data-delete-client="${client.id}" data-client-name="${escapeHtml(client.nome)}" type="button">
                      Excluir
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="clients-mobile">
          ${state.clientes.map((client) => `
            <article class="client-card">
              <div class="client-card-header">
                <div class="client-cell">
                  ${client.foto_url ? `<img src="${escapeHtml(client.foto_url)}" alt="">` : '<span class="client-avatar">○</span>'}
                  <div>
                    <strong>${escapeHtml(client.nome)}</strong>
                    <small>Desde ${dateTime(client.criado_em)}</small>
                  </div>
                </div>
                <span class="tag ${client.ativo ? 'on' : 'off'}">${client.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>

              <div class="client-card-contact">
                <span>${escapeHtml(client.email)}</span>
                ${client.telefone
                  ? `<a class="client-phone" href="${whatsappHref(client.telefone)}" target="_blank" rel="noreferrer" aria-label="Conversar com ${escapeHtml(client.nome)} pelo WhatsApp">${escapeHtml(client.telefone)}</a>`
                  : '<span>Sem telefone</span>'}
              </div>

              <div class="client-card-stats">
                <div><small>Pedidos</small><strong>${Number(client.total_pedidos || 0)}</strong></div>
                <div><small>Total comprado</small><strong class="price">${money(client.total_gasto)}</strong></div>
                <div><small>Última compra</small><strong>${dateTime(client.ultima_compra)}</strong></div>
              </div>

              <button class="table-action client-history-button" data-client-history="${client.id}" type="button">
                Ver histórico
              </button>
              <button class="table-action danger client-delete-button" data-delete-client="${client.id}" data-client-name="${escapeHtml(client.nome)}" type="button">
                Excluir cliente
              </button>
            </article>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div>○</div>
          <strong>Nenhum cliente cadastrado</strong>
          <p>Os clientes aparecerão aqui assim que criarem uma conta.</p>
        </div>
      `}
    </article>

    ${renderClientHistory(state.historicoCliente)}
  `

  content.querySelectorAll('[data-client-history]').forEach((button) => {
    button.addEventListener('click', () => loadClientHistory(button.dataset.clientHistory))
  })

  content.querySelectorAll('[data-delete-client]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteClient(button.dataset.deleteClient, button.dataset.clientName)
    })
  })

  content.querySelector('[data-close-history]')?.addEventListener('click', () => {
    state.historicoCliente = null
    renderDashboard()
  })

  content.querySelector('[data-client-note-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const button = form.querySelector('button')
    const message = form.querySelector('.form-message')

    button.disabled = true
    button.textContent = 'Salvando...'

    try {
      await api(`/admin/clientes/${form.dataset.clientNoteForm}/anotacao`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anotacao: form.elements.anotacao.value }),
      })
      message.textContent = 'Anotação salva.'
    } catch (error) {
      message.textContent = error.message
    } finally {
      button.disabled = false
      button.textContent = 'Salvar anotação'
    }
  })
}

function logout() {
  localStorage.removeItem('amanda_admin_token')
  localStorage.removeItem('amanda_admin_user')

  state.token = null
  state.admin = null

  renderLogin()
}

if (state.token && state.admin) {
  loadDashboard()
} else {
  renderLogin()
}