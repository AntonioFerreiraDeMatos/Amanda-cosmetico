import { api } from '../api.js'
import { icon } from '../icons.js'
import { mountLineChart, barList } from '../charts.js'
import { loadPeriod, periodPicker, bindPeriodPicker, periodQuery } from '../data.js'
import {
  esc, money, number, dateTime, daysSince, dayLabel, statusBadge, skeleton, errorState, emptyState,
} from '../ui.js'

const DIAS_KEY = 'amanda_admin_dias_parado'

function diasParado() {
  try {
    const value = Number(localStorage.getItem(DIAS_KEY))
    return Number.isInteger(value) && value >= 1 && value <= 60 ? value : 3
  } catch { return 3 }
}

function variation(value, { invert = false, suffix = '%' } = {}) {
  if (value === null || value === undefined) {
    return '<span class="delta delta-flat">Sem base de comparação</span>'
  }
  const up = value > 0
  const flat = value === 0
  const good = flat ? null : (invert ? !up : up)
  const cls = flat ? 'delta-flat' : good ? 'delta-up' : 'delta-down'
  const ic = flat ? 'minus' : up ? 'arrowUp' : 'arrowDown'
  const sign = up ? '+' : ''
  return `<span class="delta ${cls}">${icon(ic, 14)}${sign}${String(value).replace('.', ',')}${suffix} <span class="delta-ref">vs. período anterior</span></span>`
}

function kpi(label, value, delta, ic, hint = '') {
  return `
    <article class="card kpi">
      <div class="kpi-head"><span class="kpi-icon">${icon(ic, 18)}</span><h3>${esc(label)}</h3></div>
      <p class="kpi-value">${value}</p>
      ${delta}
      ${hint ? `<small class="kpi-hint">${esc(hint)}</small>` : ''}
    </article>`
}

function attentionCard({ tone, ic, count, title, text, href, action, button }) {
  const done = count === 0
  return `
    <article class="attention-card ${done ? 'is-done' : `tone-${tone}`}">
      <span class="attention-icon">${icon(done ? 'check' : ic, 20)}</span>
      <div class="attention-text">
        <strong>${done ? 'Tudo em dia' : `${number(count)} ${esc(title)}`}</strong>
        <small>${esc(done ? text.done : text.pending)}</small>
      </div>
      ${done ? '' : href
        ? `<a class="btn btn-sm" href="${href}">${esc(action)}${icon('arrowRight', 14)}</a>`
        : `<button class="btn btn-sm" type="button" data-action="${button}">${esc(action)}${icon('arrowRight', 14)}</button>`}
    </article>`
}

export async function render(root) {
  let period = loadPeriod()
  const dias = diasParado()

  async function load() {
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Visão geral</h1><p class="muted">O que precisa da sua atenção e como a loja está indo.</p></div>
      </div>
      <section aria-labelledby="att-title" class="section">
        <h2 id="att-title" class="section-title">Precisa da sua atenção hoje</h2>
        <div id="attention">${skeleton({ rows: 2 })}</div>
      </section>
      <section aria-labelledby="perf-title" class="section">
        <div class="section-head">
          <h2 id="perf-title" class="section-title">Desempenho</h2>
          ${periodPicker(period, 'dash')}
        </div>
        <div id="performance">${skeleton({ cards: 5, rows: 4 })}</div>
      </section>
      <div class="grid-2 section" id="lists">${skeleton({ rows: 4 })}</div>`

    bindPeriodPicker(root, period, (next) => { period = next; loadPerformance() })
    loadAttention()
    loadPerformance()
    loadLists()
  }

  async function loadAttention() {
    const box = root.querySelector('#attention')
    try {
      const data = await api(`/admin/relatorios/atencao?dias_parado=${dias}`)
      box.innerHTML = `
        <div class="attention-grid">
          ${attentionCard({
            tone: 'warning', ic: 'clock', count: data.aguardando_pix.total, title: 'aguardando Pix',
            text: { pending: 'Confira o recebimento e confirme o pagamento.', done: 'Nenhum Pix aguardando conferência.' },
            href: '#/pagamentos', action: 'Conferir Pix',
          })}
          ${attentionCard({
            tone: 'info', ic: 'box', count: data.pagos_para_separar.total, title: 'pagos para separar',
            text: { pending: 'Pedidos pagos esperando separação.', done: 'Nenhum pedido pago esperando.' },
            href: '#/pedidos?status=pago', action: 'Separar pedidos',
          })}
          ${attentionCard({
            tone: 'danger', ic: 'alert', count: data.estoque_baixo.total, title: 'com estoque baixo',
            text: { pending: 'Produtos no estoque mínimo ou abaixo.', done: 'Nenhum produto com estoque baixo.' },
            href: '#/estoque?filtro=baixo', action: 'Repor estoque',
          })}
          ${attentionCard({
            tone: 'warning', ic: 'truck', count: data.parados.total, title: `parados há +${dias} dias`,
            text: { pending: 'Pedidos sem movimentação recente.', done: `Nenhum pedido parado há mais de ${dias} dias.` },
            button: 'show-stalled', action: 'Ver pedidos',
          })}
        </div>
        <div class="attention-settings">
          <label for="dias-parado">Considerar pedido parado após</label>
          <select id="dias-parado">${[1, 2, 3, 5, 7, 10, 15].map((d) => `<option value="${d}" ${d === dias ? 'selected' : ''}>${d} dia(s)</option>`).join('')}</select>
        </div>
        <div id="stalled" class="card" hidden>
          <h3 class="card-title">Pedidos parados há mais de ${dias} dia(s)</h3>
          ${data.parados.pedidos.length ? `
            <ul class="mini-list">${data.parados.pedidos.map((p) => `
              <li><a href="#/pedidos/${Number(p.id)}"><strong>${esc(p.numero_exibicao)}</strong> · ${esc(p.cliente_nome)}</a>
                ${statusBadge(p.status)} <small class="muted">sem movimento há ${daysSince(p.atualizado_em)} dia(s)</small></li>`).join('')}</ul>
            ${data.parados.total > data.parados.pedidos.length ? `<p class="muted">Mostrando ${data.parados.pedidos.length} de ${data.parados.total}.</p>` : ''}`
            : '<p class="muted">Nenhum pedido parado.</p>'}
        </div>`
      box.querySelector('#dias-parado').addEventListener('change', (e) => {
        try { localStorage.setItem(DIAS_KEY, e.target.value) } catch { /* sem armazenamento */ }
        render(root)
      })
      box.querySelector('[data-action="show-stalled"]')?.addEventListener('click', () => {
        const panel = box.querySelector('#stalled')
        panel.hidden = !panel.hidden
        if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch (error) {
      box.innerHTML = errorState(error.message, 'retry-attention')
      box.querySelector('[data-action="retry-attention"]').addEventListener('click', loadAttention)
    }
  }

  async function loadPerformance() {
    const box = root.querySelector('#performance')
    box.innerHTML = skeleton({ cards: 5, rows: 4 })
    try {
      const q = periodQuery(period)
      const [vendas, pedidos, clientes] = await Promise.all([
        api(`/admin/relatorios/vendas?${q}`),
        api(`/admin/relatorios/pedidos?${q}`),
        api(`/admin/relatorios/clientes?${q}`),
      ])
      const v = vendas.totais
      const p = pedidos.totais
      const c = clientes.totais
      const per = vendas.periodo
      box.innerHTML = `
        <p class="muted period-label">De ${dayLabel(per.inicio)} a ${dayLabel(per.fim)} · comparado com ${dayLabel(per.anterior.inicio)} a ${dayLabel(per.anterior.fim)}</p>
        <div class="kpi-grid">
          ${kpi('Faturamento', money(v.atual.faturamento), variation(v.variacao.faturamento), 'chart', 'Pix aprovados no período')}
          ${kpi('Pedidos', number(p.atual.nao_cancelados), variation(p.variacao.nao_cancelados), 'cart', 'Criados, sem cancelados')}
          ${kpi('Ticket médio', money(v.atual.ticket_medio), variation(v.variacao.ticket_medio), 'tag', 'Faturamento ÷ pedidos pagos')}
          ${kpi('Clientes novos', number(c.atual.novos), variation(c.variacao.novos), 'users', `${number(c.atual.recorrentes)} recorrente(s) compraram`)}
          ${kpi('Conversão do Pix', `${String(p.atual.taxa_pagamento_aprovado).replace('.', ',')}%`, variation(p.variacao.taxa_pagamento_aprovado), 'check', 'Pedidos do período com Pix aprovado')}
        </div>
        <div class="grid-2-1">
          <article class="card">
            <h3 class="card-title">Faturamento por dia</h3>
            <div id="sales-chart"></div>
          </article>
          <article class="card">
            <h3 class="card-title">Pedidos por status</h3>
            ${pedidos.por_status.some((s) => s.total)
              ? barList(pedidos.por_status.filter((s) => s.status !== 'pendente').map((s) => ({
                label: s.rotulo, value: s.total, href: `#/pedidos?status=${s.status}`,
              })), { format: number })
              : emptyState('Nenhum pedido no período')}
          </article>
        </div>
        <article class="card">
          <h3 class="card-title">Top 5 produtos no período</h3>
          ${vendas.top_produtos.length
            ? barList(vendas.top_produtos.map((t) => ({
              label: t.nome, value: t.unidades, display: `${number(t.unidades)} un. · ${money(t.faturamento)}`,
            })))
            : emptyState('Nenhuma venda aprovada no período')}
        </article>`
      mountLineChart(box.querySelector('#sales-chart'), vendas.serie.map((d) => ({
        x: d.data, y: d.faturamento, extra: `${d.pedidos_pagos} pedido(s) pago(s)`,
      })), { format: money, label: 'Faturamento', tableCaption: 'Faturamento por dia' })
    } catch (error) {
      box.innerHTML = errorState(error.message, 'retry-perf')
      box.querySelector('[data-action="retry-perf"]').addEventListener('click', loadPerformance)
    }
  }

  async function loadLists() {
    const box = root.querySelector('#lists')
    try {
      const { dashboard } = await api('/admin/dashboard')
      box.innerHTML = `
        <article class="card">
          <div class="card-head"><h3 class="card-title">Últimos pedidos</h3><a href="#/pedidos" class="link">Ver todos</a></div>
          ${dashboard.pedidosRecentes.length ? `
            <ul class="mini-list">${dashboard.pedidosRecentes.map((p) => `
              <li>
                <a href="#/pedidos/${Number(p.id)}"><strong>${esc(p.numero_exibicao)}</strong> · ${esc(p.cliente)}</a>
                <span class="mini-meta">${statusBadge(p.status)} <b>${money(p.total)}</b> <small class="muted">${dateTime(p.criado_em)}</small></span>
              </li>`).join('')}</ul>`
            : emptyState('Nenhum pedido ainda')}
        </article>
        <article class="card">
          <div class="card-head"><h3 class="card-title">Alertas de estoque</h3><a href="#/estoque" class="link">Ir para estoque</a></div>
          ${dashboard.estoqueBaixo.length ? `
            <ul class="mini-list">${dashboard.estoqueBaixo.map((p) => `
              <li>
                <span><strong>${esc(p.nome)}</strong> <small class="muted">${esc(p.categoria)}</small></span>
                <span class="mini-meta"><span class="badge ${Number(p.estoque) === 0 ? 'badge-danger' : 'badge-warning'}">${icon('alert', 14)}${number(p.estoque)} un. (mín. ${number(p.estoque_minimo)})</span></span>
              </li>`).join('')}</ul>`
            : emptyState('Estoque em dia', 'Nenhum produto ativo no estoque mínimo.')}
        </article>`
    } catch (error) {
      box.innerHTML = errorState(error.message, 'retry-lists')
      box.querySelector('[data-action="retry-lists"]').addEventListener('click', loadLists)
    }
  }

  await load()
}
