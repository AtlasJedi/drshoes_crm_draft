/**
 * TypeScript mirrors of CalendarResponseDto / CalendarOrderDto (backend v2-B).
 * Source: backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java
 *
 * Contract updated v2-B (2026-05-17): two markers per order — green at receivedAt,
 * red at effectivePickupAt. effectivePickupAt = plannedPickupAt ?? receivedAt + 14d.
 * pickupAtDefaulted=true signals the dashed-border "default due" red chip.
 * unscheduled[] is always empty — every order has an effectivePickupAt.
 */

import type { OrderStatus } from "@/lib/orders/types";

/**
 * Unified DTO for all calendar entries.
 * Returned by GET /api/admin/orders/calendar?from=&to=
 *
 * Two-marker model:
 *   - Green chip anchored to receivedAt
 *   - Red chip anchored to effectivePickupAt (dashed border when pickupAtDefaulted)
 */
export interface CalendarOrderDto {
  id: string;
  code: string;
  clientName: string;
  status: OrderStatus;
  /** ISO-8601. May be null when no explicit pickup was set. */
  plannedPickupAt: string | null;
  /** ISO-8601. Always non-null — green marker day. */
  receivedAt: string;
  /** ISO-8601. Always non-null — red marker day. Computed: plannedPickupAt ?? receivedAt+14d. */
  effectivePickupAt: string;
  /** true when effectivePickupAt was derived from the +14d fallback (no explicit plannedPickupAt). */
  pickupAtDefaulted: boolean;
  itemSummary: string;
  urgent: boolean;
}

/** Top-level response from GET /api/admin/orders/calendar */
export interface CalendarResponseDto {
  scheduled: CalendarOrderDto[];
  /** Always empty in v2-B — every order is now scheduled via effectivePickupAt. */
  unscheduled: CalendarOrderDto[];
}

/** Query params shape for the calendar endpoint. */
export interface CalendarQuery {
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  from: string;
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  to: string;
}
