// apps/web/app/(public)/_components/StickyNav.tsx
// Sticky top nav for the public landing page.
// Design: handoff/design/landing.jsx StickyNav function.
// < 80 LOC per granulate directive.

import React from "react";
import { DrShoesMark } from "@repo/ui";
import { Button } from "@repo/ui";
import { I } from "@repo/ui";

const NAV_LINKS = [
  { label: "Aktualności", href: "#aktualnosci" },
  { label: "Sklep",       href: "#sklep" },
  { label: "Kontakt",     href: "#kontakt" },
] as const;

export function StickyNav() {
  return (
    <header className="sticky top-0 z-50 bg-ink text-paper border-b-[3px] border-acid">
      <div className="max-w-[1280px] mx-auto py-3.5 px-7 flex items-center justify-between">
        {/* Brand wordmark */}
        <DrShoesMark size={0.42} color="var(--paper)" accent="var(--acid)" />

        {/* Right nav */}
        <nav
          className="flex gap-7 items-center font-stencil text-sm uppercase tracking-[0.1em] font-bold"
          aria-label="Główna nawigacja"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-paper no-underline hover:text-acid transition-colors"
            >
              {label}
            </a>
          ))}

          <Button variant="acid" size="sm" href="#zamow">
            {I.sprayCan}
            Zamów
          </Button>
        </nav>
      </div>
    </header>
  );
}
