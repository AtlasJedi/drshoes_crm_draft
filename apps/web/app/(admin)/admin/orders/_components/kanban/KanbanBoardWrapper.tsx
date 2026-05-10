"use client";

/**
 * Client island for the Kanban board.
 * Receives server-fetched data via props and wires up useKanbanDnd for
 * drag-and-drop state management with optimistic updates.
 *
 * Separate from page.tsx (Server Component) so that client hooks are
 * isolated to this subtree only.
 *
 * Error toast auto-dismisses after 5 s.
 * ~75 LOC.
 */

import { useMemo, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { useKanbanDnd } from "./useKanbanDnd";
import { KanbanBoard } from "./KanbanBoard";
import type { KanbanColumnDto, KanbanCardDto } from "@/lib/kanban/types";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("kanban.wrapper");

/** Extended card shape — version may be present if backend adds it later. */
type CardWithOptionalVersion = KanbanCardDto & { version?: number };

interface Props {
  initialColumns: KanbanColumnDto[];
  triggers: TriggerDto[];
}

export function KanbanBoardWrapper({ initialColumns, triggers }: Props) {
  // Build a card-id → order version map from the initial snapshot.
  // KanbanCardDto does not currently carry version; default to 0 so that
  // the PATCH succeeds on first attempt (backend returns 409 on mismatch,
  // which the hook surfaces as an error toast). When backend adds version
  // to the DTO this map will use the real value automatically.
  const versionMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const col of initialColumns) {
      for (const card of col.cards) {
        const v = (card as CardWithOptionalVersion).version ?? 0;
        m.set(card.id, v);
      }
    }
    return m;
  }, [initialColumns]);

  const {
    columns,
    pendingMove,
    onDragEnd,
    onConfirm,
    onCancel,
    errorToast,
    dismissToast,
  } = useKanbanDnd(initialColumns, triggers, versionMap);

  // Auto-dismiss error toast after 5 s
  useEffect(() => {
    if (!errorToast) return;
    log.debug("op=errorToast action=scheduleAutoDismiss");
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [errorToast, dismissToast]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <KanbanBoard
        columns={columns}
        onDragEnd={onDragEnd}
        pendingMove={pendingMove}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />

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
