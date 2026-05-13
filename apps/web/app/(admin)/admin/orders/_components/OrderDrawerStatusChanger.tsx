"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { getTriggers } from "@/lib/messaging/api";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
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

// Main forward progression for the segmented control (WSTĘPNIE_PRZYJĘTE leads
// in only when it's the current state — design-system note: "muted, hidden from
// manual-selection UI but must render"). ANULOWANE is a separate destructive
// chip on the right.
const MAIN_FLOW: OrderStatus[] = [
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
  "WYDANE",
];

/** Filled (current) per-status color, paired with readable foreground. */
const FILLED_CLASS: Record<OrderStatus, string> = {
  WSTEPNIE_PRZYJETE: "bg-admin-mute text-white",
  PRZYJETE:          "bg-blue text-white",
  W_REALIZACJI:      "bg-acid text-ink",
  CZEKA_NA_KLIENTA:  "bg-orange text-white",
  GOTOWE_DO_ODBIORU: "bg-magenta text-white",
  WYDANE:            "bg-green text-white",
  ANULOWANE:         "bg-orange text-white",
};

/** Idle (non-current) per-status accent — colored text on white surface. */
const IDLE_CLASS: Record<OrderStatus, string> = {
  WSTEPNIE_PRZYJETE: "text-admin-mute hover:bg-admin-line/40",
  PRZYJETE:          "text-blue hover:bg-blue/10",
  W_REALIZACJI:      "text-ink hover:bg-acid/30",
  CZEKA_NA_KLIENTA:  "text-orange hover:bg-orange/10",
  GOTOWE_DO_ODBIORU: "text-magenta hover:bg-magenta/10",
  WYDANE:            "text-green hover:bg-green/10",
  ANULOWANE:         "text-orange hover:bg-orange/10",
};

/**
 * Compact labels for the segmented control. The drawer is ~720px wide and
 * a 5-segment row with full Polish labels overflows. Long-form STATUS_LABELS_PL
 * remains the source of truth everywhere else (tables, dialogs, history).
 */
const SHORT_LABEL: Record<OrderStatus, string> = {
  WSTEPNIE_PRZYJETE: "Wstępne",
  PRZYJETE:          "Przyjęte",
  W_REALIZACJI:      "Realizacja",
  CZEKA_NA_KLIENTA:  "Czeka",
  GOTOWE_DO_ODBIORU: "Gotowe",
  WYDANE:            "Wydane",
  ANULOWANE:         "Anuluj",
};

export function OrderDrawerStatusChanger({ order, onOrderUpdated }: Props) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [conflict, setConflict] = useState(false);
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);

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

  async function handleConfirm(note: string) {
    if (!target) return;
    try {
      const res = await changeStatus(order.id, target, order.version, note);
      log.info("op=changeStatus outcome=ok", { orderId: order.id, to: target, hasNote: note.trim().length > 0 });
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

  const triggerPreview: TriggerPreview = target ? previewForStatus(target, triggers) : { kind: "none" };

  const showPreFlow = order.status === "WSTEPNIE_PRZYJETE";
  const flow: OrderStatus[] = showPreFlow ? ["WSTEPNIE_PRZYJETE", ...MAIN_FLOW] : MAIN_FLOW;
  const isCancelled = order.status === "ANULOWANE";

  return (
    <div className="px-6 py-5 border-t border-admin-line space-y-3">
      <p className="text-[11px] font-semibold text-admin-mute uppercase tracking-[0.08em]">Status</p>

      <div className="flex items-stretch gap-3 flex-wrap">
        {/* Segmented control: forward progression */}
        <div
          role="group"
          aria-label="Zmiana statusu"
          className="inline-flex items-stretch rounded-lg border border-admin-line bg-admin-surface overflow-hidden divide-x divide-admin-line shadow-sm"
        >
          {flow.map((s) => {
            const cur = s === order.status;
            const cls = cur
              ? `${FILLED_CLASS[s]} cursor-default`
              : `${IDLE_CLASS[s]} bg-admin-surface`;
            return (
              <button
                key={s}
                type="button"
                disabled={cur}
                onClick={() => openConfirm(s)}
                aria-current={cur ? "step" : undefined}
                aria-label={STATUS_LABELS_PL[s]}
                title={STATUS_LABELS_PL[s]}
                className={`px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors whitespace-nowrap ${cls}`}
              >
                {SHORT_LABEL[s]}
              </button>
            );
          })}
        </div>

        {/* Destructive: separate ANULOWANE chip */}
        <button
          type="button"
          disabled={isCancelled}
          onClick={() => openConfirm("ANULOWANE")}
          aria-current={isCancelled ? "step" : undefined}
          aria-label={STATUS_LABELS_PL.ANULOWANE}
          title={STATUS_LABELS_PL.ANULOWANE}
          className={
            isCancelled
              ? `${FILLED_CLASS.ANULOWANE} cursor-default px-3 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap`
              : `${IDLE_CLASS.ANULOWANE} px-3 py-2.5 rounded-lg border border-orange/40 bg-admin-surface text-[12px] font-semibold uppercase tracking-wide transition-colors whitespace-nowrap`
          }
        >
          {SHORT_LABEL.ANULOWANE}
        </button>
      </div>

      {conflict && (
        <p role="alert" aria-live="assertive" className="text-sm text-orange font-medium">
          Konflikt — odśwież
        </p>
      )}

      <StatusChangeTriggerDialog
        open={target !== null}
        fromStatus={order.status}
        toStatus={target}
        orderId={order.id}
        triggerPreview={triggerPreview}
        onConfirm={(_sendTriggers, note) => { void handleConfirm(note); }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
