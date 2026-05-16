"use client";

/**
 * ClientsPageHeaderSetter — sets topbar title + client count subtitle for /admin/clients.
 * ~18 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  total?: number;
}

export function ClientsPageHeaderSetter({ total }: Props) {
  usePageHeader({
    title: "Klienci",
    subtitle: total !== undefined ? `${total} klientów` : undefined,
  });
  return null;
}
