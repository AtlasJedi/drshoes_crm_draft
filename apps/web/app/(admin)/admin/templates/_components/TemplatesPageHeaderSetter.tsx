"use client";

/**
 * TemplatesPageHeaderSetter — sets topbar title for /admin/templates.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function TemplatesPageHeaderSetter() {
  usePageHeader({ title: "Szablony wiadomości" });
  return null;
}
