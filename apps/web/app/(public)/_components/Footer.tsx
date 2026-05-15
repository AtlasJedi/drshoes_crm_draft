// apps/web/app/(public)/_components/Footer.tsx
// Minimal footer bar for the public landing page.
// Design: handoff/design/landing.jsx Footer (simplified to two-item mono bar per spec 9-40).
// < 25 LOC per granulate directive.

import React from "react";

export function Footer() {
  return (
    <footer
      className="t-mono border-t-[2px] border-acid"
      style={{ padding: "28px", background: "var(--ink)", color: "var(--paper)" }}
    >
      <div
        className="flex justify-between items-center"
        style={{ maxWidth: 1280, margin: "0 auto", fontSize: 11, opacity: 0.6 }}
      >
        <span>© 2026 Dr Shoes · pracownia w Wrocławiu</span>
        <span>made with paint &amp; duct tape</span>
      </div>
    </footer>
  );
}
