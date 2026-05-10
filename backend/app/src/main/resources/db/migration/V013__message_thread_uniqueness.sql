-- V013: unique partial indexes on message_thread to close the M5 mid-flight gap.
-- Prevents duplicate (channel, client_id) matched threads and
-- duplicate (channel, raw_sender) unmatched threads per active (non-discarded) state.
-- Discarded threads (discarded_at IS NOT NULL) are excluded from both indexes
-- so operators can re-create a thread after discarding an earlier one.
--
-- NOTE: before creating the unique indexes, deduplicate any existing rows that
-- would violate the constraint (retaining the oldest row by created_at).
-- In dev/test the DB is always clean; in production this removes true duplicates.

-- Deduplicate matched threads: keep oldest per (channel, client_id) where not discarded
DELETE FROM message_thread
WHERE id NOT IN (
    SELECT DISTINCT ON (channel, client_id) id
    FROM message_thread
    WHERE client_id IS NOT NULL AND discarded_at IS NULL
    ORDER BY channel, client_id, created_at ASC
)
AND client_id IS NOT NULL AND discarded_at IS NULL;

-- Deduplicate unmatched threads: keep oldest per (channel, raw_sender) where not discarded
DELETE FROM message_thread
WHERE id NOT IN (
    SELECT DISTINCT ON (channel, raw_sender) id
    FROM message_thread
    WHERE raw_sender IS NOT NULL AND discarded_at IS NULL
    ORDER BY channel, raw_sender, created_at ASC
)
AND raw_sender IS NOT NULL AND discarded_at IS NULL;

-- Unique partial index for matched threads (known client, not discarded)
CREATE UNIQUE INDEX message_thread_unique_matched
    ON message_thread (channel, client_id)
    WHERE client_id IS NOT NULL AND discarded_at IS NULL;

-- Unique partial index for unmatched threads (unknown sender, not discarded)
CREATE UNIQUE INDEX message_thread_unique_unmatched
    ON message_thread (channel, raw_sender)
    WHERE raw_sender IS NOT NULL AND discarded_at IS NULL;
