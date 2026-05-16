"use client";

/**
 * CalendarPageHeaderSetter — sets topbar title for /admin/orders/calendar.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button } from "@drshoes/ui";
import Link from "next/link";
import type { Route } from "next";

export function CalendarPageHeaderSetter() {
  usePageHeader({
    title: "Kalendarz",
    subtitle: "planowane odbiory",
    right: (
      <Link href={"/admin/orders/new" as Route}>
        <Button variant="primary" size="sm">+ Nowe zlecenie</Button>
      </Link>
    ),
  });
  return null;
}
