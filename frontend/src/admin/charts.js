// Gráficos SVG sem dependências.
// Série única na cor da marca (validada: contraste >= 3:1 nos dois temas),
// linha 2px, grade discreta, tooltip com crosshair e alternância para tabela.
import { esc, dayLabel } from './ui.js'

function niceMax(value) {
  if (value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const f = value / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

/**
 * Monta um gráfico de linha em `container`.
 * points: [{ x: 'YYYY-MM-DD', y: number, extra?: string }]
 */
export function mountLineChart(container, points, { format = String, label = 'Valor', tableCaption = '' } = {}) {
  const W = 720
  const H = 240
  const pad = { top: 16, right: 16, bottom: 28, left: 64 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const max = niceMax(Math.max(0, ...points.map((p) => p.y)))
  const n = points.length
  const xAt = (i) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yAt = (v) => pad.top + innerH - (v / max) * innerH

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`).join(' ')
  const area = n ? `${path} L${xAt(n - 1).toFixed(1)},${yAt(0)} L${xAt(0).toFixed(1)},${yAt(0)} Z` : ''
  const total = points.reduce((s, p) => s + p.y, 0)

  container.innerHTML = `
    <div class="chart-wrap">
      <div class="chart-toolbar">
        <button class="btn btn-sm btn-ghost" type="button" data-chart-toggle aria-pressed="false">Ver como tabela</button>
      </div>
      <div class="chart-plot">
        <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(`${label}: total ${format(total)} em ${n} dia(s)`)}">
          ${ticks.map((t) => `
            <line class="chart-grid" x1="${pad.left}" x2="${W - pad.right}" y1="${yAt(t)}" y2="${yAt(t)}"/>
            <text class="chart-axis" x="${pad.left - 8}" y="${yAt(t) + 4}" text-anchor="end">${esc(format(t))}</text>`).join('')}
          ${points.map((p, i) => (i % labelEvery === 0 || i === n - 1)
            ? `<text class="chart-axis" x="${xAt(i)}" y="${H - 8}" text-anchor="middle">${esc(dayLabel(p.x).slice(0, 5))}</text>`
            : '').join('')}
          <path class="chart-area" d="${area}"/>
          <path class="chart-line" d="${path}"/>
          <line class="chart-cross" x1="0" x2="0" y1="${pad.top}" y2="${pad.top + innerH}" visibility="hidden"/>
          <circle class="chart-dot" r="5" visibility="hidden"/>
          <rect class="chart-hit" x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}"/>
        </svg>
        <div class="chart-tip" role="status" hidden></div>
      </div>
      <div class="chart-table" hidden>
        <table class="table table-compact">
          <caption class="sr-only">${esc(tableCaption || label)}</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col" class="num">${esc(label)}</th></tr></thead>
          <tbody>${points.map((p) => `<tr><td>${esc(dayLabel(p.x))}</td><td class="num">${esc(format(p.y))}${p.extra ? ` <small>${esc(p.extra)}</small>` : ''}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`

  const svg = container.querySelector('svg')
  const hit = container.querySelector('.chart-hit')
  const cross = container.querySelector('.chart-cross')
  const dot = container.querySelector('.chart-dot')
  const tip = container.querySelector('.chart-tip')

  function show(clientX) {
    if (!n) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * W
    const i = Math.max(0, Math.min(n - 1, Math.round(((x - pad.left) / innerW) * (n - 1))))
    const p = points[i]
    cross.setAttribute('x1', xAt(i))
    cross.setAttribute('x2', xAt(i))
    cross.setAttribute('visibility', 'visible')
    dot.setAttribute('cx', xAt(i))
    dot.setAttribute('cy', yAt(p.y))
    dot.setAttribute('visibility', 'visible')
    tip.hidden = false
    tip.innerHTML = `<strong>${esc(dayLabel(p.x))}</strong><span>${esc(format(p.y))}</span>${p.extra ? `<small>${esc(p.extra)}</small>` : ''}`
    const left = (xAt(i) / W) * rect.width
    tip.style.left = `${Math.min(Math.max(left, 70), rect.width - 70)}px`
  }
  function hide() {
    cross.setAttribute('visibility', 'hidden')
    dot.setAttribute('visibility', 'hidden')
    tip.hidden = true
  }
  hit.addEventListener('pointermove', (e) => show(e.clientX))
  hit.addEventListener('pointerdown', (e) => show(e.clientX))
  hit.addEventListener('pointerleave', hide)

  container.querySelector('[data-chart-toggle]').addEventListener('click', (event) => {
    const btn = event.currentTarget
    const showTable = btn.getAttribute('aria-pressed') !== 'true'
    btn.setAttribute('aria-pressed', String(showTable))
    btn.textContent = showTable ? 'Ver como gráfico' : 'Ver como tabela'
    container.querySelector('.chart-plot').hidden = showTable
    container.querySelector('.chart-table').hidden = !showTable
  })
}

/**
 * Barras horizontais (magnitude, série única) com rótulo e valor em texto.
 * items: [{ label, value, display?, href? }]
 */
export function barList(items, { format = String } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return `<ul class="bar-list">${items.map((item) => {
    const width = item.value > 0 ? Math.max(2, (item.value / max) * 100) : 0
    const labelHtml = item.href
      ? `<a href="${esc(item.href)}">${esc(item.label)}</a>`
      : esc(item.label)
    return `
      <li title="${esc(`${item.label}: ${item.display ?? format(item.value)}`)}">
        <div class="bar-meta"><span>${labelHtml}</span><strong>${esc(item.display ?? format(item.value))}</strong></div>
        <div class="bar-track"><span class="bar-fill" style="width:${width.toFixed(1)}%"></span></div>
      </li>`
  }).join('')}</ul>`
}
