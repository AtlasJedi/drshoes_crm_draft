-- V004: Add optimistic-locking version column to order_ aggregate root.
-- order_ and order_item tables already exist from V001.
-- @Version (JPA optimistic locking) is on Order only; order_item has no version column.
ALTER TABLE order_ ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
