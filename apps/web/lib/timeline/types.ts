/**
 * TypeScript mirror of backend audit timeline DTOs.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/audit/dto/
 *
 * TimelineEvent.id is string | null because the synthetic ORDER_CREATED event
 * has no backing audit_log row and carries a null id from the curator.
 */

/** Curated timeline event kinds. Matches TimelineEventKind.java. */
export type TimelineEventKind =
  | "ORDER_CREATED"
  | "ORDER_UPDATED"        // generic PATCH — added M1; no field-level diff
  | "STATUS_CHANGED"
  | "ASSIGNEE_CHANGED"     // reserved M2 — body capture required
  | "PICKUP_DATE_CHANGED"  // reserved M2 — body capture required
  | "ITEM_ADDED"
  | "ITEM_EDITED"
  | "ITEM_REMOVED"
  | "ORDER_SOFT_DELETED"
  | "MESSAGE_SENT"         // M2 — outbound message dispatched
  | "PHOTO_UPLOADED"       // M3 — admin uploaded a photo
  | "PHOTO_DELETED"        // M3 — admin deleted a photo
  | "PHOTO_RELABELED"      // M3 — admin changed a photo's label
  | "MESSAGE_DELIVERED"    // M4 — provider confirmed delivery
  | "MESSAGE_FAILED"       // M4 — provider reported delivery failure
  | "MESSAGE_RECEIVED"     // M5 — inbound message recorded (email or SMS)
  | "THREAD_MARKED_READ"   // M5 — operator opened thread or clicked mark-read
  | "THREAD_ASSIGNED"      // M5 — unmatched thread assigned to a client
  | "THREAD_DISCARDED"     // M5 — unmatched thread soft-deleted by operator
  | "ORDER_NOTE";          // M10 — note + optional location move (POST .../notes)

/**
 * Curated timeline event — mirrors TimelineEvent.java.
 * id: null for synthetic events (e.g. ORDER_CREATED without audit_log row).
 * labels: display metadata key-value map (e.g. actorFullName, path).
 * note: optional operator note — present only on STATUS_CHANGED rows where a note was provided.
 * locationFrom: previous storage location before a location-change event (M10/V020). Null otherwise.
 * locationTo: new storage location after a location-change event (M10/V020). Null otherwise.
 */
export interface TimelineEvent {
  id: string | null;
  kind: TimelineEventKind;
  occurredAt: string;              // ISO-8601
  actorFullName: string | null;
  labels: Record<string, string>;
  note?: string | null;
  locationFrom?: string | null;
  locationTo?: string | null;
}
