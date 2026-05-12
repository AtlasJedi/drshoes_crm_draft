-- Task ux-4: add quoted price and advance payment columns to order_.
-- Both default to 0 so existing rows are unchanged after migration.
ALTER TABLE order_
  ADD COLUMN quoted_price_cents int NOT NULL DEFAULT 0,
  ADD COLUMN advance_paid_cents int NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_.quoted_price_cents IS 'Quoted total price in minor units (PLN cents). Independent of order_item totals — represents the workshop''s estimated final price.';
COMMENT ON COLUMN order_.advance_paid_cents IS 'Advance payment already collected from the client, in minor units. Defaults to 0. Always <= quoted_price_cents at the application layer (not constrained in DB to allow flexible workflows).';
