"use client";

/**
 * Tab navigation for the client detail page.
 * Three sub-routes: Przegląd / Zlecenia / Wiadomości.
 * usePathname() drives active-state styling — mirrors OrderViewTabs stamp pattern.
 * Design source: spec §6.5, §7.2.
 * ~50 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { createLogger } from "@/lib/log";

const log = createLogger("client-tab-nav");

interface Tab {
  label: string;
  href: (id: string) => Route;
  /** pathname ends-with suffix that activates this tab; null = exact match (overview) */
  suffix: string | null;
}

const TABS: Tab[] = [
  { label: "Przegląd",   href: (id) => `/admin/clients/${id}` as Route,           suffix: null },
  { label: "Zlecenia",   href: (id) => `/admin/clients/${id}/zlecenia` as Route,  suffix: "/zlecenia" },
  { label: "Wiadomości", href: (id) => `/admin/clients/${id}/wiadomosci` as Route, suffix: "/wiadomosci" },
];

interface Props {
  clientId: string;
}

export function ClientTabNav({ clientId }: Props) {
  const pathname = usePathname();
  log.debug("op=ClientTabNav.render", { clientId, pathname });

  return (
    <div
      className="inline-flex border-2 border-ink bg-white shadow-[2px_2px_0_var(--ink)]"
      role="tablist"
      aria-label="Widok klienta"
    >
      {TABS.map(({ label, href, suffix }, idx) => {
        const isLast = idx === TABS.length - 1;
        const isActive =
          suffix === null
            ? pathname === `/admin/clients/${clientId}`
            : pathname.endsWith(suffix);

        return (
          <Link
            key={label}
            href={href(clientId)}
            aria-current={isActive ? "page" : undefined}
            className={[
              "px-4 py-2 font-stencil text-xs tracking-widest uppercase font-bold",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-ink/5",
              !isLast ? "border-r border-ink" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
