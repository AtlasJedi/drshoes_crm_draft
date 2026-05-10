/**
 * TypeScript mirrors of CalendarResponseDto / CalendarOrderDto (backend 6-7).
 * Source: backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java
 *
 * Reality note (6-13): the backend uses a single unified CalendarOrderDto for both
 * scheduled and unscheduled entries. plannedPickupAt is null for unscheduled;
 * receivedAt is null for scheduled. The plan's separate UnscheduledOrderDto does
 * not exist on the backend — using a single DTO with nullable fields instead.
 */

import type { OrderStatus } from "@/lib/orders/types";

/**
 * Unified DTO for both scheduled and unscheduled calendar entries.
 * Returned by GET /api/admin/orders/calendar?from=&to=
 * - Scheduled entries: plannedPickupAt non-null, receivedAt null
 * - Unscheduled entries: plannedPickupAt null, receivedAt non-null
 */
export interface CalendarOrderDto {
  id: string;
  code: string;
  clientName: string;
  status: OrderStatus;
  /** ISO-8601. Non-null for scheduled entries, null for unscheduled. */
  plannedPickupAt: string | null;
  /** ISO-8601. Non-null for unscheduled entries, null for scheduled. */
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
