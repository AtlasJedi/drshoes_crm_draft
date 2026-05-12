-- M8 task m8-fb-1b: add free-text note column to audit_log.
-- Populated only for STATUS_CHANGED rows where the operator provided a note.
-- No index — notes are read only via order audit timeline (filtered by parent_entity_id).
ALTER TABLE audit_log ADD COLUMN note TEXT NULL;
