"use client";

/**
 * Three-dot dropdown menu for a single order row in OrdersTable.
 * Uses Radix DropdownMenu primitives (consistent with Radix Dialog used elsewhere).
 * Three actions: Zmień status, Wyślij wiadomość, Dodaj zdjęcie.
 * Dispatches into existing M1/M2/M3 components — no new endpoints.
 * Visual rules sourced from owner-supplied token table (design-block overridden by owner).
 */
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createLogger } from "@/lib/log";
import { getTriggers } from "@/lib/messaging/api";
import { changeStatus } from "@/lib/orders/api";
import { STATUS_LABELS_PL, STATUS_ORDER } from "@/lib/orders/status";
import type { TriggerDto } from "@/lib/messaging/types";
import type { OrderListRow, OrderStatus } from "@/lib/orders/types";
import { StatusChangeTriggerDialog } from "./StatusChangeTriggerDialog";
import type { TriggerPreview } from "./StatusChangeTriggerDialog";
import { MessageComposerModal } from "./MessageComposerModal";
import { PhotoUploader } from "./PhotoUploader";

const log = createLogger("row-quick-actions");

interface Props {
  row: OrderListRow;
  onOrderUpdated: () => void;
}

/** Statuses excluded from manual selection per domain convention. */
const EXCLUDED_FROM_PICKER: OrderStatus[] = ["WSTEPNIE_PRZYJETE"];

function previewFor(target: OrderStatus, triggers: TriggerDto[]): TriggerPreview {
  const matched = triggers.find((t) => {
    if (t.event !== "STATUS_CHANGE") return false;
    try {
      return (JSON.parse(t.eventParams) as { toStatus?: string }).toStatus === target;
    } catch {
      return false;
    }
  });
  if (!matched) return { kind: "none" };
  if (!matched.enabled) return { kind: "disabled", triggerName: matched.name };
  let channels: string[] = [];
  try { channels = JSON.parse(matched.channels) as string[]; } catch { /* empty */ }
  return {
    kind: "match",
    templateName: matched.templateName,
    channels,
    delayMinutes: matched.delayMinutes,
    requiresManualConfirmation: matched.requiresManualConfirmation,
  };
}

type ActivePanel = "status-pick" | "status-confirm" | "message" | "photo" | null;

export function RowQuickActionsMenu({ row, onOrderUpdated }: Props) {
  const [active, setActive] = useState<ActivePanel>(null);
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);

  function openStatusPicker() {
    log.info("op=openStatusPicker", { orderId: row.id });
    getTriggers()
      .then((ts) => setTriggers(ts))
      .catch((err: unknown) => log.error("op=loadTriggers outcome=error", { err }));
    setStatusTarget(null);
    setActive("status-pick");
  }

  function confirmStatusTarget() {
    if (!statusTarget) return;
    setActive("status-confirm");
  }

  async function handleStatusConfirm(sendTriggers: boolean) {
    if (!statusTarget) return;
    try {
      await changeStatus(row.id, statusTarget, row.version);
      log.info("op=statusChange outcome=ok", { orderId: row.id, to: statusTarget, sendTriggers });
      setActive(null);
      onOrderUpdated();
    } catch (err) {
      log.error("op=statusChange outcome=error", { orderId: row.id, err: String(err) });
    }
  }

  const availableStatuses = STATUS_ORDER.filter(
    (s) => s !== row.status && !EXCLUDED_FROM_PICKER.includes(s),
  );

  const itemCls =
    "flex items-center px-3 py-2 text-sm cursor-pointer rounded outline-none " +
    "hover:bg-admin-line focus:bg-admin-line select-none";

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Opcje zlecenia"
            className="inline-flex items-center justify-center w-7 h-7 rounded cursor-pointer hover:bg-admin-line transition-colors text-admin-mute text-base leading-none"
            onClick={(e) => e.stopPropagation()}
          >
            ⋯
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[180px] bg-paper rounded-lg shadow-md border border-admin-line py-1"
            sideOffset={4}
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => openStatusPicker()}
            >
              Zmień status
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-admin-line my-1" />

            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => {
                log.info("op=openMessagePanel", { orderId: row.id });
                setActive("message");
              }}
            >
              Wyślij wiadomość
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-admin-line my-1" />

            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => {
                log.info("op=openPhotoPanel", { orderId: row.id });
                setActive("photo");
              }}
            >
              Dodaj zdjęcie
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Step 1: status picker overlay */}
      {active === "status-pick" && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-paper rounded-lg shadow-xl p-5 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium mb-3">Wybierz nowy status</p>
            <label htmlFor="status-select" className="sr-only">
              Nowy status
            </label>
            <select
              id="status-select"
              aria-label="Nowy status"
              value={statusTarget ?? ""}
              onChange={(e) => setStatusTarget(e.target.value as OrderStatus)}
              className="w-full border border-admin-line rounded px-2 py-1.5 text-sm mb-4"
            >
              <option value="" disabled>
                — wybierz —
              </option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS_PL[s]}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setActive(null)}
                className="px-3 py-1.5 text-sm rounded border border-admin-line hover:bg-neutral-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={confirmStatusTarget}
                disabled={!statusTarget}
                className="px-3 py-1.5 text-sm rounded bg-acid text-paper hover:bg-acid/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Dalej
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: trigger-preview confirm dialog */}
      <StatusChangeTriggerDialog
        open={active === "status-confirm" && statusTarget !== null}
        fromStatus={row.status}
        toStatus={statusTarget}
        orderId={row.id}
        triggerPreview={statusTarget ? previewFor(statusTarget, triggers) : { kind: "none" }}
        onConfirm={(sendTriggers) => void handleStatusConfirm(sendTriggers)}
        onCancel={() => {
          setActive(null);
        }}
      />

      {/* Message composer */}
      <MessageComposerModal
        orderId={row.id}
        open={active === "message"}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
        onSent={() => {
          setActive(null);
          onOrderUpdated();
        }}
      />

      {/* Photo uploader — mounted in inline portal when active */}
      {active === "photo" && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-paper rounded-lg shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Dodaj zdjęcie — {row.code}</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-admin-mute hover:text-ink text-lg leading-none"
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <PhotoUploader
              orderId={row.id}
              onUploaded={() => {
                setActive(null);
                onOrderUpdated();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
