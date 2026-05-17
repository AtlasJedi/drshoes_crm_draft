import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { OrderListRow, OrderStatus } from "@/lib/orders/types";

const mockPush = vi.fn();
let mockSearchParamsString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

// Stub @drshoes/ui (not aliased in vitest)
vi.mock("@drshoes/ui", () => ({
  I: {},
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

function makeRow(overrides: Partial<OrderListRow> = {}): OrderListRow {
  return {
    id: "order-uuid-1",
    code: "DR-1042",
    clientId: "client-1",
    clientName: "Jan Kowalski",
    location: null,
    status: "W_REALIZACJI" as OrderStatus,
    totalPriceCents: 34000,
    currency: "PLN",
    description: null,
    plannedPickupAt: "2026-05-15T09:00:00Z",
    version: 1,
    updatedAt: "2026-05-01T09:00:00Z",
    createdAt: "2026-05-01T09:00:00Z",
    receivedAt: "2026-05-01T09:00:00Z",
    pickedUpAt: null,
    quotedPriceCents: 34000,
    advancePaidCents: 0,
    urgent: false,
    ...overrides,
  };
}

describe("ClientOrdersRows", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParamsString = "";
  });

  it("renders one row per entry as role=button", async () => {
    const { ClientOrdersRows } = await import("../ClientOrdersRows");
    const rows = [makeRow({ id: "a", code: "DR-1" }), makeRow({ id: "b", code: "DR-2" })];
    render(
      <table>
        <ClientOrdersRows clientId="client-1" rows={rows} />
      </table>,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(screen.getByText("DR-1")).toBeInTheDocument();
    expect(screen.getByText("DR-2")).toBeInTheDocument();
  });

  it("click pushes URL with ?orderId=<row.id>", async () => {
    const { ClientOrdersRows } = await import("../ClientOrdersRows");
    render(
      <table>
        <ClientOrdersRows clientId="client-1" rows={[makeRow({ id: "order-uuid-1" })]} />
      </table>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledOnce();
    const pushed = String(mockPush.mock.calls[0]?.[0] ?? "");
    expect(pushed).toContain("orderId=order-uuid-1");
  });

  it("Enter key activates row", async () => {
    const { ClientOrdersRows } = await import("../ClientOrdersRows");
    render(
      <table>
        <ClientOrdersRows clientId="client-1" rows={[makeRow({ id: "order-uuid-2" })]} />
      </table>,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(mockPush).toHaveBeenCalledOnce();
    const pushed = String(mockPush.mock.calls[0]?.[0] ?? "");
    expect(pushed).toContain("orderId=order-uuid-2");
  });

  it("Space key activates row", async () => {
    const { ClientOrdersRows } = await import("../ClientOrdersRows");
    render(
      <table>
        <ClientOrdersRows clientId="client-1" rows={[makeRow({ id: "order-uuid-3" })]} />
      </table>,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(mockPush).toHaveBeenCalledOnce();
    const pushed = String(mockPush.mock.calls[0]?.[0] ?? "");
    expect(pushed).toContain("orderId=order-uuid-3");
  });

  it("preserves existing searchParams when pushing", async () => {
    mockSearchParamsString = "page=2";
    const { ClientOrdersRows } = await import("../ClientOrdersRows");
    render(
      <table>
        <ClientOrdersRows clientId="client-1" rows={[makeRow({ id: "order-uuid-4" })]} />
      </table>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledOnce();
    const pushed = String(mockPush.mock.calls[0]?.[0] ?? "");
    expect(pushed).toContain("page=2");
    expect(pushed).toContain("orderId=order-uuid-4");
  });
});
