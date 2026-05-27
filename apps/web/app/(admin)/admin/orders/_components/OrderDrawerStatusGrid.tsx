"use client";

/**
 * OrderDrawerStatusGrid — 6 paint-fill buttons (3×2 grid) for status change.
 * Click opens StatusChangeTriggerDialog (same flow as kanban after v2-A).
 * Matches design/handoff/order-drawer-redesign/index.html .status-section spec.
 * < 80 LOC per granulated-code rule.
 */

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { getTriggers } from "@/lib/messaging/api";
import { listLocations, addOrderNote } from "@/lib/locations";
import type { OrderDto, OrderStatus } from "@/lib/orders/types";
import type { TriggerDto } from "@/lib/messaging/types";
import type { StorageLocation } from "@/lib/types";
import { previewForStatus } from "@/lib/orders/triggerPreview";
import { StatusChangeTriggerDialog } from "./StatusChangeTriggerDialog";
import type { TriggerPreview } from "./StatusChangeTriggerDialog";

const log = createLogger("order-drawer-status-grid");

// [status, css-modifier-slug, short label]
// Slugs match `.status-btn.s-*` selectors in globals.css (paint-fill animation).
const BUTTONS: [OrderStatus, string, string][] = [
  ["PRZYJETE",          "s-przyjete",   "Przyjęte"],
  ["W_REALIZACJI",      "s-realizacja", "Realizacja"],
  ["CZEKA_NA_KLIENTA",  "s-czeka",      "Czeka"],
  ["GOTOWE_DO_ODBIORU", "s-gotowe",     "Gotowe"],
  ["WYDANE",            "s-wydane",     "Wydane"],
  ["ANULOWANE",         "s-anuluj",     "Anuluj"],
];

interface Props {
  order: OrderDto;
  onOrderUpdated: (updated: OrderDto) => void;
}

export function OrderDrawerStatusGrid({ order, onOrderUpdated }: Props) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);

  useEffect(() => {
    getTriggers().then(setTriggers).catch((e: unknown) => log.error("op=loadTriggers outcome=error", { e }));
    listLocations().then((r) => setLocations(r.sort((a, b) => a.position - b.position)))
      .catch((e: unknown) => log.error("op=loadLocations outcome=error", { e }));
  }, []);

  async function handleConfirm(sendTriggers: boolean, note: string, location?: string) {
    if (!target) return;
    try {
      const res = await changeStatus(order.id, target, order.version, sendTriggers, note);
      log.info("op=changeStatus outcome=ok", { orderId: order.id, to: target, sendTriggers });
      let updated = res.order;
      if (location) {
        try {
          await addOrderNote(order.id, { location });
          updated = { ...updated, location };
        } catch (e: unknown) { log.error("op=locationMove outcome=error", { e }); }
      }
      onOrderUpdated(updated);
    } catch {
      log.error("op=changeStatus outcome=error", { orderId: order.id, to: target });
    } finally {
      setTarget(null);
    }
  }

  const triggerPreview: TriggerPreview = target ? previewForStatus(target, triggers) : { kind: "none" };

  return (
    <section aria-label="Zmień status">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {BUTTONS.map(([status, slug, label]) => {
          const isActive = order.status === status;
          const className = `status-btn ${slug}${isActive ? " active" : ""}`;
          return (
            <button
              key={status}
              type="button"
              className={className}
              onClick={() => { if (!isActive) setTarget(status); }}
              aria-current={isActive ? "step" : undefined}
              aria-label={label}
            >
              <span className="label">{label}</span>
            </button>
          );
        })}
      </div>

      <StatusChangeTriggerDialog
        open={target !== null}
        fromStatus={order.status}
        toStatus={target}
        orderId={order.id}
        triggerPreview={triggerPreview}
        currentLocation={order.location}
        locations={locations}
        onConfirm={(sendTriggers, note, location) => { void handleConfirm(sendTriggers, note, location); }}
        onCancel={() => setTarget(null)}
      />
    </section>
  );
}
