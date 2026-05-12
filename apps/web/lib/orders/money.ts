/**
 * Money helpers for PLN display and conversion.
 * Shared between NewOrderForm and OrderDrawerCoreFields.
 */

/**
 * Convert a PLN display string (e.g. "3,50" or "3.50") to integer cents.
 * Returns 0 for invalid, empty, or negative input.
 */
export function plnToCents(pln: string): number {
  const n = parseFloat(pln.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/**
 * Format integer cents as Polish PLN display string, e.g. "3,50 zł".
 */
export function centsToPlnDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " zł";
}
