-- M-v2-C: collapse CUSTOM_BUTY + CUSTOM_KURTKA into a single CUSTOM kind.
-- Audit log entries holding old strings stay intact (history is immutable).
--
-- Order matters: drop the old check constraint FIRST so the UPDATE that introduces
-- the new "CUSTOM" value doesn't trip it; then re-add the constraint with the
-- new allowed-set. (Original V025 had UPDATE before DROP and failed on any DB
-- that still had CUSTOM_BUTY rows — fixed 2026-05-17 before V025 ever ran.)

ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;

UPDATE order_item
SET kind = 'CUSTOM'
WHERE kind IN ('CUSTOM_BUTY', 'CUSTOM_KURTKA');

ALTER TABLE order_item ADD CONSTRAINT order_item_kind_check
  CHECK (kind IN ('NAPRAWA', 'CUSTOM'));
