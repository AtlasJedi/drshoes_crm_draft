"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

interface Props {
  code: string;
  status: OrderStatus;
}

export function OrderDrawerHeader({ code, status }: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-admin-line">
      <div className="flex items-center gap-3">
        <Dialog.Title className="font-mono text-base font-semibold text-admin-ink">
          {code}
        </Dialog.Title>
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL_CLASS[status]}`}
        >
          {STATUS_LABELS_PL[status]}
        </span>
      </div>
      <Dialog.Close
        aria-label="Zamknij"
        className="text-admin-mute hover:text-ink text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-acid/10 transition-colors"
      >
        ×
      </Dialog.Close>
    </div>
  );
}
