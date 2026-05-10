/**
 * Unit tests for KanbanPage server component.
 * Server-side fetchers and client components are mocked so the test
 * can render in jsdom without a backend or dnd-kit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock server-side fetchers (called inside the async Server Component)
vi.mock("@/lib/kanban/api-server", () => ({
  getKanbanBoardServer: vi.fn().mockResolvedValue({
    columns: [
      {
        status: "PRZYJETE",
        total: 1,
        cards: [
          {
            id: "c1",
            code: "DR-1001",
            clientName: "Jan K.",
            itemSummary: "item",
            plannedPickupAt: null,
            urgent: false,
          },
        ],
        hasMore: false,
      },
      { status: "W_REALIZACJI",      total: 0, cards: [], hasMore: false },
      { status: "CZEKA_NA_KLIENTA",  total: 0, cards: [], hasMore: false },
      { status: "GOTOWE_DO_ODBIORU", total: 0, cards: [], hasMore: false },
      { status: "WYDANE",            total: 0, cards: [], hasMore: false },
    ],
  }),
}));

vi.mock("@/lib/messaging/api-server", () => ({
  getTriggersServer: vi.fn().mockResolvedValue([]),
}));

// Mock client components to avoid dnd-kit / next/navigation in jsdom
vi.mock("../../_components/kanban/KanbanBoardWrapper", () => ({
  KanbanBoardWrapper: ({
    initialColumns,
  }: {
    initialColumns: Array<{ status: string }>;
  }) => (
    <div data-testid="kanban-board">
      {initialColumns.map((c) => (
        <div key={c.status} data-testid={`col-${c.status}`} />
      ))}
    </div>
  ),
}));

vi.mock("../../_components/OrderViewTabs", () => ({
  OrderViewTabs: ({ active }: { active: string }) => (
    <div data-testid="order-view-tabs" data-active={active} />
  ),
}));

// Mock next/headers (used by api-server modules)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

// @/lib/log mock to avoid issues in jsdom
vi.mock("@/lib/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import KanbanPage from "../page";

describe("KanbanPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders OrderViewTabs with active=kanban", async () => {
    const jsx = await KanbanPage();
    render(jsx);
    const tabs = screen.getByTestId("order-view-tabs");
    expect(tabs.getAttribute("data-active")).toBe("kanban");
  });

  it("renders all 5 columns via KanbanBoardWrapper", async () => {
    const jsx = await KanbanPage();
    render(jsx);
    expect(screen.getByTestId("col-PRZYJETE")).toBeTruthy();
    expect(screen.getByTestId("col-WYDANE")).toBeTruthy();
  });

  it("renders ErrorBanner when board fetch throws", async () => {
    const { getKanbanBoardServer } = await import("@/lib/kanban/api-server");
    vi.mocked(getKanbanBoardServer).mockRejectedValueOnce(new Error("503"));

    const jsx = await KanbanPage();
    render(jsx);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/nie udało się załadować tablicy kanban/i)).toBeTruthy();
  });
});
