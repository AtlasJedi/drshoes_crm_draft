"use client";

// apps/web/app/(admin)/admin/sklep/_components/ProductEditPanel.tsx
// Right-side edit panel. Tape header, 4-photo grid, form, status chips, save/delete.

import { useState } from "react";
import { createLogger } from "@/lib/log";
import { Tape, PhImg, Chip, I } from "@repo/ui";
import type { ProductDto, ProductStatus } from "@/lib/sklep/types";

const log = createLogger("sklep.producteditpanel");
const STATUSES: ProductStatus[] = ["dostępne", "zarezerwowane", "sprzedane"];

interface Props {
  product: ProductDto;
  onClose: () => void;
}

export function ProductEditPanel({ product, onClose }: Props) {
  const [name, setName]   = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [size, setSize]   = useState(product.size);
  const [price, setPrice] = useState(product.pricePln);
  const [desc, setDesc]   = useState(product.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(product.status);
  log.debug("op=ProductEditPanel.render", { id: product.id });

  return (
    <div className="admin-card" style={{ padding: 18 }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <Tape>edytujesz · {product.name}</Tape>
        <button className="btn-clean" style={{ padding: 4 }} onClick={onClose} aria-label="zamknij">
          {I.close}
        </button>
      </div>

      {/* 4-photo grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
        {[1, 2, 3, 4].map(i => (
          <PhImg key={i} label={`zdjęcie ${i}`} style={{ aspectRatio: "1" }} />
        ))}
      </div>
      <button
        className="btn-clean"
        style={{ width: "100%", justifyContent: "center", borderStyle: "dashed", marginBottom: 14 }}
        type="button"
      >
        {I.upload} dodaj zdjęcie
      </button>

      {/* Form */}
      <div style={{ display: "grid", gap: 10 }}>
        <div className="field">
          <label htmlFor="prod-name">Nazwa</label>
          <input id="prod-name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <div className="field">
            <label htmlFor="prod-brand">Marka</label>
            <input id="prod-brand" value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="prod-size">Rozmiar</label>
            <input id="prod-size" value={size} onChange={e => setSize(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="prod-price">Cena</label>
            <input id="prod-price" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="prod-desc">Opis</label>
          <textarea id="prod-desc" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ReservationsQueue inserted by task 9-34 below the status chips */}

      {/* Actions */}
      <div className="flex gap-2 mt-3.5">
        <button
          className="btn-clean primary"
          style={{ flex: 1, justifyContent: "center" }}
          type="button"
        >
          zapisz
        </button>
        <button
          className="btn-clean"
          style={{ color: "var(--red)", borderColor: "var(--red)" }}
          type="button"
        >
          {I.trash}
        </button>
      </div>
    </div>
  );
}
