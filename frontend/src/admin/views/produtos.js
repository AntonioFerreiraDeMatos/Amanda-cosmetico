import { api, imageUrl } from '../api.js'
import { icon } from '../icons.js'
import { getProdutos, getCategorias, invalidate } from '../data.js'
import {
  esc, money, number, skeleton, errorState, emptyState, toast, openDialog, confirmDialog, formError,
  withBusy, parseMoney, moneyInput,
} from '../ui.js'
import { openMovement } from './estoque.js'

const VIEW_KEY = 'amanda_admin_produtos_view'
const MAX_IMAGE = 5 * 1024 * 1024

function getView() {
  try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table' } catch { return 'table' }
}

/** Corpo completo para PUT JSON a partir do produto carregado (edição rápida). */
function fullBody(p, overrides = {}) {
  return {
    nome: p.nome,
    categoria_id: Number(p.categoria_id),
    preco: Number(p.preco),
    preco_promocional: p.preco_promocional == null ? '' : Number(p.preco_promocional),
    estoque: Number(p.estoque),
    estoque_minimo: Number(p.estoque_minimo),
    sku: p.sku || '',
    descricao: p.descricao || '',
    destaque: Number(p.destaque) === 1,
    ativo: Number(p.ativo) === 1,
    ...overrides,
  }
}

export async function render(root, ctx) {
  const f = {
    q: ctx.query.get('q') || '',
    categoria: ctx.query.get('categoria') || '',
    situacao: ctx.query.get('situacao') || '',
  }
  let view = getView()

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Produtos</h1><p class="muted">Catálogo da loja: preços, vitrine e disponibilidade.</p></div>
      <div class="page-actions">
        <div class="segmented" role="group" aria-label="Modo de exibição">
          <button class="seg-btn" type="button" data-view="table" aria-pressed="${view === 'table'}">${icon('list', 16)}<span class="sr-only-sm">Tabela</span></button>
          <button class="seg-btn" type="button" data-view="grid" aria-pressed="${view === 'grid'}">${icon('grid', 16)}<span class="sr-only-sm">Grade</span></button>
        </div>
        <button class="btn btn-primary" type="button" data-action="new">${icon('plus', 16)}Novo produto</button>
      </div>
    </div>
    <form class="card filters" role="search" aria-label="Filtrar produtos">
      <div class="field grow"><label for="p-q">Buscar</label><input id="p-q" name="q" type="search" value="${esc(f.q)}" placeholder="Nome ou SKU"></div>
      <div class="field"><label for="p-cat">Categoria</label><select id="p-cat" name="categoria"><option value="">Todas</option></select></div>
      <div class="field"><label for="p-sit">Situação</label>
        <select id="p-sit" name="situacao">
          <option value="">Todas</option>
          <option value="ativo" ${f.situacao === 'ativo' ? 'selected' : ''}>Ativos</option>
          <option value="inativo" ${f.situacao === 'inativo' ? 'selected' : ''}>Desativados</option>
          <option value="baixo" ${f.situacao === 'baixo' ? 'selected' : ''}>Estoque baixo</option>
          <option value="destaque" ${f.situacao === 'destaque' ? 'selected' : ''}>Na vitrine</option>
        </select></div>
      <div class="filters-actions"><button class="btn btn-primary" type="submit">${icon('search', 16)}Filtrar</button><a class="btn btn-ghost" href="#/produtos">Limpar</a></div>
    </form>
    <div id="products-result">${skeleton({ rows: 8 })}</div>`

  const form = root.querySelector('form.filters')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = new URLSearchParams()
    for (const [k, v] of new FormData(form).entries()) if (String(v).trim()) q.set(k, String(v).trim())
    ctx.navigate(`#/produtos${q.toString() ? `?${q}` : ''}`)
  })
  root.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
    view = btn.dataset.view
    try { localStorage.setItem(VIEW_KEY, view) } catch { /* sem armazenamento */ }
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
    paint()
  }))

  const box = root.querySelector('#products-result')
  let produtos = []
  let categorias = []

  async function load(force = false) {
    box.innerHTML = skeleton({ rows: 8 })
    try {
      if (force) invalidate('produtos', 'categorias')
      ;[produtos, categorias] = await Promise.all([getProdutos(), getCategorias()])
      const sel = form.querySelector('#p-cat')
      sel.innerHTML = `<option value="">Todas</option>${categorias.map((c) => `<option value="${Number(c.id)}" ${String(c.id) === f.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}`
      paint()
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', () => load(true))
    }
  }

  function filtered() {
    const term = f.q.toLowerCase()
    return produtos.filter((p) => {
      if (term && !`${p.nome} ${p.sku || ''}`.toLowerCase().includes(term)) return false
      if (f.categoria && String(p.categoria_id) !== f.categoria) return false
      if (f.situacao === 'ativo' && Number(p.ativo) !== 1) return false
      if (f.situacao === 'inativo' && Number(p.ativo) === 1) return false
      if (f.situacao === 'baixo' && !(Number(p.ativo) === 1 && Number(p.estoque) <= Number(p.estoque_minimo))) return false
      if (f.situacao === 'destaque' && Number(p.destaque) !== 1) return false
      return true
    })
  }

  function stockBadge(p) {
    const low = Number(p.estoque) <= Number(p.estoque_minimo)
    if (Number(p.estoque) === 0) return `<span class="badge badge-danger">${icon('alert', 14)}Sem estoque</span>`
    return low ? `<span class="badge badge-warning">${icon('alert', 14)}${number(p.estoque)} un.</span>` : `<span class="stock-ok">${number(p.estoque)} un.</span>`
  }

  function thumb(p, size = 'sm') {
    return p.imagem_principal
      ? `<img class="thumb thumb-${size}" src="${esc(imageUrl(p.imagem_principal))}" alt="" loading="lazy">`
      : `<span class="thumb thumb-${size} thumb-empty">${icon('image', size === 'sm' ? 18 : 32)}</span>`
  }

  function actions(p) {
    const ativo = Number(p.ativo) === 1
    return `
      <button class="btn btn-sm" type="button" data-edit="${Number(p.id)}">${icon('edit', 14)}Editar</button>
      <button class="btn btn-sm" type="button" data-stock="${Number(p.id)}">${icon('layers', 14)}Estoque</button>
      <button class="btn btn-sm ${ativo ? 'btn-danger-ghost' : ''}" type="button" data-toggle="${Number(p.id)}">${icon('power', 14)}${ativo ? 'Desativar' : 'Ativar'}</button>
      ${ativo ? '' : `<button class="btn btn-sm btn-danger-ghost" type="button" data-delete="${Number(p.id)}">${icon('trash', 14)}Excluir</button>`}`
  }

  function paint() {
    const list = filtered()
    if (!produtos.length) {
      box.innerHTML = emptyState('Nenhum produto cadastrado', 'Cadastre o primeiro produto da loja.', `<button class="btn btn-primary" type="button" data-action="new-empty">${icon('plus', 16)}Novo produto</button>`)
      box.querySelector('[data-action="new-empty"]').addEventListener('click', () => openForm(null))
      return
    }
    if (!list.length) {
      box.innerHTML = emptyState('Nenhum produto com esses filtros')
      return
    }
    const meta = `<p class="table-meta">${number(list.length)} produto(s) · ${number(produtos.filter((p) => Number(p.ativo) === 1).length)} ativo(s) · ${number(produtos.filter((p) => Number(p.destaque) === 1).length)} na vitrine</p>`
    if (view === 'grid') {
      box.innerHTML = `${meta}<div class="product-grid">${list.map((p) => `
        <article class="card product-card ${Number(p.ativo) === 1 ? '' : 'is-off'}">
          ${thumb(p, 'lg')}
          <div class="product-card-body">
            <h3>${esc(p.nome)}</h3>
            <p class="muted small">${esc(p.categoria)}${p.sku ? ` · ${esc(p.sku)}` : ''}</p>
            <p class="price">${p.preco_promocional ? `<s class="muted">${money(p.preco)}</s> ` : ''}<strong>${money(p.preco_promocional || p.preco)}</strong></p>
            <p class="badges">${stockBadge(p)} ${Number(p.ativo) === 1 ? '' : '<span class="badge badge-muted">Desativado</span>'} ${Number(p.destaque) === 1 ? '<span class="badge badge-info">Vitrine</span>' : ''}</p>
            <div class="card-actions">${actions(p)}</div>
          </div>
        </article>`).join('')}</div>`
    } else {
      box.innerHTML = `<div class="card table-card">${meta}<div class="table-scroll"><table class="table">
        <caption class="sr-only">Lista de produtos</caption>
        <thead><tr><th scope="col">Produto</th><th scope="col">Categoria</th><th scope="col">Preço (edição rápida)</th><th scope="col">Estoque</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${list.map((p) => `<tr class="${Number(p.ativo) === 1 ? '' : 'is-off'}">
          <td data-label="Produto"><div class="cell-product">${thumb(p)}<div><strong>${esc(p.nome)}</strong>${p.sku ? `<small class="muted block">SKU ${esc(p.sku)}</small>` : ''}</div></div></td>
          <td data-label="Categoria">${esc(p.categoria)}</td>
          <td data-label="Preço">
            <form class="quick-price" data-quick="${Number(p.id)}">
              <label class="sr-only" for="qp-${Number(p.id)}">Preço de ${esc(p.nome)}</label>
              <span class="input-prefix">R$<input id="qp-${Number(p.id)}" name="preco" inputmode="decimal" value="${esc(moneyInput(p.preco))}" size="7"></span>
              <button class="icon-btn" type="submit" aria-label="Salvar preço de ${esc(p.nome)}">${icon('check', 16)}</button>
            </form>
            ${p.preco_promocional ? `<small class="muted block">Promo ${money(p.preco_promocional)}</small>` : ''}
          </td>
          <td data-label="Estoque">${stockBadge(p)}<small class="muted block">mín. ${number(p.estoque_minimo)}</small></td>
          <td data-label="Situação">${Number(p.ativo) === 1 ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-muted">Desativado</span>'} ${Number(p.destaque) === 1 ? '<span class="badge badge-info">Vitrine</span>' : ''}</td>
          <td class="row-actions">${actions(p)}</td>
        </tr>`).join('')}</tbody></table></div></div>`
    }
  }

  const byId = (id) => produtos.find((p) => String(p.id) === String(id))

  box.addEventListener('submit', async (e) => {
    const quick = e.target.closest('[data-quick]')
    if (!quick) return
    e.preventDefault()
    const p = byId(quick.dataset.quick)
    const preco = parseMoney(quick.elements.preco.value)
    if (!preco || Number.isNaN(preco) || preco <= 0) return toast('Informe um preço válido, ex.: 49,90.', 'error')
    if (p.preco_promocional && Number(p.preco_promocional) > preco) return toast('O preço não pode ficar menor que a promoção. Edite o produto completo.', 'error')
    if (preco === Number(p.preco)) return toast('O preço não mudou.', 'error')
    await withBusy(quick.querySelector('button'), '', async () => {
      try {
        await api(`/admin/produtos/${p.id}`, { method: 'PUT', body: fullBody(p, { preco }) })
        toast(`Preço de ${p.nome} atualizado para ${money(preco)}.`)
        await load(true)
      } catch (error) { toast(error.message, 'error') }
    })
  })

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    if (btn.dataset.edit) openForm(byId(btn.dataset.edit))
    if (btn.dataset.stock) openMovement({ produtos, produtoId: btn.dataset.stock, onDone: () => load(true) })
    if (btn.dataset.toggle) {
      const p = byId(btn.dataset.toggle)
      const ativo = Number(p.ativo) === 1
      const r = await confirmDialog({
        title: ativo ? `Desativar ${p.nome}?` : `Ativar ${p.nome}?`,
        message: ativo ? 'O produto sai da loja, mas continua no histórico. Você pode ativar de novo depois.' : 'O produto volta a aparecer na loja (se a categoria estiver ativa).',
        confirmLabel: ativo ? 'Desativar' : 'Ativar',
        danger: ativo,
      })
      if (!r.ok) return
      await withBusy(btn, '...', async () => {
        try {
          if (ativo) await api(`/admin/produtos/${p.id}`, { method: 'DELETE' })
          else await api(`/admin/produtos/${p.id}`, { method: 'PUT', body: fullBody(p, { ativo: true }) })
          toast(ativo ? 'Produto desativado.' : 'Produto ativado.')
          await load(true)
        } catch (error) { toast(error.message, 'error') }
      })
    }
    if (btn.dataset.delete) {
      const p = byId(btn.dataset.delete)
      const r = await confirmDialog({
        title: `Excluir ${p.nome} definitivamente?`,
        message: 'Só é possível excluir produtos sem pedidos nem histórico de estoque. Esta ação não pode ser desfeita. Se tiver dúvida, mantenha desativado.',
        confirmLabel: 'Excluir definitivamente',
        danger: true,
      })
      if (!r.ok) return
      await withBusy(btn, '...', async () => {
        try {
          await api(`/admin/produtos/${p.id}/permanente`, { method: 'DELETE' })
          toast('Produto excluído.')
          await load(true)
        } catch (error) { toast(error.message, 'error') }
      })
    }
  })

  root.querySelector('[data-action="new"]').addEventListener('click', () => openForm(null))

  function openForm(p) {
    const editing = Boolean(p)
    const ativas = categorias.filter((c) => Number(c.ativo) === 1 || (p && String(c.id) === String(p.categoria_id)))
    if (!ativas.length) {
      toast('Crie uma categoria antes de cadastrar produtos.', 'error')
      ctx.navigate('#/categorias')
      return
    }
    const { body, close } = openDialog({
      title: editing ? `Editar ${p.nome}` : 'Novo produto',
      size: 'lg',
      content: `
        <form class="form" novalidate enctype="multipart/form-data">
          <div class="form-grid">
            <div class="field span-2"><label for="pf-nome">Nome <span class="req" aria-hidden="true">*</span></label><input id="pf-nome" name="nome" maxlength="200" required value="${esc(p?.nome || '')}"></div>
            <div class="field"><label for="pf-cat">Categoria <span class="req" aria-hidden="true">*</span></label>
              <select id="pf-cat" name="categoria_id" required><option value="">Selecione...</option>${ativas.map((c) => `<option value="${Number(c.id)}" ${p && String(c.id) === String(p.categoria_id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
            <div class="field"><label for="pf-sku">SKU</label><input id="pf-sku" name="sku" maxlength="100" value="${esc(p?.sku || '')}"></div>
            <div class="field"><label for="pf-preco">Preço (R$) <span class="req" aria-hidden="true">*</span></label><input id="pf-preco" name="preco" inputmode="decimal" required placeholder="49,90" value="${esc(moneyInput(p?.preco))}"></div>
            <div class="field"><label for="pf-promo">Preço promocional (R$)</label><input id="pf-promo" name="preco_promocional" inputmode="decimal" placeholder="Opcional" value="${esc(moneyInput(p?.preco_promocional))}"></div>
            <div class="field"><label for="pf-est">Estoque ${editing ? '' : 'inicial'} <span class="req" aria-hidden="true">*</span></label><input id="pf-est" name="estoque" type="number" min="0" step="1" required value="${Number(p?.estoque ?? 0)}"></div>
            <div class="field"><label for="pf-min">Estoque mínimo (alerta)</label><input id="pf-min" name="estoque_minimo" type="number" min="0" step="1" value="${Number(p?.estoque_minimo ?? 5)}"></div>
            <div class="field span-2" data-motivo ${editing ? 'hidden' : ''}>
              <label for="pf-motivo">Motivo da alteração de estoque ${editing ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>
              <input id="pf-motivo" name="motivo_estoque" maxlength="1000" placeholder="${editing ? 'Ex.: contagem do inventário' : 'Opcional — padrão: estoque inicial'}">
              <small class="help">${editing ? 'Obrigatório quando o estoque muda. Para entradas e saídas do dia a dia, prefira a tela Estoque.' : ''}</small>
            </div>
            <div class="field span-2"><label for="pf-desc">Descrição</label><textarea id="pf-desc" name="descricao" rows="4" maxlength="20000">${esc(p?.descricao || '')}</textarea></div>
            <div class="field span-2">
              <label for="pf-img">Imagem ${editing ? '(envie para trocar)' : ''}</label>
              <div class="image-input">
                <span class="image-preview">${p?.imagem_principal ? `<img src="${esc(imageUrl(p.imagem_principal))}" alt="Imagem atual">` : icon('image', 28)}</span>
                <input id="pf-img" name="imagem" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="pf-img-help">
              </div>
              <small id="pf-img-help" class="help">JPG, PNG ou WebP, até 5 MB.</small>
            </div>
            <label class="check span-2"><input type="checkbox" name="ativo" ${!p || Number(p.ativo) === 1 ? 'checked' : ''}> Ativo (aparece na loja)</label>
            <label class="check span-2"><input type="checkbox" name="destaque" ${Number(p?.destaque) === 1 ? 'checked' : ''}> Mostrar na vitrine (destaque)</label>
          </div>
          <p class="form-error" role="alert" hidden></p>
          <div class="dialog-actions"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
        </form>`,
    })
    const form = body.querySelector('form')
    const estoqueOriginal = Number(p?.estoque ?? 0)
    form.elements.estoque.addEventListener('input', () => {
      if (editing) form.querySelector('[data-motivo]').hidden = Number(form.elements.estoque.value) === estoqueOriginal
    })
    form.elements.imagem.addEventListener('change', () => {
      const file = form.elements.imagem.files[0]
      const preview = form.querySelector('.image-preview')
      if (!file) return
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        form.elements.imagem.value = ''
        return formError(form, 'A imagem deve ser JPG, PNG ou WebP.')
      }
      if (file.size > MAX_IMAGE) {
        form.elements.imagem.value = ''
        return formError(form, 'A imagem deve ter no máximo 5 MB.')
      }
      formError(form, '')
      const url = URL.createObjectURL(file)
      preview.innerHTML = `<img src="${url}" alt="Pré-visualização da nova imagem">`
    })
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const nome = form.elements.nome.value.trim()
      const preco = parseMoney(form.elements.preco.value)
      const promo = parseMoney(form.elements.preco_promocional.value)
      const estoque = Number(form.elements.estoque.value)
      const minimo = Number(form.elements.estoque_minimo.value || 0)
      const motivo = form.elements.motivo_estoque.value.trim()
      if (nome.length < 2) return formError(form, 'Informe o nome do produto.')
      if (!form.elements.categoria_id.value) return formError(form, 'Escolha a categoria.')
      if (!preco || Number.isNaN(preco) || preco <= 0) return formError(form, 'Informe um preço válido, ex.: 49,90.')
      if (promo !== null && (Number.isNaN(promo) || promo <= 0 || promo >= preco)) return formError(form, 'A promoção precisa ser menor que o preço normal.')
      if (!Number.isInteger(estoque) || estoque < 0) return formError(form, 'O estoque precisa ser um número inteiro (0 ou mais).')
      if (!Number.isInteger(minimo) || minimo < 0) return formError(form, 'O estoque mínimo precisa ser um número inteiro.')
      if (editing && estoque !== estoqueOriginal && motivo.length < 3) return formError(form, 'Informe o motivo da alteração de estoque.')
      if (motivo && motivo.length < 3) return formError(form, 'O motivo precisa ter pelo menos 3 caracteres.')
      formError(form, '')

      const data = new FormData()
      data.set('nome', nome)
      data.set('categoria_id', form.elements.categoria_id.value)
      data.set('sku', form.elements.sku.value.trim())
      data.set('preco', preco.toFixed(2))
      data.set('preco_promocional', promo === null ? '' : promo.toFixed(2))
      data.set('estoque', String(estoque))
      data.set('estoque_minimo', String(minimo))
      data.set('descricao', form.elements.descricao.value.trim())
      data.set('ativo', form.elements.ativo.checked ? 'true' : 'false')
      data.set('destaque', form.elements.destaque.checked ? 'true' : 'false')
      if (motivo) data.set('motivo_estoque', motivo)
      const file = form.elements.imagem.files[0]
      if (file) data.set('imagem', file)

      await withBusy(form.querySelector('[type="submit"]'), 'Salvando...', async () => {
        try {
          await api(editing ? `/admin/produtos/${p.id}` : '/admin/produtos', { method: editing ? 'PUT' : 'POST', body: data })
          toast(editing ? 'Produto atualizado.' : 'Produto cadastrado.')
          close()
          await load(true)
        } catch (error) { formError(form, error.message) }
      })
    })
  }

  await load()
}
