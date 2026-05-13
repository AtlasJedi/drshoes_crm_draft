"use client";

/**
 * AdminSidebarNav — sidebar nav with usePathname() active-state highlighting.
 * Extracted as CC so AdminSidebar can stay SC for the me-prop fetch.
 */
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { MessagesNavItem } from "@/app/(admin)/admin/_components/Sidebar/MessagesNavItem";
import { ReportIssueButton } from "@/components/admin/ReportIssueButton";
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
        "block px-3 py-2 rounded-md text-[15px] font-medium transition-colors " +
        (active
          ? "bg-acid/30 text-ink"
          : "text-admin-mute hover:bg-acid/10 hover:text-ink")
      }
    >
      {label}
    </Link>
  );
}

interface Props {
  userEmail: string;
}

export function AdminSidebarNav({ userEmail }: Props) {
  log.debug("op=AdminSidebarNav.render");
  return (
    <nav className="space-y-1 text-[15px] flex-1">
      <div className="text-admin-mute uppercase text-[11px] font-semibold tracking-[0.08em] px-1 mb-1">Pulpit</div>
      <NavLink href="/admin" label="Dashboard" exact />

      <div className="text-admin-mute uppercase text-[11px] font-semibold tracking-[0.08em] px-1 mt-5 mb-1">Operacje</div>
      <NavLink href="/admin/orders" label="Zamówienia" />
      <NavLink href="/admin/clients" label="Klienci" />
      <MessagesNavItem />

      <div className="text-admin-mute uppercase text-[11px] font-semibold tracking-[0.08em] px-1 mt-5 mb-1">Komunikacja</div>
      <NavLink href="/admin/triggers" label="Trigery" />
      <NavLink href="/admin/templates" label="Szablony wiadomości" />

      <div className="text-admin-mute uppercase text-[11px] font-semibold tracking-[0.08em] px-1 mt-5 mb-1">Sklep</div>
      <NavLink href="/admin/sklep" label="Sklep" />
      <NavLink href="/admin/aktualnosci" label="Aktualności" />

      <div className="border-t border-admin-line mt-5 pt-4">
        <ReportIssueButton user={userEmail} />
      </div>
    </nav>
  );
}
