/**
 * Shared view-switcher for the three Orders surfaces (List / Calendar / Kanban).
 * Visual source: handoff/design/admin.jsx:511-520.
 * Pure navigation — uses Next.js <Link>; active state is controlled by props.
 *
 * Note: /admin/orders/calendar and /admin/orders/kanban are future pages (M6+).
 * Until their page.tsx files exist they are not in Next.js typed-routes StaticRoutes,
 * so hrefs are cast via `Route` from `next`.
 */
import Link from "next/link";
import type { Route } from "next";

export type OrderView = "list" | "calendar" | "kanban";

const TABS: { view: OrderView; label: string; href: Route }[] = [
  { view: "list",     label: "Lista",     href: "/admin/orders" as Route },
  { view: "calendar", label: "Kalendarz", href: "/admin/orders/calendar" as Route },
  { view: "kanban",   label: "Kanban",    href: "/admin/orders/kanban" as Route },
];

interface OrderViewTabsProps {
  active: OrderView;
}

export function OrderViewTabs({ active }: OrderViewTabsProps) {
  return (
    <div
      className="inline-flex border-2 border-ink bg-white shadow-[2px_2px_0_var(--ink)]"
      role="tablist"
      aria-label="Widok zleceń"
    >
      {TABS.map(({ view, label, href }, idx) => {
        const isActive = view === active;
        const isLast = idx === TABS.length - 1;
        return (
          <Link
            key={view}
            href={href}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            className={[
              "px-4 py-2 font-stencil text-xs tracking-widest uppercase font-bold",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive
                ? "bg-ink text-paper"
                : "bg-transparent text-ink hover:bg-ink/5",
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
