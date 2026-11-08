CREATE TABLE IF NOT EXISTS `pedido_idempotencia` (
  `cliente_id` bigint unsigned NOT NULL,
  `chave` varchar(64) COLLATE utf8mb4_bin NOT NULL,
  `pedido_id` bigint unsigned NOT NULL,
  `request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cliente_id`,`chave`),
  UNIQUE KEY `uk_pedido_idempotencia_pedido` (`pedido_id`),
  CONSTRAINT `fk_pedido_idempotencia_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pedido_idempotencia_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
