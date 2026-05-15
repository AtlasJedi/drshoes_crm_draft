// apps/web/app/(public)/_components/HeroHeadline.tsx
// Display headline + tag-font tagline for the Hero section.
// < 35 LOC per granulate directive.

import React from "react";

export function HeroHeadline() {
  return (
    <>
      <h1
        className="t-display m-0"
        style={{ fontSize: "clamp(96px, 14vw, 220px)", color: "var(--paper)" }}
      >
        Dr
        <span style={{ color: "var(--acid)", WebkitTextStroke: "3px var(--paper)" }}>
          .
        </span>
        Shoes
      </h1>
      <div
        className="t-tag"
        style={{
          fontSize: 36,
          color: "var(--acid)",
          transform: "rotate(-2deg)",
          marginTop: -6,
          marginLeft: 8,
        }}
      >
        customy · naprawy · malowanie — robione ręcznie
      </div>
    </>
  );
}
