-- V029: add USLUGA and RENOWACJA order item kinds.
ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;

ALTER TABLE order_item ADD CONSTRAINT order_item_kind_check
  CHECK (kind IN ('NAPRAWA', 'CUSTOM', 'USLUGA', 'RENOWACJA'));
