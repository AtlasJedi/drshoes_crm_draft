/**
 * Pure date-math helpers for calendar week/day window resolution.
 * ISO week — Monday is the first day of the week (Polish calendar standard).
 * No external dependencies — uses built-in Date arithmetic only.
 */

/** Format a Date as YYYY-MM-DD using local (not UTC) year/month/day components. */
export function toLocalDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * Return the Monday of the ISO week that contains `date`.
 * getDay() returns Sun=0, Mon=1…Sat=6 → convert to Mon=0…Sun=6 offset.
 */
export function mondayOfWeek(date: Date): Date {
  const dow = date.getDay(); // Sun=0 … Sat=6
  const offsetFromMonday = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
  const monday = new Date(date);
  monday.setDate(date.getDate() - offsetFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Return the Sunday of the ISO week that contains `date` (end of week).
 */
export function sundayOfWeek(date: Date): Date {
  const monday = mondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * Return an array of 7 Dates [Mon … Sun] for the ISO week containing `date`.
 */
export function weekDays(date: Date): Date[] {
  const monday = mondayOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Return { from, to } as YYYY-MM-DD strings for the week window containing `date`.
 * from = Monday, to = Sunday.
 */
export function weekWindow(date: Date): { from: string; to: string } {
  return {
    from: toLocalDate(mondayOfWeek(date)),
    to: toLocalDate(sundayOfWeek(date)),
  };
}

/**
 * Return { from, to } as YYYY-MM-DD strings for a single-day window.
 * Both from and to are the same date.
 */
export function dayWindow(date: Date): { from: string; to: string } {
  const s = toLocalDate(date);
  return { from: s, to: s };
}

/**
 * Extract the YYYY-MM-DD date portion from an ISO-8601 timestamp string.
 * Works for both "YYYY-MM-DDTHH:…Z" and plain "YYYY-MM-DD" strings.
 */
export function isoToDateStr(iso: string): string {
  return iso.slice(0, 10);
}

/** Polish abbreviated day names, Mon-first (index 0 = Mon). */
export const DAY_HEADERS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;
