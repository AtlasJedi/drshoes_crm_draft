"use client";

/**
 * ClientDetailPageHeaderSetter — sets topbar title to client full name for /admin/clients/[id].
 * ~14 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  name: string;
}

export function ClientDetailPageHeaderSetter({ name }: Props) {
  usePageHeader({ title: name, subtitle: "profil klienta" });
  return null;
}
