"use client";

// apps/web/app/(admin)/admin/sklep/_components/SklepShell.tsx
// Sklep admin shell: filter chips + 2-col product grid (left) + ProductEditPanel (right).
// TODO M10: replace SEED_PRODUCTS with real Product API call

import { useState } from "react";
import { createLogger } from "@/lib/log";
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button, Chip } from "@drshoes/ui";
import type { ProductDto, ProductStatus } from "@/lib/sklep/types";
import { ProductCard } from "./ProductCard";
import { ProductEditPanel } from "./ProductEditPanel";

const log = createLogger("sklep.shell");

// Static seed data — replaced by real API call once backend endpoint exists
// TODO M10: wire to real Product API
const SEED_PRODUCTS: ProductDto[] = [
  {
    id: "p1",
    name: "AF1 Mid 'Bandana'",
    brand: "Nike",
    size: "EU 43",
    pricePln: "990 zł",
    status: "zarezerwowane",
    reservationsCount: 2,
    photos: [],
    description: "Custom AF1 mid · paisley bandana motif.",
  },
  {
    id: "p2",
    name: "Chuck 70 Hi custom",
    brand: "Converse",
    size: "EU 41",
    pricePln: "750 zł",
    status: "dostępne",
    reservationsCount: 0,
    photos: [],
    description: null,
  },
  {
    id: "p3",
    name: "Jordan 1 Retro",
    brand: "Nike",
    size: "EU 44",
    pricePln: "1 200 zł",
    status: "dostępne",
    reservationsCount: 0,
    photos: [],
    description: null,
  },
  {
    id: "p4",
    name: "DM 1460 — Vibram",
    brand: "Dr. Martens",
    size: "EU 40",
    pricePln: "640 zł",
    status: "sprzedane",
    reservationsCount: 0,
    photos: [],
    description: "Vibram sole swap",
  },
];

type FilterKey = "wszystkie" | ProductStatus;
const FILTER_KEYS: FilterKey[] = ["wszystkie", "dostępne", "zarezerwowane", "sprzedane"];

export function SklepShell() {
  const [filter, setFilter]   = useState<FilterKey>("wszystkie");
  const [editing, setEditing] = useState<ProductDto | null>(null);
  log.debug("op=SklepShell.render", { filter });

  const reserved = SEED_PRODUCTS.filter(p => p.status === "zarezerwowane").length;
  const sold     = SEED_PRODUCTS.filter(p => p.status === "sprzedane").length;
  const visible  = filter === "wszystkie"
    ? SEED_PRODUCTS
    : SEED_PRODUCTS.filter(p => p.status === filter);

  usePageHeader({
    title: "Sklep",
    subtitle: `${SEED_PRODUCTS.length} par · ${reserved} zarezerwowanych · ${sold} sprzedanych`,
    right: <Button variant="primary" size="sm">+ Dodaj parę</Button>,
  });

  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
      {/* LEFT: filter chips + product grid */}
      <div>
        <div className="flex gap-2 flex-wrap mb-3.5">
          {FILTER_KEYS.map(f => {
            const count = f === "wszystkie"
              ? SEED_PRODUCTS.length
              : SEED_PRODUCTS.filter(p => p.status === f).length;
            return (
              <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f} ({count})
              </Chip>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {visible.map(p => (
            <ProductCard key={p.id} product={p} onEdit={setEditing} />
          ))}
        </div>
      </div>

      {/* RIGHT: edit panel or placeholder */}
      <div>
        {editing ? (
          <ProductEditPanel product={editing} onClose={() => setEditing(null)} />
        ) : (
          <div
            className="admin-card flex items-center justify-center t-mono text-admin-mute"
            style={{ padding: 40, minHeight: 200, fontSize: 12 }}
          >
            wybierz produkt do edycji
          </div>
        )}
      </div>
    </div>
  );
}
