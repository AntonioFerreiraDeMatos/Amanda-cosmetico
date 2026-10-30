# Deploy na Hostinger

## Estado atual

A vitrine e a API estão publicadas em `amandacosmeticos.com.br` e
`api.amandacosmeticos.com.br`. A API e a conexão com o banco foram verificadas.
O catálogo de produção ainda precisa ser preenchido com os produtos reais.
Confirme o login Google, o acesso administrativo e o fluxo completo de pagamento
no ambiente de produção antes de divulgar compras reais.

## Pré-requisitos

- Plano Hostinger com suporte a Node.js ou uma VPS.
- Banco MySQL criado no painel.
- Domínio com HTTPS ativo.
- Um endereço para o frontend, por exemplo `https://amandacosmeticos.com.br`.
- Um endereço para a API, por exemplo `https://api.amandacosmeticos.com.br`.

Hospedagem compartilhada sem processo Node.js não consegue executar o backend Express continuamente. Nesse caso, hospede o frontend como site estático e use uma hospedagem Node/VPS para a API.

## Banco

O backend aplica o schema de `backend/src/migrations` ao iniciar e cria apenas tabelas ausentes; ele não apaga nem importa registros. Não importe `backup/amanda_cosmeticos_backup.sql` em produção: o arquivo contém dados pessoais e credenciais de teste. Cadastre e revise categorias e produtos pelo painel administrativo depois de configurar o banco.

Antes de publicar, troque a senha do usuário MySQL existente no hPanel e configure a senha nova nas variáveis do aplicativo. Não reutilize credenciais que tenham sido expostas.

## Backend

Publique `backend` como aplicativo Node.js no subdomínio `api.amandacosmeticos.com.br`, sem `node_modules` e sem arquivos `.env`. No ambiente da Hostinger configure:

```env
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=gere-um-segredo-longo-e-aleatorio
BACKEND_URL=https://api.amandacosmeticos.com.br
FRONTEND_URL=https://amandacosmeticos.com.br
GOOGLE_CLIENT_ID=...
ADMIN_NAME=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
INFINITEPAY_API_KEY=...
INFINITEPAY_HANDLE=...
INFINITEPAY_WEBHOOK_URL=https://api.amandacosmeticos.com.br/api/pagamentos/webhook
```

Configure `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` antes da primeira inicialização com o banco. O bootstrap cria um administrador uma única vez e desativa os administradores anteriores. Em produção, se essas variáveis estiverem ausentes, os administradores existentes são desativados até a nova senha ser configurada. Guarde as credenciais apenas no painel da hospedagem; não as envie por chat nem as comite.

Para o checkout InfinitePay, configure `INFINITEPAY_API_KEY` no ambiente do backend da hospedagem. A chave é enviada pelo servidor no cabeçalho `X-Api-Key` e nunca deve ser colocada em `frontend/.env` ou no código do navegador. Sem API key, o backend aceita `INFINITEPAY_HANDLE` como alternativa. Quando a API key está configurada, o checkout autentica por ela e não envia o handle. O webhook é registrado para o evento `paid`.

O Hostinger Business oferece suporte a Node.js. A inicialização aplica as migrações e, depois, inicia a API.

Execute:

```bash
npm ci --omit=dev
npm start
```

A API deve responder:

```text
GET https://api.amandacosmeticos.com.br/api/health
```

A resposta esperada informa `api: online` e `banco: conectado`.

## Frontend

Antes do build, configure `frontend/.env`:

```env
VITE_API_URL=https://api.amandacosmeticos.com.br/api
VITE_GOOGLE_CLIENT_ID=...
```

Gere o build:

```bash
npm ci
npm run build
```

Publique somente o conteúdo de `frontend/dist` no domínio do site.

## Google Login

No Google Cloud, adicione o domínio final como origem JavaScript autorizada e configure o mesmo Client ID no ambiente do backend e em `VITE_GOOGLE_CLIENT_ID` antes do build. Teste login, logout e expiração de sessão.

## InfinitePay

O checkout só deve ser liberado após configurar o handle e o webhook HTTPS. Teste um pagamento real ou sandbox conforme a conta InfinitePay e confirme a transição do pedido e o registro em `pagamentos`.

## Uploads

Garanta que `backend/uploads/produtos` exista e seja gravável pelo processo Node. Confirme que uma imagem cadastrada responde em:

```text
https://api.amandacosmeticos.com.br/uploads/produtos/arquivo.ext
```

## Checklist final

- [ ] API responde `200` em `https://api.amandacosmeticos.com.br/api/health`, com banco conectado.
- [ ] Banco conecta.
- [ ] CORS aceita apenas o frontend final.
- [ ] Login administrativo funciona.
- [ ] Google Login funciona.
- [ ] Produto aparece na loja após cadastro.
- [ ] Upload de imagem funciona.
- [ ] Checkout usa `/api/pagamentos/checkout`.
- [ ] Webhook InfinitePay está configurado.
- [ ] Nenhum `.env`, token ou backup com dados pessoais foi publicado.
