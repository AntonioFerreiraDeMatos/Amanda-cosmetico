-- Migration one-time: back up the database before applying.
-- Preserves pedidos.id and legacy numero_pedido (including existing Pix TXIDs).

ALTER TABLE `pedidos`
  ADD COLUMN `numero_exibicao` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL
  AFTER `numero_pedido`;

CREATE TABLE `pedido_numeracao_sequencial` (
  `sequencial` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pedido_id` bigint unsigned DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sequencial`),
  UNIQUE KEY `uk_pedido_numeracao_pedido` (`pedido_id`),
  CONSTRAINT `fk_pedido_numeracao_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `pedido_numeracao_sequencial` (`pedido_id`)
SELECT `id`
FROM `pedidos`
ORDER BY `id` ASC;

UPDATE `pedidos` p
INNER JOIN `pedido_numeracao_sequencial` n ON n.`pedido_id` = p.`id`
SET p.`numero_exibicao` = CONCAT(
  'AM-',
  LPAD(
    CAST(n.`sequencial` AS CHAR),
    GREATEST(6, CHAR_LENGTH(CAST(n.`sequencial` AS CHAR))),
    '0'
  )
);

ALTER TABLE `pedidos`
  MODIFY COLUMN `numero_exibicao` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD UNIQUE KEY `uk_pedido_numero_exibicao` (`numero_exibicao`);
