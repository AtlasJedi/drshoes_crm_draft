/**
 * TypeScript mirror of KanbanResponseDto / KanbanColumnDto / KanbanCardDto.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/order/dto/KanbanResponseDto.java
 *                  controller: com.drshoes.app.order.api.KanbanController
 *
 * Five canonical Kanban statuses — matches OrderStatus values used for grouping.
 * ANULOWANE is excluded from Kanban per spec §6-8.
 */

import type { OrderStatus } from "@/lib/orders/types";

/** Kanban statuses that appear as columns. */
export type KanbanStatus = Extract<
  OrderStatus,
  "PRZYJETE" | "W_REALIZACJI" | "CZEKA_NA_KLIENTA" | "GOTOWE_DO_ODBIORU" | "WYDANE"
>;

/** One card within a column. Mirrors KanbanCardDto.java (record). */
export interface KanbanCardDto {
  /** UUID */
  id: string;
  /** e.g. "DR-1042" */
  code: string;
  /** Full name from Client.getFullName() */
  clientName: string;
  /** First item description truncated to 40 chars, may be empty string */
  itemSummary: string;
  /** ISO-8601 or null when no planned pickup date */
  plannedPickupAt: string | null;
  /** ISO-8601 or null for legacy/draft orders. Added in ux-3. */
  receivedAt: string | null;
  /** true when tagged "pilne" OR plannedPickupAt within 48 h */
  urgent: boolean;
  /** Optimistic-lock version — required by PATCH /api/admin/orders/{id}/status. */
  version: number;
  /** Human-readable storage location name (denormalized). Null when not set. */
  location?: string | null;
}

/** One column in the board response. Mirrors KanbanColumnDto.java (record). */
export interface KanbanColumnDto {
  /** Column identifier — one of the five KanbanStatus values */
  status: KanbanStatus;
  /** Unfiltered count for the column header badge */
  total: number;
  /** Cards up to limitPerColumn (WYDANE: max 10 regardless of param) */
  cards: KanbanCardDto[];
  /** true when total > cards.length */
  hasMore: boolean;
}

/** Top-level board response. Mirrors KanbanResponseDto.java (record). */
export interface KanbanResponseDto {
  columns: KanbanColumnDto[];
}

/** Request params for GET /api/admin/orders/kanban */
export interface KanbanFetchParams {
  /** Default 50; must be 1–200. WYDANE always capped at 10 backend-side. */
  limitPerColumn?: number;
}
