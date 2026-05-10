/**
 * Read-only side panel for orders with no planned_pickup_at (unscheduled[]).
 * Each row opens the drawer via ?orderId=. Drag deferred — hint renders disabled.
 * Legend sourced from admin.jsx:602-613.
 * Design: admin.jsx:578-613.
 */
"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CalendarOrderDto } from "@/lib/calendar/types";
import type { OrderStatus } from "@/lib/orders/types";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import { colorOfStatus } from "./utils";

interface BezTerminuPanelProps {
  unscheduled: CalendarOrderDto[];
}

// Statuses shown in the legend (mirrors STATUS_INFO keys from admin.jsx)
const LEGEND_STATUSES: OrderStatus[] = [
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
  "WYDANE",
  "ANULOWANE",
];

export function BezTerminuPanel({ unscheduled }: BezTerminuPanelProps) {
  const router = useRouter();

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("orderId", orderId);
    router.push(`${window.location.pathname}?${params.toString()}` as Route);
  }

  return (
    <div className="admin-card flex flex-col p-4 overflow-auto gap-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-2.5">
        <span className="t-display" style={{ fontSize: 18 }}>
          Bez terminu
        </span>
        <span className="chip font-mono text-xs">{unscheduled.length}</span>
      </div>

      {/* Drag hint — disabled (drag deferred to a future milestone) */}
      <p className="t-mono mb-3" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", letterSpacing: ".05em" }}>
        przeciągnij na dzień by zaplanować
      </p>

      {/* Order rows */}
      {unscheduled.length === 0 ? (
        <p className="t-mono text-sm py-4 text-center" style={{ color: "rgba(0,0,0,0.5)" }}>
          Brak zleceń bez terminu
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {unscheduled.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => openDrawer(order.id)}
              className="text-left"
              style={{
                padding: 10,
                border: "1.5px solid var(--ink)",
                background: "#fff",
                boxShadow: "2px 2px 0 var(--ink)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Drag icon placeholder — non-interactive, deferred */}
                <span style={{ color: "rgba(0,0,0,0.4)" }} aria-hidden>
                  ⠿
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{order.clientName}</span>
              </div>
              <div
                className="t-mono"
                style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 2, marginLeft: 24 }}
              >
                {order.itemSummary}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
        <div className="t-stencil" style={{ fontSize: 11, letterSpacing: ".1em", marginBottom: 8 }}>
          Legenda
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LEGEND_STATUSES.map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 8,
                  background: colorOfStatus(s),
                  border: "1px solid var(--ink)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span className="t-mono" style={{ fontSize: 11 }}>
                {STATUS_LABELS_PL[s]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
