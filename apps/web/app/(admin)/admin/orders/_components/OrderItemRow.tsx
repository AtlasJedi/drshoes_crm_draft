"use client";

import { KIND_LABELS_PL } from "@/lib/orders/status";
import type { OrderItemDto, OrderItemKind } from "@/lib/orders/types";

/** Polish currency display: 1234 cents → "12,34 zł" */
export function fmtPLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

interface Props {
  item: OrderItemDto;
  onEdit: () => void;
  onRemove: () => void;
  removeId: string | null;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  busy: boolean;
}

/** Read-mode display row for a single order item with edit / remove controls. */
export function OrderItemRow({ item, onEdit, onRemove, removeId, onRemoveConfirm, onRemoveCancel, busy }: Props) {
  const pill = (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-admin-line text-admin-mute">
      {KIND_LABELS_PL[item.kind as OrderItemKind]}
    </span>
  );

  return (
    <div className="flex items-center gap-2 text-sm">
      {pill}
      <span className="flex-1 truncate text-ink">{item.description ?? "—"}</span>
      <span className="font-mono text-admin-mute shrink-0">{fmtPLN(item.priceCents)}</span>
      <button type="button" onClick={onEdit}
        className="text-xs text-admin-mute hover:text-ink px-1" aria-label="Edytuj pozycję">
        ✎
      </button>
      {removeId === item.id ? (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-red-600">Czy usunąć tę pozycję?</span>
          <button type="button" disabled={busy} onClick={onRemoveConfirm}
            className="text-red-600 hover:underline disabled:opacity-50">Tak</button>
          <button type="button" onClick={onRemoveCancel}
            className="text-admin-mute hover:text-ink">Nie</button>
        </span>
      ) : (
        <button type="button" onClick={onRemove}
          className="text-xs text-admin-mute hover:text-red-600 px-1" aria-label="Usuń pozycję">
          ✕
        </button>
      )}
    </div>
  );
}
