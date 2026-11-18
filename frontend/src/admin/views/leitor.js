// Painel "Leitor de código de barras" da tela Estoque.
// Fluxo: escolhe Entrada / Saída / Contagem → bipa os produtos (pistola ou
// câmera) → confere a lista → confirma tudo de uma vez (uma transação só).

import { api } from '../api.js'
import { icon } from '../icons.js'
import { imageUrl } from '../api.js'
import { invalidate } from '../data.js'
import { esc, number, toast, uuid, withBusy, confirmDialog } from '../ui.js'
import { listenHardwareScanner, openCameraScanner, feedback, cleanCode } from '../scanner.js'

const DRAFT_KEY = 'amanda_leitor_sessao'

const MODOS = {
  entrada: { label: 'Entrada', help: 'Cada leitura soma 1 unidade. Use ao receber mercadoria.', motivo: 'Recebimento de mercadoria', icon: 'arrowUp' },
  saida: { label: 'Saída', help: 'Cada leitura retira 1 unidade. Use para avaria, uso interno ou brinde.', motivo: 'Saída manual', icon: 'arrowDown' },
  ajuste: { label: 'Contagem', help: 'Conte as peças: cada leitura soma 1 na contagem. Ao confirmar, o estoque passa a ser o número contado.', motivo: 'Contagem de inventário', icon: 'edit' },
}

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (d && MODOS[d.modo] && Array.isArray(d.itens)) return d
  } catch { /* ignore */ }
  return { modo: 'entrada', motivo: '', itens: [] }
}

function saveDraft(state) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ modo: state.modo, motivo: state.motivo, itens: state.itens }))
  } catch { /* ignore */ }
}

export function mountLeitor(container, { onDone, onUnknown } = {}) {
  const state = loadDraft()
  const cache = new Map() // código → produto (evita buscar de novo a cada bip)
  let busy = false

  container.innerHTML = `
    <section class="card scan-panel" aria-labelledby="scan-title">
      <div class="scan-head">
        <div>
          <h2 id="scan-title" class="card-title">${icon('scan', 18)} Leitor de código de barras</h2>
          <p class="muted small">Bipe com a pistola em qualquer lugar desta tela, digite o código ou use a câmera.</p>
        </div>
        <div class="segmented scan-modes" role="radiogroup" aria-label="Tipo de movimentação">
          ${Object.entries(MODOS).map(([k, m]) => `
            <label class="seg-btn"><input type="radio" name="scan-modo" value="${k}" ${state.modo === k ? 'checked' : ''}>${icon(m.icon, 14)} ${m.label}</label>`).join('')}
        </div>
      </div>
      <p class="scan-help" data-help></p>

      <form class="scan-input-row" autocomplete="off">
        <label class="sr-only" for="scan-code">Código de barras</label>
        <div class="scan-input-wrap">
          ${icon('scan', 18)}
          <input id="scan-code" data-scan-input inputmode="numeric" enterkeyhint="go" placeholder="Bipe ou digite o código e aperte Enter" maxlength="64">
          <span class="scan-pulse" aria-hidden="true"></span>
        </div>
        <button class="btn btn-primary" type="button" data-camera>${icon('camera', 16)}<span>Câmera</span></button>
      </form>

      <div class="scan-list" data-list aria-live="polite"></div>

      <div class="scan-footer" data-footer>
        <div class="field grow"><label for="scan-motivo">Motivo</label>
          <input id="scan-motivo" maxlength="1000" placeholder="Ex.: nota fiscal 1234 do fornecedor"></div>
        <div class="scan-footer-actions">
          <button class="btn btn-ghost" type="button" data-clear>Limpar lista</button>
          <button class="btn btn-primary btn-lg" type="button" data-confirm></button>
        </div>
      </div>
    </section>`

  const input = container.querySelector('#scan-code')
  const list = container.querySelector('[data-list]')
  const motivoInput = container.querySelector('#scan-motivo')
  const confirmBtn = container.querySelector('[data-confirm]')
  motivoInput.value = state.motivo

  function totalUnidades() {
    return state.itens.reduce((s, i) => s + i.quantidade, 0)
  }

  function previsto(item) {
    const atual = Number(item.produto.estoque)
    if (state.modo === 'ajuste') return item.quantidade
    return state.modo === 'entrada' ? atual + item.quantidade : atual - item.quantidade
  }

  function paint() {
    const modo = MODOS[state.modo]
    container.querySelector('[data-help]').textContent = modo.help
    container.querySelector('[data-footer]').hidden = !state.itens.length
    confirmBtn.innerHTML = `${icon('check', 16)} Confirmar ${modo.label.toLowerCase()} · ${number(state.itens.length)} produto(s), ${number(totalUnidades())} un.`

    if (!state.itens.length) {
      list.innerHTML = `
        <div class="scan-empty">
          <div class="scan-empty-art" aria-hidden="true">${icon('scan', 34)}</div>
          <strong>Pronto para ler</strong>
          <span class="muted small">Os produtos lidos aparecem aqui antes de você confirmar.</span>
        </div>`
      return
    }

    list.innerHTML = state.itens.map((item, index) => {
      const p = item.produto
      const novo = previsto(item)
      const invalido = novo < 0
      return `
        <article class="scan-item ${index === 0 ? 'is-new' : ''} ${invalido ? 'is-invalid' : ''}" data-id="${Number(p.id)}">
          ${p.imagem_principal
            ? `<img class="thumb thumb-sm" src="${esc(imageUrl(p.imagem_principal))}" alt="" loading="lazy">`
            : `<span class="thumb thumb-sm thumb-empty">${icon('image', 16)}</span>`}
          <div class="scan-item-info">
            <strong>${esc(p.nome)}</strong>
            <small class="muted">${esc(p.codigo_barras || p.sku || '')}${Number(p.ativo) === 1 ? '' : ' · desativado'}</small>
            <small class="scan-item-stock ${invalido ? 'is-error' : ''}">
              ${state.modo === 'ajuste' ? 'Sistema' : 'Estoque'}: ${number(p.estoque)} → <strong>${number(novo)}</strong>${invalido ? ' (insuficiente)' : ''}
            </small>
          </div>
          <div class="stepper" role="group" aria-label="Quantidade de ${esc(p.nome)}">
            <button type="button" class="btn btn-sm btn-icon" data-dec aria-label="Diminuir">−</button>
            <input type="number" min="${state.modo === 'ajuste' ? 0 : 1}" step="1" inputmode="numeric" value="${item.quantidade}" data-qty aria-label="Quantidade">
            <button type="button" class="btn btn-sm btn-icon" data-inc aria-label="Aumentar">+</button>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-icon" data-remove aria-label="Remover ${esc(p.nome)}">${icon('trash', 14)}</button>
        </article>`
    }).join('')
  }

  function commit() {
    saveDraft(state)
    paint()
  }

  async function findProduct(code) {
    if (cache.has(code)) return cache.get(code)
    const existing = state.itens.find((i) => i.produto.codigo_barras === code || i.produto.sku === code)
    if (existing) return existing.produto
    const data = await api(`/admin/produtos/codigo/${encodeURIComponent(code)}`)
    cache.set(code, data.produto)
    return data.produto
  }

  async function onCode(raw) {
    const code = cleanCode(raw)
    if (!code) return
    try {
      const produto = await findProduct(code)
      const item = state.itens.find((i) => Number(i.produto.id) === Number(produto.id))
      if (item) {
        item.quantidade += 1
        state.itens = [item, ...state.itens.filter((i) => i !== item)]
      } else {
        state.itens.unshift({ produto, quantidade: 1, chave: uuid() })
      }
      feedback(true)
      commit()
    } catch (error) {
      feedback(false)
      if (error.status === 404) {
        toast(`Código ${code} não cadastrado.`, 'error')
        onUnknown?.(code)
      } else {
        toast(error.message, 'error')
      }
    }
  }

  // Pistola em qualquer lugar da tela
  const stopHardware = listenHardwareScanner((code) => {
    if (!container.isConnected) return destroy()
    onCode(code)
  })
  function destroy() {
    stopHardware()
    window.removeEventListener('hashchange', onLeave)
  }
  function onLeave() {
    setTimeout(() => { if (!container.isConnected) destroy() }, 0)
  }
  window.addEventListener('hashchange', onLeave)

  container.querySelector('.scan-input-row').addEventListener('submit', (e) => {
    e.preventDefault()
    const code = input.value
    input.value = ''
    onCode(code)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const code = input.value
      input.value = ''
      onCode(code)
    }
  })

  container.querySelector('[data-camera]').addEventListener('click', () => {
    openCameraScanner({ continuous: true, title: `${MODOS[state.modo].label} pela câmera`, onCode: (c) => { onCode(c); return false } })
  })

  container.querySelectorAll('input[name="scan-modo"]').forEach((radio) => radio.addEventListener('change', () => {
    state.modo = radio.value
    if (!motivoInput.value || Object.values(MODOS).some((m) => m.motivo === motivoInput.value)) {
      motivoInput.value = MODOS[state.modo].motivo
      state.motivo = motivoInput.value
    }
    commit()
  }))

  motivoInput.addEventListener('input', () => {
    state.motivo = motivoInput.value
    saveDraft(state)
  })

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.scan-item')
    if (!row) return
    const item = state.itens.find((i) => String(i.produto.id) === row.dataset.id)
    if (!item) return
    const min = state.modo === 'ajuste' ? 0 : 1
    if (e.target.closest('[data-inc]')) item.quantidade += 1
    else if (e.target.closest('[data-dec]')) item.quantidade = Math.max(min, item.quantidade - 1)
    else if (e.target.closest('[data-remove]')) state.itens = state.itens.filter((i) => i !== item)
    else return
    commit()
  })

  list.addEventListener('change', (e) => {
    if (!e.target.matches('[data-qty]')) return
    const row = e.target.closest('.scan-item')
    const item = state.itens.find((i) => String(i.produto.id) === row.dataset.id)
    const min = state.modo === 'ajuste' ? 0 : 1
    const value = Math.floor(Number(e.target.value))
    item.quantidade = Number.isFinite(value) ? Math.min(100000, Math.max(min, value)) : min
    commit()
  })

  container.querySelector('[data-clear]').addEventListener('click', async () => {
    const { ok } = await confirmDialog({
      title: 'Limpar a lista?',
      message: 'Os produtos lidos nesta sessão serão descartados. Nada foi alterado no estoque ainda.',
      confirmLabel: 'Limpar',
      danger: true,
    })
    if (!ok) return
    state.itens = []
    commit()
  })

  confirmBtn.addEventListener('click', () => {
    if (busy) return
    const motivo = motivoInput.value.trim()
    if (motivo.length < 3) {
      toast('Informe o motivo (ex.: nota fiscal do fornecedor).', 'error')
      motivoInput.focus()
      return
    }
    const invalido = state.itens.find((i) => previsto(i) < 0)
    if (invalido) {
      toast(`Saída maior que o estoque de ${invalido.produto.nome}.`, 'error')
      return
    }
    busy = true
    withBusy(confirmBtn, 'Registrando…', async () => {
      try {
        const data = await api('/admin/estoque/lote', {
          method: 'POST',
          body: {
            tipo: state.modo,
            motivo,
            itens: state.itens.map((i) => ({ produto_id: Number(i.produto.id), quantidade: i.quantidade, chave: i.chave })),
          },
        })
        feedback(true)
        toast(data.reutilizado ? 'Este lote já tinha sido registrado.' : `Estoque atualizado: ${data.mensagem}`)
        state.itens = []
        cache.clear()
        invalidate('produtos')
        commit()
        onDone?.()
      } catch (error) {
        feedback(false)
        // Erro de regra (4xx): gera novas chaves para a próxima tentativa.
        if (error.status >= 400 && error.status < 500 && error.status !== 409) {
          state.itens.forEach((i) => { i.chave = uuid() })
          saveDraft(state)
        }
        toast(error.message, 'error')
      } finally {
        busy = false
      }
    })
  })

  if (!state.motivo) {
    state.motivo = MODOS[state.modo].motivo
    motivoInput.value = state.motivo
  }
  paint()

  return { destroy }
}
