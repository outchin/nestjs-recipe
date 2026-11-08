-- Inventory lab seed. Re-runnable: resets the scenario to "2 users, last item in stock".
-- Tables are created by TypeORM (DB_SYNC=true) — start the API with DB_DRIVER=mysql first.
-- Both users' password: password123
SET NAMES utf8mb4;

-- CHECK constraints: TypeORM's MySQL driver ignores @Check, so add them here (only if missing).
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_products_stock_non_negative') = 0,
  'ALTER TABLE products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0)', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_products_price_non_negative') = 0,
  'ALTER TABLE products ADD CONSTRAINT chk_products_price_non_negative CHECK (price >= 0)', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_order_items_quantity_positive') = 0,
  'ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DELETE FROM order_items;
DELETE FROM orders;

INSERT INTO users (email, password_hash, display_name) VALUES
  ('alice@lab.local', 'scrypt$5f2f8c9060ba4f183b8e1d6004d4c8f6$adbddfed910ef81d653784f9c0e83d6b389786abfc181a3f2cc92b067a6ac641913cd311b74f03b70d8266c9ad6b6635971245bc29cdc5ea88924b19e4fa86d8', 'Alice'),
  ('bob@lab.local',   'scrypt$5f2f8c9060ba4f183b8e1d6004d4c8f6$adbddfed910ef81d653784f9c0e83d6b389786abfc181a3f2cc92b067a6ac641913cd311b74f03b70d8266c9ad6b6635971245bc29cdc5ea88924b19e4fa86d8', 'Bob')
AS new ON DUPLICATE KEY UPDATE display_name = new.display_name, password_hash = new.password_hash;

INSERT INTO products (sku, name, price, stock, version) VALUES
  ('SNEAKER-LTD-001', 'Limited Edition Sneaker', 199.00, 1,  1),  -- the contended one
  ('TSHIRT-BASIC-001', 'Basic T-Shirt',            15.00, 50, 1)
AS new ON DUPLICATE KEY UPDATE name = new.name, price = new.price, stock = new.stock, version = 1;

SELECT id, email, display_name FROM users;
SELECT id, sku, name, price, stock, version FROM products;
