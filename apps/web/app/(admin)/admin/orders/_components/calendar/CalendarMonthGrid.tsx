/**
 * Full month grid — 7-column layout with leading empty cells for month start offset.
 * Takes a Date (first day of the month) and the full scheduled[] array.
 * Distributes orders into day buckets by local day-of-month derived from
 * plannedPickupAt ISO string. Orders with null plannedPickupAt are skipped
 * (they belong in the unscheduled sidebar, not the grid).
 * Design: admin.jsx:540-575.
 */
"use client";

import { CalendarCell } from "./CalendarCell";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const DAY_HEADERS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;

interface CalendarMonthGridProps {
  /** First day of the month to render. */
  date: Date;
  scheduled: CalendarOrderDto[];
}

/** ISO day of week: Mon=1 … Sun=7 → convert to 0-based Mon offset. */
function monthStartOffset(firstDay: Date): number {
  const dow = firstDay.getDay(); // Sun=0, Mon=1 … Sat=6
  return dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Extract the local day-of-month (1-31) from an ISO timestamp without a full Date parse.
 *  ISO string is always "YYYY-MM-DDTHH:…" — slice chars 8-9. */
function localDayFromIso(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

export function CalendarMonthGrid({ date, scheduled }: CalendarMonthGridProps) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const totalDays = daysInMonth(date);
  const offset = monthStartOffset(date);

  // Group orders by day-of-month; skip orders without a planned pickup date
  const byDay = new Map<number, CalendarOrderDto[]>();
  for (const order of scheduled) {
    if (!order.plannedPickupAt) continue;
    const d = localDayFromIso(order.plannedPickupAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(order);
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b-2 border-ink bg-paper-2">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="font-stencil text-[11px] tracking-widest text-ink px-3 py-2.5 border-r border-admin-line"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid grid-cols-7 grid-rows-[repeat(6,minmax(0,1fr))] flex-1">
        {/* Leading empty cells */}
        {Array.from({ length: offset }).map((_, i) => (
          <div
            key={`empty-${i}`}
            data-empty="true"
            className="border-r border-b border-admin-line bg-black/[0.02]"
          />
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
          <CalendarCell
            key={day}
            day={day}
            isToday={day === todayDay}
            orders={byDay.get(day) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
