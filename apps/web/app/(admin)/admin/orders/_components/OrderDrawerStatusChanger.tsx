"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { getTriggers } from "@/lib/messaging/api";
import { STATUS_LABELS_PL, STATUS_ORDER, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderDto, OrderStatus } from "@/lib/orders/types";
import type { TriggerDto } from "@/lib/messaging/types";
import { previewForStatus } from "@/lib/orders/triggerPreview";
import { StatusChangeTriggerDialog } from "./StatusChangeTriggerDialog";
import type { TriggerPreview } from "./StatusChangeTriggerDialog";

const log = createLogger("status-changer");

interface Props {
  order: OrderDto;
  onOrderUpdated: (updated: OrderDto) => void;
}

export function OrderDrawerStatusChanger({ order, onOrderUpdated }: Props) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [conflict, setConflict] = useState(false);
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);

  // Fetch all triggers once on mount; preview is computed client-side
  useEffect(() => {
    getTriggers()
      .then((data) => {
        log.info("op=loadTriggers outcome=success", { count: data.length });
        setTriggers(data);
      })
      .catch((err: unknown) => {
        log.error("op=loadTriggers outcome=error", { err });
      });
  }, []);

  function openConfirm(s: OrderStatus) {
    log.info("op=open-confirm", { orderId: order.id, from: order.status, to: s });
    setConflict(false);
    setTarget(s);
  }

  async function handleConfirm() {
    if (!target) return;
    try {
      const res = await changeStatus(order.id, target, order.version);
      log.info("op=changeStatus outcome=ok", { orderId: order.id, to: target });
      onOrderUpdated(res.order);
      setTarget(null);
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 409) {
        log.info("op=changeStatus outcome=conflict", { orderId: order.id, to: target });
        setConflict(true);
        setTarget(null);
      } else {
        log.error("op=changeStatus outcome=error", { orderId: order.id, to: target });
      }
    }
  }

  // Compute preview for the currently selected target status
  const triggerPreview: TriggerPreview = target ? previewForStatus(target, triggers) : { kind: "none" };

  return (
    <div className="px-6 py-4 border-t border-admin-line space-y-3">
      <p className="text-xs font-medium text-admin-mute uppercase tracking-wide">Status</p>
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => {
          const cur = s === order.status;
          const cls = `px-2.5 py-1 rounded text-xs font-medium transition-opacity ${STATUS_PILL_CLASS[s]} ${cur ? "ring-2 ring-offset-1 ring-ink/30 cursor-default" : "opacity-60 hover:opacity-100"}`;
          return (
            <button key={s} disabled={cur} onClick={() => openConfirm(s)} className={cls}>
              {STATUS_LABELS_PL[s]}
            </button>
          );
        })}
      </div>

      {conflict && (
        <p role="alert" aria-live="assertive" className="text-xs text-red-600">
          Konflikt — odśwież
        </p>
      )}

      <StatusChangeTriggerDialog
        open={target !== null}
        fromStatus={order.status}
        toStatus={target}
        orderId={order.id}
        triggerPreview={triggerPreview}
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
