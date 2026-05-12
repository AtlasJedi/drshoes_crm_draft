/**
 * TypeScript mirrors of CalendarResponseDto / CalendarOrderDto (backend 6-7).
 * Source: backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java
 *
 * Contract updated ux-2 (2026-05-12): receivedAt is now ALWAYS populated on both
 * scheduled and unscheduled entries. This allows week/day views to render the same
 * order as two distinct markers:
 *   - acid dot anchored to receivedAt date
 *   - magenta dot anchored to plannedPickupAt date
 */

import type { OrderStatus } from "@/lib/orders/types";

/**
 * Unified DTO for both scheduled and unscheduled calendar entries.
 * Returned by GET /api/admin/orders/calendar?from=&to=
 * - Scheduled entries: plannedPickupAt non-null, receivedAt non-null
 * - Unscheduled entries: plannedPickupAt null, receivedAt non-null
 */
export interface CalendarOrderDto {
  id: string;
  code: string;
  clientName: string;
  status: OrderStatus;
  /** ISO-8601. Non-null for scheduled entries, null for unscheduled. */
  plannedPickupAt: string | null;
  /** ISO-8601. Always non-null (both scheduled and unscheduled entries). */
  receivedAt: string | null;
  itemSummary: string;
  urgent: boolean;
}

/** Top-level response from GET /api/admin/orders/calendar */
export interface CalendarResponseDto {
  scheduled: CalendarOrderDto[];
  unscheduled: CalendarOrderDto[];
}

/** Query params shape for the calendar endpoint. */
export interface CalendarQuery {
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  from: string;
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  to: string;
}
