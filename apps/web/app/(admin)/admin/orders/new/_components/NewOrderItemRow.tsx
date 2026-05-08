"use client";

import type { OrderItemKind } from "@/lib/orders/types";
import { KIND_LABELS_PL } from "@/lib/orders/status";

export interface ItemRowState {
  kind: OrderItemKind;
  description: string;
  pricePln: string; // display string: "19.90" — converted to cents on submit
}

interface Props {
  index: number;
  item: ItemRowState;
  onChange: (index: number, next: ItemRowState) => void;
  onRemove: (index: number) => void;
}

const KIND_OPTIONS = Object.entries(KIND_LABELS_PL) as [OrderItemKind, string][];

export function NewOrderItemRow({ index, item, onChange, onRemove }: Props) {
  const inputCls =
    "h-9 px-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm";

  return (
    <div className="flex gap-2 items-start">
      {/* Kind select */}
      <select
        value={item.kind}
        onChange={(e) => onChange(index, { ...item, kind: e.target.value as OrderItemKind })}
        className={inputCls + " w-36 bg-white"}
        aria-label="Rodzaj pozycji"
      >
        {KIND_OPTIONS.map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>

      {/* Description */}
      <input
        type="text"
        value={item.description}
        placeholder="Opis (opcjonalnie)"
        onChange={(e) => onChange(index, { ...item, description: e.target.value })}
        className={inputCls + " flex-1 min-w-0"}
        aria-label="Opis pozycji"
      />

      {/* Price (PLN) */}
      <input
        type="number"
        value={item.pricePln}
        min="0"
        step="0.01"
        placeholder="0.00"
        onChange={(e) => onChange(index, { ...item, pricePln: e.target.value })}
        className={inputCls + " w-24 text-right"}
        aria-label="Cena w PLN"
      />
      <span className="h-9 flex items-center text-sm text-admin-mute select-none">zł</span>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Usuń pozycję"
        className="h-9 px-2 text-admin-mute hover:text-magenta text-sm transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
