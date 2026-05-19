/**
 * Tests for OrdersTable — headers, column order, shortCode rendering, urgent highlight.
 * Task: C (client-adjustments-2026-05-19)
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
}));

vi.mock("../RowQuickActionsMenu", () => ({
  RowQuickActionsMenu: () => <div data-testid="quick-actions" />,
}));

vi.mock("../SortableColumnHeader", () => ({
  SortableColumnHeader: ({ label }: { label: string }) => <span>{label}</span>,
}));

const BASE_ROW: OrderListRow = {
  id: "r1",
  code: "DR-2026-0013",
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

describe("OrdersTable — columns", () => {
  it("renders exactly 7 visible header cells in correct order", () => {
    const { container } = render(
      <OrdersTable rows={[BASE_ROW]} totalPages={1} currentPage={0} />,
    );

    // All th elements (including checkbox th and actions th)
    const allThs = Array.from(container.querySelectorAll("thead th"));
    // Collect text content of non-empty ths (skip checkbox and empty actions column)
    const labeledThs = allThs.filter((th) => th.textContent?.trim());
    const labels = labeledThs.map((th) => th.textContent?.trim());

    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe("NR ZAMÓWIENIA");
    expect(labels[1]).toBe("STATUS");
    expect(labels[2]).toBe("KLIENT");
    expect(labels[3]).toBe("OPIS");
    expect(labels[4]).toBe("PRZYJĘCIE");
    expect(labels[5]).toBe("ODBIÓR");
    expect(labels[6]).toBe("SUMA");
  });

  it("all labeled header cells have uppercase text content", () => {
    const { container } = render(
      <OrdersTable rows={[BASE_ROW]} totalPages={1} currentPage={0} />,
    );

    const allThs = Array.from(container.querySelectorAll("thead th"));
    const labeledThs = allThs.filter((th) => th.textContent?.trim());
    for (const th of labeledThs) {
      const text = th.textContent!.trim();
      expect(text).toBe(text.toUpperCase());
    }
  });

  it("renders shortCode in code cell — DR-2026-0013 → 0013", () => {
    const { container } = render(
      <OrdersTable rows={[BASE_ROW]} totalPages={1} currentPage={0} />,
    );

    const tds = Array.from(container.querySelectorAll("tbody tr td"));
    // td[0] = checkbox, td[1] = code
    const codeTd = tds[1];
    expect(codeTd.textContent).toBe("0013");
  });

  it("does not render MIEJSCE or FOTO columns", () => {
    const { container } = render(
      <OrdersTable rows={[BASE_ROW]} totalPages={1} currentPage={0} />,
    );

    const html = container.innerHTML;
    expect(html).not.toMatch(/Miejsce|MIEJSCE/);
    expect(html).not.toMatch(/Foto|FOTO/);
    expect(container.querySelector("[data-testid='phimg']")).toBeNull();
  });
});

describe("OrdersTable — urgent highlight", () => {
  it("applies magenta class to urgent rows", () => {
    const rows: OrderListRow[] = [
      { ...BASE_ROW, id: "r1", code: "DR-2026-0001", urgent: true },
      { ...BASE_ROW, id: "r2", code: "DR-2026-0002", urgent: false },
    ];
    const { container } = render(
      <OrdersTable rows={rows} totalPages={1} currentPage={0} />,
    );

    const trs = container.querySelectorAll("tbody tr");
    expect(trs).toHaveLength(2);
    expect(trs[0].className).toMatch(/magenta/);
    expect(trs[1].className).not.toMatch(/magenta/);
  });
});
