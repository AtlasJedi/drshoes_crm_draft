-- M11 fix batch: items are the only writer for quoted_price_cents.
-- Backfill historic rows where quoted_price_cents drifted from total_price_cents.
-- Going forward, OrderItemService.recomputeTotal keeps them in sync.

UPDATE order_
SET quoted_price_cents = total_price_cents
WHERE quoted_price_cents <> total_price_cents;
