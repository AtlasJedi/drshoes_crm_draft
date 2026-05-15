"use client";

/**
 * MessagesPageHeaderSetter — sets topbar title for /admin/messages.
 * ~12 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

export function MessagesPageHeaderSetter() {
  usePageHeader({
    title: "Wiadomości",
    subtitle: "zunifikowana skrzynka",
  });
  return null;
}
