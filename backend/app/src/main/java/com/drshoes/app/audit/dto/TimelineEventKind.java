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
    MESSAGE_SENT        // M2 — emitted by MessageSentTimelineHandler for MessageRouter service rows
}
