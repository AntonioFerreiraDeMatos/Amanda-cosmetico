# Amanda Cosméticos

Loja virtual da Amanda Cosméticos: vitrine de produtos e categorias, carrinho,
autenticação de clientes, checkout e painel administrativo.

**Produção:** [amandacosmeticos.com.br](https://amandacosmeticos.com.br)

**API:** [api.amandacosmeticos.com.br](https://api.amandacosmeticos.com.br)

## Funcionalidades

- Vitrine responsiva com categorias e catálogo de produtos.
- Carrinho e fluxo de pedidos autenticado.
- Painel administrativo para catálogo, categorias, clientes e dashboard.
- Login de clientes com Google Identity Services e sessões JWT.
- Integração de checkout e webhook InfinitePay.
- API Express com MySQL, controle de estoque e migrações de schema.

## Tecnologias

- Frontend: Vite, JavaScript e CSS.
- Backend: Node.js, Express e MySQL.
- Autenticação: JWT e Google Identity Services.
- Upload de imagens: Multer.
- Pagamentos: InfinitePay.

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
login Google, pagamentos ou o painel administrativo, configure também os valores
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
`VITE_API_URL` e `VITE_GOOGLE_CLIENT_ID` antes do build de produção.

## API

Rotas principais:

- Públicas: `GET /api/health`, `GET /api/produtos`, `GET /api/categorias`,
  `POST /api/auth/google`.
- Clientes autenticados: `POST /api/pedidos`,
  `POST /api/pagamentos/checkout`.
- Administração: login, dashboard, produtos, categorias, clientes e histórico
  em `/api/admin`.

A API aplica as migrações SQL ao iniciar. As migrações criam tabelas ausentes e
não importam dados. Consulte [a documentação de arquitetura](docs/arquitetura.md)
para detalhes dos fluxos.

## Publicação e configuração

O frontend e a API estão publicados na Hostinger. A saúde da API e a conexão
com o banco foram verificadas. O catálogo de produção ainda precisa receber os
produtos reais; cadastre-os no painel administrativo. Antes de disponibilizar
compras reais, valide no ambiente de produção login Google, credenciais
administrativas, handle e webhook InfinitePay.

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
