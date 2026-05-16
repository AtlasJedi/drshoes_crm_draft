"use client";

/**
 * OrdersPageHeaderSetter — sets topbar title + active/ready counts subtitle for /admin/orders.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button } from "@drshoes/ui";
import Link from "next/link";
import type { Route } from "next";

interface Props {
  activeCount: number;
  readyCount: number;
}

export function OrdersPageHeaderSetter({ activeCount, readyCount }: Props) {
  usePageHeader({
    title: "Zamówienia",
    subtitle: `${activeCount} aktywnych · ${readyCount} gotowych do odbioru`,
    right: (
      <Link href={"/admin/orders/new" as Route}>
        <Button variant="primary" size="sm">+ Nowe zlecenie</Button>
      </Link>
    ),
  });
  return null;
}
