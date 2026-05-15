/**
 * /admin/orders/calendar — Month / Week / Day calendar view.
 * Server Component: resolves ?mode= and ?date= params, fetches the window,
 * renders the correct grid + BezTerminuPanel in a 2-column layout.
 *
 * URL params:
 *   mode=month|week|day   → which grid to render (defaults to "month")
 *   date=YYYY-MM-DD       → anchor date for the window (defaults to today)
 *   orderId=<uuid>        → opens OrderDrawer overlay (M1 pattern)
 *
 * Modes:
 *   month — CalendarMonthGrid, window = full month of `date`
 *   week  — CalendarWeekGrid,  window = ISO week (Mon–Sun) containing `date`
 *   day   — CalendarDayGrid,   window = single day `date`
 *
 * Design: admin.jsx:481-617.
 */

import { CalendarPageHeaderSetter } from "./_components/CalendarPageHeaderSetter";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { fetchCalendarWindow } from "@/lib/calendar/api-server";
import { getOrderServer } from "@/lib/orders/api-server";
import type { OrderDto } from "@/lib/orders/types";
import type { CalendarResponseDto } from "@/lib/calendar/types";
import {
  toLocalDate,
  parseLocalDate,
  mondayOfWeek,
  sundayOfWeek,
  weekWindow,
  dayWindow,
} from "@/lib/calendar/window";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { CalendarMonthGrid } from "../_components/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "../_components/calendar/CalendarWeekGrid";
import { CalendarDayGrid } from "../_components/calendar/CalendarDayGrid";
import { BezTerminuPanel } from "../_components/calendar/BezTerminuPanel";
import { OrderDrawer } from "../_components/OrderDrawer";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { EmptyState } from "@/components/state/EmptyState";

const log = createLogger("calendar-page");

type CalendarMode = "month" | "week" | "day";

interface SearchParams {
  mode?: string;
  date?: string;
  orderId?: string;
}

/** Polish month names for the month-mode header label. */
const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
] as const;

function monthLabel(date: Date): string {
  return `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
}

/** Polish abbreviated day-of-week + day-of-month, e.g. "Wt 12". */
function weekDayShortLabel(date: Date): string {
  const names = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
  return `${names[date.getDay()]} ${date.getDate()}`;
}

/** Build the navigation label for the current window. */
function windowLabel(mode: CalendarMode, anchor: Date): string {
  if (mode === "month") return monthLabel(anchor);
  if (mode === "week") {
    const mon = mondayOfWeek(anchor);
    const sun = sundayOfWeek(anchor);
    return `${weekDayShortLabel(mon)} – ${weekDayShortLabel(sun)}`;
  }
  // day
  const names = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
  return `${names[anchor.getDay()]} ${anchor.getDate()} ${MONTHS_PL[anchor.getMonth()]}`;
}

/** Build YYYY-MM-DD param for the previous/next navigation button. */
function adjacentParam(mode: CalendarMode, anchor: Date, delta: number): string {
  const d = new Date(anchor);
  if (mode === "month") {
    d.setMonth(d.getMonth() + delta, 1);
  } else if (mode === "week") {
    d.setDate(d.getDate() + delta * 7);
  } else {
    d.setDate(d.getDate() + delta);
  }
  return toLocalDate(d);
}

/** Resolve the window boundaries for fetch based on mode and anchor date. */
function resolveWindow(mode: CalendarMode, anchor: Date): { from: string; to: string } {
  if (mode === "month") {
    const from = toLocalDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const to = toLocalDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
    return { from, to };
  }
  if (mode === "week") return weekWindow(anchor);
  return dayWindow(anchor);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // --- Resolve mode ---
  const rawMode = sp.mode;
  const mode: CalendarMode =
    rawMode === "week" || rawMode === "day" ? rawMode : "month";

  // --- Resolve anchor date ---
  let anchor: Date;
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) {
    anchor = parseLocalDate(sp.date);
  } else {
    const now = new Date();
    // For month mode default to day-1 of current month; week/day default to today
    if (mode === "month") {
      anchor = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      anchor = now;
    }
  }

  const { from, to } = resolveWindow(mode, anchor);
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
    log.error("op=fetchCalendar outcome=error", { message: String(err), from, to, mode });
    fetchError = true;
  }

  const prevParam = adjacentParam(mode, anchor, -1);
  const nextParam = adjacentParam(mode, anchor, 1);

  const scheduled = calendarData?.scheduled ?? [];
  const unscheduled = calendarData?.unscheduled ?? [];
  const isCalendarEmpty = !fetchError && calendarData !== null && scheduled.length === 0;

  /** Build the href for a mode toggle button, preserving the current anchor date. */
  function modeHref(m: CalendarMode): Route {
    const dateParam = toLocalDate(anchor);
    return `/admin/orders/calendar?mode=${m}&date=${dateParam}` as Route;
  }

  const MODE_LABELS: Record<CalendarMode, string> = {
    month: "miesiąc",
    week: "tydzień",
    day: "dzień",
  };

  return (
    <div className="flex flex-col h-full">
      <CalendarPageHeaderSetter />
      {/* Top bar: view tabs + mode toggle + navigation */}
      <div className="px-6 pt-4 pb-0 flex justify-between items-center gap-4">
        <OrderViewTabs active="calendar" />

        <div className="flex items-center gap-4">
          {/* Month / Week / Day toggle — all three enabled */}
          <div className="inline-flex border-[1.5px] border-ink bg-white">
            {(["month", "week", "day"] as const).map((m, idx, arr) => {
              const isActive = m === mode;
              return (
                <Link
                  key={m}
                  href={modeHref(m)}
                  className={[
                    "px-3 py-1.5 font-mono text-[11px] font-bold tracking-wide uppercase",
                    idx < arr.length - 1 ? "border-r border-admin-line" : "",
                    isActive
                      ? "bg-acid text-ink"
                      : "bg-transparent text-ink hover:bg-ink/5",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {MODE_LABELS[m]}
                </Link>
              );
            })}
          </div>

          {/* Navigation: prev ← label → next */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/admin/orders/calendar?mode=${mode}&date=${prevParam}` as Route}
              className="p-1.5 hover:bg-ink/5 rounded"
              aria-label="Poprzedni"
            >
              ←
            </Link>
            <span className="font-display text-2xl text-ink leading-none">
              {windowLabel(mode, anchor)}
            </span>
            <Link
              href={`/admin/orders/calendar?mode=${mode}&date=${nextParam}` as Route}
              className="p-1.5 hover:bg-ink/5 rounded"
              aria-label="Następny"
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

      {/* Main content */}
      {!fetchError && (
        <div className="flex-1 px-6 pt-4 pb-6 grid grid-cols-[1fr_280px] gap-5 overflow-hidden min-h-0">
          {/* Grid column */}
          <div className="admin-card overflow-hidden flex flex-col p-0">
            {isCalendarEmpty ? (
              <EmptyState message="Brak zamówień w tym okresie." />
            ) : mode === "month" ? (
              <CalendarMonthGrid date={anchor} scheduled={scheduled} />
            ) : mode === "week" ? (
              <CalendarWeekGrid date={anchor} scheduled={scheduled} />
            ) : (
              <CalendarDayGrid date={anchor} scheduled={scheduled} />
            )}
          </div>

          {/* Bez terminu side panel (shown in all modes) */}
          <BezTerminuPanel unscheduled={unscheduled} />
        </div>
      )}

      {/* Drawer overlay */}
      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} users={[]} />}
    </div>
  );
}
