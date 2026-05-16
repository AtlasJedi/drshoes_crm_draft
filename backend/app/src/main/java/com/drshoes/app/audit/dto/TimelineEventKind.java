package com.drshoes.app.audit.dto;

/**
 * Kinds of curated timeline events surfaced to the admin UI.
 *
 * Seven kinds are emitted in M1 (derivable from AuditLog path+method+status
 * without field-level body capture). Two kinds — ASSIGNEE_CHANGED and
 * PICKUP_DATE_CHANGED — are reserved for M2 when request-body capture lands;
 * they cannot be distinguished from ORDER_UPDATED with M1's AuditLog shape.
 *
 * ORDER_UPDATED is a new kind added in M1 to represent a generic PATCH on an
 * order (no field-level diff available). It is not in the original plan spec;
 * documented in dispatch log 1-9-20260508T170346Z.md.
 */
public enum TimelineEventKind {
    ORDER_CREATED,
    ORDER_UPDATED,        // generic PATCH — added M1; no field-level diff in AuditLog
    STATUS_CHANGED,
    ASSIGNEE_CHANGED,     // reserved M2 — body capture required
    PICKUP_DATE_CHANGED,  // reserved M2 — body capture required
    ITEM_ADDED,
    ITEM_EDITED,
    ITEM_REMOVED,
    ORDER_SOFT_DELETED,
    MESSAGE_SENT,       // M2 — emitted by MessageSentTimelineHandler for MessageRouter service rows
    MESSAGE_DELIVERED,  // M4 — emitted by WebhookStatusReconciler#apply when status → DELIVERED
    MESSAGE_FAILED,     // M4 — emitted by WebhookStatusReconciler#apply when status → FAILED
    PHOTO_UPLOADED,     // M3 — emitted by PhotoService#upload @Audited row
    PHOTO_DELETED,      // M3 — emitted by PhotoService#delete @Audited row
    PHOTO_RELABELED,    // M3 — emitted by PhotoService#relabel @Audited row
    // M5 — inbound messages + thread lifecycle
    MESSAGE_RECEIVED,   // M5 — emitted by InboundMessageService#recordEmailInbound / #recordSmsInbound
    THREAD_MARKED_READ, // M5 — emitted by MessageThreadMutationService#markRead
    THREAD_ASSIGNED,    // M5 — emitted by MessageThreadMutationService#assignUnmatched
    THREAD_DISCARDED,   // M5 — emitted by MessageThreadMutationService#discardUnmatched
    ORDER_NOTE          // M10 — emitted by POST /api/admin/orders/{id}/notes (note + optional location move)
}
