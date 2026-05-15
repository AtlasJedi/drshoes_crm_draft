"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderListRow } from "@/lib/orders/types";
import { RowQuickActionsMenu } from "./RowQuickActionsMenu";
import { SortableColumnHeader } from "./SortableColumnHeader";

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

/** Format ISO timestamp as dd.MM.yyyy HH:mm in Polish locale — used for createdAt audit. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
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

  const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-admin-mute uppercase tracking-[0.08em]";
  const tdCls = "px-4 py-3.5 text-[15px] text-admin-ink";

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
              <th className={thCls}>
                <SortableColumnHeader field="code" label="Kod" />
              </th>
              <th className={thCls}>
                <SortableColumnHeader field="status" label="Status" />
              </th>
              <th className={thCls}>Klient</th>
              <th className={thCls}>Pozycje</th>
              <th className={thCls}>
                <SortableColumnHeader field="receivedAt" label="Przyjęto" />
              </th>
              <th className={thCls}>Termin odbioru</th>
              <th className={thCls}>
                <SortableColumnHeader field="pickedUpAt" label="Wydano" />
              </th>
              <th className={thCls}>Wykonawca</th>
              <th className={thCls + " text-right"}>
                <SortableColumnHeader field="createdAt" label="Utworzono" className="justify-end" />
              </th>
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
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  {onToggleRow && (
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(row.id) ?? false}
                      onChange={() => onToggleRow(row.id)}
                      className="accent-acid h-4 w-4"
                      aria-label={`Zaznacz zlecenie ${row.code}`}
                    />
                  )}
                </td>
                <td className={tdCls + " font-mono text-[13px]"}>{row.code}</td>
                <td className={tdCls}>
                  <span className={`inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide ${STATUS_PILL_CLASS[row.status]}`}>
                    {STATUS_LABELS_PL[row.status]}
                  </span>
                </td>
                <td className={tdCls + " text-admin-mute"}>{row.clientName}</td>
                <td className={tdCls + " text-admin-mute"}>{row.description ?? "—"}</td>
                <td className={tdCls + " text-admin-mute font-mono text-[13px]"}>{fmtDate(row.receivedAt)}</td>
                <td className={tdCls + " font-mono text-[13px]"}>{fmtDate(row.plannedPickupAt)}</td>
                <td className={tdCls + " text-admin-mute font-mono text-[13px]"}>{fmtDate(row.pickedUpAt)}</td>
                <td className={tdCls + " text-admin-mute"}>—</td>
                <td className={tdCls + " text-right text-admin-mute font-mono text-[13px] whitespace-nowrap"}>{fmtDateTime(row.createdAt)}</td>
                <td className={tdCls + " text-right font-mono"}>{pricePLN(row.totalPriceCents)}</td>
                <td
                  className="px-3 py-3.5 text-right"
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
        <div className="flex items-center justify-between mt-5 text-[15px]">
          <button
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
            className="px-4 py-2 rounded-md border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10 font-medium"
          >
            ← Poprzednia
          </button>
          <span className="text-admin-mute">
            Strona {currentPage + 1} z {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages - 1}
            onClick={() => goToPage(currentPage + 1)}
            className="px-4 py-2 rounded-md border border-admin-line text-admin-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-acid/10 font-medium"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  );
}
