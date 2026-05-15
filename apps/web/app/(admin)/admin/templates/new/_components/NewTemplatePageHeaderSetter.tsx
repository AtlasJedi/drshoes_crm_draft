"use client";

/**
 * NewTemplatePageHeaderSetter — sets topbar title for /admin/templates/new.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function NewTemplatePageHeaderSetter() {
  usePageHeader({ title: "Nowy szablon" });
  return null;
}
