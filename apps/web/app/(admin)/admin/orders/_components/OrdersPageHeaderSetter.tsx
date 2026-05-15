"use client";

/**
 * OrdersPageHeaderSetter — sets topbar title + active/ready counts subtitle for /admin/orders.
 * ~18 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  activeCount: number;
  readyCount: number;
}

export function OrdersPageHeaderSetter({ activeCount, readyCount }: Props) {
  usePageHeader({
    title: "Zamówienia",
    subtitle: `${activeCount} aktywnych · ${readyCount} gotowych do odbioru`,
  });
  return null;
}
