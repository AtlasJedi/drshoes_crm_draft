import { describe, it, expect } from "vitest";
import { sortKanbanCards } from "./sort";
import type { KanbanCardDto } from "./types";

function card(overrides: Partial<KanbanCardDto> & { id: string }): KanbanCardDto {
  return {
    code: overrides.id,
    clientName: "Test",
    itemSummary: "",
    plannedPickupAt: null,
    receivedAt: null,
    urgent: false,
    ...overrides,
  };
}

describe("sortKanbanCards", () => {
  it("all-urgent: sorts oldest receivedAt first", () => {
    const cards = [
      card({ id: "c", urgent: true, receivedAt: "2026-05-03T08:00:00Z" }),
      card({ id: "a", urgent: true, receivedAt: "2026-05-01T08:00:00Z" }),
      card({ id: "b", urgent: true, receivedAt: "2026-05-02T08:00:00Z" }),
    ];
    const result = sortKanbanCards(cards);
    expect(result.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("no-urgent: sorts oldest receivedAt first", () => {
    const cards = [
      card({ id: "z", urgent: false, receivedAt: "2026-05-10T00:00:00Z" }),
      card({ id: "x", urgent: false, receivedAt: "2026-05-08T00:00:00Z" }),
      card({ id: "y", urgent: false, receivedAt: "2026-05-09T00:00:00Z" }),
    ];
    const result = sortKanbanCards(cards);
    expect(result.map((c) => c.id)).toEqual(["x", "y", "z"]);
  });

  it("mixed: urgent cards come before non-urgent, each group sorted oldest first", () => {
    const cards = [
      card({ id: "n2", urgent: false, receivedAt: "2026-05-02T00:00:00Z" }),
      card({ id: "u2", urgent: true,  receivedAt: "2026-05-04T00:00:00Z" }),
      card({ id: "n1", urgent: false, receivedAt: "2026-05-01T00:00:00Z" }),
      card({ id: "u1", urgent: true,  receivedAt: "2026-05-03T00:00:00Z" }),
    ];
    const result = sortKanbanCards(cards);
    expect(result.map((c) => c.id)).toEqual(["u1", "u2", "n1", "n2"]);
  });

  it("null receivedAt sorts to bottom of its group", () => {
    const cards = [
      card({ id: "u-null", urgent: true,  receivedAt: null }),
      card({ id: "u-old",  urgent: true,  receivedAt: "2026-05-01T00:00:00Z" }),
      card({ id: "n-null", urgent: false, receivedAt: null }),
      card({ id: "n-old",  urgent: false, receivedAt: "2026-05-02T00:00:00Z" }),
    ];
    const result = sortKanbanCards(cards);
    expect(result.map((c) => c.id)).toEqual(["u-old", "u-null", "n-old", "n-null"]);
  });

  it("does not mutate the original array", () => {
    const cards = [
      card({ id: "b", urgent: false, receivedAt: "2026-05-02T00:00:00Z" }),
      card({ id: "a", urgent: false, receivedAt: "2026-05-01T00:00:00Z" }),
    ];
    const original = [...cards];
    sortKanbanCards(cards);
    expect(cards.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });

  it("empty array returns empty array", () => {
    expect(sortKanbanCards([])).toEqual([]);
  });
});
