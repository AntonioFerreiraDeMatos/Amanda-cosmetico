import { api } from '../api.js'
import { icon } from '../icons.js'
import { esc, dateTime, money, skeleton, errorState, emptyState, ORDER_STATUS } from '../ui.js'

function parse(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
}

const ENTITY_LINK = {
  pedido: (id) => `#/pedidos/${id}`,
  cliente: (id) => `#/clientes/${id}`,
  produto: () => '#/produtos',
  categoria: () => '#/categorias',
}

/** Frase legível: "Amanda confirmou o Pix do pedido". */
function describe(r) {
  const antes = parse(r.antes_json) || {}
  const depois = parse(r.depois_json) || {}
  const ent = `${r.entidade} #${r.entidade_id}`
  const map = {
    'pedido.criado_admin': () => `cadastrou o pedido ${depois.numero_pedido || ent} (${money(depois.subtotal)})`,
    'pedido.dados_atualizados': () => `alterou a entrega/observações do ${ent}`,
    'pedido.status_atualizado': () => `mudou o ${ent} de "${ORDER_STATUS[antes.status] || antes.status}" para "${ORDER_STATUS[depois.status] || depois.status}"`,
    'pedido.cancelado': () => `cancelou o ${ent}`,
    'pedido.excluido': () => `excluiu o ${ent}`,
    'pagamento.pix_confirmado': () => `confirmou o Pix de ${money(depois.valor)} do ${ent}`,
    'pagamento.pix_revertido_para_pendente': () => `reverteu o Pix do ${ent} para pendente`,
    'estoque.entrada': () => `deu entrada no estoque do ${ent}: ${antes.estoque} → ${depois.estoque}`,
    'estoque.saida': () => `deu saída no estoque do ${ent}: ${antes.estoque} → ${depois.estoque}`,
    'estoque.ajuste': () => `ajustou o estoque do ${ent}: ${antes.estoque} → ${depois.estoque}`,
    'produto.criado': () => `cadastrou o produto "${depois.nome}"`,
    'produto.atualizado': () => {
      const mudou = []
      if (antes.preco !== depois.preco) mudou.push(`preço ${money(antes.preco)} → ${money(depois.preco)}`)
      if (antes.estoque !== depois.estoque) mudou.push(`estoque ${antes.estoque} → ${depois.estoque}`)
      if (antes.ativo !== depois.ativo) mudou.push(depois.ativo ? 'ativou' : 'desativou')
      if (antes.nome !== depois.nome) mudou.push(`nome "${antes.nome}" → "${depois.nome}"`)
      return `editou o produto "${depois.nome}"${mudou.length ? ` (${mudou.join('; ')})` : ''}`
    },
    'produto.desativado': () => `desativou o ${ent}`,
    'produto.excluido': () => `excluiu definitivamente o ${ent}`,
    'cliente.dados_atualizados': () => `editou o cadastro de ${depois.nome || ent}`,
    'cliente.desativado': () => `desativou o ${ent}`,
    'cliente.reativado': () => `reativou o ${ent}`,
    'cliente.anotacao_atualizada': () => `atualizou a anotação do ${ent}`,
    'categoria.criada': () => `criou a categoria "${depois.nome}"`,
    'categoria.atualizada': () => `editou a categoria "${depois.nome}"`,
    'categoria.excluida': () => `excluiu a categoria "${antes.nome}"`,
    'exportacao.pedidos': () => `exportou ${depois.linhas} pedido(s) em CSV`,
    'exportacao.clientes': () => `exportou ${depois.linhas} cliente(s) em CSV`,
    'exportacao.estoque': () => `exportou o estoque (${depois.linhas} produto(s)) em CSV`,
  }
  return (map[r.acao] || (() => `${r.acao} em ${ent}`))()
}

export async function render(root, ctx) {
  const entidade = ctx.query.get('entidade') || ''
  const termo = ctx.query.get('q') || ''
  root.innerHTML = `
    <div class="page-head"><div><h1>Histórico</h1><p class="muted">Quem fez o quê e quando no painel.</p></div></div>
    <form class="card filters" role="search" aria-label="Filtrar histórico">
      <div class="field grow"><label for="h-q">Buscar</label><input id="h-q" name="q" type="search" value="${esc(termo)}" placeholder="Pessoa, pedido, produto, motivo..."></div>
      <div class="field"><label for="h-ent">Tipo</label>
        <select id="h-ent" name="entidade"><option value="">Tudo</option>
          ${[['pedido', 'Pedidos e Pix'], ['produto', 'Produtos e estoque'], ['cliente', 'Clientes'], ['categoria', 'Categorias'], ['relatorio', 'Exportações']].map(([v, l]) => `<option value="${v}" ${entidade === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      <div class="filters-actions"><button class="btn btn-primary" type="submit">${icon('search', 16)}Filtrar</button><a class="btn btn-ghost" href="#/historico">Limpar</a></div>
    </form>
    <div id="hist">${skeleton({ rows: 8 })}</div>`
  const form = root.querySelector('form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = new URLSearchParams()
    for (const [k, v] of new FormData(form).entries()) if (String(v).trim()) q.set(k, String(v).trim())
    ctx.navigate(`#/historico${q.toString() ? `?${q}` : ''}`)
  })

  const box = root.querySelector('#hist')
  async function load() {
    try {
      const { registros } = await api('/admin/auditoria')
      const t = termo.toLowerCase()
      const list = registros
        .map((r) => ({ ...r, frase: describe(r) }))
        .filter((r) => !entidade || r.entidade === entidade)
        .filter((r) => !t || `${r.administrador_nome} ${r.frase} ${r.motivo || ''}`.toLowerCase().includes(t))
      if (!list.length) {
        box.innerHTML = emptyState('Nada encontrado no histórico')
        return
      }
      box.innerHTML = `<div class="card"><ol class="audit-list">${list.map((r) => {
        const link = ENTITY_LINK[r.entidade]?.(Number(r.entidade_id))
        return `<li>
          <time datetime="${esc(r.criado_em)}">${dateTime(r.criado_em)}</time>
          <p><strong>${esc(r.administrador_nome || 'Administrador removido')}</strong> ${esc(r.frase)}${link ? ` <a href="${link}" class="link">ver</a>` : ''}</p>
          ${r.motivo ? `<small class="muted">Motivo: ${esc(r.motivo)}</small>` : ''}
        </li>`
      }).join('')}</ol>
      <p class="muted small">Mostrando os ${registros.length} registros mais recentes.</p></div>`
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }
  await load()
}
