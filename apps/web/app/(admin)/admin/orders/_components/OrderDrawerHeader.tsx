"use client";

/**
 * OrderDrawerHeader — drawer header with close/more buttons, order code, status pill,
 * and the 5-step stepper from the handoff design.
 * Replaces the old header + OrderDrawerStatusTimeline combination.
 * Matches design/handoff/order-drawer-redesign/index.html .drawer-head + .stepper spec.
 * < 80 LOC per granulated-code rule.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { I } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("order-drawer-header");

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PRZYJETE",          label: "Przyjęte" },
  { status: "W_REALIZACJI",      label: "W realizacji" },
  { status: "CZEKA_NA_KLIENTA",  label: "Czeka" },
  { status: "GOTOWE_DO_ODBIORU", label: "Gotowe" },
  { status: "WYDANE",            label: "Wydane" },
];

const STATUS_DOT: Partial<Record<OrderStatus, string>> = {
  PRZYJETE:          "#2b5cff",
  W_REALIZACJI:      "#ff5a1f",
  CZEKA_NA_KLIENTA:  "#e1342b",
  GOTOWE_DO_ODBIORU: "#18b06b",
  WYDANE:            "#0a0a0a",
  ANULOWANE:         "#e1342b",
  WSTEPNIE_PRZYJETE: "#6b6960",
};

const TZ = "Europe/Warsaw";
function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ,
  });
}

interface Props {
  code: string;
  status: OrderStatus;
  clientName?: string | null;
  receivedAt?: string | null;
  location?: string | null;
}

export function OrderDrawerHeader({ code, status, clientName, receivedAt, location }: Props) {
  log.debug("op=render", { code, status });

  const activeIdx = STEPS.findIndex((s) => s.status === status);
  const cancelled = status === "ANULOWANE";
  const dotColor = STATUS_DOT[status] ?? "#6b6960";

  const sub = [clientName, receivedAt ? `przyjęte ${fmtShortDate(receivedAt)}` : null]
    .filter(Boolean).join(" · ");

  return (
    <>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto", gap: 12, alignItems: "center", padding: "16px 18px", background: "var(--paper)", borderBottom: "2px solid var(--ink)" }}>
        <Dialog.Close asChild>
          <button style={{ width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", border: "1.5px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer" }} aria-label="Zamknij">
            {I.close}
          </button>
        </Dialog.Close>

        <div>
          <Dialog.Title className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>{code}</Dialog.Title>
          {sub && <div className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute)", marginTop: 4 }}>{sub}{location ? ` · 📍 ${location}` : ""}</div>}
        </div>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", border: "1.5px solid var(--ink)", background: "var(--paper)", fontFamily: "var(--font-stencil)", fontWeight: 800, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", boxShadow: "2px 2px 0 var(--ink)" }}>
          <span style={{ width: 8, height: 8, background: dotColor, display: "inline-block" }} />
          {status === "ANULOWANE" ? "Anulowane" : STEPS.find((s) => s.status === status)?.label ?? status}
        </span>

        <button style={{ width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", border: "1.5px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer" }} aria-label="Więcej opcji">
          {I.more}
        </button>
      </div>

      {/* Stepper */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", padding: "14px 18px 16px", borderBottom: "1.5px solid var(--admin-line)", background: "var(--paper)", opacity: cancelled ? 0.4 : 1 }} aria-label="Etapy zlecenia">
        {STEPS.map((step, i) => {
          const past   = !cancelled && i < activeIdx;
          const active = !cancelled && i === activeIdx;
          return (
            <div key={step.status} style={{ textAlign: "center", position: "relative" }}>
              <div style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--ink)", background: (past || active) ? "var(--ink)" : "var(--paper)", color: (past || active) ? "var(--paper)" : "var(--ink)", fontFamily: "var(--font-stencil)", fontWeight: 800, fontSize: 13, margin: "0 auto" }} data-step-state={active ? "active" : past ? "past" : "future"}>
                {i + 1}
              </div>
              <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-stencil)", fontWeight: 800, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: active ? "var(--ink)" : "var(--admin-mute)", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", top: 13, left: "calc(50% + 18px)", right: "calc(-50% + 18px)", height: 2, background: past ? "var(--ink)" : "var(--admin-line)" }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
