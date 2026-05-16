"use client";

import { useState } from "react";
import { createLogger } from "@/lib/log";
import { updateOrder } from "@/lib/orders/api";
import { HttpError } from "@/lib/api";
import type { OrderDto } from "@/lib/orders/types";
import { plnToCents } from "@/lib/orders/money";
import { daysInShop, isUrgent } from "@/lib/orders/dim";

const log = createLogger("order-drawer");

type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

interface Props {
  order: OrderDto;
  onOrderUpdate: (updated: OrderDto) => void;
}

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-admin-mute uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

function pricePLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderDrawerCoreFields({ order, onOrderUpdate }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function patch(field: string, value: string | number | null) {
    setSaveState("saving");
    log.info("op=patchField", { orderId: order.id, field });
    try {
      const updated = await updateOrder(order.id, { [field]: value, version: order.version });
      log.info("op=patchField outcome=ok", { orderId: order.id, field });
      onOrderUpdate(updated);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) { setSaveState("conflict"); }
      else { setSaveState("error"); }
    }
  }

  const inputCls = "w-full h-9 px-3 border border-admin-line rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-acid bg-transparent";

  const days = daysInShop({ receivedAt: order.receivedAt, status: order.status });
  const urgent = isUrgent({ receivedAt: order.receivedAt, status: order.status });

  return (
    <div className="px-6 py-4 space-y-4">
      <FieldRow label="Klient">
        <p className="text-sm text-admin-ink">{order.clientName}</p>
      </FieldRow>

      <FieldRow label="Opis">
        <textarea
          defaultValue={order.description ?? ""}
          onBlur={(e) => patch("description", e.target.value || null)}
          rows={2}
          className="w-full px-3 py-2 border border-admin-line rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-acid bg-transparent resize-none"
        />
      </FieldRow>

      <FieldRow label="Czas w warsztacie">
        {days === null ? (
          <p className="text-sm text-admin-mute">—</p>
        ) : (
          <p className={`text-sm ${urgent ? "text-magenta font-semibold" : "text-admin-ink"}`}>
            {days} {days === 1 ? "dzień" : "dni"}
            {urgent && " · pilne"}
          </p>
        )}
      </FieldRow>

      <FieldRow label="Wycena">
        <p className="text-sm text-admin-ink font-mono">{pricePLN(order.quotedPriceCents)} zł</p>
      </FieldRow>

      <FieldRow label="Zaliczka">
        <input
          type="text"
          inputMode="decimal"
          defaultValue={order.advancePaidCents > 0 ? pricePLN(order.advancePaidCents) : ""}
          placeholder="0,00"
          onBlur={(e) => patch("advancePaidCents", plnToCents(e.target.value))}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Do zapłaty przy odbiorze">
        {(() => {
          const balance = Math.max(0, order.quotedPriceCents - order.advancePaidCents);
          if (order.quotedPriceCents === 0) return <p className="text-sm text-admin-mute">—</p>;
          const colorCls = balance > 0 ? "text-magenta" : "text-green";
          return <p className={`text-sm font-medium ${colorCls}`}>{pricePLN(balance)} zł</p>;
        })()}
      </FieldRow>

      <div aria-live="polite" className="text-xs min-h-[1.25rem]">
        {saveState === "saved" && <span className="text-green">Zapisano</span>}
        {saveState === "conflict" && <span className="text-orange">Konflikt — odśwież</span>}
        {saveState === "error" && <span className="text-orange">Błąd zapisu. Spróbuj ponownie.</span>}
      </div>
    </div>
  );
}
