import { api } from '../api.js'
import { icon } from '../icons.js'
import { getCategorias, getProdutos, invalidate } from '../data.js'
import {
  esc, number, skeleton, errorState, emptyState, toast, openDialog, confirmDialog, formError, withBusy,
} from '../ui.js'

function categoryForm(c = {}) {
  return `
    <form class="form" novalidate>
      <div class="field"><label for="cat-nome">Nome <span class="req" aria-hidden="true">*</span></label><input id="cat-nome" name="nome" maxlength="100" required value="${esc(c.nome || '')}"></div>
      <div class="field"><label for="cat-desc">Descrição</label><textarea id="cat-desc" name="descricao" rows="3" maxlength="2000">${esc(c.descricao || '')}</textarea></div>
      ${c.id ? `<label class="check"><input type="checkbox" name="ativo" ${Number(c.ativo) === 1 ? 'checked' : ''}> Ativa (desativar tira os produtos dela da loja)</label>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">${c.id ? 'Salvar' : 'Criar categoria'}</button></div>
    </form>`
}

export async function render(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Categorias</h1><p class="muted">Organize o catálogo da loja.</p></div>
      <div class="page-actions"><button class="btn btn-primary" type="button" data-action="new">${icon('plus', 16)}Nova categoria</button></div>
    </div>
    <div id="cat-result">${skeleton({ rows: 6 })}</div>`
  const box = root.querySelector('#cat-result')

  async function load() {
    box.innerHTML = skeleton({ rows: 6 })
    try {
      invalidate('categorias')
      const [categorias, produtos] = await Promise.all([getCategorias(), getProdutos()])
      const count = (id) => produtos.filter((p) => String(p.categoria_id) === String(id))
      if (!categorias.length) {
        box.innerHTML = emptyState('Nenhuma categoria', 'Crie a primeira categoria para cadastrar produtos.')
        return
      }
      box.innerHTML = `<div class="card table-card"><div class="table-scroll"><table class="table">
        <caption class="sr-only">Categorias</caption>
        <thead><tr><th scope="col">Categoria</th><th scope="col" class="num">Produtos</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${categorias.map((c) => {
          const list = count(c.id)
          const ativos = list.filter((p) => Number(p.ativo) === 1).length
          return `<tr class="${Number(c.ativo) === 1 ? '' : 'is-off'}">
            <td data-label="Categoria"><strong>${esc(c.nome)}</strong>${c.descricao ? `<small class="muted block">${esc(c.descricao)}</small>` : ''}</td>
            <td data-label="Produtos" class="num"><a href="#/produtos?categoria=${Number(c.id)}">${number(list.length)}</a><small class="muted block">${number(ativos)} ativo(s)</small></td>
            <td data-label="Situação">${Number(c.ativo) === 1 ? '<span class="badge badge-success">Ativa</span>' : '<span class="badge badge-muted">Desativada</span>'}</td>
            <td class="row-actions">
              <button class="btn btn-sm" type="button" data-edit="${Number(c.id)}">${icon('edit', 14)}Editar</button>
              <button class="btn btn-sm btn-danger-ghost" type="button" data-delete="${Number(c.id)}" ${list.length ? 'disabled title="Mova ou exclua os produtos antes"' : ''}>${icon('trash', 14)}Excluir</button>
            </td>
          </tr>`
        }).join('')}</tbody></table></div>
        <p class="muted small">Categorias com produtos não podem ser excluídas — desative-as para tirar da loja.</p></div>`
      box.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(categorias.find((c) => String(c.id) === b.dataset.edit))))
      box.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
        const c = categorias.find((x) => String(x.id) === b.dataset.delete)
        const r = await confirmDialog({ title: `Excluir ${c.nome}?`, message: 'A categoria será removida. Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })
        if (!r.ok) return
        await withBusy(b, '...', async () => {
          try { await api(`/admin/categorias/${c.id}`, { method: 'DELETE' }); toast('Categoria removida.'); load() } catch (error) { toast(error.message, 'error') }
        })
      }))
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }

  function open(c) {
    const { body, close } = openDialog({ title: c ? `Editar ${c.nome}` : 'Nova categoria', size: 'sm', content: categoryForm(c || {}) })
    const form = body.querySelector('form')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const nome = form.elements.nome.value.trim()
      if (nome.length < 2) return formError(form, 'O nome precisa ter pelo menos 2 caracteres.')
      const payload = { nome, descricao: form.elements.descricao.value.trim() }
      if (c) payload.ativo = form.elements.ativo.checked
      await withBusy(form.querySelector('[type="submit"]'), 'Salvando...', async () => {
        try {
          await api(c ? `/admin/categorias/${c.id}` : '/admin/categorias', { method: c ? 'PUT' : 'POST', body: payload })
          invalidate('produtos')
          toast(c ? 'Categoria atualizada.' : 'Categoria criada.')
          close()
          load()
        } catch (error) { formError(form, error.message) }
      })
    })
  }

  root.querySelector('[data-action="new"]').addEventListener('click', () => open(null))
  await load()
}
