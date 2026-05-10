/**
 * Server-only: typed fetcher for GET /api/admin/orders/calendar?from=&to=
 * Validates range (≤ 92 days) before the network call; the backend also enforces
 * this server-side (400) but early validation avoids a round-trip.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { CalendarResponseDto } from "./types";

const log = createLogger("calendar.api-server");

/** Max allowed date-range in days (backend enforces 400 above this). */
const MAX_RANGE_DAYS = 92;

/** Parse a YYYY-MM-DD string into a UTC midnight Date (no tz shift — backend handles tz). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/**
 * Fetches the calendar window for `from`..`to` (inclusive, YYYY-MM-DD local dates).
 * Throws `RangeError` if `from > to` or range > 92 days.
 * Throws `Error` if the backend responds with a non-2xx status.
 */
export async function fetchCalendarWindow(
  from: string,
  to: string,
): Promise<CalendarResponseDto> {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);

  if (fromDate > toDate) {
    throw new RangeError(`calendar: from (${from}) is after to (${to})`);
  }

  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new RangeError(`calendar: range ${diffDays} days exceeds max ${MAX_RANGE_DAYS}`);
  }

  const base = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  const qs = new URLSearchParams({ from, to }).toString();

  log.info("op=fetchCalendarWindow", { from, to, diffDays });

  const resp = await fetch(`${base}/api/admin/orders/calendar?${qs}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!resp.ok) {
    log.warn("op=fetchCalendarWindow outcome=error", { status: resp.status, from, to });
    throw new Error(`calendar fetch failed: ${resp.status}`);
  }

  return (await resp.json()) as CalendarResponseDto;
}
