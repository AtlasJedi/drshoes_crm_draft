-- V011: add error_code + error_message columns to webhook_event.
-- Needed by WebhookEventMapper to store bounce/spam error details
-- alongside the forensic event row. Both columns are nullable:
-- DELIVERED events have no error; DROPPED/NO_MESSAGE events also
-- have no error to store.

ALTER TABLE webhook_event
    ADD COLUMN error_code    VARCHAR(60),
    ADD COLUMN error_message TEXT;
