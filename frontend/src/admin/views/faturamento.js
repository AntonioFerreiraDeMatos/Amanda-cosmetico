import { api, download } from '../api.js'
import { icon } from '../icons.js'
import { mountLineChart } from '../charts.js'
import { loadPeriod, periodPicker, bindPeriodPicker, periodQuery } from '../data.js'
import { esc, money, number, dayLabel, skeleton, errorState, toast, withBusy } from '../ui.js'

function delta(v) {
  if (v === null || v === undefined) return '<span class="delta delta-flat">Sem base de comparação</span>'
  const up = v > 0
  return `<span class="delta ${v === 0 ? 'delta-flat' : up ? 'delta-up' : 'delta-down'}">${icon(v === 0 ? 'minus' : up ? 'arrowUp' : 'arrowDown', 14)}${up ? '+' : ''}${String(v).replace('.', ',')}% <span class="delta-ref">vs. período anterior</span></span>`
}

export async function render(root) {
  let period = loadPeriod()
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Faturamento</h1><p class="muted">Pix aprovados por dia, no horário de Brasília.</p></div>
      <div class="page-actions"><button class="btn" type="button" data-action="export">${icon('download', 16)}Exportar pedidos do período</button></div>
    </div>
    <div class="section-head">${periodPicker(period, 'fat')}</div>
    <div id="fat">${skeleton({ cards: 3, rows: 6 })}</div>`
  bindPeriodPicker(root, period, (next) => { period = next; load() })
  root.querySelector('[data-action="export"]').addEventListener('click', (e) => withBusy(e.currentTarget, 'Gerando...', async () => {
    try { await download(`/admin/exportar/pedidos.csv?${periodQuery(period)}`, 'pedidos.csv'); toast('Planilha gerada.') } catch (error) { toast(error.message, 'error') }
  }))

  const box = root.querySelector('#fat')
  async function load() {
    box.innerHTML = skeleton({ cards: 3, rows: 6 })
    try {
      const data = await api(`/admin/relatorios/vendas?${periodQuery(period)}`)
      const t = data.totais
      const best = data.serie.reduce((a, b) => (b.faturamento > (a?.faturamento ?? -1) ? b : a), null)
      box.innerHTML = `
        <p class="muted period-label">De ${dayLabel(data.periodo.inicio)} a ${dayLabel(data.periodo.fim)} (${data.periodo.dias} dias)</p>
        <div class="kpi-grid kpi-grid-3">
          <article class="card kpi"><h3>Faturamento</h3><p class="kpi-value">${money(t.atual.faturamento)}</p>${delta(t.variacao.faturamento)}<small class="kpi-hint">Período anterior: ${money(t.anterior.faturamento)}</small></article>
          <article class="card kpi"><h3>Pedidos pagos</h3><p class="kpi-value">${number(t.atual.pedidos_pagos)}</p>${delta(t.variacao.pedidos_pagos)}</article>
          <article class="card kpi"><h3>Ticket médio</h3><p class="kpi-value">${money(t.atual.ticket_medio)}</p>${delta(t.variacao.ticket_medio)}${best && best.faturamento > 0 ? `<small class="kpi-hint">Melhor dia: ${dayLabel(best.data)} (${money(best.faturamento)})</small>` : ''}</article>
        </div>
        <article class="card"><h2 class="card-title">Faturamento por dia</h2><div id="fat-chart"></div></article>
        <article class="card">
          <h2 class="card-title">Produtos que mais faturaram</h2>
          ${data.top_produtos.length ? `<div class="table-scroll"><table class="table">
            <caption class="sr-only">Top produtos do período</caption>
            <thead><tr><th scope="col">Produto</th><th scope="col" class="num">Unidades</th><th scope="col" class="num">Faturamento</th></tr></thead>
            <tbody>${data.top_produtos.map((p) => `<tr><td data-label="Produto">${esc(p.nome)}</td><td data-label="Unidades" class="num">${number(p.unidades)}</td><td data-label="Faturamento" class="num">${money(p.faturamento)}</td></tr>`).join('')}</tbody>
          </table></div>` : '<p class="muted">Nenhuma venda aprovada no período.</p>'}
        </article>`
      mountLineChart(box.querySelector('#fat-chart'), data.serie.map((d) => ({
        x: d.data, y: d.faturamento, extra: `${d.pedidos_pagos} pago(s) · ${d.pedidos_criados} criado(s)`,
      })), { format: money, label: 'Faturamento', tableCaption: 'Faturamento por dia' })
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }
  await load()
}
