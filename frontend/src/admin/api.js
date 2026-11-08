// Cliente HTTP do painel. Token em localStorage (sessão de 8h no servidor).
import { resolveApiUrl } from '../api-url.js'

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV)

const TOKEN_KEY = 'amanda_admin_token'
const USER_KEY = 'amanda_admin_user'

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* modo privado */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key) } catch { /* modo privado */ }
}

export const session = {
  get token() { return safeGet(TOKEN_KEY) },
  get admin() {
    try { return JSON.parse(safeGet(USER_KEY) || 'null') } catch { return null }
  },
  save(token, admin) {
    safeSet(TOKEN_KEY, token)
    safeSet(USER_KEY, JSON.stringify(admin || null))
  },
  clear() {
    safeRemove(TOKEN_KEY)
    safeRemove(USER_KEY)
  },
  /** Expiração do JWT (somente leitura do payload, sem validar assinatura). */
  get expiresAt() {
    const token = this.token
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload.exp ? new Date(payload.exp * 1000) : null
    } catch {
      return null
    }
  },
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function parseBody(response) {
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) return {}
  try { return await response.json() } catch { return {} }
}

/**
 * api('/admin/pedidos', { method, body, idempotencyKey })
 * - body objeto -> JSON; FormData -> multipart.
 */
export async function api(path, { method = 'GET', body, idempotencyKey, headers = {} } = {}) {
  const finalHeaders = { ...headers }
  if (session.token) finalHeaders.Authorization = `Bearer ${session.token}`
  if (idempotencyKey) finalHeaders['Idempotency-Key'] = idempotencyKey
  let payload = body
  if (body && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers: finalHeaders, body: payload })
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique sua internet e tente novamente.', 0)
  }

  const data = await parseBody(response)
  if (response.status === 401 && path !== '/admin/login') {
    session.clear()
    window.dispatchEvent(new CustomEvent('admin:logout', { detail: 'expired' }))
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401)
  }
  if (!response.ok) {
    throw new ApiError(data.mensagem || `Erro ${response.status} ao falar com o servidor.`, response.status)
  }
  return data
}

/** Baixa um arquivo autenticado (CSV) e dispara o download no navegador. */
export async function download(path, fallbackName) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
    })
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0)
  }
  if (response.status === 401) {
    session.clear()
    window.dispatchEvent(new CustomEvent('admin:logout', { detail: 'expired' }))
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401)
  }
  if (!response.ok) {
    const data = await parseBody(response)
    throw new ApiError(data.mensagem || 'Não foi possível gerar o arquivo.', response.status)
  }
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] || fallbackName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Health check fica em /api/health (fora de /admin). */
export async function health() {
  const response = await fetch(`${API_URL}/health`, { cache: 'no-store' })
  const data = await parseBody(response)
  return { ok: response.ok, ...data }
}

export function imageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const origin = new URL(API_URL, window.location.origin).origin
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}
