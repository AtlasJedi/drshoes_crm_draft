/**
 * Tests for OrdersTable — urgent row highlight + LocationChip wiring.
 * Task: f2 (milestone m11)
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { OrdersTable } from "../OrdersTable";
import type { OrderListRow } from "@/lib/orders/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@drshoes/ui", () => ({
  Pill: ({ status }: { status: string }) => <span data-testid="pill">{status}</span>,
  PhImg: () => <div data-testid="phimg" />,
}));

vi.mock("../RowQuickActionsMenu", () => ({
  RowQuickActionsMenu: () => <div data-testid="quick-actions" />,
}));

vi.mock("../SortableColumnHeader", () => ({
  SortableColumnHeader: ({ label }: { label: string }) => <span>{label}</span>,
}));

const BASE_ROW: OrderListRow = {
  id: "r1",
  code: "DR-001",
  clientId: "c1",
  clientName: "Jan Kowalski",
  location: null,
  status: "W_REALIZACJI",
  totalPriceCents: 10000,
  currency: "PLN",
  description: null,
  plannedPickupAt: null,
  version: 0,
  updatedAt: "2026-05-01T10:00:00Z",
  createdAt: "2026-05-01T10:00:00Z",
  receivedAt: "2026-04-15T10:00:00Z",
  pickedUpAt: null,
  quotedPriceCents: 10000,
  advancePaidCents: 0,
  urgent: false,
};

describe("OrdersTable — urgent highlight", () => {
  it("applies magenta class to urgent rows", () => {
    const rows: OrderListRow[] = [
      { ...BASE_ROW, id: "r1", code: "DR-001", urgent: true },
      { ...BASE_ROW, id: "r2", code: "DR-002", urgent: false },
    ];
    const { container } = render(
      <OrdersTable rows={rows} totalPages={1} currentPage={0} />,
    );

    const trs = container.querySelectorAll("tbody tr");
    expect(trs).toHaveLength(2);

    // urgent row has magenta in className
    expect(trs[0].className).toMatch(/magenta/);
    // non-urgent row does not
    expect(trs[1].className).not.toMatch(/magenta/);
  });

  it("renders LocationChip when row has location", () => {
    const rows: OrderListRow[] = [
      { ...BASE_ROW, id: "r1", location: "szafa-A", urgent: false },
    ];
    const { container } = render(
      <OrdersTable rows={rows} totalPages={1} currentPage={0} />,
    );
    // LocationChip renders a span with aria-label and the location name
    expect(container.querySelector("[aria-label='Aktualne miejsce']")).toBeTruthy();
  });

  it("renders empty cell when location is null", () => {
    const rows: OrderListRow[] = [
      { ...BASE_ROW, id: "r1", location: null, urgent: false },
    ];
    const { container } = render(
      <OrdersTable rows={rows} totalPages={1} currentPage={0} />,
    );
    expect(container.querySelector("[aria-label='Aktualne miejsce']")).toBeNull();
  });
});
