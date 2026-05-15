"use client";

/**
 * CalendarPageHeaderSetter — sets topbar title for /admin/orders/calendar.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function CalendarPageHeaderSetter() {
  usePageHeader({ title: "Kalendarz", subtitle: "planowane odbiory" });
  return null;
}
