// AdminSidebarNav — PATCH ONLY. Adds the KONFIGURACJA section after SKLEP.
// Drop into the existing sections array; do not rewrite the whole component.

// ─── 1. Imports (top of file) ─────────────────────────────────────
import Link from "next/link";
import { usePathname } from "next/navigation";
// pathname already exists inside the component via usePathname()

// ─── 2. New section block — append after the SKLEP section ────────
<section className="sb-section">
  <div
    className="t-stencil"
    style={{
      fontSize: 11,
      letterSpacing: ".08em",
      color: "var(--admin-mute)",
      margin: "16px 14px 6px",
    }}
  >
    Konfiguracja
  </div>
  <Link
    href="/admin/settings/miejsca"
    className={`sb-link${pathname === "/admin/settings/miejsca" ? " active" : ""}`}
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s-8-7-8-13a8 8 0 1 1 16 0c0 6-8 13-8 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
    <span>Miejsca</span>
  </Link>
</section>
