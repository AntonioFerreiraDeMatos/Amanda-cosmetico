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

O backend aplica cada arquivo de `backend/src/migrations` uma única vez e registra
o nome em `schema_migrations`. Antes de publicar uma migration nova, faça backup
do banco e revise o SQL. Não importe `backup/amanda_cosmeticos_backup.sql` em
produção: o arquivo contém dados pessoais e credenciais de teste. Cadastre e
revise categorias e produtos pelo painel administrativo depois de configurar o banco.

`003-sequencial-pedidos.sql` preserva os IDs internos e os números antigos usados
em referências Pix, adiciona `numero_exibicao` e preenche `AM-000001`, `AM-000002`
etc. em ordem crescente do ID interno. A migration também cria o alocador
MySQL append-only usado pelos próximos pedidos. Faça backup e confirme o plano de
execução antes de reiniciar o backend com essa migration em produção; não execute
o arquivo manualmente se ele já constar em `schema_migrations`.

`004-admin-auditoria-estoque.sql` adiciona tabelas de auditoria administrativa e
movimentações de estoque sem apagar tabelas ou registros existentes. Ela é necessária
para os novos ajustes de estoque, reversões de Pix e histórico administrativo do painel.

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
FRONTEND_URL=https://www.amandacosmeticos.com.br,https://amandacosmeticos.com.br
GOOGLE_CLIENT_ID=...
PIX_KEY=...
ADMIN_NAME=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

Configure `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` antes da primeira inicialização com o banco. O bootstrap cria o administrador inicial. Para redefinir a senha administrativa depois, atualize as variáveis e execute `npm run admin:create` dentro de `backend`; esse comando atualiza a conta correspondente. Guarde as credenciais apenas no painel da hospedagem; não as envie por chat nem as comite.

O checkout registra o pedido em `/api/pedidos` antes de exibir o QR Code e o código Pix copia e cola calculados no servidor. O cliente pode abrir a conversa comercial `wa.me` com a mensagem do pedido, mas essa ação é opcional. O número público da loja está em `frontend/src/order-message.js`; alterar esse número exige novo build/publicação do frontend. Configure `PIX_KEY` com a chave Pix válida da loja no ambiente Node.js da Hostinger; não coloque a chave no Git. Não há gateway ou link de pagamento. O pedido permanece aguardando pagamento até Amanda conferir o recebimento e confirmar no painel. O frete permanece a confirmar e não compõe o valor do QR. O endpoint antigo `/api/pagamentos/checkout` continua retornando `410 Gone`.

O Hostinger Business oferece suporte a Node.js. A inicialização aplica as migrações e, depois, inicia a API.
O CORS autoriza explicitamente os domínios oficiais com e sem `www`, independentemente
de `NODE_ENV`; `FRONTEND_URL` pode conter origens adicionais separadas por vírgula.
Origens não listadas continuam rejeitadas.

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

Depois de publicar uma alteração no backend, confirme que o deploy usou o pacote
atualizado (e não a origem de um deploy anterior) e reinicie a aplicação Node.js.
O processo de inicialização aplica migrações ainda não registradas em
`schema_migrations`.
Valide os preflights para as origens oficiais:

```bash
curl -i -X OPTIONS https://api.amandacosmeticos.com.br/api/admin/login \
  -H "Origin: https://www.amandacosmeticos.com.br" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"

curl -i -X OPTIONS https://api.amandacosmeticos.com.br/api/auth/google \
  -H "Origin: https://amandacosmeticos.com.br" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Ambas devem retornar `204` e incluir `Access-Control-Allow-Origin`,
`Access-Control-Allow-Methods` e `Access-Control-Allow-Headers`. Uma origem externa
não autorizada não deve receber `Access-Control-Allow-Origin`.

## Frontend

Antes do build, configure `frontend/.env`:

```env
VITE_API_URL=https://api.amandacosmeticos.com.br/api
VITE_GOOGLE_CLIENT_ID=...
```

Use a URL pública da API no build. Se `VITE_API_URL` estiver ausente ou apontar
para `localhost` em um build de produção, o frontend usa
`https://api.amandacosmeticos.com.br/api`.

Gere o build:

```bash
npm ci
npm run build
```

Publique somente o conteúdo de `frontend/dist` no domínio do site.
O domínio canônico é `https://www.amandacosmeticos.com.br`, e o arquivo
`.htaccess` redireciona a raiz sem `www` para ele. A API aceita as duas origens
via CORS. A correção de CORS requer publicar o backend atualizado e reiniciar o
processo Node.js; publicar apenas o frontend não atualiza a política da API.

## Google Login

No Google Cloud, adicione `https://www.amandacosmeticos.com.br` como origem
JavaScript autorizada e configure o mesmo Client ID no ambiente do backend e em
`VITE_GOOGLE_CLIENT_ID` antes do build. Teste login, logout e expiração de
sessão.

## Pix

Configure `PIX_KEY` no ambiente da aplicação Node.js e reinicie a aplicação. Faça um pedido de teste: confira o valor, leia o QR Code ou copie o código Pix e verifique que o pedido aparece no painel com pagamento pendente. O valor Pix cobre somente os produtos; combine o frete separadamente. Confirme no painel somente depois de verificar o recebimento real na conta.

No painel, confirme que o faturamento soma somente pagamentos aprovados, os filtros e detalhes do pedido retornam dados reais e os status de preparação/entrega só avançam depois da aprovação do Pix. O cancelamento administrativo deve ser testado apenas em pedido de teste não pago e devolver o estoque dentro da mesma transação.

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
- [ ] Pedido é gravado em `/api/pedidos` antes de abrir o WhatsApp.
- [ ] Pedido e histórico exibem a numeração sequencial `AM-000001`; pedidos antigos mantêm suas referências Pix legadas.
- [ ] Frete está identificado como pendente de confirmação.
- [ ] A aprovação manual de Pix e os links de WhatsApp foram testados.
- [ ] Nenhum `.env`, token ou backup com dados pessoais foi publicado.
