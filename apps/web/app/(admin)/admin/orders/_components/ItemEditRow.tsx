"use client";

import type { OrderItemKind } from "@/lib/orders/types";
import { KIND_LABELS_PL } from "@/lib/orders/status";

export interface ItemEditState {
  kind: OrderItemKind;
  description: string;
  pricePln: string; // display: "19.90" — converted to cents on submit
}

interface Props {
  value: ItemEditState;
  onChange: (next: ItemEditState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}

const KIND_OPTIONS = Object.entries(KIND_LABELS_PL) as [OrderItemKind, string][];
const inputCls = "h-9 px-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm bg-white";

/** Inline form row for adding or editing an order item. */
export function ItemEditRow({ value, onChange, onSave, onCancel, busy }: Props) {
  return (
    <div className="flex gap-2 items-start">
      <select value={value.kind} disabled={busy}
        onChange={(e) => onChange({ ...value, kind: e.target.value as OrderItemKind })}
        className={inputCls + " w-36"} aria-label="Rodzaj pozycji">
        {KIND_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input type="text" value={value.description} disabled={busy}
        placeholder="Opis (opcjonalnie)"
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        className={inputCls + " flex-1 min-w-0"} aria-label="Opis pozycji" />
      <input type="number" value={value.pricePln} disabled={busy}
        min="0" step="0.01" placeholder="0.00"
        onChange={(e) => onChange({ ...value, pricePln: e.target.value })}
        className={inputCls + " w-24 text-right"} aria-label="Cena w PLN" />
      <span className="h-9 flex items-center text-sm text-admin-mute select-none">zł</span>
      <button type="button" disabled={busy} onClick={onSave}
        className="h-9 px-3 rounded-sm bg-acid text-ink text-sm font-medium hover:brightness-95 disabled:opacity-50">
        Zapisz
      </button>
      <button type="button" disabled={busy} onClick={onCancel}
        className="h-9 px-3 rounded-sm border border-admin-line text-sm text-admin-mute hover:text-ink disabled:opacity-50">
        Anuluj
      </button>
    </div>
  );
}
