"use client";

/**
 * AdminSidebarNav — sidebar nav with usePathname() active-state highlighting.
 * Extracted as CC so AdminSidebar can stay SC for the me-prop fetch.
 */
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { MessagesNavItem } from "@/app/(admin)/admin/_components/Sidebar/MessagesNavItem";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.sidebar.nav");

interface NavLinkProps {
  href: string;
  label: string;
  /** If true, only highlight on exact pathname match (use for /admin Dashboard). */
  exact?: boolean;
}

function NavLink({ href, label, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href as Route}
      className={
        "block px-2 py-1 rounded text-sm font-medium transition-colors " +
        (active
          ? "bg-acid/30 text-ink"
          : "text-admin-mute hover:bg-acid/10 hover:text-ink")
      }
    >
      {label}
    </Link>
  );
}

export function AdminSidebarNav() {
  log.debug("op=AdminSidebarNav.render");
  return (
    <nav className="space-y-1 text-sm flex-1">
      <div className="text-admin-mute uppercase text-xs tracking-wide">Pulpit</div>
      <NavLink href="/admin" label="Dashboard" exact />

      <div className="text-admin-mute uppercase text-xs tracking-wide mt-4">Operacje</div>
      <NavLink href="/admin/orders" label="Zamówienia" />
      <NavLink href="/admin/clients" label="Klienci" />
      <MessagesNavItem />

      <div className="text-admin-mute uppercase text-xs tracking-wide mt-4">Sklep</div>
      <NavLink href="/admin/sklep" label="Sklep" />
      <NavLink href="/admin/aktualnosci" label="Aktualności" />
    </nav>
  );
}
