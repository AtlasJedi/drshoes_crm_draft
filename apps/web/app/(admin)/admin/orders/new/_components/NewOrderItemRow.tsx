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
  return (
    <div
      className="grid items-stretch border-b border-[rgba(10,10,10,0.08)] last:border-b-0 focus-within:bg-acid/[0.08]"
      style={{ gridTemplateColumns: "140px 1fr 110px 36px" }}
    >
      {/* Kind select */}
      <div className="border-r border-[rgba(10,10,10,0.08)]">
        <select
          value={item.kind}
          onChange={(e) => onChange(index, { ...item, kind: e.target.value as OrderItemKind })}
          aria-label="Rodzaj pozycji"
          className="w-full h-full px-3 py-[11px] bg-transparent border-0 outline-none font-stencil font-black text-[12px] uppercase tracking-[.06em] cursor-pointer appearance-none"
          style={{
            backgroundImage:
              "linear-gradient(45deg,transparent 50%,var(--ink) 50%),linear-gradient(135deg,var(--ink) 50%,transparent 50%)",
            backgroundPosition: "calc(100% - 14px) 50%, calc(100% - 9px) 50%",
            backgroundSize: "5px 5px",
            backgroundRepeat: "no-repeat",
            paddingRight: 28,
          }}
        >
          {KIND_OPTIONS.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="border-r border-[rgba(10,10,10,0.08)]">
        <input
          type="text"
          value={item.description}
          placeholder="Opis (opcjonalnie)"
          onChange={(e) => onChange(index, { ...item, description: e.target.value })}
          className="w-full h-full px-[14px] py-[11px] bg-transparent border-0 outline-none text-sm"
          aria-label="Opis pozycji"
        />
      </div>

      {/* Price (PLN) */}
      <div className="border-r border-[rgba(10,10,10,0.08)] flex items-center pr-3">
        <input
          type="number"
          value={item.pricePln}
          min="0"
          step="0.01"
          placeholder="0,00"
          onChange={(e) => onChange(index, { ...item, pricePln: e.target.value })}
          className="w-full bg-transparent border-0 outline-none text-right font-mono text-sm font-semibold pr-1 py-[11px]"
          aria-label="Cena w PLN"
        />
        <span className="font-mono text-[11px] text-admin-mute shrink-0">zł</span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Usuń pozycję"
        className="flex items-center justify-center text-admin-mute hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </div>
  );
}
