import { health, session, API_URL, api, download } from '../api.js'
import { icon } from '../icons.js'
import { esc, dateTime, comingSoon, openDialog, formError, withBusy, toast } from '../ui.js'
import { invalidate } from '../data.js'

const SOON = [
  ['users', 'Administradores', 'Convidar outras pessoas da equipe e definir permissões.'],
  ['card', 'Configurações de pagamento', 'Alterar chave Pix e dados do recebedor pelo painel (hoje: variável de ambiente no servidor).'],
  ['whatsapp', 'WhatsApp da loja', 'Alterar o número exibido na loja sem novo build.'],
  ['tag', 'Cupons de desconto', 'Criar e acompanhar cupons (a tabela existe, mas ainda não há telas nem regras).'],
  ['shield', 'Backup do banco', 'Gerar backup pelo painel (hoje: hPanel da Hostinger).'],
]

export async function render(root) {
  const admin = session.admin
  const exp = session.expiresAt
  root.innerHTML = `
    <div class="page-head"><div><h1>Sistema</h1><p class="muted">Situação do servidor, sua sessão e recursos futuros.</p></div></div>
    <div class="grid-2 section">
      <article class="card">
        <h2 class="card-title">${icon('shield', 18)} Servidor</h2>
        <div id="health"><p class="muted">Verificando...</p></div>
        <button class="btn btn-sm" type="button" data-action="check">${icon('refresh', 14)}Verificar de novo</button>
      </article>
      <article class="card">
        <h2 class="card-title">${icon('user', 18)} Sua sessão</h2>
        <dl class="kv">
          <div><dt>Nome</dt><dd>${esc(admin?.nome || '—')}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(admin?.email || '—')}</dd></div>
          <div><dt>Expira em</dt><dd>${exp ? dateTime(exp) : '—'}</dd></div>
        </dl>
        <p class="muted small">Por segurança, a sessão expira em algumas horas. Use "Sair" em computadores compartilhados.</p>
      </article>
    </div>
    <article class="card section">
      <h2 class="card-title">Atalhos de teclado</h2>
      <dl class="kv">
        <div><dt><kbd>Ctrl</kbd> + <kbd>K</kbd></dt><dd>Busca global (pedidos, clientes, produtos e telas)</dd></div>
        <div><dt><kbd>Esc</kbd></dt><dd>Fecha janelas e a busca</dd></div>
      </dl>
    </article>
    <article class="card section">
      <h2 class="card-title">${icon('alert', 18)} Começar a operação real</h2>
      <p class="muted">Apaga <strong>todos</strong> os pedidos, pagamentos, clientes, produtos, imagens e categorias de teste. Sua conta de administrador e o histórico de auditoria são mantidos, e a numeração dos pedidos recomeça em AM-000001.</p>
      <p class="muted small">Antes, baixe tudo em Excel (pedidos, itens, pagamentos, clientes, produtos, categorias e estoque). As fotos não vão na planilha: para elas, use o backup do hPanel. Esta ação não pode ser desfeita.</p>
      <div class="card-actions">
        <button class="btn" type="button" data-action="export-all">${icon('download', 16)}Baixar tudo em Excel</button>
        <button class="btn btn-danger-ghost" type="button" data-action="reset">${icon('trash', 16)}Zerar dados de teste</button>
      </div>
    </article>
    <section class="section" aria-labelledby="soon-title">
      <h2 id="soon-title" class="section-title">Em breve</h2>
      <div class="soon-grid">${SOON.map(([ic, title, text]) => `
        <article class="card soon-card">
          <div class="card-head"><h3 class="card-title">${icon(ic, 18)} ${esc(title)}</h3>${comingSoon()}</div>
          <p class="muted small">${esc(text)}</p>
          <button class="btn btn-sm" type="button" disabled aria-disabled="true">Indisponível</button>
        </article>`).join('')}</div>
    </section>`

  async function check() {
    const box = root.querySelector('#health')
    box.innerHTML = '<p class="muted">Verificando...</p>'
    try {
      const h = await health()
      box.innerHTML = `<dl class="kv">
        <div><dt>API</dt><dd>${h.api === 'online' ? `<span class="badge badge-success">${icon('check', 14)}Online</span>` : '<span class="badge badge-danger">Fora do ar</span>'}</dd></div>
        <div><dt>Banco de dados</dt><dd>${h.banco === 'conectado' ? `<span class="badge badge-success">${icon('check', 14)}Conectado</span>` : `<span class="badge badge-danger">${icon('alert', 14)}Com problema</span>`}</dd></div>
        <div><dt>Endereço da API</dt><dd><code>${esc(API_URL)}</code></dd></div>
        ${h.horario ? `<div><dt>Horário do servidor</dt><dd>${dateTime(h.horario)}</dd></div>` : ''}
      </dl>`
    } catch {
      box.innerHTML = `<p><span class="badge badge-danger">${icon('alert', 14)}Sem resposta</span> Não foi possível falar com a API.</p>`
    }
  }
  root.querySelector('[data-action="check"]').addEventListener('click', check)
  root.querySelector('[data-action="reset"]').addEventListener('click', openReset)
  root.querySelector('[data-action="export-all"]').addEventListener('click', (e) => withBusy(e.currentTarget, 'Gerando planilha...', async () => {
    try {
      await download('/admin/exportar/tudo.xlsx', `amanda-cosmeticos-dados-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast('Planilha baixada.')
    } catch (error) { toast(error.message, 'error') }
  }))
  check()
}

function openReset() {
  const { body, close } = openDialog({
    title: 'Zerar todos os dados de teste?',
    content: `<form novalidate>
      <p>Serão apagados <strong>todos</strong> os pedidos, pagamentos, clientes, produtos, imagens e categorias. Não há como desfazer.</p>
      <div class="field"><label for="rz-senha">Sua senha</label><input id="rz-senha" name="senha" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="rz-conf">Digite <strong>ZERAR TUDO</strong> para confirmar</label><input id="rz-conf" name="confirmacao" autocomplete="off" required></div>
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-danger-ghost" type="submit">${icon('trash', 16)}Apagar tudo</button></div>
    </form>`,
  })
  const form = body.querySelector('form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const senha = form.elements.senha.value
    const confirmacao = form.elements.confirmacao.value.trim()
    if (!senha) return formError(form, 'Informe sua senha.')
    if (confirmacao !== 'ZERAR TUDO') return formError(form, 'Digite ZERAR TUDO exatamente, em maiúsculas.')
    formError(form, '')
    await withBusy(form.querySelector('[type=submit]'), 'Apagando...', async () => {
      try {
        await api('/admin/sistema/zerar-dados', { method: 'POST', body: { senha, confirmacao } })
        invalidate()
        close()
        toast('Dados de teste apagados. Pode cadastrar os dados reais.')
      } catch (error) { formError(form, error.message) }
    })
  })
}
