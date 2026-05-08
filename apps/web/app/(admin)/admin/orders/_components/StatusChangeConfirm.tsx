"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

/** Shape computed in OrderDrawerStatusChanger and passed down for display. */
export type TriggerPreview =
  | { kind: "match"; templateName: string; channels: string[]; delayMinutes: number; requiresManualConfirmation: boolean }
  | { kind: "disabled"; triggerName: string }
  | { kind: "none" };

interface Props {
  open: boolean;
  from: OrderStatus;
  to: OrderStatus | null;
  busy: boolean;
  triggerPreview: TriggerPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Polish label for a channel identifier. */
function channelLabel(ch: string): string {
  switch (ch) {
    case "EMAIL": return "e-mail";
    case "SMS": return "SMS";
    case "WHATSAPP": return "WhatsApp";
    default: return ch.toLowerCase();
  }
}

export function StatusChangeConfirm({ open, from, to, busy, triggerPreview, onConfirm, onCancel }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
          <Dialog.Title className="font-semibold text-ink">
            Zmienić status z{" "}
            <strong>{STATUS_LABELS_PL[from]}</strong> na{" "}
            <strong>{to ? STATUS_LABELS_PL[to] : ""}</strong>?
          </Dialog.Title>

          {/* Trigger preview section */}
          <div>
            <p className="text-xs font-medium text-admin-mute mb-1">Co się stanie:</p>
            {triggerPreview.kind === "match" && (
              <div className="text-sm space-y-0.5">
                <p>
                  Po zmianie zostaną wysłane wiadomości:{" "}
                  <strong>{triggerPreview.templateName}</strong>{" "}
                  kanałem {triggerPreview.channels.map(channelLabel).join(", ")}.
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
                Wyzwalacz <em>{triggerPreview.triggerName}</em> jest wyłączony — nic nie zostanie wysłane.
              </p>
            )}
            {triggerPreview.kind === "none" && (
              <p className="text-sm text-admin-mute">
                Brak skonfigurowanego wyzwalacza dla tego statusu.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onCancel} className="text-sm text-admin-mute hover:text-ink">
              Anuluj
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="px-4 py-1.5 text-sm bg-ink text-paper rounded disabled:opacity-50"
            >
              {busy ? "…" : "Potwierdź"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
