"use client";

/**
 * TriggersPageHeaderSetter — sets topbar title for /admin/triggers.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function TriggersPageHeaderSetter() {
  usePageHeader({
    title: "Triggery",
    subtitle: "zautomatyzowane wiadomości",
  });
  return null;
}
