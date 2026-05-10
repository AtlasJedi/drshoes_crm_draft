"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderListRow } from "@/lib/orders/types";
import { RowQuickActionsMenu } from "./RowQuickActionsMenu";

const log = createLogger("orders-table");

/** Polish currency formatter: 1234 cents → "12,34 zł" */
function pricePLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

/** Format ISO date as dd.MM.yyyy in Polish locale */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

interface Props {
  rows: OrderListRow[];
  totalPages: number;
  currentPage: number;
  // Selection props — optional; injected by OrdersPageClient when BulkActionBar is active
  selectedIds?: string[];
  isAllSelected?: boolean;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
}

export function OrdersTable({
  rows,
  totalPages,
  currentPage,
  selectedIds,
  isAllSelected,
  onToggleRow,
  onToggleAll,
}: Props) {
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

  const thCls = "px-3 py-2 text-left text-xs font-medium text-admin-mute uppercase tracking-wide";
  const tdCls = "px-3 py-3 text-sm text-admin-ink";

  return (
    <div>
      <div className="overflow-x-auto border border-admin-line rounded">
        <table className="w-full border-collapse">
          <thead className="bg-admin-surface border-b border-admin-line">
            <tr>
              <th className={thCls + " w-10"}>
                {onToggleAll && (
                  <input
                    type="checkbox"
                    checked={isAllSelected ?? false}
                    onChange={onToggleAll}
                    className="accent-acid"
                    aria-label="Zaznacz wszystkie"
                  />
                )}
              </th>
              <th className={thCls}>Kod</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Klient</th>
              <th className={thCls}>Pozycje</th>
              <th className={thCls}>Termin odbioru</th>
              <th className={thCls}>Wykonawca</th>
              <th className={thCls + " text-right"}>Suma</th>
              <th className={thCls + " w-10 text-right"}>
                {/* actions */}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                className="border-b border-admin-line hover:bg-acid/5 cursor-pointer focus:outline-none focus:bg-acid/10 transition-colors"
                onClick={() => onRowActivate(row.id)}
                onKeyDown={(e) => e.key === "Enter" && onRowActivate(row.id)}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  {onToggleRow && (
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(row.id) ?? false}
                      onChange={() => onToggleRow(row.id)}
                      className="accent-acid"
                      aria-label={`Zaznacz zlecenie ${row.code}`}
                    />
                  )}
                </td>
                <td className={tdCls + " font-mono text-xs"}>{row.code}</td>
                <td className={tdCls}>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL_CLASS[row.status]}`}>
                    {STATUS_LABELS_PL[row.status]}
                  </span>
                </td>
                <td className={tdCls + " text-admin-mute"}>{row.clientId.slice(0, 8)}…</td>
                <td className={tdCls + " text-admin-mute"}>{row.description ?? "—"}</td>
                <td className={tdCls}>{fmtDate(row.plannedPickupAt)}</td>
                <td className={tdCls + " text-admin-mute"}>—</td>
                <td className={tdCls + " text-right font-mono"}>{pricePLN(row.totalPriceCents)}</td>
                <td
                  className="px-2 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowQuickActionsMenu
                    row={row}
                    onOrderUpdated={() => {
                      // Reload page data via Next.js Server Component re-render
                      router.refresh();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
            className="px-3 py-1 rounded border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10"
          >
            ← Poprzednia
          </button>
          <span className="text-admin-mute">
            Strona {currentPage + 1} z {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages - 1}
            onClick={() => goToPage(currentPage + 1)}
            className="px-3 py-1 rounded border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  );
}
