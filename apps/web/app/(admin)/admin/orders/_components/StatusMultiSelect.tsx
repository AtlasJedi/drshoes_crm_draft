"use client";

/**
 * StatusMultiSelect — popover checkbox dropdown for order status filtering.
 * Opens on click; closes on outside-click or Escape.
 * Integrates with the orders list URL via `onSelect` callback.
 *
 * Label rules:
 *   0 selected  → "Wszystkie"
 *   1 selected  → that status's Polish label
 *   2+ selected → "X statusów"
 *
 * WSTEPNIE_PRZYJETE is intentionally excluded from the selectable options but
 * is still handled defensively in the label computation.
 */
import React, { useRef, useEffect, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("status-multi-select");

/** Statuses available for manual selection (WSTEPNIE_PRZYJETE excluded per design). */
const SELECTABLE_STATUSES: OrderStatus[] = [
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
  "WYDANE",
  "ANULOWANE",
];

interface Props {
  selected: OrderStatus[];
  /** Called with new selection array (empty array = clear filter). */
  onSelect: (statuses: OrderStatus[]) => void;
}

/** Computes the trigger label based on selection count. */
export function buildLabel(selected: OrderStatus[]): string {
  if (selected.length === 0) return "Wszystkie";
  if (selected.length === 1) return STATUS_LABELS_PL[selected[0]!] ?? selected[0]!;
  return `${selected.length} statusów`;
}

export function StatusMultiSelect({ selected, onSelect }: Props) {
  const [open, setOpen] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  function toggle(status: OrderStatus, checked: boolean) {
    const next = checked
      ? [...selected, status]
      : selected.filter((s) => s !== status);
    log.info("op=statusToggle", { status, checked, count: next.length });
    onSelect(next);
  }

  function clearAll() {
    log.info("op=statusClear");
    onSelect([]);
    close();
  }

  const label = buildLabel(selected);
  const triggerCls =
    "inline-flex items-center gap-1.5 border border-admin-line rounded-md px-3 py-2 " +
    "text-[15px] bg-admin-surface text-admin-ink cursor-pointer select-none " +
    "hover:bg-acid/10 focus:outline-none focus:ring-2 focus:ring-acid transition-colors";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-mute">
        Status
      </span>
      <button
        type="button"
        role="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={triggerCls}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          className={
            "absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-admin-surface " +
            "border border-admin-line rounded-md shadow-lg py-1"
          }
        >
          <ul role="listbox" className="flex flex-col">
            {SELECTABLE_STATUSES.map((s) => {
              const checked = selected.includes(s);
              return (
                <li key={s} role="option" aria-selected={checked}>
                  <label className="flex items-center gap-2.5 px-3 py-2 text-[15px] text-admin-ink cursor-pointer hover:bg-acid/10">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggle(s, e.target.checked)}
                      className="accent-acid"
                    />
                    {STATUS_LABELS_PL[s]}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-admin-line mt-1 px-3 py-2">
            <button
              type="button"
              onClick={clearAll}
              className="text-[13px] text-admin-mute hover:text-admin-ink underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-acid rounded"
            >
              Wyczyść
            </button>
            <button
              type="button"
              onClick={close}
              className="text-[13px] text-admin-mute hover:text-admin-ink focus:outline-none focus:ring-1 focus:ring-acid rounded"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
