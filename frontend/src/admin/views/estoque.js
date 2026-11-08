import { api, download } from '../api.js'
import { icon } from '../icons.js'
import { getProdutos, invalidate } from '../data.js'
import {
  esc, money, number, date, dateTime, skeleton, errorState, emptyState, toast, openDialog, formError,
  withBusy, uuid,
} from '../ui.js'

const TIPO_LABEL = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  baixa_pedido: 'Venda (pedido)',
  devolucao_pedido: 'Devolução (cancelamento)',
}

/**
 * Formulário de movimentação. A chave de idempotência é gerada uma vez por
 * formulário aberto: se a internet cair e você reenviar, o estoque não é
 * movimentado duas vezes.
 */
export function openMovement({ produtos, produtoId = '', onDone }) {
  let key = uuid()
  const lista = produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const { body, close } = openDialog({
    title: 'Movimentar estoque',
    content: `
      <form class="form" novalidate>
        <div class="field"><label for="mv-prod">Produto <span class="req" aria-hidden="true">*</span></label>
          <select id="mv-prod" name="produto_id" required><option value="">Selecione...</option>
            ${lista.map((p) => `<option value="${Number(p.id)}" ${String(p.id) === String(produtoId) ? 'selected' : ''}>${esc(p.nome)} — ${number(p.estoque)} un.${Number(p.ativo) === 1 ? '' : ' (desativado)'}</option>`).join('')}
          </select></div>
        <fieldset class="fieldset">
          <legend>Tipo de movimentação <span class="req" aria-hidden="true">*</span></legend>
          <div class="segmented" role="radiogroup">
            <label class="seg-btn"><input type="radio" name="tipo" value="entrada" checked> ${icon('arrowUp', 14)} Entrada</label>
            <label class="seg-btn"><input type="radio" name="tipo" value="saida"> ${icon('arrowDown', 14)} Saída</label>
            <label class="seg-btn"><input type="radio" name="tipo" value="ajuste"> ${icon('edit', 14)} Ajuste</label>
          </div>
          <small class="help" data-tipo-help>Entrada: soma ao estoque (compra, reposição).</small>
        </fieldset>
        <div class="field"><label for="mv-qtd" data-qtd-label>Quantidade <span class="req" aria-hidden="true">*</span></label>
          <input id="mv-qtd" name="quantidade" type="number" min="0" step="1" required inputmode="numeric"></div>
        <p class="preview" data-preview aria-live="polite"></p>
        <div class="field"><label for="mv-motivo">Motivo <span class="req" aria-hidden="true">*</span></label>
          <input id="mv-motivo" name="motivo" maxlength="1000" required placeholder="Ex.: reposição do fornecedor, produto avariado, contagem"></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="dialog-actions"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Registrar movimentação</button></div>
      </form>`,
  })
  const form = body.querySelector('form')
  const helps = {
    entrada: 'Entrada: soma ao estoque (compra, reposição).',
    saida: 'Saída: retira do estoque (avaria, uso, brinde).',
    ajuste: 'Ajuste: define o estoque exato após uma contagem.',
  }
  function preview() {
    const p = produtos.find((x) => String(x.id) === form.elements.produto_id.value)
    const tipo = form.elements.tipo.value
    const q = Number(form.elements.quantidade.value)
    form.querySelector('[data-tipo-help]').textContent = helps[tipo]
    form.querySelector('[data-qtd-label]').firstChild.textContent = tipo === 'ajuste' ? 'Novo estoque (contado) ' : 'Quantidade '
    const out = form.querySelector('[data-preview]')
    if (!p || form.elements.quantidade.value === '' || !Number.isInteger(q) || q < 0) { out.textContent = ''; return }
    const atual = Number(p.estoque)
    const novo = tipo === 'ajuste' ? q : tipo === 'entrada' ? atual + q : atual - q
    out.textContent = `Estoque: ${number(atual)} → ${number(novo)} un.${novo < 0 ? ' (inválido)' : ''}`
    out.classList.toggle('is-invalid', novo < 0)
  }
  form.addEventListener('input', preview)
  form.addEventListener('change', preview)
  preview()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const produto = produtos.find((x) => String(x.id) === form.elements.produto_id.value)
    const tipo = form.elements.tipo.value
    const quantidade = Number(form.elements.quantidade.value)
    const motivo = form.elements.motivo.value.trim()
    if (!produto) return formError(form, 'Escolha o produto.')
    if (form.elements.quantidade.value === '' || !Number.isInteger(quantidade) || quantidade < 0) return formError(form, 'Informe uma quantidade inteira.')
    if (tipo !== 'ajuste' && quantidade < 1) return formError(form, 'A quantidade precisa ser maior que zero.')
    if (tipo === 'saida' && quantidade > Number(produto.estoque)) return formError(form, `A saída é maior que o estoque disponível (${produto.estoque} un.).`)
    if (tipo === 'ajuste' && quantidade === Number(produto.estoque)) return formError(form, 'O estoque contado é igual ao atual; nada a ajustar.')
    if (motivo.length < 3) return formError(form, 'Informe o motivo (mínimo de 3 caracteres).')
    formError(form, '')
    await withBusy(form.querySelector('[type="submit"]'), 'Registrando...', async () => {
      try {
        const data = await api('/admin/estoque/movimentacoes', {
          method: 'POST', idempotencyKey: key, body: { produto_id: Number(produto.id), tipo, quantidade, motivo },
        })
        invalidate('produtos')
        toast(data.reutilizado ? 'Esta movimentação já tinha sido registrada.' : `Estoque de ${produto.nome}: ${number(data.estoque_anterior)} → ${number(data.estoque)} un.`)
        key = uuid()
        close()
        onDone?.()
      } catch (error) {
        // Erro de validação do servidor (4xx): nova tentativa é outra operação.
        if (error.status >= 400 && error.status < 500) key = uuid()
        formError(form, error.message)
      }
    })
  })
}

export async function render(root, ctx) {
  const filtro = ctx.query.get('filtro') || ''
  const produtoFiltro = ctx.query.get('produto') || ''
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Estoque</h1><p class="muted">Entradas, saídas e ajustes — tudo com motivo e histórico.</p></div>
      <div class="page-actions">
        <button class="btn" type="button" data-action="export">${icon('download', 16)}Exportar CSV</button>
        <button class="btn btn-primary" type="button" data-action="move">${icon('plus', 16)}Movimentar estoque</button>
      </div>
    </div>
    <div class="grid-2 section" id="stock-summary">${skeleton({ rows: 4 })}</div>
    <section class="card section" aria-labelledby="hist-title">
      <div class="card-head">
        <h2 id="hist-title" class="card-title">Histórico de movimentações</h2>
        <div class="field inline"><label for="hist-prod">Produto</label><select id="hist-prod"><option value="">Todos</option></select></div>
      </div>
      <div id="stock-history">${skeleton({ rows: 6 })}</div>
    </section>`

  let produtos = []
  root.querySelector('[data-action="export"]').addEventListener('click', (e) => withBusy(e.currentTarget, 'Gerando...', async () => {
    try { await download('/admin/exportar/estoque.csv', 'estoque.csv'); toast('Planilha de estoque gerada.') } catch (error) { toast(error.message, 'error') }
  }))
  root.querySelector('[data-action="move"]').addEventListener('click', () => openMovement({ produtos, produtoId: produtoFiltro, onDone: reloadAll }))
  root.querySelector('#hist-prod').addEventListener('change', (e) => {
    const q = new URLSearchParams(ctx.query)
    if (e.target.value) q.set('produto', e.target.value); else q.delete('produto')
    ctx.navigate(`#/estoque${q.toString() ? `?${q}` : ''}`)
  })

  async function loadSummary() {
    const box = root.querySelector('#stock-summary')
    try {
      const data = await api('/admin/relatorios/estoque?dias_sem_venda=30')
      box.innerHTML = `
        <article class="card ${filtro === 'baixo' ? 'is-highlight' : ''}" id="low-stock">
          <h2 class="card-title">${icon('alert', 18)} Estoque baixo <span class="count">${number(data.estoque_baixo.length)}</span></h2>
          ${data.estoque_baixo.length ? `<ul class="mini-list">${data.estoque_baixo.map((p) => `
            <li><span><strong>${esc(p.nome)}</strong> <small class="muted">${esc(p.categoria)}</small></span>
              <span class="mini-meta"><span class="badge ${p.estoque === 0 ? 'badge-danger' : 'badge-warning'}">${number(p.estoque)} / mín. ${number(p.estoque_minimo)}</span>
              <button class="btn btn-sm" type="button" data-entry="${Number(p.id)}">${icon('plus', 14)}Entrada</button></span></li>`).join('')}</ul>`
            : emptyState('Nenhum produto com estoque baixo')}
        </article>
        <article class="card">
          <h2 class="card-title">${icon('clock', 18)} Parados há 30+ dias <span class="count">${number(data.parados.length)}</span></h2>
          <p class="muted small">Produtos ativos, com estoque, sem venda nos últimos 30 dias.</p>
          ${data.parados.length ? `<ul class="mini-list">${data.parados.slice(0, 12).map((p) => `
            <li><span><strong>${esc(p.nome)}</strong> <small class="muted">${number(p.estoque)} un. · ${money(p.valor_parado)} parados</small></span>
              <small class="muted">${p.ultima_venda ? `Última venda ${date(p.ultima_venda)}` : 'Nunca vendido'}</small></li>`).join('')}</ul>`
            : emptyState('Nenhum produto parado')}
        </article>`
      box.querySelectorAll('[data-entry]').forEach((b) => b.addEventListener('click', () => {
        openMovement({ produtos, produtoId: b.dataset.entry, onDone: reloadAll })
      }))
      if (filtro === 'baixo') box.querySelector('#low-stock').scrollIntoView({ block: 'nearest' })
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', loadSummary)
    }
  }

  async function loadHistory() {
    const box = root.querySelector('#stock-history')
    box.innerHTML = skeleton({ rows: 6 })
    try {
      produtos = await getProdutos()
      const sel = root.querySelector('#hist-prod')
      sel.innerHTML = `<option value="">Todos</option>${produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((p) => `<option value="${Number(p.id)}" ${String(p.id) === produtoFiltro ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}`
      const data = await api(`/admin/estoque/movimentacoes${produtoFiltro ? `?produto_id=${encodeURIComponent(produtoFiltro)}` : ''}`)
      if (!data.movimentacoes.length) {
        box.innerHTML = emptyState('Nenhuma movimentação registrada')
        return
      }
      box.innerHTML = `<div class="table-scroll"><table class="table">
        <caption class="sr-only">Histórico de movimentações de estoque (últimas 100)</caption>
        <thead><tr><th scope="col">Quando</th><th scope="col">Produto</th><th scope="col">Tipo</th><th scope="col" class="num">Antes → depois</th><th scope="col">Motivo</th><th scope="col">Quem</th></tr></thead>
        <tbody>${data.movimentacoes.map((m) => {
          const d = Number(m.diferenca)
          return `<tr>
            <td data-label="Quando">${dateTime(m.criado_em)}</td>
            <td data-label="Produto">${esc(m.produto_nome)}${m.pedido_id ? `<small class="block"><a href="#/pedidos/${Number(m.pedido_id)}">Pedido ${esc(m.numero_exibicao || m.pedido_id)}</a></small>` : ''}</td>
            <td data-label="Tipo"><span class="badge ${d > 0 ? 'badge-success' : d < 0 ? 'badge-warning' : 'badge-muted'}">${icon(d > 0 ? 'arrowUp' : d < 0 ? 'arrowDown' : 'minus', 14)}${esc(TIPO_LABEL[m.tipo] || m.tipo)} ${d > 0 ? '+' : ''}${number(d)}</span></td>
            <td data-label="Antes → depois" class="num">${number(m.quantidade_anterior)} → ${number(m.quantidade_nova)}</td>
            <td data-label="Motivo">${esc(m.motivo)}</td>
            <td data-label="Quem">${esc(m.administrador_nome || (m.tipo === 'baixa_pedido' ? 'Loja (pedido do cliente)' : 'Sistema'))}</td>
          </tr>`
        }).join('')}</tbody></table></div>
        <p class="muted small">Mostrando as 100 movimentações mais recentes.</p>`
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', loadHistory)
    }
  }

  function reloadAll() {
    loadSummary()
    loadHistory()
  }

  await Promise.all([loadSummary(), loadHistory()])
}
