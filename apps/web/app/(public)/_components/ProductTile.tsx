// apps/web/app/(public)/_components/ProductTile.tsx
// Sub-component: single shoe product card with Stamp overlay.
// Design: handoff/design/landing.jsx Sklep > visible.map(). < 60 LOC per granulate directive.

import React from "react";
import { PhImg, Stamp } from "@drshoes/ui";

export type ProductStatus = "dostępne" | "zarezerwowane" | "sprzedane";

export interface ProductEntry {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: string;
  status: ProductStatus;
}

interface ProductTileProps {
  product: ProductEntry;
  index: number;
}

function stampForStatus(s: ProductStatus) {
  if (s === "dostępne") return <Stamp color="green">dostępne</Stamp>;
  if (s === "zarezerwowane") return <Stamp color="pink">rezerwacja</Stamp>;
  return <Stamp color="ink" angle={-3}>sprzedane</Stamp>;
}

export function ProductTile({ product, index }: ProductTileProps) {
  return (
    <div
      data-testid="product-tile"
      className="bg-paper border-[3px] border-ink relative overflow-hidden"
      style={{ boxShadow: "6px 6px 0 var(--ink)" }}
    >
      {/* square image with stamp + index badge */}
      <div className="relative overflow-hidden border-b-[3px] border-ink" style={{ aspectRatio: "1/1" }}>
        <PhImg
          label={`${product.brand}\n${product.name}`}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
        <div className="absolute top-3.5 left-3.5">{stampForStatus(product.status)}</div>
        <div
          className="absolute top-3.5 right-3.5 t-mono text-[var(--paper)] bg-[var(--ink)]"
          style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px" }}
        >
          #{String(index + 1).padStart(2, "0")}
        </div>
      </div>

      {/* product details */}
      <div className="flex flex-col gap-1.5" style={{ padding: 18 }}>
        <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: ".1em" }}>
          {product.brand} · {product.size}
        </div>
        <h4 className="t-display m-0" style={{ fontSize: 24, lineHeight: 1 }}>
          {product.name}
        </h4>
        <div className="t-display mt-2.5" style={{ fontSize: 30 }}>
          {product.price}
        </div>
      </div>
    </div>
  );
}
