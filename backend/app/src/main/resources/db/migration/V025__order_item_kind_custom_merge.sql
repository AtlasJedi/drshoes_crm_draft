-- M-v2-C: collapse CUSTOM_BUTY + CUSTOM_KURTKA into a single CUSTOM kind.
-- Audit log entries holding old strings stay intact (history is immutable).

UPDATE order_item
SET kind = 'CUSTOM'
WHERE kind IN ('CUSTOM_BUTY', 'CUSTOM_KURTKA');

ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;
ALTER TABLE order_item ADD CONSTRAINT order_item_kind_check
  CHECK (kind IN ('NAPRAWA', 'CUSTOM'));
