// apps/web/app/(public)/_components/NewsTeaserCard.tsx
// Card component for the NewsTeaser section — hero (big) and sm (small) variants.
// Design: handoff/design/landing.jsx News function article elements.
// < 70 LOC per granulate directive.

import React from "react";
import { PhImg, Stamp } from "@repo/ui";

export interface NewsTeaserCardProps {
  date: string;
  title: string;
  excerpt: string;
  size?: "hero" | "sm";
}

export function NewsTeaserCard({
  date,
  title,
  excerpt,
  size = "sm",
}: NewsTeaserCardProps) {
  if (size === "hero") {
    return (
      <article
        className="spray-frame pink"
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          border: "none",
          padding: 0,
          gridRow: "span 2",
        }}
      >
        <div style={{ aspectRatio: "16/10", overflow: "hidden", borderBottom: "3px solid var(--ink)" }}>
          <PhImg label="news cover · workshop fresh paint" style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
        <div style={{ padding: 26, position: "relative" }}>
          <div style={{ position: "absolute", top: -22, right: 24 }}>
            <Stamp color="pink" angle={3}>świeże</Stamp>
          </div>
          <div className="t-mono" style={{ fontSize: 12, letterSpacing: ".1em", color: "rgba(0,0,0,0.55)" }}>
            {date} · pracownia
          </div>
          <h3 className="t-display" style={{ fontSize: 38, margin: "10px 0 12px" }}>{title}</h3>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(0,0,0,0.78)", margin: 0 }}>{excerpt}</p>
          <div style={{ marginTop: 18 }}>
            <a className="btn btn-paper btn-sm" href="#">czytaj →</a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article style={{ background: "var(--paper)", color: "var(--ink)", border: "3px solid var(--paper)" }}>
      <div style={{ aspectRatio: "4/3", overflow: "hidden", borderBottom: "3px solid var(--ink)" }}>
        <PhImg label="news thumbnail" style={{ width: "100%", height: "100%", border: "none" }} />
      </div>
      <div style={{ padding: 18 }}>
        <div className="t-mono" style={{ fontSize: 11, letterSpacing: ".1em", color: "rgba(0,0,0,0.55)" }}>{date}</div>
        <h4 className="t-display" style={{ fontSize: 22, margin: "8px 0 8px", lineHeight: 1 }}>{title}</h4>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,0.7)", margin: 0 }}>{excerpt}</p>
        <a
          className="t-mono"
          href="#"
          style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--ink)", borderBottom: "2px solid var(--acid)" }}
        >
          czytaj →
        </a>
      </div>
    </article>
  );
}
