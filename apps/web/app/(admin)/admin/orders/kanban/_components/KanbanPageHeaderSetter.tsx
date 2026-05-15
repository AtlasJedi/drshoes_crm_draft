"use client";

/**
 * KanbanPageHeaderSetter — sets topbar title for /admin/orders/kanban.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function KanbanPageHeaderSetter() {
  usePageHeader({
    title: "Kanban",
    subtitle: "przeciągnij kartę by zmienić status",
  });
  return null;
}
