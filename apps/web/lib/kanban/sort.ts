/**
 * Pure sort function for Kanban columns.
 *
 * Sort order within each column:
 *   1. Urgent (card.urgent === true) first, oldest receivedAt ascending.
 *   2. Non-urgent next, oldest receivedAt ascending.
 *
 * Null receivedAt is treated as far-future (sorts to bottom of its group).
 */
import type { KanbanCardDto } from "./types";

const FAR_FUTURE = new Date(8640000000000000).getTime(); // max date ms

function receivedMs(card: KanbanCardDto): number {
  if (!card.receivedAt) return FAR_FUTURE;
  const ms = new Date(card.receivedAt).getTime();
  return isNaN(ms) ? FAR_FUTURE : ms;
}

export function sortKanbanCards(cards: KanbanCardDto[]): KanbanCardDto[] {
  return [...cards].sort((a, b) => {
    // Primary: urgent first
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    // Secondary: oldest receivedAt ascending
    return receivedMs(a) - receivedMs(b);
  });
}
