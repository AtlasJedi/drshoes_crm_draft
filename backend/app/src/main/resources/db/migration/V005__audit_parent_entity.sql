-- V005: Add parent_entity_id pointer for hierarchical audit timeline.
-- Allows item-level operations (e.g. OrderItem mutations) to be grouped
-- under their parent entity (e.g. the containing Order) in the timeline.
ALTER TABLE audit_log ADD COLUMN parent_entity_id UUID;
CREATE INDEX audit_log_parent_idx ON audit_log (parent_entity_id, created_at)
  WHERE parent_entity_id IS NOT NULL;
