"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./KanbanCard";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import { sortKanbanCards } from "@/lib/kanban/sort";
import type { KanbanColumnDto } from "@/lib/kanban/types";

/** CSS variable per column status — matches admin.jsx:625-631 */
const COLUMN_BG: Record<string, string> = {
  PRZYJETE:          "var(--blue)",
  W_REALIZACJI:      "var(--orange)",
  CZEKA_NA_KLIENTA:  "#c89c00",
  GOTOWE_DO_ODBIORU: "var(--green)",
};

interface Props {
  column: KanbanColumnDto;
}

export function KanbanColumn({ column }: Props) {
  const bg = COLUMN_BG[column.status] ?? "var(--ink)";

  // Make the body droppable so cards can be dropped into an empty column
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  // Client-side sort: urgent first (oldest→newest), then non-urgent (oldest→newest).
  // Null receivedAt sorts to bottom of its group. Sort is the source of truth post-drop.
  const sortedCards = sortKanbanCards(column.cards);

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        style={{ background: bg }}
        className="px-3 py-2.5 border-2 border-ink flex items-center justify-between"
      >
        <span
          className="font-stencil text-[12px] tracking-[.1em] uppercase text-paper"
        >
          {STATUS_LABELS_PL[column.status]}
        </span>
        <div className="flex items-center gap-2">
          {/* Auto-sort indicator */}
          <span
            className="font-mono text-[9px] text-white/60 tracking-tight select-none hidden sm:block"
            title="Sortowanie: pilne pierwsze, potem najstarsze"
          >
            Pilne ↑ · Najstarsze ↑
          </span>
          <span className="font-mono text-[11px] font-bold bg-white/85 text-ink px-1.5 py-0 rounded-full">
            {column.total}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] border-2 border-t-0 border-ink bg-black/[.03] p-2 flex flex-col gap-2 transition-colors ${
          isOver ? "ring-2 ring-[var(--pink)] ring-offset-2 ring-offset-transparent" : ""
        }`}
      >
        <SortableContext
          items={sortedCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedCards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <p className="text-xs text-ink/40 text-center py-4 select-none">
            brak zleceń w tym statusie
          </p>
        )}

        {column.hasMore && (
          <p className="text-[10px] font-mono text-ink/40 text-center py-1 select-none">
            +{column.total - column.cards.length} więcej
          </p>
        )}

      </div>
    </div>
  );
}
