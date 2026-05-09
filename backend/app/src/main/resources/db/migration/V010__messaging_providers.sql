-- V010: webhook_event forensics table + retry chain columns on message.
-- NOTE: applied_outcome CHECK includes PROCESSING (plan amendment to spec §3.5).
-- PROCESSING allows a two-phase INSERT-then-UPDATE pattern in WebhookStatusReconciler
-- without a mid-transaction CHECK violation. Value is never persisted at commit.

CREATE TABLE webhook_event (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider             VARCHAR(20) NOT NULL CHECK (provider IN ('POSTMARK','SMSAPI')),
  provider_event_id    VARCHAR(120),
  provider_message_id  VARCHAR(120),
  message_id           UUID REFERENCES message(id) ON DELETE SET NULL,
  event_type           VARCHAR(40) NOT NULL,
  applied_status       VARCHAR(16) CHECK (applied_status IN ('DELIVERED','FAILED')),
  applied_outcome      VARCHAR(20) NOT NULL CHECK (applied_outcome IN
                         ('APPLIED','DEDUP','NO_MESSAGE','NO_TRANSITION','DROPPED','PROCESSING')),
  raw_payload          JSONB NOT NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ
);

CREATE UNIQUE INDEX webhook_event_provider_eventid_uq
  ON webhook_event (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX webhook_event_provider_msgid_idx
  ON webhook_event (provider, provider_message_id);

-- Retry chain on message: preserves full send history for the operator thread view.
ALTER TABLE message
  ADD COLUMN retry_of_message_id UUID REFERENCES message(id),
  ADD COLUMN retry_attempt        INTEGER NOT NULL DEFAULT 1;

CREATE INDEX message_retry_chain_idx ON message (retry_of_message_id)
  WHERE retry_of_message_id IS NOT NULL;
