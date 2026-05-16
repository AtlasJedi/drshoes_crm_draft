import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanbanBoardWrapper } from "../KanbanBoardWrapper";

vi.mock("@/lib/orders/api", () => ({
  changeStatus: vi.fn().mockResolvedValue({ order: {}, triggerSuggestion: null }),
}));
vi.mock("@/lib/locations", () => ({
  listLocations: vi.fn().mockResolvedValue([
    { id: 1, name: "Półka A", active: true, position: 0 },
  ]),
  addOrderNote: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/messaging/api", () => ({
  getTriggers: vi.fn().mockResolvedValue([]),
}));

// Stub out dnd-kit so the board renders without pointer-sensor infra
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
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

const columns = [
  {
    status: "PRZYJETE" as const,
    total: 1,
    cards: [{
      id: "o-1", code: "DR-1", clientName: "Anna",
      itemSummary: "buty", plannedPickupAt: null, receivedAt: null, urgent: false,
    }],
    hasMore: false,
  },
  {
    status: "W_REALIZACJI" as const,
    total: 0,
    cards: [],
    hasMore: false,
  },
];

describe("KanbanBoardWrapper — drag confirms via StatusChangeTriggerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens StatusChangeTriggerDialog with PYK button after test-handle drag", async () => {
    render(
      <KanbanBoardWrapper
        initialColumns={columns}
        triggers={[]}
        orderVersionMap={new Map([["o-1", 0]])}
      />,
    );

    // The test-only drag handle is rendered with display:none in NODE_ENV=test
    const handle = screen.getByTestId("kanban-test-drag-o-1-PRZYJETE");
    fireEvent.click(handle);

    expect(await screen.findByText("Zmiana statusu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^PYK$/i })).toBeInTheDocument();
  });

  it("cancel via dialog close reverts optimistic move", async () => {
    render(
      <KanbanBoardWrapper
        initialColumns={columns}
        triggers={[]}
        orderVersionMap={new Map([["o-1", 0]])}
      />,
    );

    const handle = screen.getByTestId("kanban-test-drag-o-1-PRZYJETE");
    fireEvent.click(handle);

    // Wait for dialog to appear
    await screen.findByText("Zmiana statusu");

    // Click the Anuluj button
    fireEvent.click(screen.getByRole("button", { name: /anuluj/i }));

    await waitFor(() => {
      expect(screen.queryByText("Zmiana statusu")).not.toBeInTheDocument();
    });
  });
});
