/**
 * /admin/orders/calendar — Month-only read-only calendar view.
 * Server Component: resolves ?date= param → fetchCalendarWindow,
 * renders CalendarMonthGrid + BezTerminuPanel in a 2-column layout.
 *
 * URL params:
 *   date=YYYY-MM-DD  → month to display (defaults to current month)
 *   orderId=<uuid>   → opens OrderDrawer overlay (M1 pattern)
 *
 * Design: admin.jsx:481-617; states use shared state primitives from
 * apps/web/components/state/ (shipped 6-12, override approved by owner).
 */

import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { fetchCalendarWindow } from "@/lib/calendar/api-server";
import { getOrderServer } from "@/lib/orders/api-server";
import type { OrderDto } from "@/lib/orders/types";
import type { CalendarResponseDto } from "@/lib/calendar/types";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { CalendarMonthGrid } from "../_components/calendar/CalendarMonthGrid";
import { BezTerminuPanel } from "../_components/calendar/BezTerminuPanel";
import { OrderDrawer } from "../_components/OrderDrawer";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { EmptyState } from "@/components/state/EmptyState";

const log = createLogger("calendar-page");

interface SearchParams {
  date?: string;
  orderId?: string;
}

/** Format a Date as YYYY-MM-DD (local, no tz shift — server-side only). */
function toLocalDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Polish month names for header label. */
const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
] as const;

function monthLabel(date: Date): string {
  return `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
}

/** Build YYYY-MM-01 string for prev/next month Link hrefs. */
function adjacentMonthParam(base: Date, delta: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  return toLocalDate(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Resolve the month to display; fall back to current month if param absent/invalid
  let monthDate: Date;
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) {
    const [y, m] = sp.date.split("-").map(Number);
    monthDate = new Date(y!, m! - 1, 1);
  } else {
    const now = new Date();
    monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // from = first day, to = last day of the month
  const from = toLocalDate(monthDate);
  const to = toLocalDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

  const orderId = sp.orderId;

  let calendarData: CalendarResponseDto | null = null;
  let fetchError = false;
  let drawerOrder: OrderDto | null = null;

  try {
    if (orderId) {
      const [cal, order] = await Promise.all([
        fetchCalendarWindow(from, to),
        getOrderServer(orderId),
      ]);
      calendarData = cal;
      drawerOrder = order;
    } else {
      calendarData = await fetchCalendarWindow(from, to);
    }
  } catch (err) {
    log.error("op=fetchCalendar outcome=error", { message: String(err), from, to });
    fetchError = true;
  }

  const prevParam = adjacentMonthParam(monthDate, -1);
  const nextParam = adjacentMonthParam(monthDate, 1);

  const scheduled = calendarData?.scheduled ?? [];
  const unscheduled = calendarData?.unscheduled ?? [];
  // Empty state: fetch succeeded but no scheduled orders this month
  const isCalendarEmpty = !fetchError && calendarData !== null && scheduled.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: view tabs + view-mode toggle + month navigation */}
      <div className="px-6 pt-4 pb-0 flex justify-between items-center gap-4">
        <OrderViewTabs active="calendar" />

        <div className="flex items-center gap-4">
          {/* Month / Week / Day toggle — Week + Day disabled in M6 (wkrótce) */}
          <div className="inline-flex border-[1.5px] border-ink bg-white">
            {(["miesiąc", "tydzień", "dzień"] as const).map((v, idx, arr) => {
              const isActive = v === "miesiąc";
              const isDisabled = v !== "miesiąc";
              return (
                <button
                  key={v}
                  type="button"
                  disabled={isDisabled}
                  title={isDisabled ? "wkrótce" : undefined}
                  className={[
                    "px-3 py-1.5 font-mono text-[11px] font-bold tracking-wide uppercase",
                    idx < arr.length - 1 ? "border-r border-admin-line" : "",
                    isActive ? "bg-acid text-ink" : "bg-transparent text-ink",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* Month navigation: prev ← label → next */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/admin/orders/calendar?date=${prevParam}` as Route}
              className="p-1.5 hover:bg-ink/5 rounded"
              aria-label="Poprzedni miesiąc"
            >
              ←
            </Link>
            <span className="font-display text-2xl text-ink leading-none">
              {monthLabel(monthDate)}
            </span>
            <Link
              href={`/admin/orders/calendar?date=${nextParam}` as Route}
              className="p-1.5 hover:bg-ink/5 rounded"
              aria-label="Następny miesiąc"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="px-6 pt-4">
          <ErrorBanner message="Nie udało się załadować danych." />
        </div>
      )}

      {/* Main content: 2-column layout (grid + side panel) */}
      {!fetchError && (
        <div className="flex-1 px-6 pt-4 pb-6 grid grid-cols-[1fr_280px] gap-5 overflow-hidden min-h-0">
          {/* Month grid column */}
          <div className="admin-card overflow-hidden flex flex-col p-0">
            {isCalendarEmpty ? (
              <EmptyState message="Brak zamówień w tym miesiącu." />
            ) : (
              <CalendarMonthGrid date={monthDate} scheduled={scheduled} />
            )}
          </div>

          {/* Bez terminu side panel */}
          <BezTerminuPanel unscheduled={unscheduled} />
        </div>
      )}

      {/* Drawer overlay — mounts when ?orderId= is present and order is fetched */}
      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} users={[]} />}
    </div>
  );
}
