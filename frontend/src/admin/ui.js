// Utilitários de interface do painel: escape, formatação pt-BR, toasts,
// diálogos de confirmação e estados (carregando, vazio, erro).
import { icon } from './icons.js'

const TIME_ZONE = 'America/Sao_Paulo'

export function esc(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[c])
}

export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function number(value) {
  return Number(value || 0).toLocaleString('pt-BR')
}

export function date(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })
}

export function dateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "2026-11-08" (dia no fuso da loja) -> "08/11/2026" */
export function dayLabel(isoDay) {
  const [y, m, d] = String(isoDay).split('-')
  return d && m && y ? `${d}/${m}/${y}` : isoDay
}

export function daysSince(value) {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return 0
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export function phoneLabel(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value || '—'
}

/** Aceita "1.234,56", "1234,56", "R$ 12,90" ou "12.90". */
export function parseMoney(value) {
  let text = String(value ?? '').replace(/R\$\s?/g, '').trim()
  if (!text) return null
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  const amount = Number(text)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN
}

export function moneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  return Number(value).toFixed(2).replace('.', ',')
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  // Fallback RFC 4122 v4
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function isEmailTecnico(email) {
  return /@cliente\.amanda\.local$/i.test(String(email || ''))
}

// ---------------------------------------------------------------
// Rótulos de status
// ---------------------------------------------------------------

export const ORDER_STATUS = {
  pendente: 'Pendente',
  aguardando_pagamento: 'Aguardando Pix',
  pago: 'Pago — separar',
  processando: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const PAYMENT_STATUS = {
  pendente: 'Pix pendente',
  processando: 'Processando',
  aprovado: 'Pix aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
}

const STATUS_TONE = {
  aguardando_pagamento: 'warning',
  pendente: 'warning',
  pago: 'info',
  processando: 'info',
  enviado: 'info',
  entregue: 'success',
  aprovado: 'success',
  cancelado: 'muted',
  recusado: 'danger',
  estornado: 'muted',
}

const STATUS_ICON = { warning: 'clock', info: 'arrowRight', success: 'check', danger: 'alert', muted: 'x' }

export function statusBadge(status, kind = 'order') {
  const labels = kind === 'payment' ? PAYMENT_STATUS : ORDER_STATUS
  const tone = STATUS_TONE[status] || 'muted'
  const label = labels[status] || status || 'Indisponível'
  return `<span class="badge badge-${tone}">${icon(STATUS_ICON[tone], 14)}${esc(label)}</span>`
}

export function comingSoon(label = 'Em breve') {
  return `<span class="badge badge-soon">${esc(label)}</span>`
}

// ---------------------------------------------------------------
// Estados de tela
// ---------------------------------------------------------------

export function skeleton({ rows = 5, cards = 0 } = {}) {
  const cardHtml = cards
    ? `<div class="kpi-grid">${'<div class="card skeleton-card"><span class="sk sk-line w40"></span><span class="sk sk-line w70 tall"></span><span class="sk sk-line w30"></span></div>'.repeat(cards)}</div>`
    : ''
  const rowHtml = '<div class="sk-row"><span class="sk sk-line w30"></span><span class="sk sk-line w50"></span><span class="sk sk-line w20"></span></div>'.repeat(rows)
  return `<div class="skeleton" aria-busy="true" aria-label="Carregando">${cardHtml}<div class="card">${rowHtml}</div></div>`
}

export function emptyState(title, text = '', action = '') {
  return `<div class="state state-empty">${icon('inbox', 32)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`
}

export function errorState(message, retryId = 'retry') {
  return `<div class="state state-error" role="alert">${icon('alert', 32)}<h3>Não foi possível carregar</h3><p>${esc(message)}</p><button class="btn" type="button" data-action="${retryId}">${icon('refresh', 16)}Tentar novamente</button></div>`
}

// ---------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------

export function toast(message, type = 'success') {
  let region = document.querySelector('#toast-region')
  if (!region) {
    region = document.createElement('div')
    region.id = 'toast-region'
    region.className = 'toast-region'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'false')
    document.body.append(region)
  }
  const item = document.createElement('div')
  item.className = `toast toast-${type}`
  item.setAttribute('role', type === 'error' ? 'alert' : 'status')
  item.innerHTML = `${icon(type === 'error' ? 'alert' : 'check', 18)}<span>${esc(message)}</span>`
  region.append(item)
  setTimeout(() => item.classList.add('leaving'), type === 'error' ? 6500 : 3800)
  setTimeout(() => item.remove(), type === 'error' ? 7000 : 4300)
}

// ---------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------

/**
 * Abre um <dialog> modal. `render(body)` preenche o conteúdo.
 * Retorna { dialog, close }.
 */
export function openDialog({ title, size = 'md', content = '', onClose } = {}) {
  const dialog = document.createElement('dialog')
  dialog.className = `dialog dialog-${size}`
  const titleId = `dlg-${uuid().slice(0, 8)}`
  dialog.setAttribute('aria-labelledby', titleId)
  dialog.innerHTML = `
    <div class="dialog-head">
      <h2 id="${titleId}">${esc(title)}</h2>
      <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('x', 20)}</button>
    </div>
    <div class="dialog-body">${content}</div>`
  document.body.append(dialog)
  const close = (value) => {
    if (dialog.open) dialog.close()
    dialog.remove()
    onClose?.(value)
  }
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close() })
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) close()
  })
  dialog.showModal()
  const first = dialog.querySelector('.dialog-body input, .dialog-body select, .dialog-body textarea, .dialog-body button')
  first?.focus()
  return { dialog, body: dialog.querySelector('.dialog-body'), close }
}

/**
 * Confirmação de ação. Com `reason`, exige motivo (mín. 3 caracteres).
 * Resolve { ok: boolean, reason?: string }.
 */
export function confirmDialog({
  title, message, confirmLabel = 'Confirmar', danger = false, reason = false, reasonLabel = 'Motivo',
}) {
  return new Promise((resolve) => {
    let resolved = false
    const finish = (value) => { if (!resolved) { resolved = true; resolve(value) } }
    const { body, close } = openDialog({
      title,
      size: 'sm',
      onClose: () => finish({ ok: false }),
      content: `
        <form class="form" novalidate>
          <p class="dialog-text">${esc(message)}</p>
          ${reason ? `
            <div class="field">
              <label for="confirm-reason">${esc(reasonLabel)} <span class="req" aria-hidden="true">*</span></label>
              <textarea id="confirm-reason" name="reason" rows="3" maxlength="1000" required aria-describedby="confirm-reason-help"></textarea>
              <small id="confirm-reason-help" class="help">Obrigatório, de 3 a 1000 caracteres. Fica registrado no histórico.</small>
            </div>` : ''}
          <p class="form-error" role="alert" hidden></p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" type="button" data-close>Voltar</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit">${esc(confirmLabel)}</button>
          </div>
        </form>`,
    })
    const form = body.querySelector('form')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const text = reason ? form.elements.reason.value.trim() : undefined
      if (reason && (text.length < 3 || text.length > 1000)) {
        const error = form.querySelector('.form-error')
        error.textContent = 'Informe o motivo com pelo menos 3 caracteres.'
        error.hidden = false
        form.elements.reason.setAttribute('aria-invalid', 'true')
        form.elements.reason.focus()
        return
      }
      finish({ ok: true, reason: text })
      close()
    })
  })
}

/** Mostra erro de formulário de forma acessível. */
export function formError(form, message) {
  const el = form.querySelector('.form-error')
  if (!el) return toast(message, 'error')
  el.textContent = message
  el.hidden = !message
}

/** Desabilita o botão enquanto a ação roda, evitando cliques duplos. */
export async function withBusy(button, label, task) {
  const original = button?.innerHTML
  if (button) {
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(label)}`
  }
  try {
    return await task()
  } finally {
    if (button && button.isConnected) {
      button.disabled = false
      button.removeAttribute('aria-busy')
      button.innerHTML = original
    }
  }
}

export function debounce(fn, wait = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

export function whatsappLink(phone, message = '') {
  const digits = String(phone || '').replace(/\D/g, '')
  const full = digits.startsWith('55') && [12, 13].includes(digits.length)
    ? digits
    : [10, 11].includes(digits.length) ? `55${digits}` : null
  if (!full) return null
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

/** Campos de endereço reutilizados nos formulários de pedido e cliente. */
export function addressFields(prefix, address = {}, { required = true } = {}) {
  const req = required ? 'required' : ''
  const star = required ? ' <span class="req" aria-hidden="true">*</span>' : ''
  const f = (name, label, attrs = '', span = '') => `
    <div class="field ${span}">
      <label for="${prefix}-${name}">${label}${attrs.includes('optional') ? '' : star}</label>
      <input id="${prefix}-${name}" name="${name}" value="${esc(address[name] || '')}" ${attrs.includes('optional') ? '' : req} ${attrs.replace('optional', '')}>
    </div>`
  return `
    <div class="form-grid">
      ${f('nome_destinatario', 'Destinatário', 'maxlength="150" autocomplete="name"', 'span-2')}
      ${f('telefone', 'WhatsApp de entrega', 'inputmode="tel" maxlength="20" placeholder="(85) 99999-9999"')}
      ${f('cep', 'CEP', 'inputmode="numeric" maxlength="9" placeholder="00000-000"')}
      ${f('rua', 'Rua', 'maxlength="200"', 'span-2')}
      ${f('numero', 'Número', 'maxlength="20"')}
      ${f('complemento', 'Complemento', 'optional maxlength="100"')}
      ${f('bairro', 'Bairro', 'maxlength="100"')}
      ${f('cidade', 'Cidade', 'maxlength="100"')}
      ${f('estado', 'UF', 'maxlength="100" placeholder="CE"')}
    </div>`
}

export function readAddress(form) {
  const v = (name) => String(form.elements[name]?.value || '').trim()
  return {
    nome_destinatario: v('nome_destinatario'),
    telefone: v('telefone').replace(/\D/g, ''),
    cep: v('cep').replace(/\D/g, ''),
    rua: v('rua'),
    numero: v('numero'),
    complemento: v('complemento'),
    bairro: v('bairro'),
    cidade: v('cidade'),
    estado: v('estado'),
  }
}

export function validateAddress(a) {
  if (a.nome_destinatario.length < 2) return 'Informe o nome do destinatário.'
  if (a.telefone.length < 10 || a.telefone.length > 13) return 'Informe um WhatsApp com DDD (10 ou 11 dígitos).'
  if (a.cep.length !== 8) return 'O CEP precisa ter 8 dígitos.'
  if (a.rua.length < 2) return 'Informe a rua.'
  if (!a.numero) return 'Informe o número.'
  if (a.bairro.length < 2) return 'Informe o bairro.'
  if (a.cidade.length < 2) return 'Informe a cidade.'
  if (a.estado.length < 2) return 'Informe a UF.'
  return ''
}
