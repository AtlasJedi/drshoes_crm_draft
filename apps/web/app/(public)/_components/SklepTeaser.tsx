// apps/web/app/(public)/_components/SklepTeaser.tsx
// Public landing: Sklep / shop teaser — 4 static product tiles + non-functional filter pills.
// Design: handoff/design/landing.jsx Sklep function (~line 158).
"use client";

import React from "react";
import { Tape } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import { ProductTile, type ProductEntry } from "./ProductTile";

const log = createLogger("public/SklepTeaser");

// Static placeholder data — real data loads when Sklep stub unlocks (out of M9 scope per spec §7).
const PRODUCTS: ProductEntry[] = [
  { id: "p1", brand: "Nike",        name: "AF1 Mid 'Bandana'",  size: "EU 43", price: "990 zł",  status: "zarezerwowane" },
  { id: "p2", brand: "Vans",        name: "Old Skool 'Drip'",   size: "EU 41", price: "750 zł",  status: "dostępne"      },
  { id: "p3", brand: "Jordan",      name: "Jordan 1 'Tag'",     size: "EU 44", price: "1240 zł", status: "dostępne"      },
  { id: "p4", brand: "Dr. Martens", name: "1460 — Vibram",      size: "EU 42", price: "680 zł",  status: "sprzedane"     },
];

const FILTERS = ["Wszystkie", "Nike", "Vans", "Jordan", "Dr. Martens"] as const;

export function SklepTeaser() {
  log.debug("op=SklepTeaser.render");

  return (
    <section id="sklep" style={{ padding: "100px 28px", background: "var(--paper)", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* header row: tape + headline (left) / notice box (right) */}
        <div className="flex justify-between items-end mb-7 flex-wrap gap-4">
          <div>
            <Tape color="pink">sklep</Tape>
            <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>
              Pary <span style={{ color: "var(--blue)" }}>do wzięcia</span>
            </h2>
          </div>
          <div
            className="t-mono border-[2px] border-ink"
            style={{ fontSize: 12, maxWidth: 320, color: "rgba(0,0,0,0.65)", lineHeight: 1.5, padding: "10px 14px", background: "var(--paper-2)" }}
          >
            ⚠ Płatność i odbiór wyłącznie na miejscu w pracowni.
            Rezerwacja jest niezobowiązująca przez 48h.
          </div>
        </div>

        {/* filter pills — non-functional; design demo only per spec §7 deferral */}
        <div className="flex gap-3.5 mb-7 flex-wrap items-center">
          <span
            className="t-mono"
            style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(0,0,0,0.55)" }}
          >
            filtruj:
          </span>
          {FILTERS.map((f, i) => (
            <button
              key={f}
              type="button"
              className="t-mono font-bold border-[2px] border-ink uppercase"
              style={{
                padding: "6px 16px",
                background: i === 0 ? "var(--acid)" : "var(--paper)",
                fontSize: 12,
                letterSpacing: ".05em",
                cursor: "pointer",
                transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)`,
                boxShadow: i === 0 ? "3px 3px 0 var(--ink)" : "none",
              }}
              // eslint-disable-next-line no-console
              onClick={() => console.warn("filter wkrótce")}
            >
              {f}
            </button>
          ))}
        </div>

        {/* 4-tile product grid */}
        <div className="grid grid-cols-4 gap-4">
          {PRODUCTS.map((p, i) => (
            <ProductTile key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
