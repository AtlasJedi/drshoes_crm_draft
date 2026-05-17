"use client";

/**
 * Client island for the Kanban board.
 * Receives server-fetched data via props and wires up useKanbanDnd for
 * drag-and-drop state management with optimistic updates.
 *
 * v2-A: post-drag confirmation goes through `StatusChangeTriggerDialog`
 * (PYK + PYK & SEND + optional note + optional location move) — same path
 * as the list view and the order drawer. Single source of truth.
 *
 * Error toast auto-dismisses after 5 s.
 */

import { useMemo, useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { useKanbanDnd } from "./useKanbanDnd";
import { KanbanBoard } from "./KanbanBoard";
import { StatusChangeTriggerDialog } from "../StatusChangeTriggerDialog";
import { listLocations } from "@/lib/locations";
import type { KanbanColumnDto, KanbanCardDto } from "@/lib/kanban/types";
import type { TriggerDto } from "@/lib/messaging/types";
import type { StorageLocation } from "@/lib/types";

const log = createLogger("kanban.wrapper");

interface Props {
  initialColumns: KanbanColumnDto[];
  triggers: TriggerDto[];
  /** Optional override (tests). Production uses the derived map below. */
  orderVersionMap?: Map<string, number>;
}

export function KanbanBoardWrapper({ initialColumns, triggers, orderVersionMap }: Props) {
  // Build a card-id → order version map from the initial snapshot.
  // KanbanCardDto carries version from the backend; the map feeds useKanbanDnd
  // so that PATCH /api/admin/orders/{id}/status sends the correct optimistic-lock value.
  const derivedVersionMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const col of initialColumns) {
      for (const card of col.cards) {
        m.set(card.id, card.version);
      }
    }
    return m;
  }, [initialColumns]);

  const versionMap = orderVersionMap ?? derivedVersionMap;

  const {
    columns,
    pendingMove,
    onDragEnd,
    onConfirm,
    onCancel,
    errorToast,
    dismissToast,
  } = useKanbanDnd(initialColumns, triggers, versionMap);

  // Load active storage locations for the dialog's "Miejsce" picker.
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  useEffect(() => {
    listLocations()
      .then((rows) => setLocations(rows.sort((a, b) => a.position - b.position)))
      .catch((err: unknown) => {
        log.error("op=loadLocations outcome=error", { err: String(err) });
        setLocations([]);
      });
  }, []);

  // Auto-dismiss error toast after 5 s
  useEffect(() => {
    if (!errorToast) return;
    log.debug("op=errorToast action=scheduleAutoDismiss");
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [errorToast, dismissToast]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <KanbanBoard columns={columns} onDragEnd={onDragEnd} />

      {/* Test-only drag handle — exposes onDragEnd without dnd-kit pointer infra.
          Hidden via display:none; rendered only in test env.
          testid format: kanban-test-drag-{cardId}-{fromStatus} → drags to the
          first other column so tests don't need to compute target. */}
      {process.env.NODE_ENV === "test" && (
        <div style={{ display: "none" }} data-testid="kanban-test-drag-root">
          {columns.flatMap((col) =>
            col.cards.map((card) => {
              const target = columns.find((c) => c.status !== col.status);
              if (!target) return null;
              return (
                <button
                  key={`${card.id}-${col.status}`}
                  type="button"
                  data-testid={`kanban-test-drag-${card.id}-${col.status}`}
                  onClick={() => onDragEnd(card.id, col.status, target.status)}
                >
                  {card.id}→{target.status}
                </button>
              );
            }),
          )}
        </div>
      )}

      {/* Single source of truth for status changes: same dialog as list + drawer. */}
      {pendingMove && (
        <StatusChangeTriggerDialog
          open
          fromStatus={pendingMove.fromStatus}
          toStatus={pendingMove.toStatus}
          orderId={pendingMove.cardId}
          clientName={pendingMove.clientName}
          triggerPreview={pendingMove.triggerPreview}
          currentLocation={null}
          locations={locations}
          onConfirm={(sendTriggers, note, location) => {
            void onConfirm(sendTriggers, note, location);
          }}
          onCancel={onCancel}
        />
      )}

      {/* Error toast — bottom-right corner, auto-dismisses after 5 s */}
      {errorToast && (
        <div
          role="alert"
          className="absolute bottom-6 right-6 bg-paper border-2 border-ink shadow-[3px_3px_0_var(--pink),3px_3px_0_1.5px_var(--ink)] px-4 py-3 max-w-xs"
        >
          <p className="text-sm text-ink">{errorToast}</p>
          <button
            onClick={dismissToast}
            className="text-xs text-admin-mute mt-1 hover:text-ink"
          >
            Zamknij
          </button>
        </div>
      )}
    </div>
  );
}
