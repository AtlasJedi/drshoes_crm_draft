"use client";

/**
 * ClientDetailPageHeaderSetter — sets topbar title to client full name for /admin/clients/[id].
 * Subtitle: "klient od MM.YYYY" using client.createdAt.
 * ~20 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  name: string;
  createdAt: string;
}

function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", {
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}

export function ClientDetailPageHeaderSetter({ name, createdAt }: Props) {
  usePageHeader({ title: name, subtitle: `klient od ${fmtMonthYear(createdAt)}` });
  return null;
}
