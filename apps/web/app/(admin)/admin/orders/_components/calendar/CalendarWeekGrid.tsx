/**
 * 7-column week grid — ISO week (Monday first).
 * Renders two marker types per order:
 *   - acid dot  : order received on that day (receivedAt)
 *   - magenta dot: order to pick up that day (plannedPickupAt)
 * Clicking a chip pushes ?orderId= to open the drawer.
 *
 * Design tokens: acid (received), magenta (pickup), admin-line (borders).
 * Typography matches CalendarMonthGrid.
 */
"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CalendarOrderDto } from "@/lib/calendar/types";
import { weekDays, isoToDateStr, toLocalDate, DAY_HEADERS_PL } from "@/lib/calendar/window";

interface CalendarWeekGridProps {
  /** Any date within the target week — the grid always shows Mon–Sun of that ISO week. */
  date: Date;
  scheduled: CalendarOrderDto[];
}

interface DayBucket {
  received: CalendarOrderDto[];
  pickup: CalendarOrderDto[];
}

function buildBuckets(days: Date[], scheduled: CalendarOrderDto[]): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>();
  for (const d of days) {
    map.set(toLocalDate(d), { received: [], pickup: [] });
  }
  for (const order of scheduled) {
    if (order.receivedAt) {
      const dateStr = isoToDateStr(order.receivedAt);
      const bucket = map.get(dateStr);
      if (bucket) bucket.received.push(order);
    }
    if (order.plannedPickupAt) {
      const dateStr = isoToDateStr(order.plannedPickupAt);
      const bucket = map.get(dateStr);
      if (bucket) bucket.pickup.push(order);
    }
  }
  return map;
}

/** Chip for a single order inside a week cell. */
function OrderChip({
  order,
  markerType,
  onOpen,
}: {
  order: CalendarOrderDto;
  markerType: "received" | "pickup";
  onOpen: (id: string) => void;
}) {
  const dotColor = markerType === "received" ? "var(--acid)" : "var(--magenta)";
  const label = markerType === "received" ? "przyjęte" : "odbiór";
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      title={`${order.code} · ${order.clientName} (${label})`}
      className="flex items-center gap-1 text-left w-full px-1.5 py-0.5 font-mono text-[10px] font-semibold
                 hover:bg-ink/5 rounded overflow-hidden"
    >
      <span
        aria-hidden
        className="shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: dotColor, border: "1px solid var(--ink)" }}
      />
      <span className="truncate text-ink">
        {order.code} · {order.clientName.split(" ")[0]}
      </span>
    </button>
  );
}

export function CalendarWeekGrid({ date, scheduled }: CalendarWeekGridProps) {
  const router = useRouter();
  const days = weekDays(date);
  const buckets = buildBuckets(days, scheduled);

  const today = toLocalDate(new Date());

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("orderId", orderId);
    router.push(`${typeof window !== "undefined" ? window.location.pathname : ""
      }?${params.toString()}` as Route);
  }

  return (
    <div className="flex flex-col overflow-hidden h-full" data-testid="calendar-week-grid">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b-2 border-ink bg-paper-2">
        {days.map((d, i) => {
          const dateStr = toLocalDate(d);
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={[
                "px-3 py-2.5 border-r border-admin-line",
                i === 6 ? "border-r-0" : "",
              ].join(" ")}
            >
              <div className="font-stencil text-[11px] tracking-widest text-ink/60 uppercase">
                {DAY_HEADERS_PL[i]}
              </div>
              <div
                className={[
                  "font-mono text-[18px] leading-tight mt-0.5",
                  isToday ? "font-bold text-ink" : "text-ink/80",
                ].join(" ")}
              >
                {d.getDate()}
              </div>
              {isToday && (
                <span className="font-stencil text-[9px] px-1.5 py-px bg-acid border border-ink tracking-wider uppercase">
                  dziś
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cells row */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((d, i) => {
          const dateStr = toLocalDate(d);
          const bucket = buckets.get(dateStr)!;
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              data-testid={`week-cell-${dateStr}`}
              className={[
                "border-r border-b border-admin-line p-1.5 min-h-[100px]",
                i === 6 ? "border-r-0" : "",
                isToday ? "bg-acid/10" : "",
              ].join(" ")}
            >
              {/* Received orders — acid markers */}
              {bucket.received.map((order) => (
                <OrderChip
                  key={`recv-${order.id}`}
                  order={order}
                  markerType="received"
                  onOpen={openDrawer}
                />
              ))}
              {/* Pickup orders — magenta markers */}
              {bucket.pickup.map((order) => (
                <OrderChip
                  key={`pkup-${order.id}`}
                  order={order}
                  markerType="pickup"
                  onOpen={openDrawer}
                />
              ))}
              {bucket.received.length === 0 && bucket.pickup.length === 0 && (
                <span className="font-mono text-[10px] text-ink/20 select-none">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
