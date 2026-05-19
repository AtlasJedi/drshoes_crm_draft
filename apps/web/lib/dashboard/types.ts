/**
 * TypeScript mirrors of backend dashboard DTO records.
 * Source of truth: DashboardKpiDto.java + DashboardChartsDto.java (W1, task 6-5 + 6-6).
 */

/** GET /api/admin/dashboard/kpis — mirrors DashboardKpiDto.java */
export interface DashboardKpiDto {
  inProgressCount: number;
  readyForPickupCount: number;
  todayIntakeCount: number;
  /** Raw cents — present for potential future client-side formatting. */
  monthRevenueCents: number;
  /** Backend-formatted PLN string, e.g. "18 240 zł". Never format on the FE. */
  monthRevenueFormatted: string;
  /** Sum of totalPriceCents for W_REALIZACJI + PRZYJETE orders (raw cents). */
  inProgressMoneyCents: number;
  /** Backend-formatted PLN string for in-progress money sum. */
  inProgressMoneyFormatted: string;
  /** Sum of totalPriceCents for WYDANE orders picked up this calendar month (raw cents). */
  pickedUpMoneyMonthCents: number;
  /** Backend-formatted PLN string for picked-up-this-month money sum. */
  pickedUpMoneyMonthFormatted: string;
}

/** One row in the orders-per-week stacked bar. Mirrors DashboardChartsDto.OrdersPerWeekRowDto */
export interface OrdersPerWeekRowDto {
  /** ISO week/month/quarter label, e.g. "2026-W11", "2026-05", "2026-Q2". */
  weekIso: string;
  /** Per-kind order counts. All 5 OrderItemKind keys always present (zero-filled by backend). */
  byKind: Record<import("@/lib/orders/types").OrderItemKind, number>;
}

/** One slice in the mix donut. Mirrors DashboardChartsDto.MixByTypeRowDto */
export interface MixByTypeRowDto {
  kind: "CZYSZCZENIE" | "RENOWACJA" | "NAPRAWA" | "SZEWC" | "CUSTOM";
  count: number;
  /** Integer percentage 0-100, backend-computed. */
  percent: number;
}

/** GET /api/admin/dashboard/charts — mirrors DashboardChartsDto.java */
export interface DashboardChartsDto {
  /** Last 8 ISO weeks ending current, ascending. Length 0-8. */
  ordersPerWeek: OrdersPerWeekRowDto[];
  mixByType: MixByTypeRowDto[];
}
