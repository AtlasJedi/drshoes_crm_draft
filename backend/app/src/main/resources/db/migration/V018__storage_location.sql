-- V018: Replace proto storage_location schema (V001) with M10 design.
--
-- V001 had: UUID pk, code, description, color — a more complex proto schema.
-- M10 design: BIGSERIAL pk, name UNIQUE, position, active — simpler string-set admin table.
-- orders.current_storage_location_id (UUID FK) column is preserved as-is; the new
-- denormalized orders.location VARCHAR(64) column is added in V019.
--
-- CASCADE drops the FK constraint from order_.current_storage_location_id and the
-- order_storage_idx automatically.
DROP TABLE storage_location CASCADE;

CREATE TABLE storage_location (
  id          BIGSERIAL    PRIMARY KEY,
  name        VARCHAR(64)  NOT NULL UNIQUE,
  position    INTEGER      NOT NULL DEFAULT 0,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_location_active_position
  ON storage_location (active, position);
