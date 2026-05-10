"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { StatusChangeTriggerDialog } from "../StatusChangeTriggerDialog";
import type { KanbanColumnDto } from "@/lib/kanban/types";
import type { PendingMove } from "./useKanbanDnd";

interface Props {
  columns: KanbanColumnDto[];
  /**
   * Called when a drag completes between two different columns.
   * Wired by 6-19; 6-18 left the default no-op slot in place.
   */
  onDragEnd?: (cardId: string, fromStatus: string, toStatus: string) => void;
  pendingMove?: PendingMove | null;
  onConfirm?: (sendTriggers: boolean) => Promise<void>;
  onCancel?: () => void;
}

export function KanbanBoard({
  columns,
  onDragEnd,
  pendingMove = null,
  onConfirm,
  onCancel,
}: Props) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Find the card being dragged for the DragOverlay ghost
  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;

    const fromColumn = columns.find((col) =>
      col.cards.some((c) => c.id === String(active.id)),
    );
    if (!fromColumn) return;
    if (fromColumn.status === String(over.id)) return; // same column — no-op

    onDragEnd?.(String(active.id), fromColumn.status, String(over.id));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex-1 overflow-auto p-6 grid gap-4"
          style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
        >
          {columns.map((col) => (
            <KanbanColumn key={col.status} column={col} />
          ))}
        </div>

        {/* Ghost card shown while dragging — opacity-90 + rotate-1 + shadow-lg per token rules */}
        <DragOverlay>
          {activeCard && (
            <div className="opacity-90 rotate-1 shadow-lg">
              <KanbanCard card={activeCard} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pendingMove && onConfirm && onCancel && (
        <StatusChangeTriggerDialog
          open={true}
          fromStatus={pendingMove.fromStatus}
          toStatus={pendingMove.toStatus}
          orderId={pendingMove.cardId}
          clientName={pendingMove.clientName}
          triggerPreview={pendingMove.triggerPreview}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  );
}
