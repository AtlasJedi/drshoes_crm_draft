import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanCard } from "../KanbanCard";
import type { KanbanCardDto } from "@/lib/kanban/types";

// Stub dnd-kit to avoid JSDOM drag complexity
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin/orders/kanban",
  useSearchParams: () => new URLSearchParams(),
}));

const card: KanbanCardDto = {
  id: "uuid-card-1",
  code: "DR-1042",
  clientName: "Magdalena K.",
  itemSummary: "DM 1460 — Vibram",
  plannedPickupAt: "2026-05-08T10:00:00Z",
  urgent: true,
};

describe("KanbanCard", () => {
  it("renders code and client name", () => {
    render(<KanbanCard card={card} />);
    expect(screen.getByText("DR-1042")).toBeTruthy();
    expect(screen.getByText("Magdalena K.")).toBeTruthy();
  });

  it("renders urgent badge when urgent=true", () => {
    render(<KanbanCard card={card} />);
    expect(screen.getByText("pilne")).toBeTruthy();
  });

  it("does not render urgent badge when urgent=false", () => {
    render(<KanbanCard card={{ ...card, urgent: false }} />);
    expect(screen.queryByText("pilne")).toBeNull();
  });

  it("renders — for null plannedPickupAt", () => {
    render(<KanbanCard card={{ ...card, plannedPickupAt: null }} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders — for empty itemSummary", () => {
    render(<KanbanCard card={{ ...card, itemSummary: "" }} />);
    // The body section renders "—" for empty summary
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("pushes ?orderId=<id> on click", () => {
    render(<KanbanCard card={card} />);
    fireEvent.click(screen.getByText("DR-1042").closest("[data-card-id]")!);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("orderId=uuid-card-1"),
    );
  });
});
