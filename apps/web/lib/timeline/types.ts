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
  | "PHOTO_RELABELED";     // M3 — admin changed a photo's label

/**
 * Curated timeline event — mirrors TimelineEvent.java.
 * id: null for synthetic events (e.g. ORDER_CREATED without audit_log row).
 * labels: display metadata key-value map (e.g. actorFullName, path).
 */
export interface TimelineEvent {
  id: string | null;
  kind: TimelineEventKind;
  occurredAt: string;              // ISO-8601
  actorFullName: string | null;
  labels: Record<string, string>;
}
