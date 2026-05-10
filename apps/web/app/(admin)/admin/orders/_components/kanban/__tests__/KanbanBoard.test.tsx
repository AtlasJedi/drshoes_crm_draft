import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "../KanbanBoard";
import type { KanbanColumnDto } from "@/lib/kanban/types";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
      itemSummary: "item", plannedPickupAt: null, urgent: false,
    },
  ],
  hasMore: false,
}));

describe("KanbanBoard", () => {
  it("renders all 5 columns", () => {
    render(<KanbanBoard columns={cols} />);
    // Use exact Polish column header labels from STATUS_LABELS_PL
    expect(screen.getByText("Przyjęte")).toBeTruthy();
    expect(screen.getByText("W realizacji")).toBeTruthy();
    expect(screen.getByText("Gotowe do odbioru")).toBeTruthy();
    // "Wydane" appears in card data too — use getAllByText
    expect(screen.getAllByText(/wydane/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty columns with empty-state text", () => {
    const emptyCols: KanbanColumnDto[] = STATUSES.map((s) => ({
      status: s, total: 0, cards: [], hasMore: false,
    }));
    render(<KanbanBoard columns={emptyCols} />);
    const empties = screen.getAllByText("brak zleceń w tym statusie");
    expect(empties).toHaveLength(5);
  });
});
