// apps/web/app/(public)/_components/Hero.tsx
// Full-bleed hero section for the Dr Shoes landing page.
// Delegates background+splatters to HeroBackground, headline+tagline to HeroHeadline.
// < 65 LOC per granulate directive.

import React from "react";
import { Tape, Sticker, Button } from "@repo/ui";
import { I } from "@repo/ui";
import { HeroBackground } from "./HeroBackground";
import { HeroHeadline } from "./HeroHeadline";

export function Hero() {
  return (
    <section
      id="zamow"
      className="relative overflow-hidden bg-ink text-paper"
    >
      <HeroBackground />

      {/* main content */}
      <div
        className="relative mx-auto px-7 pt-[120px] pb-[110px]"
        style={{ maxWidth: 1280 }}
      >
        {/* tape label row */}
        <div className="flex gap-3 items-center mb-6">
          <Tape>est. 2014 · Wrocław</Tape>
          <Tape color="pink" angle={1.5}>pracownia · nie sklep</Tape>
        </div>

        <HeroHeadline />

        {/* CTA buttons */}
        <div className="flex gap-3.5 mt-11 flex-wrap">
          <Button variant="acid" size="lg" href="#zamow">
            {I.sprayCan} Zamów custom
          </Button>
          <Button variant="paper" size="lg" href="#zamow">
            Oddaj buty do naprawy
          </Button>
        </div>

        {/* bottom-right sticker + scroll cue */}
        <div
          className="absolute flex flex-col items-end gap-2"
          style={{ right: 28, bottom: 30 }}
        >
          <Sticker>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                background: "var(--acid)",
                borderRadius: 9999,
                marginRight: 4,
              }}
            />
            @dr_shoes · 38.4k
          </Sticker>
          <div
            className="t-mono"
            style={{ fontSize: 12, color: "var(--paper)", opacity: 0.55, letterSpacing: ".15em" }}
          >
            ↓ scroll
          </div>
        </div>
      </div>
    </section>
  );
}
