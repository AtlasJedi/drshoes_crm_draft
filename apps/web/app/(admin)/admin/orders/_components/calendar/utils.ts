/**
 * Status → background color mapping for calendar pills.
 * Mirrors admin.jsx:503 colorOf function, using CSS custom properties.
 */
import type { OrderStatus } from "@/lib/orders/types";

export function colorOfStatus(status: OrderStatus): string {
  switch (status) {
    case "GOTOWE_DO_ODBIORU":
      return "var(--green)";
    case "W_REALIZACJI":
      return "var(--orange)";
    case "PRZYJETE":
    case "WSTEPNIE_PRZYJETE":
      return "var(--blue)";
    case "CZEKA_NA_KLIENTA":
      return "#a17a00";
    case "WYDANE":
      return "rgba(0,0,0,0.35)";
    case "ANULOWANE":
    default:
      return "var(--red)";
  }
}
