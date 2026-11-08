CREATE TABLE IF NOT EXISTS `admin_auditoria` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `administrador_id` bigint unsigned DEFAULT NULL,
  `acao` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidade` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidade_id` bigint unsigned NOT NULL,
  `motivo` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `antes_json` longtext COLLATE utf8mb4_unicode_ci,
  `depois_json` longtext COLLATE utf8mb4_unicode_ci,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_auditoria_entidade` (`entidade`,`entidade_id`,`id`),
  KEY `idx_admin_auditoria_data` (`criado_em`),
  CONSTRAINT `fk_admin_auditoria_admin`
    FOREIGN KEY (`administrador_id`) REFERENCES `administradores` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estoque_movimentacoes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `produto_id` bigint unsigned NOT NULL,
  `administrador_id` bigint unsigned DEFAULT NULL,
  `pedido_id` bigint unsigned DEFAULT NULL,
  `tipo` enum('entrada','saida','ajuste','baixa_pedido','devolucao_pedido') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade_anterior` int unsigned NOT NULL,
  `quantidade_nova` int unsigned NOT NULL,
  `diferenca` bigint NOT NULL,
  `motivo` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chave_idempotencia` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_estoque_idempotencia` (`chave_idempotencia`),
  KEY `idx_estoque_movimento_produto` (`produto_id`,`id`),
  KEY `idx_estoque_movimento_pedido` (`pedido_id`),
  CONSTRAINT `fk_estoque_movimento_produto`
    FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_estoque_movimento_admin`
    FOREIGN KEY (`administrador_id`) REFERENCES `administradores` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_estoque_movimento_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
