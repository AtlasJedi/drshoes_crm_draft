"use client";

/**
 * AktualnosciPageHeaderSetter — sets topbar title for /admin/aktualnosci.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function AktualnosciPageHeaderSetter() {
  usePageHeader({ title: "Aktualności", subtitle: "wpisy na stronę" });
  return null;
}
