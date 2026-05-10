import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanColumn } from "../KanbanColumn";
import type { KanbanColumnDto } from "@/lib/kanban/types";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  }),
  verticalListSortingStrategy: "verticalListSortingStrategy",
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/orders/kanban",
  useSearchParams: () => new URLSearchParams(),
}));

const col: KanbanColumnDto = {
  status: "PRZYJETE",
  total: 3,
  cards: [
    {
      id: "u1", code: "DR-1001", clientName: "Jan K.",
      itemSummary: "Vibram", plannedPickupAt: null, urgent: false,
    },
  ],
  hasMore: true,
};

describe("KanbanColumn", () => {
  it("renders column status label", () => {
    render(<KanbanColumn column={col} />);
    // STATUS_LABELS_PL["PRZYJETE"] = "Przyjęte"
    expect(screen.getByText(/przyjęte/i)).toBeTruthy();
  });

  it("renders total count badge", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders hasMore text when more cards exist", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText(/więcej/)).toBeTruthy();
  });

  it("renders empty state when no cards", () => {
    render(<KanbanColumn column={{ ...col, cards: [], total: 0, hasMore: false }} />);
    expect(screen.getByText("brak zleceń w tym statusie")).toBeTruthy();
  });

  it("renders card children", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText("DR-1001")).toBeTruthy();
  });
});
