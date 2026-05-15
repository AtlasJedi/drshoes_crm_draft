import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "../KanbanBoard";
import type { KanbanColumnDto } from "@/lib/kanban/types";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

const STATUSES = [
  "PRZYJETE", "W_REALIZACJI", "CZEKA_NA_KLIENTA", "GOTOWE_DO_ODBIORU", "WYDANE",
] as const;

const cols: KanbanColumnDto[] = STATUSES.map((s) => ({
  status: s,
  total: 1,
  cards: [
    {
      id: `id-${s}`, code: `DR-${s}`, clientName: `Klient ${s}`,
      itemSummary: "item", plannedPickupAt: null, receivedAt: null, urgent: false,
    },
  ],
  hasMore: false,
}));

const PENDING_MOVE = {
  cardId: "id-PRZYJETE",
  cardCode: "DR-PRZYJETE",
  clientName: "Klient PRZYJETE",
  fromStatus: "PRZYJETE" as const,
  toStatus: "W_REALIZACJI" as const,
  orderVersion: 0,
  triggerPreview: { kind: "none" as const },
};

describe("KanbanBoard", () => {
  it("renders all 5 columns", () => {
    render(<KanbanBoard columns={cols} />);
    expect(screen.getByText("Przyjęte")).toBeTruthy();
    expect(screen.getByText("W realizacji")).toBeTruthy();
    expect(screen.getByText("Gotowe do odbioru")).toBeTruthy();
    expect(screen.getAllByText(/wydane/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty columns with empty-state text", () => {
    const emptyCols: KanbanColumnDto[] = STATUSES.map((s) => ({
      status: s, total: 0, cards: [], hasMore: false,
    }));
    render(<KanbanBoard columns={emptyCols} />);
    expect(screen.getAllByText("brak zleceń w tym statusie")).toHaveLength(5);
  });

  it("renders 5 dodaj buttons (one per column)", () => {
    render(<KanbanBoard columns={cols} />);
    expect(screen.getAllByRole("button", { name: /dodaj/i })).toHaveLength(5);
  });

  it("shows post-drag popup when pendingMove is provided", () => {
    render(
      <KanbanBoard
        columns={cols}
        pendingMove={PENDING_MOVE}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Status zmieniony/i)).toBeInTheDocument();
    // DR-PRZYJETE appears both in card and popup — verify popup's div contains the arrow
    expect(screen.getByText(/DR-PRZYJETE.*→.*W realizacji/)).toBeInTheDocument();
  });

  it("popup does not render when pendingMove is null", () => {
    render(<KanbanBoard columns={cols} pendingMove={null} />);
    expect(screen.queryByText(/Status zmieniony/i)).not.toBeInTheDocument();
  });

  it("clicking wyślij in popup calls onConfirm(true)", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <KanbanBoard
        columns={cols}
        pendingMove={PENDING_MOVE}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /wyślij/i }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("clicking close in popup calls onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <KanbanBoard
        columns={cols}
        pendingMove={PENDING_MOVE}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Zamknij/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
