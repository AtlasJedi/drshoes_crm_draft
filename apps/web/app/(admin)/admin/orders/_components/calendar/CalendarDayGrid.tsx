/**
 * Single-day view — lists all received and pickup orders for a given date.
 * Two sections:
 *   1. Przyjęte (received today) — acid dot prefix
 *   2. Do odbioru (pickup today) — magenta dot prefix
 * Clicking a row opens the drawer via ?orderId=.
 *
 * Design tokens: acid (received), magenta (pickup), admin-line (borders).
 * Typography matches CalendarMonthGrid/CalendarWeekGrid.
 */
"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CalendarOrderDto } from "@/lib/calendar/types";
import { isoToDateStr, toLocalDate } from "@/lib/calendar/window";

interface CalendarDayGridProps {
  /** The exact date to display. */
  date: Date;
  scheduled: CalendarOrderDto[];
}

const MONTHS_PL = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
] as const;

function dayLabel(date: Date): string {
  // e.g. "wtorek, 12 maja 2026"
  const dow = date.getDay(); // Sun=0 … Sat=6
  const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  return `${dayNames[dow]}, ${date.getDate()} ${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
}

interface SectionProps {
  title: string;
  dotColor: string;
  orders: CalendarOrderDto[];
  onOpen: (id: string) => void;
}

function Section({ title, dotColor, orders, onOpen }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded-full shrink-0"
          style={{ width: 10, height: 10, background: dotColor, border: "1px solid var(--ink)" }}
          aria-hidden
        />
        <span className="font-stencil text-[11px] tracking-widest uppercase text-ink/70">
          {title}
        </span>
        <span className="chip font-mono text-xs ml-auto">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <p className="font-mono text-[12px] text-ink/30 py-2 pl-4">brak</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => onOpen(order.id)}
              className="text-left w-full flex items-start gap-3 px-3 py-2.5 border border-admin-line hover:border-ink bg-white hover:bg-acid/5 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px] font-bold text-ink leading-tight">
                  {order.code}
                </div>
                <div className="font-sans text-[13px] text-ink/80 leading-tight mt-0.5">
                  {order.clientName}
                </div>
                {order.itemSummary && (
                  <div className="font-mono text-[11px] text-ink/50 mt-1 truncate">
                    {order.itemSummary}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalendarDayGrid({ date, scheduled }: CalendarDayGridProps) {
  const router = useRouter();
  const dateStr = toLocalDate(date);
  const today = toLocalDate(new Date());
  const isToday = dateStr === today;

  // Partition orders into received-today and pickup-today
  const received: CalendarOrderDto[] = [];
  const pickup: CalendarOrderDto[] = [];

  for (const order of scheduled) {
    if (order.receivedAt && isoToDateStr(order.receivedAt) === dateStr) {
      received.push(order);
    }
    if (order.plannedPickupAt && isoToDateStr(order.plannedPickupAt) === dateStr) {
      pickup.push(order);
    }
  }

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("orderId", orderId);
    router.push(`${typeof window !== "undefined" ? window.location.pathname : ""
      }?${params.toString()}` as Route);
  }

  return (
    <div className="flex flex-col overflow-hidden h-full" data-testid="calendar-day-grid">
      {/* Day header */}
      <div
        className={[
          "px-5 py-4 border-b-2 border-ink",
          isToday ? "bg-acid/20" : "bg-paper-2",
        ].join(" ")}
      >
        <div className="font-display text-2xl text-ink leading-none">
          {dayLabel(date)}
          {isToday && (
            <span className="ml-3 font-stencil text-[10px] px-2 py-px bg-acid border border-ink tracking-wider uppercase align-middle">
              dziś
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-8">
        <Section
          title="Przyjęte"
          dotColor="var(--acid)"
          orders={received}
          onOpen={openDrawer}
        />
        <Section
          title="Do odbioru"
          dotColor="var(--magenta)"
          orders={pickup}
          onOpen={openDrawer}
        />
      </div>
    </div>
  );
}
