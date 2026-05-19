-- V033: Owner directive (2026-05-19) — destroy existing order_item rows to simplify enum migration.
-- FKs into order_item: photo.order_item_id REFERENCES order_item(id) ON DELETE SET NULL
--   → CASCADE on TRUNCATE will null out photo.order_item_id for any existing photo rows.
-- audit_log carries entity refs as strings/jsonb — no FK, unaffected.
TRUNCATE TABLE order_item RESTART IDENTITY CASCADE;
ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;
ALTER TABLE order_item
  ADD CONSTRAINT order_item_kind_check
  CHECK (kind IN ('CZYSZCZENIE', 'RENOWACJA', 'NAPRAWA', 'SZEWC', 'CUSTOM'));
ALTER TABLE order_item ALTER COLUMN kind SET DEFAULT 'CZYSZCZENIE';
