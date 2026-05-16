"use client";

/**
 * OrderDrawerOpis — textarea (no label) with acid corner tag "opis".
 * Matches design/handoff/order-drawer-redesign/index.html .opis-wrap spec.
 * Saves via PATCH endpoint on blur — same handler as OrderDrawerCoreFields.
 * < 50 LOC per granulated-code rule.
 */

import { useState } from "react";
import { createLogger } from "@/lib/log";
import { updateOrder } from "@/lib/orders/api";
import { HttpError } from "@/lib/api";
import type { OrderDto } from "@/lib/orders/types";

const log = createLogger("order-drawer-opis");

interface Props {
  order: OrderDto;
  onSave: (updated: OrderDto) => void;
}

export function OrderDrawerOpis({ order, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const value = e.target.value || null;
    if (value === (order.description ?? null)) return; // no change
    setSaving(true);
    setError(null);
    log.info("op=saveOpis", { orderId: order.id });
    try {
      const updated = await updateOrder(order.id, { description: value, version: order.version });
      log.info("op=saveOpis outcome=ok", { orderId: order.id });
      onSave(updated);
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        setError("Konflikt — odśwież");
      } else {
        setError("Błąd zapisu");
      }
      log.error("op=saveOpis outcome=error", { orderId: order.id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Opis zlecenia" style={{ position: "relative" }}>
      {/* Acid corner tape */}
      <span style={{
        position: "absolute", top: -7, right: 10,
        background: "var(--acid)", border: "1.5px solid var(--ink)",
        padding: "1px 6px",
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
        letterSpacing: ".12em", textTransform: "uppercase",
        transform: "rotate(-2deg)",
        zIndex: 1,
      }}>
        opis
      </span>
      <textarea
        key={order.id}
        defaultValue={order.description ?? ""}
        onBlur={handleBlur}
        placeholder="Opis zlecenia — co konkretnie jest do zrobienia, materiał, kolor, uwagi klienta…"
        rows={3}
        style={{
          width: "100%",
          minHeight: 76,
          padding: "12px 14px",
          background: "var(--paper)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.4,
          color: "var(--ink)", resize: "vertical",
          boxShadow: "3px 3px 0 var(--ink)",
          outline: "none",
        }}
        onFocus={(e) => { e.target.style.outline = "2px solid var(--acid)"; e.target.style.outlineOffset = "1px"; }}
        onBlurCapture={(e) => { e.target.style.outline = "none"; }}
        disabled={saving}
      />
      {error && <p style={{ fontSize: 11, color: "var(--red)", marginTop: 2 }}>{error}</p>}
    </section>
  );
}
