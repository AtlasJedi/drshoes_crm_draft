import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link — renders a plain <a>
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock the server fetcher
vi.mock("@/lib/calendar/api-server", () => ({
  fetchCalendarWindow: vi.fn(),
}));

// Mock orders api-server (used for getOrderServer when ?orderId= is set)
vi.mock("@/lib/orders/api-server", () => ({
  getOrderServer: vi.fn().mockResolvedValue({
    id: "drawer-order-id",
    code: "DR-999",
    clientId: "c1",
    status: "PRZYJETE",
    source: "ADMIN",
    receivedAt: null,
    plannedPickupAt: null,
    pickedUpAt: null,
    assignedCraftsmanId: null,
    currentStorageLocationId: null,
    tags: null,
    totalPriceCents: 0,
    currency: "PLN",
    description: null,
    cancelledReason: null,
    version: 1,
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
    items: [],
  }),
}));

// Mock child presentational components to keep tests fast and isolated
vi.mock("../../_components/OrderViewTabs", () => ({
  OrderViewTabs: ({ active }: { active: string }) => (
    <div data-testid="view-tabs" data-active={active} />
  ),
}));
vi.mock("../../_components/calendar/CalendarMonthGrid", () => ({
  CalendarMonthGrid: ({ scheduled }: { scheduled: unknown[] }) => (
    <div data-testid="month-grid" data-count={scheduled.length} />
  ),
}));
vi.mock("../../_components/calendar/CalendarWeekGrid", () => ({
  CalendarWeekGrid: ({ scheduled }: { scheduled: unknown[] }) => (
    <div data-testid="week-grid" data-count={scheduled.length} />
  ),
}));
vi.mock("../../_components/calendar/CalendarDayGrid", () => ({
  CalendarDayGrid: ({ scheduled }: { scheduled: unknown[] }) => (
    <div data-testid="day-grid" data-count={scheduled.length} />
  ),
}));
vi.mock("../../_components/calendar/BezTerminuPanel", () => ({
  BezTerminuPanel: ({ unscheduled }: { unscheduled: unknown[] }) => (
    <div data-testid="bez-terminu" data-count={unscheduled.length} />
  ),
}));
vi.mock("../../_components/OrderDrawer", () => ({
  OrderDrawer: ({ initialOrder }: { initialOrder: { id: string } }) => (
    <div data-testid="order-drawer" data-order-id={initialOrder.id} />
  ),
}));

// Suppress ErrorBanner "use client" — it's already a simple div component
vi.mock("@/components/state/ErrorBanner", () => ({
  ErrorBanner: ({ message }: { message?: string }) => (
    <div role="alert">{message}</div>
  ),
}));
vi.mock("@/components/state/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => (
    <div data-testid="empty-state">{message}</div>
  ),
}));

import { fetchCalendarWindow } from "@/lib/calendar/api-server";
import CalendarPage from "../page";

const mockFetch = fetchCalendarWindow as ReturnType<typeof vi.fn>;

describe("CalendarPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders OrderViewTabs with active='calendar'", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("view-tabs")).toHaveAttribute("data-active", "calendar");
  });

  it("renders the month grid with scheduled orders", async () => {
    mockFetch.mockResolvedValueOnce({
      scheduled: [
        {
          id: "1",
          code: "DR-001",
          clientName: "A",
          status: "PRZYJETE",
          plannedPickupAt: "2026-05-05T10:00:00Z",
          receivedAt: null,
          itemSummary: "x",
          urgent: false,
        },
      ],
      unscheduled: [],
    });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("month-grid")).toHaveAttribute("data-count", "1");
  });

  it("renders BezTerminuPanel with unscheduled orders", async () => {
    mockFetch.mockResolvedValueOnce({
      scheduled: [],
      unscheduled: [
        {
          id: "2",
          code: "DR-002",
          clientName: "B",
          status: "PRZYJETE",
          plannedPickupAt: null,
          receivedAt: "2026-05-01T09:00:00Z",
          itemSummary: "y",
          urgent: false,
        },
      ],
    });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("bez-terminu")).toHaveAttribute("data-count", "1");
  });

  it("renders error banner when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("opens drawer when ?orderId= is set", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    const jsx = await CalendarPage({
      searchParams: Promise.resolve({ orderId: "drawer-order-id", date: "2026-05-01" }),
    });
    render(jsx as React.ReactElement);
    const drawer = screen.queryByTestId("order-drawer");
    expect(drawer).not.toBeNull();
    expect(drawer).toHaveAttribute("data-order-id", "drawer-order-id");
  });

  it("renders mode toggle as three enabled links with miesiąc active by default", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    // All three mode toggles are <Link> → rendered as <a> by the mock
    const miesiacLink = screen.getByRole("link", { name: "miesiąc" });
    const tydzienLink = screen.getByRole("link", { name: "tydzień" });
    const dzienLink = screen.getByRole("link", { name: "dzień" });
    expect(miesiacLink).toBeInTheDocument();
    expect(tydzienLink).toBeInTheDocument();
    expect(dzienLink).toBeInTheDocument();
    // Active mode has aria-current="page"
    expect(miesiacLink).toHaveAttribute("aria-current", "page");
    expect(tydzienLink).not.toHaveAttribute("aria-current");
    expect(dzienLink).not.toHaveAttribute("aria-current");
  });

  it("renders week-grid when ?mode=week is set", async () => {
    const order = {
      id: "w1", code: "DR-W01", clientName: "A", status: "PRZYJETE",
      plannedPickupAt: "2026-05-14T10:00:00Z",
      receivedAt: "2026-05-12T09:00:00Z",
      itemSummary: "x", urgent: false,
    };
    mockFetch.mockResolvedValueOnce({ scheduled: [order], unscheduled: [] });
    const jsx = await CalendarPage({
      searchParams: Promise.resolve({ mode: "week", date: "2026-05-12" }),
    });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("week-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("month-grid")).not.toBeInTheDocument();
  });

  it("renders day-grid when ?mode=day is set", async () => {
    const order = {
      id: "d1", code: "DR-D01", clientName: "B", status: "PRZYJETE",
      plannedPickupAt: "2026-05-12T15:00:00Z",
      receivedAt: "2026-05-12T09:00:00Z",
      itemSummary: "y", urgent: false,
    };
    mockFetch.mockResolvedValueOnce({ scheduled: [order], unscheduled: [] });
    const jsx = await CalendarPage({
      searchParams: Promise.resolve({ mode: "day", date: "2026-05-12" }),
    });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("day-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("month-grid")).not.toBeInTheDocument();
  });
});
