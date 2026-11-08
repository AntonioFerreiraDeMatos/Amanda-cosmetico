# Amanda Cosméticos

Loja virtual da Amanda Cosméticos: vitrine de produtos e categorias, carrinho,
autenticação de clientes, pedidos via WhatsApp e painel administrativo.

**Produção:** [amandacosmeticos.com.br](https://amandacosmeticos.com.br)

**API:** [api.amandacosmeticos.com.br](https://api.amandacosmeticos.com.br)

## Funcionalidades

- Vitrine responsiva com categorias e catálogo de produtos.
- Carrinho com preços do catálogo oficial e fluxo de pedidos autenticado.
- Painel administrativo responsivo para dashboard, catálogo, estoque, clientes,
  pedidos, detalhes e pagamentos Pix.
- Login de clientes com Google Identity Services e sessões JWT.
- Checkout em quatro etapas; o servidor registra o pedido antes de oferecer
  Pix e um link opcional para o WhatsApp comercial.
- O painel filtra/pagina pedidos; o faturamento soma somente pagamentos Pix
  aprovados. Cancelar pedidos não pagos devolve as quantidades ao estoque.
- A administração permite corrigir cadastro e endereço de clientes, desativá-los
  sem apagar o histórico, reverter uma confirmação Pix incorreta e registrar
  entradas, saídas e ajustes de estoque com motivo e responsável.
- Movimentações de estoque do checkout, cancelamento e ajustes manuais são
  registradas; alterações administrativas têm histórico consultável no painel.
- Pedidos usam numeração sequencial de exibição (`AM-000001`); os identificadores
  internos e referências Pix legadas dos pedidos existentes são preservados.
- Pedidos cancelados e sem Pix aprovado podem ser excluídos definitivamente;
  a exclusão é auditada e o número sequencial não é reaproveitado.
- Faturamento, pagamentos e relatórios por período calculados a partir dos
  pedidos e pagamentos reais do MySQL, com exportação CSV.
- Tela **Sistema** com a ação "Zerar dados de teste", que apaga pedidos,
  clientes, produtos e categorias para iniciar a operação real. Exige a senha
  do administrador e a frase de confirmação; a conta administrativa e a
  auditoria são preservadas.
- API Express com MySQL, controle de estoque e migrações de schema.

## Tecnologias

- Frontend: Vite, JavaScript e CSS.
- Backend: Node.js, Express e MySQL.
- Autenticação: JWT e Google Identity Services.
- Upload de imagens: Multer.
- Pagamentos: combinação pelo WhatsApp, com confirmação manual pela loja.

## Estrutura do projeto

- `frontend/`: vitrine e painel administrativo.
- `backend/`: API, autenticação, rotas, migrações e lógica de pedidos.
- `docs/arquitetura.md`: componentes, autenticação, dados e checkout.
- `docs/deploy-hostinger.md`: configuração e publicação na Hostinger.

## Requisitos

- Node.js compatível com Vite 8 (Node.js 20.19+ ou 22.12+).
- MySQL para executar a API.
- npm.

## Desenvolvimento local

Configure as variáveis a partir dos exemplos, sem colocar valores reais no Git:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edite `backend/.env` com a conexão MySQL e um `JWT_SECRET` forte. Para usar
login Google e o painel administrativo, configure também os valores
necessários descritos nos exemplos de ambiente e na documentação de deploy.

Instale dependências e inicie a API:

```powershell
Set-Location backend
npm ci
npm start
```

Em outro terminal, inicie o frontend:

```powershell
Set-Location frontend
npm ci
npm run dev
```

O frontend local espera a API em `http://localhost:3000/api` por padrão.
Configure `VITE_API_URL` em `frontend/.env` se estiver usando outro endereço.

## Build do frontend

```powershell
Set-Location frontend
npm ci
npm run build
```

O conteúdo gerado em `frontend/dist` é o artefato estático a publicar. Defina
`VITE_API_URL` e `VITE_GOOGLE_CLIENT_ID` antes do build de produção. Em produção,
`VITE_API_URL` não pode apontar para `localhost`; se estiver assim, o frontend
usa a API publicada em `https://api.amandacosmeticos.com.br/api`.

## API

Rotas principais:

- Públicas: `GET /api/health`, `GET /api/produtos`, `GET /api/categorias`,
  `POST /api/auth/google`.
- Clientes autenticados: `POST /api/pedidos` (requer `Idempotency-Key`) e
  `GET /api/pedidos/:id` (recupera somente pedidos do próprio cliente).
- O checkout antigo em `POST /api/pagamentos/checkout` está desativado e retorna
  `410 Gone`; a loja usa `POST /api/pedidos` para registrar o pedido antes de
  mostrar o Pix. O WhatsApp é opcional e não confirma o pagamento.
- Administração: login, indicadores, produtos, categorias, clientes, histórico,
  lista filtrável/paginada e detalhes de pedidos em `/api/admin`.
- Status do pedido: `PATCH /api/admin/pedidos/:id/status`; o pagamento Pix só
  pode ser confirmado pelo endpoint administrativo próprio após conferência
  (`POST /api/admin/pedidos/:id/confirmar-pix`) e corrigido com
  `POST /api/admin/pedidos/:id/reverter-pix`.
- Exclusão de pedido: `DELETE /api/admin/pedidos/:id` (somente cancelado e sem
  pagamento aprovado).
- Remoção dos dados de teste: `POST /api/admin/sistema/zerar-dados` (exige senha
  e confirmação; limitado por IP como o login).
- O CORS sempre autoriza `amandacosmeticos.com.br` com e sem `www`;
  `FRONTEND_URL` apenas acrescenta outras origens.

A API aplica uma vez cada migration SQL ao iniciar e registra a execução em
`schema_migrations`. A migration de numeração preenche os números de exibição
dos pedidos existentes sem alterar seus IDs internos nem os códigos Pix legados.
Faça backup e revise as migrations antes de publicar uma nova versão. Consulte
[a documentação de arquitetura](docs/arquitetura.md) para detalhes dos fluxos.

## Testes

```powershell
Set-Location backend
npm test            # testes da API (banco simulado, não acessa o MySQL)
Set-Location ..\frontend
node --test test/   # testes do frontend
```

## Publicação e configuração

O frontend e a API estão publicados na Hostinger. A saúde da API e a conexão
com o banco foram verificadas. O catálogo de produção ainda precisa receber os
produtos reais; cadastre-os no painel administrativo. Antes de disponibilizar
compras reais, configure `PIX_KEY` no ambiente de produção e valide login Google,
credenciais administrativas, pedidos via WhatsApp e confirmação manual dos
pagamentos Pix.

Siga o [guia de deploy na Hostinger](docs/deploy-hostinger.md) para configurar
variáveis de ambiente, banco, uploads, build e validações pós-publicação.

## Segurança

- Nunca versione `.env`, tokens, senhas, logs, uploads/runtime ou backups do
  banco.
- `.env.example` contém apenas nomes e valores demonstrativos.
- Não importe o backup pessoal/teste da pasta local `backup/` em produção ou
  neste repositório público.
- Valores `VITE_*` são incorporados ao JavaScript público do frontend; não
  coloque segredos neles.
- Configure e armazene credenciais reais somente no painel da hospedagem.
