/**
 * Individual calendar cell for a single day of the month.
 * Renders up to 3 order pills + "+N więcej" overflow indicator.
 * Click on a pill pushes ?orderId= into the URL to open the drawer.
 * Design: admin.jsx:553-572. Color palette: admin.jsx:503.
 */
"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CalendarOrderDto } from "@/lib/calendar/types";
import { colorOfStatus } from "./utils";
import { Tape } from "@repo/ui";

interface CalendarCellProps {
  day: number;
  isToday: boolean;
  orders: CalendarOrderDto[];
}

export function CalendarCell({ day, isToday, orders }: CalendarCellProps) {
  const router = useRouter();
  const visible = orders.slice(0, 3);
  const overflow = orders.length - 3;

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("orderId", orderId);
    router.push(`${window.location.pathname}?${params.toString()}` as Route);
  }

  return (
    <div
      data-testid={`cell-${day}`}
      className={[
        "border-r border-b border-admin-line p-1.5 min-h-0 relative",
        isToday ? "bg-acid/20 today" : "bg-transparent",
      ].join(" ")}
    >
      <div className="flex justify-between items-center">
        <span
          className={[
            "font-mono text-[11px]",
            isToday ? "font-bold text-ink" : "font-medium text-ink/60",
          ].join(" ")}
        >
          {day}
        </span>
        {isToday && (
          <Tape angle={2} style={{ fontSize: 9, padding: "1px 8px" }}>dziś</Tape>
        )}
      </div>

      <div className="flex flex-col gap-0.5 mt-1">
        {visible.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => openDrawer(order.id)}
            title={`${order.code} · ${order.clientName}`}
            className="text-left px-1.5 py-px font-mono text-[10px] font-semibold border-l-2 border-ink overflow-hidden text-ellipsis whitespace-nowrap w-full"
            style={{
              background: colorOfStatus(order.status),
              color: order.status === "WYDANE" ? "rgba(0,0,0,0.6)" : "var(--paper)",
            }}
          >
            {order.code} · {order.clientName.split(" ")[0]}
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
}
