"use client";

/**
 * DashboardPageHeaderSetter — sets topbar title + today's date subtitle for /admin.
 * Client component because usePageHeader uses useEffect internally.
 * ~18 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function DashboardPageHeaderSetter() {
  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
  usePageHeader({ title: "Dashboard", subtitle: today });
  return null;
}
