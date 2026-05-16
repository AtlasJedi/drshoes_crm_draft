"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import type { OrderListRow } from "@/lib/orders/types";
import { Pill, PhImg } from "@drshoes/ui";
import { RowQuickActionsMenu } from "./RowQuickActionsMenu";
import { SortableColumnHeader } from "./SortableColumnHeader";

const log = createLogger("orders-table");

function pricePLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

const TZ = "Europe/Warsaw";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
}


interface Props {
  rows: OrderListRow[];
  totalPages: number;
  currentPage: number;
  selectedIds?: string[];
  isAllSelected?: boolean;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
}

export function OrdersTable({ rows, totalPages, currentPage, selectedIds, isAllSelected, onToggleRow, onToggleAll }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`/admin/orders?${params.toString()}` as Route);
  }

  function onRowActivate(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderId", id);
    log.info("op=rowClick", { orderId: id });
    router.push(`/admin/orders?${params.toString()}` as Route);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                {onToggleAll && (
                  <input type="checkbox" checked={isAllSelected ?? false} onChange={onToggleAll} className="accent-acid" aria-label="Zaznacz wszystkie" />
                )}
              </th>
              <th><SortableColumnHeader field="code" label="Kod" /></th>
              <th><SortableColumnHeader field="status" label="Status" /></th>
              <th>Klient</th>
              <th>Pozycje</th>
              <th><SortableColumnHeader field="receivedAt" label="Przyjęto" /></th>
              <th>Termin odbioru</th>
              <th>Miejsce</th>
              <th style={{ width: 50 }}>Foto</th>
              <th style={{ textAlign: "right" }}>Suma</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onRowActivate(row.id)}
                onKeyDown={(e) => e.key === "Enter" && onRowActivate(row.id)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  {onToggleRow && (
                    <input type="checkbox" checked={selectedIds?.includes(row.id) ?? false} onChange={() => onToggleRow(row.id)} className="accent-acid h-4 w-4" aria-label={`Zaznacz zlecenie ${row.code}`} />
                  )}
                </td>
                <td className="font-mono text-[13px]">{row.code}</td>
                <td><Pill status={row.status} /></td>
                <td className="text-admin-mute">{row.clientName}</td>
                <td className="text-admin-mute">{row.description ?? "—"}</td>
                <td className="text-admin-mute font-mono text-[13px]">{fmtDate(row.receivedAt)}</td>
                <td className="font-mono text-[13px]">{fmtDate(row.plannedPickupAt)}</td>
                <td className="text-admin-mute">{row.location ?? "—"}</td>
                <td><PhImg label="" style={{ width: 36, height: 36, border: "1.5px solid var(--ink, #0a0a0a)" }} /></td>
                <td className="text-right font-mono">{pricePLN(Math.max(0, row.quotedPriceCents - row.advancePaidCents))}</td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <RowQuickActionsMenu row={row} onOrderUpdated={() => router.refresh()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 text-[15px]">
          <button disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)} className="px-4 py-2 rounded-md border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10 font-medium">
            ← Poprzednia
          </button>
          <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
          <button disabled={currentPage >= totalPages - 1} onClick={() => goToPage(currentPage + 1)} className="px-4 py-2 rounded-md border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10 font-medium">
            Następna →
          </button>
        </div>
      )}
    </div>
  );
}
