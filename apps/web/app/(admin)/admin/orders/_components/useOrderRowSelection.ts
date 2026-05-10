"use client";

/**
 * Selection-state hook for the orders table.
 * Manages a Set<string> of selected order IDs.
 * visibleIds is the current page's row IDs — used for toggleAll and isAllSelected.
 */
import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("order-row-selection");

export interface OrderRowSelectionState {
  selectedIds: string[];
  isAllSelected: boolean;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

export function useOrderRowSelection(
  visibleIds: string[],
): OrderRowSelectionState {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        log.info("op=toggleRow action=deselect", { orderId: id });
      } else {
        next.add(id);
        log.info("op=toggleRow action=select", { orderId: id });
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        log.info("op=toggleAll action=clearAll", { count: visibleIds.length });
        return new Set();
      }
      log.info("op=toggleAll action=selectAll", { count: visibleIds.length });
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const clear = useCallback(() => {
    log.info("op=clearSelection");
    setSelected(new Set());
  }, []);

  const selectedIds = Array.from(selected);
  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return { selectedIds, isAllSelected, toggleRow, toggleAll, clear };
}
