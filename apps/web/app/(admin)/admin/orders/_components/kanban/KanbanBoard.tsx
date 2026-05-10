"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnDto } from "@/lib/kanban/types";

interface Props {
  columns: KanbanColumnDto[];
  /**
   * Called when a drag completes between two different columns.
   * Wired by 6-19; 6-18 leaves the default no-op in place.
   */
  onDragEnd?: (cardId: string, fromStatus: string, toStatus: string) => void;
}

export function KanbanBoard({ columns, onDragEnd }: Props) {
  // PointerSensor with 8 px activationConstraint avoids triggering drag on click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    // Find source column from card list
    const fromColumn = columns.find((col) =>
      col.cards.some((c) => c.id === String(active.id)),
    );
    const toStatus = String(over.id);

    if (!fromColumn) return;
    if (fromColumn.status === toStatus) return; // same column — no-op

    onDragEnd?.(String(active.id), fromColumn.status, toStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="flex-1 overflow-auto p-6 grid gap-4"
        style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
      >
        {columns.map((col) => (
          <KanbanColumn key={col.status} column={col} />
        ))}
      </div>
    </DndContext>
  );
}
