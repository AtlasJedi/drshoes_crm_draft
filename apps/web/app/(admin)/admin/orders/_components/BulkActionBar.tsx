"use client";

/**
 * Sticky-bottom bulk-action bar for the orders list.
 * Appears when >= 1 table row is selected.
 * Calls POST /api/admin/orders/bulk/status (6-9) on submit.
 * Design gate lifted by owner override (same override as 6-12, 6-16, 6-19, 6-20).
 */
import { useState } from "react";
import { createLogger } from "@/lib/log";
import { bulkChangeStatus } from "@/lib/orders/bulk-api";
import type { BulkStatusResult } from "@/lib/orders/bulk-api";
import { STATUS_LABELS_PL, STATUS_ORDER } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";
import { BulkResultModal } from "./BulkResultModal";

const log = createLogger("bulk-action-bar");

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActionBar({ selectedIds, onClear }: Props) {
  const [targetStatus, setTargetStatus] = useState<OrderStatus | "">("");
  const [sendTriggers, setSendTriggers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkStatusResult | null>(null);

  if (selectedIds.length === 0) return null;

  async function handleSubmit() {
    if (!targetStatus) return;
    setBusy(true);
    log.info("op=bulkSubmit", {
      count: selectedIds.length,
      newStatus: targetStatus,
      sendTriggers,
    });
    try {
      const res = await bulkChangeStatus({
        orderIds: selectedIds,
        newStatus: targetStatus,
        sendTriggers,
      });
      setResult(res);
      if (res.failed.length === 0) {
        // Full success — clear selection immediately; modal stays for acknowledgment
        onClear();
      }
    } catch (err) {
      log.error("op=bulkSubmit outcome=error", { err: String(err) });
    } finally {
      setBusy(false);
    }
  }

  function handleResultClose() {
    setResult(null);
    // Always clear selection on modal dismiss (covers partial-success case)
    onClear();
  }

  const selectCls =
    "border border-admin-line rounded px-2 py-1 text-sm bg-paper text-admin-ink" +
    " focus:outline-none focus:ring-1 focus:ring-acid";

  return (
    <>
      <div
        role="region"
        aria-label="Akcje zbiorcze"
        className="fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-admin-line shadow-lg px-6 py-3 flex flex-wrap items-center gap-4"
      >
        <span className="text-sm font-medium text-admin-ink">
          {selectedIds.length} zaznaczone
        </span>

        <label className="flex items-center gap-2 text-sm text-admin-mute">
          Zmień status:
          <select
            className={selectCls}
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as OrderStatus | "")}
          >
            <option value="">— wybierz —</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_PL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-admin-mute cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendTriggers}
            onChange={(e) => setSendTriggers(e.target.checked)}
            className="accent-acid"
          />
          Wyślij wyzwalacze
        </label>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-admin-mute hover:text-ink transition-colors"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !targetStatus}
            className="px-4 py-1.5 text-sm rounded bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Przetwarzanie…" : "Wykonaj"}
          </button>
        </div>
      </div>

      {result && (
        <BulkResultModal open result={result} onClose={handleResultClose} />
      )}
    </>
  );
}
