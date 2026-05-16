// apps/web/app/(public)/_components/NewsTeaser.tsx
// News teaser section for the public landing page.
// Design: handoff/design/landing.jsx News function.
// Static placeholder data — real API wires in when Aktualności stub unlocks.
// < 60 LOC per granulate directive.

import React from "react";
import { Splatter, Tape, Button, I } from "@drshoes/ui";
import { NewsTeaserCard } from "./NewsTeaserCard";

interface NewsEntry {
  date: string;
  title: string;
  excerpt: string;
}

const NEWS: NewsEntry[] = [
  { date: "08.05.26", title: 'Świeży drop · custom AF1 "Bandana"', excerpt: "Acrylic Angelus, fixer Saphir, 100% ręcznie. 6 par w sklepie." },
  { date: "02.05.26", title: "Carhartt back piece — proces",         excerpt: "Cały tydzień nad jednym tłem." },
  { date: "28.04.26", title: "Dr Martens 1460 — Vibram",            excerpt: "Wymiana podeszwy + czyszczenie głębokie." },
  { date: "20.04.26", title: "IG: 38.4k followers!",                excerpt: "Dziękujemy społeczności." },
];

export function NewsTeaser() {
  const hero = NEWS[0]!;
  const rest = NEWS.slice(1);

  return (
    <section
      id="aktualnosci"
      className="py-[100px] bg-ink text-paper relative overflow-hidden"
      style={{ padding: "100px 28px" }}
    >
      <Splatter color="var(--pink)" size={300} style={{ top: -60, left: -40, opacity: 0.4 }} />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Tape color="acid">aktualności</Tape>
            <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>
              Co się <span style={{ color: "var(--acid)" }}>dzieje</span>
            </h2>
          </div>
          <Button variant="acid" size="sm" href="#">
            Wszystkie wpisy {I.arrow}
          </Button>
        </div>

        {/* Grid: 1 hero + 3 small */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 22 }}>
          <NewsTeaserCard size="hero" date={hero.date} title={hero.title} excerpt={hero.excerpt} />
          {rest.map((n, i) => (
            <NewsTeaserCard key={i} size="sm" date={n.date} title={n.title} excerpt={n.excerpt} />
          ))}
        </div>
      </div>
    </section>
  );
}
