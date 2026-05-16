"use client";

// KanbanBoard — DndContext wrapper + 5-column grid.
// Post-drag status confirmation now happens via StatusChangeTriggerDialog
// mounted by KanbanBoardWrapper (v2-A: single source of truth for status changes).
// ~60 LOC.

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
import type { KanbanColumnDto } from "@/lib/kanban/types";

interface Props {
  columns: KanbanColumnDto[];
  onDragEnd?: (cardId: string, fromStatus: string, toStatus: string) => void;
}

export function KanbanBoard({ columns, onDragEnd }: Props) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
    if (fromColumn.status === String(over.id)) return;

    onDragEnd?.(String(active.id), fromColumn.status, String(over.id));
  }

  return (
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

      <DragOverlay>
        {activeCard && (
          <div className="opacity-90 rotate-1 shadow-lg">
            <KanbanCard card={activeCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
