"use client";

/**
 * AdminSidebarNav — sidebar nav using .sb-link/.active utility classes from globals.css.
 * Four labeled sections: PULPIT / OPERACJE / KOMUNIKACJA / SKLEP.
 * Extracted as CC so AdminSidebar can stay SC for the me-prop fetch.
 * ~65 LOC.
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
    <Link href={href as Route} className={"sb-link" + (active ? " active" : "")}>
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="t-stencil px-[18px] mt-5 mb-1"
      style={{ fontSize: 10, opacity: 0.45, letterSpacing: ".15em" }}
    >
      {children}
    </div>
  );
}

interface Props {
  userEmail: string;
}

export function AdminSidebarNav({ userEmail }: Props) {
  log.debug("op=AdminSidebarNav.render");
  return (
    <nav className="flex flex-col py-[14px] flex-1">
      <SectionLabel>PULPIT</SectionLabel>
      <NavLink href="/admin" label="Dashboard" exact />

      <SectionLabel>OPERACJE</SectionLabel>
      <NavLink href="/admin/orders" label="Zamówienia" />
      <NavLink href="/admin/clients" label="Klienci" />
      <MessagesNavItem />

      <SectionLabel>KOMUNIKACJA</SectionLabel>
      <NavLink href="/admin/triggers" label="Triggery" />
      <NavLink href="/admin/templates" label="Szablony wiadomości" />

      <SectionLabel>SKLEP</SectionLabel>
      <NavLink href="/admin/sklep" label="Sklep" />
      <NavLink href="/admin/aktualnosci" label="Aktualności" />

      <SectionLabel>KONFIGURACJA</SectionLabel>
      <NavLink href="/admin/settings/miejsca" label="Miejsca" exact />

      <div className="mt-auto px-[14px] pt-4">
        <ReportIssueButton user={userEmail} />
      </div>
    </nav>
  );
}
