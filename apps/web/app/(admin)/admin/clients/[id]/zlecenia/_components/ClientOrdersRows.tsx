"use client";

/**
 * Client-side row renderer for the client-detail order history table.
 * Clicking (or Enter/Space on) a row appends ?orderId=<id> to the current URL,
 * which causes the host server page to fetch the order and mount <OrderDrawer />.
 * Same pattern as /admin/orders, /admin/orders/calendar, /admin/orders/kanban.
 * < 80 LOC per granular-code rule.
 */

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderListRow, OrderStatus } from "@/lib/orders/types";

const log = createLogger("client-orders-rows");

interface Props {
  clientId: string;
  rows: OrderListRow[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Warsaw",
  });
}

function pricePLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

export function ClientOrdersRows({ clientId, rows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderId", orderId);
    log.info("op=rowClick", { orderId, clientId });
    router.push(`/admin/clients/${clientId}/zlecenia?${params.toString()}` as Route);
  }

  const tdCls = "px-4 py-3.5 text-[15px] text-admin-ink";

  return (
    <tbody>
      {rows.map((row) => (
        <tr
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => openDrawer(row.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDrawer(row.id);
            }
          }}
          aria-label={`Otwórz zlecenie ${row.code}`}
          className="border-b border-admin-line hover:bg-acid/5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-acid focus:ring-inset"
        >
          <td className={tdCls + " font-mono text-[13px]"}>{row.code}</td>
          <td className={tdCls}>
            <span className={`inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide ${STATUS_PILL_CLASS[row.status as OrderStatus]}`}>
              {STATUS_LABELS_PL[row.status as OrderStatus]}
            </span>
          </td>
          <td className={tdCls}>{fmtDate(row.plannedPickupAt)}</td>
          <td className={tdCls + " text-right font-mono"}>{pricePLN(row.totalPriceCents)}</td>
        </tr>
      ))}
    </tbody>
  );
}
