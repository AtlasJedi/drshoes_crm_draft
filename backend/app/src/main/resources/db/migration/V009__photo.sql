-- M3 photo gallery (admin-only).
-- V001 bootstrapped a proto `photo` table (no uploaded_by NOT NULL, no size_bytes,
-- no original_filename, label as CHECK string, extra width/height/bytes/position
-- columns). No production data exists — safe to drop and recreate with the
-- authoritative M3 schema.

DROP TABLE IF EXISTS photo;

CREATE TYPE photo_label AS ENUM ('BEFORE','IN_PROGRESS','AFTER','OTHER');

CREATE TABLE photo (
  id                UUID PRIMARY KEY,
  order_id          UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  order_item_id     UUID REFERENCES order_item(id) ON DELETE SET NULL,
  uploaded_by       UUID NOT NULL REFERENCES user_(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  s3_key            TEXT NOT NULL UNIQUE,
  mime              TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL CHECK (size_bytes > 0),
  label             photo_label NOT NULL DEFAULT 'OTHER',
  original_filename TEXT NOT NULL
);

CREATE INDEX idx_photo_order ON photo(order_id, uploaded_at DESC);
CREATE INDEX idx_photo_order_item ON photo(order_item_id) WHERE order_item_id IS NOT NULL;

COMMENT ON TABLE  photo IS 'Per-order photo gallery. Hard delete; audit log is forensic record.';
COMMENT ON COLUMN photo.s3_key IS 'Format: orders/{orderId}/{photoId}-{slugifiedFilename}. Unique.';
COMMENT ON COLUMN photo.label  IS 'BEFORE | IN_PROGRESS | AFTER | OTHER. Default OTHER on upload.';
