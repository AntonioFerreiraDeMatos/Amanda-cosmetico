import { api } from '../api.js'
import { icon } from '../icons.js'
import {
  esc, money, number, dateTime, daysSince, phoneLabel, statusBadge, skeleton, errorState, emptyState,
  toast, confirmDialog, withBusy, whatsappLink,
} from '../ui.js'
import { whatsappMessage } from './pedidos.js'

export async function render(root, ctx) {
  const aba = ctx.query.get('aba') === 'aprovados' ? 'aprovados' : 'pendentes'
  root.innerHTML = `
    <div class="page-head"><div><h1>Pagamentos Pix</h1><p class="muted">Confira na sua conta e confirme os Pix recebidos.</p></div></div>
    <div class="tabs" role="tablist" aria-label="Situação do Pix">
      <a role="tab" href="#/pagamentos" aria-selected="${aba === 'pendentes'}" class="tab">${icon('clock', 16)}Aguardando conferência</a>
      <a role="tab" href="#/pagamentos?aba=aprovados" aria-selected="${aba === 'aprovados'}" class="tab">${icon('check', 16)}Aprovados</a>
    </div>
    <div id="pay" role="tabpanel">${skeleton({ rows: 6 })}</div>`
  const box = root.querySelector('#pay')

  async function load() {
    box.innerHTML = skeleton({ rows: 6 })
    try {
      const q = aba === 'pendentes'
        ? 'status=aguardando_pagamento&payment_status=pendente&limit=100'
        : 'payment_status=aprovado&limit=50'
      const data = await api(`/admin/pedidos?${q}`)
      const list = aba === 'pendentes' ? data.pedidos.slice().reverse() : data.pedidos
      if (!list.length) {
        box.innerHTML = emptyState(aba === 'pendentes' ? 'Nenhum Pix aguardando' : 'Nenhum Pix aprovado ainda', aba === 'pendentes' ? 'Tudo conferido por aqui.' : '')
        return
      }
      const total = list.reduce((s, p) => s + Number(p.total || 0), 0)
      box.innerHTML = `
        <div class="card table-card">
          <p class="table-meta">${number(data.total)} pedido(s) · ${money(total)}${aba === 'pendentes' ? ' a conferir · mais antigos primeiro' : ' (mais recentes)'}</p>
          <div class="table-scroll"><table class="table">
            <caption class="sr-only">Pagamentos ${aba}</caption>
            <thead><tr><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col" class="num">Valor do Pix</th><th scope="col">Criado</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
            <tbody>${list.map((p) => {
              const wa = whatsappLink(p.telefone_entrega || p.cliente_telefone, whatsappMessage(p))
              const age = daysSince(p.criado_em)
              return `<tr>
                <td data-label="Pedido"><a class="strong" href="#/pedidos/${Number(p.id)}">${esc(p.numero_exibicao)}</a></td>
                <td data-label="Cliente">${esc(p.cliente_nome)}<small class="muted block">${esc(phoneLabel(p.telefone_entrega || p.cliente_telefone))}</small></td>
                <td data-label="Valor" class="num"><strong>${money(p.total)}</strong></td>
                <td data-label="Criado">${dateTime(p.criado_em)}${aba === 'pendentes' && age >= 2 ? `<small class="block warn-text">${icon('alert', 12)} há ${age} dias</small>` : ''}</td>
                <td data-label="Situação">${statusBadge(p.pagamento_status, 'payment')} ${aba === 'aprovados' ? statusBadge(p.status) : ''}</td>
                <td class="row-actions">
                  ${aba === 'pendentes' ? `<button class="btn btn-sm btn-primary" type="button" data-confirm="${Number(p.id)}" data-total="${esc(p.total)}" data-num="${esc(p.numero_exibicao)}">${icon('check', 14)}Confirmar</button>` : ''}
                  ${wa ? `<a class="btn btn-sm btn-whatsapp" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp de ${esc(p.cliente_nome)}">${icon('whatsapp', 14)}</a>` : ''}
                </td>
              </tr>`
            }).join('')}</tbody>
          </table></div>
        </div>`
      box.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', async () => {
        const r = await confirmDialog({
          title: `Confirmar Pix do pedido ${b.dataset.num}?`,
          message: `Confirme somente depois de ver ${money(b.dataset.total)} na sua conta.`,
          confirmLabel: 'Sim, recebi o Pix',
        })
        if (!r.ok) return
        await withBusy(b, 'Confirmando...', async () => {
          try { await api(`/admin/pedidos/${b.dataset.confirm}/confirmar-pix`, { method: 'POST' }); toast('Pix confirmado. O pedido foi para "Pago — separar".'); load() } catch (error) { toast(error.message, 'error') }
        })
      }))
    } catch (error) {
      box.innerHTML = errorState(error.message)
      box.querySelector('[data-action="retry"]').addEventListener('click', load)
    }
  }
  await load()
}
