"use client";

import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { previewForStatus } from "@/lib/orders/triggerPreview";
import type { KanbanColumnDto, KanbanStatus } from "@/lib/kanban/types";
import type { TriggerPreview } from "../StatusChangeTriggerDialog";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("kanban.dnd");

export interface PendingMove {
  cardId: string;
  fromStatus: KanbanStatus;
  toStatus: KanbanStatus;
  orderVersion: number;
  triggerPreview: TriggerPreview;
  clientName: string;
}

export interface UseKanbanDndResult {
  columns: KanbanColumnDto[];
  pendingMove: PendingMove | null;
  onDragEnd: (cardId: string, fromStatus: string, toStatus: string) => void;
  onConfirm: (sendTriggers: boolean) => Promise<void>;
  onCancel: () => void;
  errorToast: string | null;
  dismissToast: () => void;
}

function applyOptimisticMove(
  cols: KanbanColumnDto[],
  cardId: string,
  fromStatus: KanbanStatus,
  toStatus: KanbanStatus,
): KanbanColumnDto[] {
  return cols.map((col) => {
    if (col.status === fromStatus) {
      return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
    }
    if (col.status === toStatus) {
      const fromCol = cols.find((c) => c.status === fromStatus);
      const card = fromCol?.cards.find((c) => c.id === cardId);
      if (!card) return col;
      return { ...col, cards: [card, ...col.cards] };
    }
    return col;
  });
}

export function useKanbanDnd(
  initialColumns: KanbanColumnDto[],
  triggers: TriggerDto[],
  orderVersionMap: Map<string, number>,
): UseKanbanDndResult {
  const [columns, setColumns] = useState<KanbanColumnDto[]>(initialColumns);
  const [snapshot, setSnapshot] = useState<KanbanColumnDto[] | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const onDragEnd = useCallback(
    (cardId: string, fromStatusRaw: string, toStatusRaw: string) => {
      const fromStatus = fromStatusRaw as KanbanStatus;
      const toStatus   = toStatusRaw   as KanbanStatus;

      if (fromStatus === toStatus) {
        log.debug("op=dragEnd outcome=sameColumn", { cardId });
        return;
      }

      log.info("op=dragEnd outcome=crossColumn", { cardId, fromStatus, toStatus });

      // Capture current columns for snapshot before mutating
      setColumns((prev) => {
        setSnapshot(prev);
        const next = applyOptimisticMove(prev, cardId, fromStatus, toStatus);

        const fromCol = prev.find((c) => c.status === fromStatus);
        const card    = fromCol?.cards.find((c) => c.id === cardId);
        const version = orderVersionMap.get(cardId) ?? 0;
        const preview = previewForStatus(toStatus, triggers);

        setPendingMove({
          cardId,
          fromStatus,
          toStatus,
          orderVersion: version,
          triggerPreview: preview,
          clientName: card?.clientName ?? "",
        });

        return next;
      });
    },
    [triggers, orderVersionMap],
  );

  const onConfirm = useCallback(
    async (sendTriggers: boolean) => {
      if (!pendingMove) return;
      const { cardId, toStatus, orderVersion } = pendingMove;
      log.info("op=confirmMove", { cardId, toStatus, sendTriggers });
      // Capture snapshot ref before clearing so revert can use it
      const savedSnapshot = snapshot;
      setPendingMove(null);
      setSnapshot(null);

      try {
        await changeStatus(cardId, toStatus, orderVersion);
        log.info("op=confirmMove outcome=ok", { cardId, toStatus });
      } catch (err: unknown) {
        log.error("op=confirmMove outcome=error", { cardId, toStatus, err });
        if (savedSnapshot) setColumns(savedSnapshot);
        setErrorToast("Nie udało się zmienić statusu — spróbuj jeszcze raz");
      }
    },
    [pendingMove, snapshot],
  );

  const onCancel = useCallback(() => {
    log.info("op=cancelMove", { cardId: pendingMove?.cardId });
    if (snapshot) setColumns(snapshot);
    setSnapshot(null);
    setPendingMove(null);
  }, [pendingMove, snapshot]);

  const dismissToast = useCallback(() => setErrorToast(null), []);

  return { columns, pendingMove, onDragEnd, onConfirm, onCancel, errorToast, dismissToast };
}
