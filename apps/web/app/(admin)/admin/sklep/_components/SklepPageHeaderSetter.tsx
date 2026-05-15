"use client";

/**
 * SklepPageHeaderSetter — sets topbar title for /admin/sklep.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function SklepPageHeaderSetter() {
  usePageHeader({ title: "Sklep", subtitle: "zarządzanie produktami" });
  return null;
}
