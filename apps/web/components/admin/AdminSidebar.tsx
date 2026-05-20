import type { MeResponse } from "@/lib/auth/types";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { DrShoesMark } from "@drshoes/ui";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.sidebar");

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  me: MeResponse;
}

/**
 * SC shell — dark 230px sidebar with acid right border.
 * Nav delegated to AdminSidebarNav (CC) for usePathname active-state.
 * Footer: acid avatar + name + role + power button → POST /logout.
 * ~55 LOC.
 */
export function AdminSidebar({ me }: Props) {
  log.debug("op=AdminSidebar.render", { userId: me.id });
  const ini = initials(me.fullName);

  return (
    <aside
      style={{ width: 230, borderRight: "3px solid var(--acid)" }}
      className="bg-ink text-paper flex flex-col shrink-0 min-h-screen"
    >
      {/* Header */}
      <div
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        className="px-[18px] py-5"
      >
        <DrShoesMark size={0.32} color="var(--paper)" accent="var(--acid)" />
        <div
          className="t-mono"
          style={{ fontSize: 10, opacity: 0.55, marginTop: 4, letterSpacing: ".15em" }}
        >
          panel pracowni · v2.4
        </div>
      </div>

      {/* Nav */}
      <AdminSidebarNav userEmail={me.email} />

      {/* Footer */}
      <div
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        className="p-[14px] flex items-center gap-[10px]"
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--acid)", color: "var(--ink)",
            fontFamily: "var(--font-display)", fontSize: 18,
          }}
          className="flex items-center justify-center shrink-0"
        >
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <div className="t-stencil truncate" style={{ fontSize: 12, color: "var(--paper)" }}>
            {me.fullName}
          </div>
          <div className="t-mono" style={{ fontSize: 10, opacity: 0.55 }}>
            {me.role.toLowerCase()} · pracownia
          </div>
        </div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            aria-label="Wyloguj"
            className="text-paper opacity-55 hover:opacity-100 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
