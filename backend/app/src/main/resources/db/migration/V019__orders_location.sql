-- M10 wave 1: add denormalized storage location to orders.
-- Plain VARCHAR, no FK to storage_location.name — rename-resistant by design
-- (owner directive 2026-05-16: "no IDs, no joins, simple CRM").
ALTER TABLE order_ ADD COLUMN location VARCHAR(64) NULL;
