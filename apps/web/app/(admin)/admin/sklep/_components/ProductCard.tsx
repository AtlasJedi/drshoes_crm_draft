"use client";

// apps/web/app/(admin)/admin/sklep/_components/ProductCard.tsx
// Grid card for a single product. Stamp overlay top-left, edit/eye overlays top-right.

import { createLogger } from "@/lib/log";
import { Stamp, PhImg, I } from "@repo/ui";
import type { ProductDto, ProductStatus } from "@/lib/sklep/types";

const log = createLogger("sklep.productcard");

const STAMP_COLOR: Record<ProductStatus, "green" | "pink" | "ink"> = {
  "dostępne":     "green",
  "zarezerwowane": "pink",
  "sprzedane":    "ink",
};

const STAMP_LABEL: Record<ProductStatus, string> = {
  "dostępne":     "dostępne",
  "zarezerwowane": "rezerwacja",
  "sprzedane":    "sprzedane",
};

interface Props {
  product: ProductDto;
  onEdit: (p: ProductDto) => void;
}

export function ProductCard({ product: p, onEdit }: Props) {
  log.debug("op=ProductCard.render", { id: p.id });
  return (
    <div className="admin-card overflow-hidden" style={{ padding: 0 }}>
      <div className="relative border-b-[1.5px] border-ink" style={{ aspectRatio: "1" }}>
        <PhImg label={p.name} style={{ width: "100%", height: "100%", border: "none" }} />
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <Stamp color={STAMP_COLOR[p.status]} angle={-3}>
            {STAMP_LABEL[p.status]}
          </Stamp>
        </div>
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
          <button
            className="btn-clean"
            style={{ padding: 5 }}
            onClick={() => onEdit(p)}
            aria-label="edytuj"
          >
            {I.edit}
          </button>
          <button className="btn-clean" style={{ padding: 5 }} aria-label="podgląd">
            {I.eye}
          </button>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.55)" }}>
          {p.brand} · {p.size}
        </div>
        <div className="t-display mt-0.5" style={{ fontSize: 18 }}>{p.name}</div>
        <div className="flex justify-between items-center mt-1.5">
          <div className="t-display" style={{ fontSize: 22 }}>{p.pricePln}</div>
          {p.status === "zarezerwowane" && p.reservationsCount > 0 && (
            <span className="t-mono font-bold" style={{ fontSize: 10, color: "var(--pink)" }}>
              {p.reservationsCount} rezerwacje
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
