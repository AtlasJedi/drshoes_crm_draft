"use client";

/**
 * Post-bulk-action result dialog.
 * Shows per-order success/failure rows from the 6-9 API response.
 * Matched to bulk-action-bar design override (design gate lifted by owner).
 */
import * as Dialog from "@radix-ui/react-dialog";
import type {
  BulkStatusResult,
  BulkSuccessRow,
  BulkFailureRow,
} from "@/lib/orders/bulk-api";
import { STATUS_LABELS_PL } from "@/lib/orders/status";

interface Props {
  open: boolean;
  result: BulkStatusResult;
  onClose: () => void;
}

const FAILURE_LABELS: Record<string, string> = {
  ILLEGAL_TRANSITION: "Niedozwolona zmiana (ILLEGAL_TRANSITION)",
  NOT_FOUND: "Nie znaleziono (NOT_FOUND)",
  VERSION_CONFLICT: "Konflikt wersji (VERSION_CONFLICT)",
  UNKNOWN: "Błąd nieznany (UNKNOWN)",
};

export function BulkResultModal({ open, result, onClose }: Props) {
  const successCount = result.succeeded.length;
  const failureCount = result.failed.length;
  const total = successCount + failureCount;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            bg-paper rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col"
        >
          <Dialog.Title className="font-semibold text-ink text-base">
            Wynik zmiany zbiorczej ({total} zleceń)
          </Dialog.Title>

          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">
              {successCount} sukces{successCount !== 1 ? "y" : ""}
            </span>
            {failureCount > 0 && (
              <span className="text-red-600 font-medium">
                {failureCount} błąd{failureCount > 1 ? "y" : ""}
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {result.succeeded.map((row: BulkSuccessRow) => (
              <div
                key={row.orderId}
                className="flex items-center justify-between py-2 border-b border-admin-line last:border-0"
              >
                <span className="font-mono text-xs text-admin-ink">
                  {row.code}
                </span>
                <span className="text-xs text-green-700">
                  {STATUS_LABELS_PL[row.fromStatus]} → {STATUS_LABELS_PL[row.toStatus]}
                </span>
              </div>
            ))}
            {result.failed.map((row: BulkFailureRow) => (
              <div
                key={row.orderId}
                className="flex items-center justify-between py-2 border-b border-admin-line last:border-0"
              >
                <span className="font-mono text-xs text-admin-ink">
                  {row.code}
                </span>
                <span className="text-xs text-red-600">
                  {FAILURE_LABELS[row.error] ?? row.error}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-ink text-paper rounded hover:bg-ink/80 transition-colors"
            >
              Zamknij
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
