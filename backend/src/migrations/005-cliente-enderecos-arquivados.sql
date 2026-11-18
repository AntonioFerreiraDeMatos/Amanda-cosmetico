-- Área do cliente: endereços usados em pedidos nunca são alterados nem apagados,
-- para preservar o endereço histórico de cada pedido. Ao editar ou remover um
-- desses endereços, a conta arquiva a versão antiga e (na edição) cria uma nova.

ALTER TABLE `enderecos`
  ADD COLUMN `arquivado` tinyint(1) NOT NULL DEFAULT '0' AFTER `principal`,
  ADD KEY `idx_endereco_cliente_ativo` (`cliente_id`, `arquivado`);
