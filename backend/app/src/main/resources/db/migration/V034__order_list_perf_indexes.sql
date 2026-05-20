-- V034: partial B-tree indexes backing the order list + kanban access paths.
--
-- Targets the queries documented in
-- docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md.
--
-- All three are partial (deleted_at IS NULL) so they stay tiny: ~50 KB at
-- 1k orders, ~500 KB at 10k. The existing order_status_pickup_idx
-- (status, planned_pickup_at) stays — used by trigger queries + calendar.

-- (1) Backs the LIST default sort across active statuses:
--     SELECT * FROM order_
--      WHERE status IN (5 active) AND deleted_at IS NULL
--      ORDER BY created_at DESC LIMIT 25 OFFSET 0
CREATE INDEX order_active_created_at_idx
  ON order_ (created_at DESC)
  WHERE deleted_at IS NULL
    AND status IN ('WSTEPNIE_PRZYJETE','PRZYJETE','W_REALIZACJI',
                   'CZEKA_NA_KLIENTA','GOTOWE_DO_ODBIORU');

-- (2) Backs the Kanban per-column query:
--     SELECT * FROM order_
--      WHERE status = ? AND deleted_at IS NULL
--      ORDER BY received_at DESC LIMIT ?
CREATE INDEX order_status_received_at_idx
  ON order_ (status, received_at DESC)
  WHERE deleted_at IS NULL;

-- (3) Backs the Kanban WYDANE column AND the LIST 30d cap branch:
--     SELECT * FROM order_
--      WHERE status='WYDANE' AND deleted_at IS NULL
--      ORDER BY picked_up_at DESC NULLS LAST LIMIT ?
--   and
--     SELECT * FROM order_
--      WHERE status='WYDANE' AND picked_up_at >= ? AND deleted_at IS NULL
CREATE INDEX order_wydane_picked_up_at_idx
  ON order_ (picked_up_at DESC NULLS LAST)
  WHERE status = 'WYDANE' AND deleted_at IS NULL;
