"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

/** Shape computed by previewForStatus() and passed down for display. */
export type TriggerPreview =
  | { kind: "match"; templateName: string; channels: string[]; delayMinutes: number; requiresManualConfirmation: boolean }
  | { kind: "disabled"; triggerName: string }
  | { kind: "none" };

const log = createLogger("status-trigger-dialog");

interface Props {
  open: boolean;
  fromStatus: OrderStatus;
  toStatus: OrderStatus | null;
  /** orderId for logging context only */
  orderId: string;
  clientName?: string;
  triggerPreview: TriggerPreview;
  /** Called with true → send triggers; false → status-only */
  onConfirm: (sendTriggers: boolean) => void;
  onCancel: () => void;
}

function channelLabel(ch: string): string {
  switch (ch) {
    case "EMAIL":    return "e-mail";
    case "SMS":      return "SMS";
    case "WHATSAPP": return "WhatsApp";
    default:         return ch.toLowerCase();
  }
}

export function StatusChangeTriggerDialog({
  open,
  fromStatus,
  toStatus,
  orderId,
  clientName,
  triggerPreview,
  onConfirm,
  onCancel,
}: Props) {
  const hasTrigger = triggerPreview.kind === "match";

  function handleSend() {
    log.info("op=confirmWithTrigger", { orderId, from: fromStatus, to: toStatus });
    onConfirm(true);
  }

  function handleStatusOnly() {
    log.info("op=confirmStatusOnly", { orderId, from: fromStatus, to: toStatus });
    onConfirm(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper border-2 border-ink shadow-[5px_5px_0_var(--pink),5px_5px_0_1.5px_var(--ink)] w-full max-w-sm p-5 space-y-4">
          <Dialog.Title className="font-stencil text-sm tracking-widest uppercase text-pink">
            Zmiana statusu
          </Dialog.Title>

          <p className="text-sm text-ink">
            {clientName && <strong>{clientName} — </strong>}
            <span>
              {STATUS_LABELS_PL[fromStatus]}
              {" → "}
              <strong>{toStatus ? STATUS_LABELS_PL[toStatus] : ""}</strong>
            </span>
          </p>

          {/* Trigger preview */}
          <div>
            <p className="text-xs font-medium text-admin-mute mb-1">Co się stanie:</p>
            {triggerPreview.kind === "match" && (
              <div className="text-sm space-y-0.5">
                <p>
                  Szablon{" "}
                  <strong>{triggerPreview.templateName}</strong>{" "}
                  zostanie wysłany kanałem{" "}
                  {triggerPreview.channels.map(channelLabel).join(", ")}.
                </p>
                {triggerPreview.delayMinutes > 0 && (
                  <p className="text-xs text-admin-mute">
                    Opóźnienie: {triggerPreview.delayMinutes} min.
                  </p>
                )}
                {triggerPreview.requiresManualConfirmation && (
                  <p className="text-xs text-amber-600">
                    Wymagane ręczne potwierdzenie wysyłki.
                  </p>
                )}
              </div>
            )}
            {triggerPreview.kind === "disabled" && (
              <p className="text-sm text-admin-mute">
                Wyzwalacz <em>{triggerPreview.triggerName}</em> jest wyłączony.
              </p>
            )}
            {triggerPreview.kind === "none" && (
              <p className="text-sm text-admin-mute">
                Brak skonfigurowanego wyzwalacza dla tego przejścia.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {hasTrigger && (
              <button
                onClick={handleSend}
                className="w-full px-4 py-2 text-sm font-medium bg-ink text-paper border-2 border-ink hover:bg-ink/90 transition-colors"
              >
                Wyślij wiadomość
              </button>
            )}
            <button
              onClick={handleStatusOnly}
              className="w-full px-4 py-2 text-sm font-medium bg-paper text-ink border-2 border-ink hover:bg-paper-2 transition-colors"
            >
              Tylko zmień status
            </button>
            <button
              onClick={onCancel}
              className="text-sm text-admin-mute hover:text-ink text-center py-1"
            >
              Anuluj
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
