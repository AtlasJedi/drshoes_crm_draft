// apps/web/app/(public)/_components/Contact.tsx
// Contact section for the public landing page.
// Design: handoff/design/landing.jsx Kontakt function (bg-ink variant per task spec 9-40).
// Map: generic Wrocław Rynek embed — real coords deferred per spec §7.
// < 78 LOC per granulate directive.

import React from "react";
import { Tape, Stamp, Sticker, I } from "@drshoes/ui";

export function Contact() {
  return (
    <section id="kontakt" style={{ padding: "100px 28px", background: "var(--ink)", color: "var(--paper)", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* heading */}
        <div style={{ marginBottom: 36 }}>
          <Tape color="acid">kontakt</Tape>
          <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>
            Wpadnij<br /><span style={{ color: "var(--pink)" }}>do nas</span>
          </h2>
        </div>

        {/* 2-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          {/* left: sticker info board */}
          <div
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: "3px solid var(--ink)",
              padding: 28,
              position: "relative",
              boxShadow: "8px 8px 0 rgba(0,0,0,0.45)",
              backgroundImage: "radial-gradient(rgba(0,0,0,0.05) 1.2px, transparent 1.6px)",
              backgroundSize: "12px 12px",
            }}
          >
            <div style={{ position: "absolute", top: -16, left: 30 }}>
              <Tape color="paper">pracownia</Tape>
            </div>
            <div style={{ position: "absolute", top: 18, right: 18, transform: "rotate(8deg)" }}>
              <Stamp color="pink">@dr_shoes</Stamp>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px 18px", marginTop: 18 }}>
              <div style={{ color: "var(--pink)" }}>{I.pin}</div>
              <div>
                <div className="t-display" style={{ fontSize: 22, lineHeight: 1 }}>ul. Włodkowica 14/2</div>
                <div className="t-mono" style={{ fontSize: 13, color: "rgba(0,0,0,0.65)", marginTop: 4 }}>50-072 Wrocław · piętro 2</div>
              </div>

              <div style={{ color: "var(--blue)" }}>{I.clock}</div>
              <div>
                <div className="t-mono" style={{ fontSize: 13, fontWeight: 700 }}>Pn–Pt 11:00 — 19:00</div>
                <div className="t-mono" style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>Sob 12:00 — 16:00 · Nd zamknięte</div>
              </div>

              <div>{I.phone}</div>
              <a href="tel:+48794220118" className="t-display" style={{ fontSize: 26, color: "var(--ink)", textDecoration: "none" }}>+48 794 220 118</a>

              <div>{I.mail}</div>
              <a href="mailto:siema@drshoes.pl" className="t-mono" style={{ fontSize: 14, color: "var(--ink)", textDecoration: "none" }}>siema@drshoes.pl</a>

              <div style={{ color: "var(--pink)" }}>{I.ig}</div>
              <div className="t-mono" style={{ fontSize: 14 }}>@dr_shoes · 38.4k followers</div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px dashed rgba(0,0,0,0.3)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Sticker angle={-2}>spawn point</Sticker>
              <Sticker angle={1.5} style={{ background: "var(--acid)" }}>RTV ok</Sticker>
              <Sticker angle={-1}>kawa za free</Sticker>
            </div>
          </div>

          {/* right: map placeholder iframe — generic Wrocław centre per spec §7 deferral */}
          <iframe
            src="https://maps.google.com/maps?q=Wroclaw+Rynek&z=14&output=embed"
            title="Lokalizacja pracowni Dr Shoes — Wrocław"
            className="border-[3px] border-acid w-full"
            style={{ height: 420, display: "block" }}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
