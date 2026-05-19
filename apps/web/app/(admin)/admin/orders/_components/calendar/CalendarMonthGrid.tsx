/**
 * Full month grid — 7-column layout with leading empty cells for month start offset.
 * v2-B: each order is bucketed TWICE:
 *   - Green chip on the receivedAt local day
 *   - Red chip on the effectivePickupAt local day (dashed border when pickupAtDefaulted)
 * Clicking either chip pushes ?orderId= to open the drawer.
 */
"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const DAY_HEADERS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;

interface CalendarMonthGridProps {
  /** First day of the month to render. */
  date: Date;
  scheduled: CalendarOrderDto[];
}

type MarkerType = "received" | "due" | "due-defaulted";

interface ChipEntry {
  order: CalendarOrderDto;
  markerType: MarkerType;
}

/** ISO day of month (1-31) from an ISO timestamp — slice chars 8-9. */
function localDayFromIso(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

/** ISO month string "YYYY-MM" from an ISO timestamp — slice chars 0-6. */
function localMonthFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function monthStartOffset(firstDay: Date): number {
  const dow = firstDay.getDay();
  return dow === 0 ? 6 : dow - 1;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Zero-padded month string "YYYY-MM" from a Date. */
function dateToMonthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function chipClasses(markerType: MarkerType): string {
  switch (markerType) {
    case "received":
      return "bg-green/15 border-l-2 border-green text-ink";
    case "due":
      return "bg-red/15 border-l-2 border-red text-ink";
    case "due-defaulted":
      return "bg-red/10 border-l-2 border-dashed border-red text-ink";
  }
}

function chipLabel(markerType: MarkerType): string {
  return markerType === "received" ? "przyjęte" : "odbiór";
}

export function CalendarMonthGrid({ date, scheduled }: CalendarMonthGridProps) {
  const router = useRouter();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const totalDays = daysInMonth(date);
  const offset = monthStartOffset(date);
  const monthStr = dateToMonthStr(date);

  // Bucket each order twice: once for receivedAt, once for effectivePickupAt
  const byDay = new Map<number, ChipEntry[]>();

  for (const order of scheduled) {
    // Green chip — receivedAt
    if (order.receivedAt && localMonthFromIso(order.receivedAt) === monthStr) {
      const d = localDayFromIso(order.receivedAt);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push({ order, markerType: "received" });
    }

    // Red chip — effectivePickupAt
    if (order.effectivePickupAt && localMonthFromIso(order.effectivePickupAt) === monthStr) {
      const d = localDayFromIso(order.effectivePickupAt);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push({
        order,
        markerType: order.pickupAtDefaulted ? "due-defaulted" : "due",
      });
    }
  }

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("orderId", orderId);
    router.push(`${window.location.pathname}?${params.toString()}` as Route);
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
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const chips = byDay.get(day) ?? [];
          const visible = chips.slice(0, 3);
          const overflow = chips.length - 3;

          return (
            <div
              key={day}
              data-testid={`cell-${day}`}
              className={[
                "border-r border-b border-admin-line p-1.5 min-h-0 relative",
                day === todayDay ? "bg-acid/20 today" : "bg-transparent",
              ].join(" ")}
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={[
                    "font-mono text-[11px]",
                    day === todayDay ? "font-bold text-ink" : "font-medium text-ink/60",
                  ].join(" ")}
                >
                  {day}
                </span>
                {day === todayDay && (
                  <span className="font-stencil text-[9px] px-1 py-px bg-acid border border-ink tracking-wider uppercase leading-none">
                    dziś
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map(({ order, markerType }, idx) => (
                  <button
                    key={`${order.id}-${markerType}-${idx}`}
                    type="button"
                    onClick={() => openDrawer(order.id)}
                    title={`${order.code} · ${order.clientName} (${chipLabel(markerType)})`}
                    data-testid={`chip-${order.id}-${markerType}`}
                    className={`text-left px-1.5 py-px font-mono text-[10px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap w-full ${chipClasses(markerType)}`}
                  >
                    {order.urgent ? <span className="t-pilne-marker">!</span> : null}{order.code} · {order.clientName.split(" ")[0]}
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="font-mono text-[10px] text-ink/50">
                    + {overflow} więcej
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
