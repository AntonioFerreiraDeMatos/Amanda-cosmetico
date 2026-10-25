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
- pagamentos: checkout e webhook InfinitePay;
- admin: login, dashboard, produtos, categorias e clientes.

## Autenticação

- Administrador: JWT com `tipo: administrador`, validado por `adminAuth`.
- Cliente: JWT validado por `auth`.
- Google Identity Services entrega o token ao backend, que valida o token antes de criar a sessão.

## Dados

O MySQL é a fonte dos produtos, categorias, clientes, pedidos, itens, imagens e pagamentos. O backend calcula totais e valida estoque. O navegador não deve ser usado como fonte confiável para valores financeiros.

## Fluxo de checkout

1. Cliente autentica.
2. Frontend envia itens e JWT para `/api/pagamentos/checkout`.
3. Backend consulta produtos e preços no banco.
4. Backend trava os produtos, valida estoque e cria o pedido.
5. Estoque é reservado dentro da transação.
6. InfinitePay recebe o checkout.
7. Webhook confirma o pagamento e registra `pagamentos`.

A reserva de estoque exige uma rotina operacional para cancelamento/expiração de pedidos não pagos antes de uma operação de grande volume.
