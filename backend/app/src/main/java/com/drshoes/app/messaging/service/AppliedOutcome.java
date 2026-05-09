package com.drshoes.app.messaging.service;

/**
 * Outcome of a single {@link WebhookStatusReconciler#apply} call.
 *
 * Mirrors the CHECK constraint values in webhook_event.applied_outcome
 * (V010 + plan errata §1 which adds PROCESSING):
 *
 *   APPLIED       — state-guarded UPDATE succeeded; message status advanced.
 *   DEDUP         — duplicate provider_event_id; row already exists; skipped.
 *   NO_MESSAGE    — providerMessageId not found in message table.
 *   NO_TRANSITION — message not in SENT state; UPDATE affected 0 rows.
 *   DROPPED       — event.status() is null (non-delivery record type like Click/Open).
 *   PROCESSING    — reserved for two-phase INSERT pattern; never committed.
 */
public enum AppliedOutcome {
    APPLIED,
    DEDUP,
    NO_MESSAGE,
    NO_TRANSITION,
    DROPPED,
    PROCESSING
}
