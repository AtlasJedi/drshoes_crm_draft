-- =============================================================================
-- V021 — order_item.description becomes nullable
-- Description is shown as "opcjonalnie" in the New Order form; the create-order
-- payload may send description=null. The original NOT NULL constraint in V001
-- caused 500s on every order create that omitted item descriptions.
-- =============================================================================

ALTER TABLE order_item
  ALTER COLUMN description DROP NOT NULL;
