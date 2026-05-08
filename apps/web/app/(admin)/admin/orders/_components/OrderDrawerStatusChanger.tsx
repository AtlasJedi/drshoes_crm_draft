"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { getTriggers } from "@/lib/messaging/api";
import { STATUS_LABELS_PL, STATUS_ORDER, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderDto, OrderStatus } from "@/lib/orders/types";
import type { TriggerDto } from "@/lib/messaging/types";
import { StatusChangeConfirm } from "./StatusChangeConfirm";
import type { TriggerPreview } from "./StatusChangeConfirm";

const log = createLogger("status-changer");

interface Props {
  order: OrderDto;
  onOrderUpdated: (updated: OrderDto) => void;
}

/**
 * Compute a trigger preview for the prospective status transition.
 * Looks for a STATUS_CHANGE trigger whose eventParams.toStatus matches targetStatus.
 */
function previewFor(targetStatus: string, triggers: TriggerDto[]): TriggerPreview {
  const matched = triggers.find((t) => {
    if (t.event !== "STATUS_CHANGE") return false;
    try {
      const params = JSON.parse(t.eventParams) as { toStatus?: string };
      return params.toStatus === targetStatus;
    } catch {
      return false;
    }
  });
  if (!matched) return { kind: "none" };
  if (!matched.enabled) return { kind: "disabled", triggerName: matched.name };
  let channels: string[] = [];
  try {
    channels = JSON.parse(matched.channels) as string[];
  } catch {
    // leave channels empty if parse fails
  }
  return {
    kind: "match",
    templateName: matched.templateName,
    channels,
    delayMinutes: matched.delayMinutes,
    requiresManualConfirmation: matched.requiresManualConfirmation,
  };
}

export function OrderDrawerStatusChanger({ order, onOrderUpdated }: Props) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  // Compute preview for the currently selected target status
  const triggerPreview: TriggerPreview = target ? previewFor(target, triggers) : { kind: "none" };

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

      <StatusChangeConfirm
        open={target !== null}
        from={order.status}
        to={target}
        busy={busy}
        triggerPreview={triggerPreview}
        onConfirm={handleConfirm}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
