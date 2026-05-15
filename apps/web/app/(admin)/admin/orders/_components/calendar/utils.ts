/**
 * Status → background color mapping for calendar event chips.
 * Mirrors admin.jsx:503 colorOf function + M9 token updates.
 * GOTOWE_DO_ODBIORU → green (was magenta in M7).
 * W_REALIZACJI → orange (was acid in M7).
 */
import type { OrderStatus } from "@/lib/orders/types";

export function colorOfStatus(status: OrderStatus | string): string {
  switch (status) {
    case "PRZYJETE":          return "var(--blue)";
    case "WSTEPNIE_PRZYJETE": return "var(--admin-mute)";
    case "W_REALIZACJI":      return "var(--orange)";
    case "CZEKA_NA_KLIENTA":  return "#a17a00";
    case "GOTOWE_DO_ODBIORU": return "var(--green)";
    case "WYDANE":            return "rgba(0,0,0,0.35)";
    case "ANULOWANE":         return "var(--red)";
    default:                  return "var(--admin-mute)";
  }
}
