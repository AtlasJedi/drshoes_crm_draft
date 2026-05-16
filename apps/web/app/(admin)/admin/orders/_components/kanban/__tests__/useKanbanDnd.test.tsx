import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKanbanDnd } from "../useKanbanDnd";
import type { KanbanColumnDto } from "@/lib/kanban/types";
import type { TriggerDto } from "@/lib/messaging/types";

vi.mock("@/lib/orders/api", () => ({
  changeStatus: vi.fn(),
}));
vi.mock("@/lib/messaging/api", () => ({
  getTriggers: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/locations", () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  addOrderNote: vi.fn().mockResolvedValue({}),
}));

import { changeStatus } from "@/lib/orders/api";

const card1 = {
  id: "card-a", code: "DR-1001", clientName: "Jan K.",
  itemSummary: "item", plannedPickupAt: null, receivedAt: null, urgent: false,
};
const card2 = {
  id: "card-b", code: "DR-1002", clientName: "Ala K.",
  itemSummary: "item2", plannedPickupAt: null, receivedAt: null, urgent: false,
};

function makeColumns(): KanbanColumnDto[] {
  return [
    { status: "PRZYJETE",          total: 1, cards: [card1], hasMore: false },
    { status: "W_REALIZACJI",      total: 1, cards: [card2], hasMore: false },
    { status: "CZEKA_NA_KLIENTA",  total: 0, cards: [],      hasMore: false },
    { status: "GOTOWE_DO_ODBIORU", total: 0, cards: [],      hasMore: false },
    { status: "WYDANE",            total: 0, cards: [],      hasMore: false },
  ];
}

const triggers: TriggerDto[] = [];
const versionMap = new Map<string, number>([["card-a", 3], ["card-b", 1]]);

describe("useKanbanDnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drop on same column is a no-op — no optimistic move, no dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "PRZYJETE");
    });
    expect(result.current.pendingMove).toBeNull();
    // card-a stays in PRZYJETE
    expect(result.current.columns[0]!.cards).toHaveLength(1);
  });

  it("drop on different column triggers optimistic move + opens dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    expect(result.current.columns[0]!.cards).toHaveLength(0);
    expect(result.current.columns[1]!.cards).toHaveLength(2);
    expect(result.current.pendingMove).not.toBeNull();
    expect(result.current.pendingMove?.cardId).toBe("card-a");
    expect(result.current.pendingMove?.toStatus).toBe("W_REALIZACJI");
  });

  it("onCancel reverts optimistic move and closes dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    act(() => {
      result.current.onCancel();
    });
    expect(result.current.pendingMove).toBeNull();
    expect(result.current.columns[0]!.cards).toHaveLength(1); // card-a restored
    expect(result.current.columns[1]!.cards).toHaveLength(1); // card-b only
  });

  it("onConfirm calls changeStatus with correct args and commits on 2xx", async () => {
    vi.mocked(changeStatus).mockResolvedValueOnce({
      order: { id: "card-a", status: "W_REALIZACJI", version: 4 } as never,
      triggerSuggestion: null,
    });
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(true);
    });
    expect(changeStatus).toHaveBeenCalledWith("card-a", "W_REALIZACJI", 3, true, "");
    expect(result.current.pendingMove).toBeNull();
    expect(result.current.errorToast).toBeNull();
    expect(result.current.columns[0]!.cards).toHaveLength(0);
  });

  it("onConfirm with sendTriggers=false still calls changeStatus", async () => {
    vi.mocked(changeStatus).mockResolvedValueOnce({
      order: { id: "card-a", status: "W_REALIZACJI", version: 4 } as never,
      triggerSuggestion: null,
    });
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(false);
    });
    expect(changeStatus).toHaveBeenCalledWith("card-a", "W_REALIZACJI", 3, false, "");
  });

  it("onConfirm with note + location calls changeStatus + addOrderNote", async () => {
    vi.mocked(changeStatus).mockResolvedValueOnce({
      order: { id: "card-a", status: "W_REALIZACJI", version: 4 } as never,
      triggerSuggestion: null,
    });
    const { addOrderNote } = await import("@/lib/locations");
    vi.mocked(addOrderNote).mockResolvedValueOnce({} as never);
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(true, "Czeka na decyzję", "Półka A");
    });
    expect(changeStatus).toHaveBeenCalledWith(
      "card-a", "W_REALIZACJI", 3, true, "Czeka na decyzję",
    );
    expect(addOrderNote).toHaveBeenCalledWith("card-a", { location: "Półka A" });
  });

  it("onConfirm reverts move and sets error toast on failure", async () => {
    vi.mocked(changeStatus).mockRejectedValueOnce(new Error("HTTP 409"));
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(true);
    });
    expect(result.current.columns[0]!.cards).toHaveLength(1);
    expect(result.current.errorToast).toBe(
      "Nie udało się zmienić statusu — spróbuj jeszcze raz",
    );
  });
});
