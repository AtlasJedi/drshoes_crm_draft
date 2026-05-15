"use client";

/**
 * NewOrderPageHeaderSetter — sets topbar title for /admin/orders/new.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function NewOrderPageHeaderSetter() {
  usePageHeader({
    title: "Nowe zlecenie",
    subtitle: "wprowadź dane klienta i zlecenia",
  });
  return null;
}
