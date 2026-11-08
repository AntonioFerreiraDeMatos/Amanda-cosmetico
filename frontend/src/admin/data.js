// Cache curto de listas usadas em várias telas (produtos, categorias, clientes).
import { api } from './api.js'
import { esc } from './ui.js'

const cache = new Map()
const TTL = 60 * 1000

async function cached(key, loader) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  const value = await loader()
  cache.set(key, { at: Date.now(), value })
  return value
}

export function invalidate(...keys) {
  if (!keys.length) cache.clear()
  keys.forEach((k) => cache.delete(k))
}

export const getProdutos = () => cached('produtos', async () => (await api('/admin/produtos')).produtos || [])
export const getCategorias = () => cached('categorias', async () => (await api('/admin/categorias')).categorias || [])
export const getClientes = () => cached('clientes', async () => (await api('/admin/clientes')).clientes || [])

// ---------------------------------------------------------------
// Seletor de período (7/30/90/personalizado) — usado no dashboard e faturamento
// ---------------------------------------------------------------

const PERIOD_KEY = 'amanda_admin_periodo'

export function loadPeriod() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY) || 'null')
    if (saved?.periodo) return saved
  } catch { /* sem armazenamento */ }
  return { periodo: '30', inicio: '', fim: '' }
}

export function savePeriod(value) {
  try { localStorage.setItem(PERIOD_KEY, JSON.stringify(value)) } catch { /* sem armazenamento */ }
}

export function periodQuery(p) {
  const q = new URLSearchParams({ periodo: p.periodo })
  if (p.periodo === 'personalizado') {
    q.set('inicio', p.inicio)
    q.set('fim', p.fim)
  }
  return q.toString()
}

export function periodPicker(p, id = 'period') {
  const opt = (v, l) => `<button type="button" class="seg-btn" data-period="${v}" aria-pressed="${p.periodo === v}">${l}</button>`
  return `
    <form class="period-picker" data-period-form="${id}" aria-label="Período">
      <div class="segmented" role="group" aria-label="Escolha o período">
        ${opt('7', '7 dias')}${opt('30', '30 dias')}${opt('90', '90 dias')}${opt('personalizado', 'Personalizado')}
      </div>
      <div class="period-custom" ${p.periodo === 'personalizado' ? '' : 'hidden'}>
        <label class="sr-only" for="${id}-inicio">Data inicial</label>
        <input type="date" id="${id}-inicio" name="inicio" value="${esc(p.inicio)}">
        <span aria-hidden="true">até</span>
        <label class="sr-only" for="${id}-fim">Data final</label>
        <input type="date" id="${id}-fim" name="fim" value="${esc(p.fim)}">
        <button class="btn btn-sm" type="submit">Aplicar</button>
      </div>
    </form>`
}

/** Liga o seletor: chama onChange(novoPeriodo) quando o período muda. */
export function bindPeriodPicker(root, current, onChange) {
  const form = root.querySelector('[data-period-form]')
  if (!form) return
  form.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-period]')
    if (!btn) return
    const value = btn.dataset.period
    form.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
    const custom = form.querySelector('.period-custom')
    custom.hidden = value !== 'personalizado'
    if (value === 'personalizado') {
      form.elements.inicio.focus()
      return
    }
    const next = { periodo: value, inicio: '', fim: '' }
    savePeriod(next)
    onChange(next)
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const inicio = form.elements.inicio.value
    const fim = form.elements.fim.value
    if (!inicio || !fim) {
      form.elements[inicio ? 'fim' : 'inicio'].focus()
      return
    }
    if (inicio > fim) {
      form.elements.fim.setCustomValidity('A data final precisa ser igual ou posterior à inicial.')
      form.elements.fim.reportValidity()
      form.elements.fim.setCustomValidity('')
      return
    }
    const next = { periodo: 'personalizado', inicio, fim }
    savePeriod(next)
    onChange(next)
  })
  return current
}
