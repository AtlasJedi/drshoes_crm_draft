/**
 * Order formatting utilities.
 */

const DR_PREFIX_RE = /^DR-\d{4}-/;

/**
 * Strips the `DR-YYYY-` prefix from an order code.
 * e.g. `DR-2026-0013` → `0013`
 * Falls back to the original code if the prefix doesn't match (legacy safety net).
 */
export function shortCode(code: string): string {
  return code.replace(DR_PREFIX_RE, "");
}
