-- Drop the redundant delivered_at column added in V007.
-- V001 line 157 already declares picked_up_at TIMESTAMPTZ, written by
-- OrderService.changeStatus on transition to WYDANE.  V007 duplicated it.
-- The column has zero rows so DROP is safe.
DROP INDEX IF EXISTS order_delivered_at_idx;
ALTER TABLE order_ DROP COLUMN IF EXISTS delivered_at;
