-- Código de barras (EAN-13, EAN-8, UPC, Code128...) para leitura por pistola
-- USB/Bluetooth ou câmera do celular. Único por produto; vazio é permitido.

ALTER TABLE `produtos`
  ADD COLUMN `codigo_barras` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `sku`,
  ADD UNIQUE KEY `uk_produto_codigo_barras` (`codigo_barras`),
  ADD KEY `idx_produto_nome` (`nome`);
