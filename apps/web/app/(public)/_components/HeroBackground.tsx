// apps/web/app/(public)/_components/HeroBackground.tsx
// Full-bleed PhImg placeholder + two decorative Splatter overlays for Hero.
// < 40 LOC per granulate directive.

import React from "react";
import { PhImg, Splatter } from "@repo/ui";

export function HeroBackground() {
  return (
    <>
      <div className="absolute inset-0">
        <PhImg
          dark
          label="HERO REEL · workshop b-roll · custom AF1 closeup"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        />
      </div>
      <Splatter
        color="var(--acid)"
        size={420}
        style={{ top: -80, right: -60, opacity: 0.85 }}
      />
      <Splatter
        color="var(--pink)"
        size={280}
        style={{ bottom: -40, left: 120, opacity: 0.65 }}
      />
    </>
  );
}
