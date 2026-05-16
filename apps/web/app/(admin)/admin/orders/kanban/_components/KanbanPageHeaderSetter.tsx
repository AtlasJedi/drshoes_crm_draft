"use client";

/**
 * KanbanPageHeaderSetter — sets topbar title/subtitle/right for /admin/orders/kanban.
 * ~20 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button } from "@drshoes/ui";
import Link from "next/link";
import type { Route } from "next";

export function KanbanPageHeaderSetter() {
  usePageHeader({
    title: "Kanban",
    subtitle: "przeciągnij kartę by zmienić status",
    right: (
      <Link href={"/admin/orders/new" as Route}>
        <Button variant="primary" size="sm">+ Nowe zlecenie</Button>
      </Link>
    ),
  });
  return null;
}
