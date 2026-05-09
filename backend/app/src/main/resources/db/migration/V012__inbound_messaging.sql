-- V012: inbound messaging support.
-- Makes client_id nullable on message_thread + message (unmatched inbound rows have no client).
-- Adds raw_sender VARCHAR(255) — set for unmatched, NULL for matched rows.
-- Adds discarded_at TIMESTAMPTZ to message_thread (soft-delete for quarantine).
-- Adds channel VARCHAR(16) to message_thread (per-channel threading; defaults to EMAIL for existing rows).
-- CHECK constraints ensure exactly one of (client_id, raw_sender) is non-null per row.
-- Idempotency: UNIQUE partial (provider_message_id, channel) WHERE provider_message_id IS NOT NULL on message.

ALTER TABLE message_thread ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE message_thread ADD COLUMN raw_sender    VARCHAR(255) NULL;
ALTER TABLE message_thread ADD COLUMN discarded_at  TIMESTAMPTZ NULL;
ALTER TABLE message_thread ADD COLUMN channel       VARCHAR(16) NOT NULL DEFAULT 'EMAIL'
                               CHECK (channel IN ('EMAIL','SMS','WHATSAPP'));
ALTER TABLE message_thread
  ADD CONSTRAINT message_thread_client_or_raw
  CHECK (
    (client_id IS NOT NULL AND raw_sender IS NULL)
    OR (client_id IS NULL AND raw_sender IS NOT NULL)
  );

ALTER TABLE message ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE message ADD COLUMN raw_sender VARCHAR(255) NULL;
ALTER TABLE message
  ADD CONSTRAINT message_client_or_raw
  CHECK (
    (client_id IS NOT NULL AND raw_sender IS NULL)
    OR (client_id IS NULL AND raw_sender IS NOT NULL)
  );

CREATE INDEX message_thread_unmatched_idx ON message_thread (channel, raw_sender)
  WHERE client_id IS NULL;

CREATE UNIQUE INDEX message_provider_msg_channel_unique_idx
  ON message (provider_message_id, channel)
  WHERE provider_message_id IS NOT NULL;
