# Arquitetura

## Frontend

O frontend é uma aplicação Vite multipágina:

- `index.html`: vitrine, carrinho, autenticação do cliente e checkout.
- `admin.html`: painel administrativo.
- `src/main.js`: renderização da loja e integrações com API.
- `src/admin.js`: estado e renderização do painel.

O frontend não é uma camada de segurança. Todas as regras de autenticação, estoque e valores devem ser validadas no backend.

## Backend

O backend é Express com controllers e queries SQL diretamente nos controllers. As rotas são separadas por domínio:

- catálogo: produtos e categorias;
- cliente: cadastro e autenticação;
- pedidos: criação autenticada;
- pagamentos: confirmação manual de Pix pelo painel administrativo;
- admin: login, dashboard, produtos, categorias, clientes e gestão de pedidos.

## Autenticação

- Administrador: JWT com `tipo: administrador`, validado por `adminAuth`; cada
  requisição também confirma no banco que a conta identificada ainda está ativa.
- Cliente: JWT validado por `auth`.
- Google Identity Services entrega o token ao backend, que valida o token antes de criar a sessão.

## Dados

O MySQL é a fonte dos produtos, categorias, clientes, pedidos, itens, imagens e pagamentos. O backend calcula totais e valida estoque. O navegador não deve ser usado como fonte confiável para valores financeiros.

## Checkout Pix e WhatsApp

1. Cliente autentica e percorre as etapas de carrinho, entrega, Pix e acompanhamento.
2. Frontend envia somente IDs e quantidades, o endereço e uma chave de idempotência para `/api/pedidos`.
3. Backend serializa pedidos do cliente, consulta preços atuais e valida disponibilidade e estoque.
4. Backend cria o endereço, pedido, itens, pagamento Pix pendente e vínculo de idempotência na mesma transação; o estoque é reservado. O payload Pix copia e cola é calculado com o valor persistido no pagamento.
5. O total salvo contém somente os produtos. O frete permanece não confirmado e é combinado pelo WhatsApp.
6. Após a gravação, o frontend exibe o QR Code e o código Pix copia e cola; o cliente pode, opcionalmente, abrir uma mensagem pronta no WhatsApp.
7. `GET /api/pedidos/:id` permite que o cliente autenticado recupere os dados do próprio pedido após recarregar a página.
8. O pedido permanece aguardando pagamento. Após verificar o recebimento real, o administrador confirma o Pix no painel; o cliente não pode aprovar o próprio pagamento.

O WhatsApp comercial usa o formato `https://wa.me/<número>` e recebe a mensagem do pedido. A mensagem inclui os dados do cliente, entrega, produtos, quantidades, valores unitários e subtotal. Ela explicita que o frete precisa ser cotado e que o total final ainda será informado; abrir ou enviar a mensagem não registra o pedido nem confirma o pagamento.

O endpoint antigo `POST /api/pagamentos/checkout` continua desativado e responde `410 Gone`; a loja usa `POST /api/pedidos`. Não há gateway, link de pagamento ou webhook. A variável `PIX_KEY` deve conter uma chave Pix válida. O valor do QR cobre somente os produtos; o frete não está incluído.

O painel usa `GET /api/admin/pedidos` com filtros e paginação, `GET /api/admin/pedidos/:id` para detalhes, `PATCH /api/admin/pedidos/:id/dados` para observações e correção de entrega e `PATCH /api/admin/pedidos/:id/status` para transições do pedido. A lista inclui itens, quantidades e busca por cliente, número ou telefone; pagamentos e faturamento usam apenas pagamentos aprovados. A correção de entrega cria um endereço associado ao pedido em vez de alterar um endereço que possa estar ligado a outros pedidos. A confirmação de Pix permanece em endpoint separado e exige conferência real. Cancelar pelo painel é permitido somente para pedido não pago e, na mesma transação, cancela o Pix pendente e devolve as quantidades reservadas ao estoque.

O schema mantém os horários de criação e última atualização, mas não possui tabela de histórico de eventos/status. O Pix manual não consulta automaticamente a conta bancária. A tabela `pedido_idempotencia` impede duplicação do pedido ao repetir a mesma chave por cliente.
