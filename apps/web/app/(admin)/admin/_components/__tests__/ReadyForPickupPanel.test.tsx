import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the server-side orders list fetcher
vi.mock("@/lib/orders/api-server", () => ({
  listOrdersServer: vi.fn(),
}));

import { listOrdersServer } from "@/lib/orders/api-server";
import { ReadyForPickupPanel } from "../ReadyForPickupPanel";
import type { OrderListRow } from "@/lib/orders/types";

const mockListOrders = listOrdersServer as ReturnType<typeof vi.fn>;

const ROWS: OrderListRow[] = [
  {
    id: "ord-1",
    code: "DR-0042",
    clientId: "cli-1",
    status: "GOTOWE_DO_ODBIORU",
    totalPriceCents: 15000,
    currency: "PLN",
    description: "Naprawa podeszwy",
    plannedPickupAt: null,
    version: 1,
    updatedAt: "2026-05-10T10:00:00Z",
  },
];

describe("ReadyForPickupPanel", () => {
  it("renders heading", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await ReadyForPickupPanel());
    expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
  });

  it("renders order code and description", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await ReadyForPickupPanel());
    expect(screen.getByText("DR-0042")).toBeInTheDocument();
    expect(screen.getByText("Naprawa podeszwy")).toBeInTheDocument();
  });

  it("renders empty state when no orders", async () => {
    mockListOrders.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 4 });
    render(await ReadyForPickupPanel());
    expect(screen.getByText("Nic gotowego")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockListOrders.mockRejectedValueOnce(new Error("network error"));
    render(await ReadyForPickupPanel());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
