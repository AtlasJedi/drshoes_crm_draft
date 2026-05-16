/**
 * Polish display labels and Tailwind pill classes for OrderStatus and OrderItemKind.
 * Color classes use the design-system custom palette (acid, magenta, blue, orange, green)
 * defined in packages/ui/src/tokens.ts and registered via tailwind-preset.
 * WSTEPNIE_PRZYJETE uses admin-muted tones (hidden from manual-selection UI but must render).
 */

import type { OrderStatus, OrderItemKind } from "./types";

// ---------- Status labels ----------

export const STATUS_LABELS_PL: Record<OrderStatus, string> = {
  WSTEPNIE_PRZYJETE:   "Wstępnie przyjęte",
  PRZYJETE:            "Przyjęte",
  W_REALIZACJI:        "W realizacji",
  CZEKA_NA_KLIENTA:    "Czeka na klienta",
  GOTOWE_DO_ODBIORU:   "Gotowe do odbioru",
  WYDANE:              "Wydane",
  ANULOWANE:           "Anulowane",
};

/**
 * Tailwind pill classes per status.
 * Uses custom design-system tokens from tailwind-preset (acid, magenta, blue, orange, green).
 * Pairs background + foreground for legibility.
 */
export const STATUS_PILL_CLASS: Record<OrderStatus, string> = {
  WSTEPNIE_PRZYJETE:
    "bg-admin-line text-admin-mute",
  PRZYJETE:
    "bg-blue/10 text-blue",
  W_REALIZACJI:
    "bg-acid text-ink",
  CZEKA_NA_KLIENTA:
    "bg-orange/10 text-orange",
  GOTOWE_DO_ODBIORU:
    "bg-magenta/10 text-magenta",
  WYDANE:
    "bg-green/10 text-green",
  ANULOWANE:
    "bg-admin-line text-admin-mute",
};

/**
 * Canonical ordering for status progression display.
 * WSTEPNIE_PRZYJETE leads; ANULOWANE is always last.
 */
export const STATUS_ORDER: OrderStatus[] = [
  "WSTEPNIE_PRZYJETE",
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
  "WYDANE",
  "ANULOWANE",
];

// ---------- Item kind labels ----------

export const KIND_LABELS_PL: Record<OrderItemKind, string> = {
  NAPRAWA: "Usługa",
  CUSTOM:  "Custom",
};
