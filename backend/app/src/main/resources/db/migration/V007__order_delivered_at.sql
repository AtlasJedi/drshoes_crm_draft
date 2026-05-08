-- Add delivered_at to order_ for AFTER_HANDOVER_Y_DAYS trigger queries.
-- Populated when order transitions to WYDANE (handed over to client).
ALTER TABLE order_ ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
CREATE INDEX order_delivered_at_idx ON order_ (delivered_at)
  WHERE delivered_at IS NOT NULL AND deleted_at IS NULL;
