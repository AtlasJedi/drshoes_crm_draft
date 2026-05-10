"use client";

/**
 * Client boundary wrapper for the orders list page.
 * Owns selection state and wires OrdersTable + BulkActionBar together.
 * The parent page.tsx is a Server Component — this is the RSC/client split point.
 */
import { useOrderRowSelection } from "./useOrderRowSelection";
import { OrdersTable } from "./OrdersTable";
import { BulkActionBar } from "./BulkActionBar";
import type { OrderListRow } from "@/lib/orders/types";

interface Props {
  rows: OrderListRow[];
  totalPages: number;
  currentPage: number;
}

export function OrdersPageClient({ rows, totalPages, currentPage }: Props) {
  const visibleIds = rows.map((r) => r.id);
  const { selectedIds, isAllSelected, toggleRow, toggleAll, clear } =
    useOrderRowSelection(visibleIds);

  return (
    <>
      <OrdersTable
        rows={rows}
        totalPages={totalPages}
        currentPage={currentPage}
        selectedIds={selectedIds}
        isAllSelected={isAllSelected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
      />
      <BulkActionBar selectedIds={selectedIds} onClear={clear} />
    </>
  );
}
