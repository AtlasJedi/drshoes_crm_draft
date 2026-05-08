"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

interface Props {
  open: boolean;
  from: OrderStatus;
  to: OrderStatus | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StatusChangeConfirm({ open, from, to, busy, onConfirm, onCancel }: Props) {
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
          <div>
            <p className="text-xs font-medium text-admin-mute mb-1">Co się stanie:</p>
            <p className="text-xs text-admin-mute italic">
              Triggery dochodzą w M2 — żadne powiadomienia nie wyślą się teraz.
            </p>
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
