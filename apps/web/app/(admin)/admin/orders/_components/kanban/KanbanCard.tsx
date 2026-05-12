"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import type { KanbanCardDto } from "@/lib/kanban/types";

const log = createLogger("kanban.card");

interface Props {
  card: KanbanCardDto;
}

/** Format ISO date string as "DD.MM" Polish short date, or "—" if null. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function KanbanCard({ card }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function openDrawer() {
    log.info("op=openDrawer", { cardId: card.id, code: card.code });
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderId", card.id);
    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={openDrawer}
      data-card-id={card.id}
      className={`admin-card p-2.5 cursor-grab active:cursor-grabbing select-none${
        card.urgent ? " border-l-[3px] border-l-[var(--pink)]" : ""
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-ink/50">{card.code}</span>
        {card.urgent && (
          <span className="px-1.5 py-0 bg-pink text-paper text-[9px] font-mono font-bold tracking-widest uppercase">
            pilne
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-1.5">
        <div
          className="w-10 h-10 border border-ink/30 flex-shrink-0 bg-paper-2"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="font-semibold text-xs truncate">{card.clientName}</div>
          <div className="font-mono text-[10px] text-ink/60 mt-0.5 truncate">
            {card.itemSummary || "—"}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-dashed border-line">
        <span className="font-mono text-[10px] text-ink/55">
          {shortDate(card.plannedPickupAt)}
        </span>
        <span
          className="w-5 h-5 rounded-full bg-paper-2 border border-ink/50 text-[9px] font-mono font-bold flex items-center justify-center"
          aria-hidden="true"
        >
          T
        </span>
      </div>
    </div>
  );
}
