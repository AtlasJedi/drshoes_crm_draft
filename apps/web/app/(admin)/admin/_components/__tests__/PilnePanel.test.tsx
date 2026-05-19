import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/orders/api-server", () => ({
  listOrdersServer: vi.fn(),
}));

import { listOrdersServer } from "@/lib/orders/api-server";
import { PilnePanel } from "../PilnePanel";
import type { OrderListRow } from "@/lib/orders/types";

const mockListOrders = listOrdersServer as ReturnType<typeof vi.fn>;

// receivedAt 6 days ago → 6 dni badge
const SIX_DAYS_AGO = new Date(Date.now() - 6 * 86_400_000).toISOString();
const FOUR_DAYS_AGO = new Date(Date.now() - 4 * 86_400_000).toISOString();

const ROWS: OrderListRow[] = [
  {
    id: "ord-1", code: "DR-2026-0007", clientId: "cli-1",
    status: "PRZYJETE", totalPriceCents: 8000, currency: "PLN",
    description: "Czyszczenie", plannedPickupAt: null, version: 1,
    updatedAt: "2026-05-13T10:00:00Z", createdAt: "2026-05-13T08:00:00Z",
    receivedAt: SIX_DAYS_AGO, pickedUpAt: null,
    quotedPriceCents: 0, advancePaidCents: 0, clientName: "Adam Kowalski",
    location: null, urgent: true,
  },
  {
    id: "ord-2", code: "DR-2026-0011", clientId: "cli-2",
    status: "PRZYJETE", totalPriceCents: 12000, currency: "PLN",
    description: "Naprawa", plannedPickupAt: null, version: 1,
    updatedAt: "2026-05-15T10:00:00Z", createdAt: "2026-05-15T08:00:00Z",
    receivedAt: FOUR_DAYS_AGO, pickedUpAt: null,
    quotedPriceCents: 0, advancePaidCents: 0, clientName: "Ewa Nowak",
    location: null, urgent: true,
  },
];

describe("PilnePanel", () => {
  it("renders title Pilne", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    render(await PilnePanel());
    expect(screen.getByText("Pilne")).toBeInTheDocument();
  });

  it("renders subtitle", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    render(await PilnePanel());
    expect(screen.getByText(/Status przyjęte/)).toBeInTheDocument();
  });

  it("renders 2 rows", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    render(await PilnePanel());
    // Both client names visible
    expect(screen.getByText("Adam Kowalski")).toBeInTheDocument();
    expect(screen.getByText("Ewa Nowak")).toBeInTheDocument();
  });

  it("renders short code (last segment after final hyphen)", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    render(await PilnePanel());
    expect(screen.getByText("0007")).toBeInTheDocument();
    expect(screen.getByText("0011")).toBeInTheDocument();
  });

  it("renders days-in-shop badge", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    const { container } = render(await PilnePanel());
    // Badges are <span> elements rendered as inline blocks (not the subtitle div)
    // Use querySelectorAll to count only the badge spans, not the subtitle text node
    const badgeSpans = Array.from(container.querySelectorAll("span")).filter(
      (el) => /^\d+ dni$/.test(el.textContent?.trim() ?? "")
    );
    expect(badgeSpans.length).toBe(2);
  });

  it("renders empty state when no urgent orders", async () => {
    mockListOrders.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 12 });
    render(await PilnePanel());
    expect(screen.getByText("Brak pilnych zleceń")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockListOrders.mockRejectedValueOnce(new Error("network error"));
    render(await PilnePanel());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls listOrdersServer with urgent:true filter", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 2, totalPages: 1, number: 0, size: 12 });
    await PilnePanel();
    const [calledFilters] = mockListOrders.mock.calls[0] as [{ urgent?: boolean }];
    expect(calledFilters.urgent).toBe(true);
  });
});
