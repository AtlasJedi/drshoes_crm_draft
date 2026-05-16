-- v2-F: add target_status column to audit_log so the TimelineEventCurator
-- can distinguish STATUS_CHANGED rows that transition an order to WYDANE
-- (emitted as DONE kind in the timeline) from other status changes.
-- Column is NULL for all non-status-change rows.

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_status VARCHAR(32) NULL;
