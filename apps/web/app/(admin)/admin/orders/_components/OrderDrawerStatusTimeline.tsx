// apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusTimeline.tsx
"use client";

import { createLogger } from "@/lib/log";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("order-drawer-status-timeline");

interface Props {
  currentStatus: OrderStatus;
}

type StepState = "past" | "active" | "future";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PRZYJETE",          label: "przyjęte" },
  { status: "W_REALIZACJI",      label: "w realizacji" },
  { status: "CZEKA_NA_KLIENTA",  label: "czeka" },
  { status: "GOTOWE_DO_ODBIORU", label: "gotowe" },
  { status: "WYDANE",            label: "wydane" },
];

function resolveActiveIndex(current: OrderStatus): number {
  if (current === "ANULOWANE") return -2; // sentinel: all greyed
  const idx = STEPS.findIndex((s) => s.status === current);
  return idx === -1 ? 0 : idx; // WSTEPNIE_PRZYJETE → 0 (przyjęte active)
}

export function OrderDrawerStatusTimeline({ currentStatus }: Props) {
  log.debug("op=OrderDrawerStatusTimeline.render", { currentStatus });
  const activeIdx = resolveActiveIndex(currentStatus);
  const cancelled = activeIdx === -2;

  function stepState(i: number): StepState {
    if (cancelled) return "future"; // whole bar greyed via opacity-40
    if (i < activeIdx) return "past";
    if (i === activeIdx) return "active";
    return "future";
  }

  return (
    <div
      className={`flex items-start justify-between px-5 py-4 border-b border-admin-line${cancelled ? " opacity-40" : ""}`}
      aria-label="Postęp zlecenia"
    >
      {STEPS.map((step, i) => {
        const state = stepState(i);
        const circleBg     = state === "active" ? "var(--ink)" : state === "past" ? "var(--paper)" : "#fff";
        const circleColor  = state === "active" ? "var(--paper)" : state === "past" ? "var(--ink)" : "rgba(0,0,0,0.4)";
        const borderRadius = state === "active" ? 0 : "50%";
        const labelColor   = state !== "future" ? "var(--ink)" : "rgba(0,0,0,0.5)";
        const labelWeight  = state !== "future" ? 700 : 400;
        const lineColor    = state === "past" ? "var(--ink)" : "rgba(0,0,0,0.08)";

        return (
          <div key={step.status} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                data-step-state={state}
                style={{
                  width: 26, height: 26,
                  background: circleBg,
                  border: "2px solid var(--ink)",
                  borderRadius,
                  color: circleColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: labelWeight,
                color: labelColor, letterSpacing: ".05em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: lineColor, alignSelf: "flex-start", marginTop: 13, marginLeft: 4, marginRight: 4 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
