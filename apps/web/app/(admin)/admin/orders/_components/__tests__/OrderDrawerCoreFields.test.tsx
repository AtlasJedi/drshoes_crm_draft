/**
 * Tests for OrderDrawerCoreFields (task f1):
 * - Wykonawca not present
 * - Wycena shows formatted quotedPriceCents (read-only)
 * - "Czas w warsztacie" label shows when receivedAt is set
 * - text-magenta class applied when urgent
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDrawerCoreFields } from "../OrderDrawerCoreFields";
import type { OrderDto } from "@/lib/orders/types";

vi.mock("@/lib/orders/api", () => ({
  updateOrder: vi.fn(),
}));

const NOW = new Date("2026-06-01T12:00:00Z").getTime();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

const BASE_ORDER: OrderDto = {
  id: "order-1",
  code: "DR-TEST",
  clientId: "c1",
  clientName: "Jan Kowalski",
  status: "W_REALIZACJI",
  source: "ADMIN",
  receivedAt: null,
  plannedPickupAt: null,
  pickedUpAt: null,
  assignedCraftsmanId: null,
  currentStorageLocationId: null,
  location: null,
  tags: null,
  totalPriceCents: 0,
  currency: "PLN",
  description: null,
  cancelledReason: null,
  version: 1,
  createdAt: "2026-05-01T10:00:00Z",
  updatedAt: "2026-05-01T10:00:00Z",
  items: [],
  quotedPriceCents: 0,
  advancePaidCents: 0,
  urgent: false,
};

describe("OrderDrawerCoreFields", () => {
  it("does not render Wykonawca field", () => {
    render(<OrderDrawerCoreFields order={BASE_ORDER} onOrderUpdate={vi.fn()} />);
    expect(screen.queryByText(/wykonawca/i)).toBeNull();
  });

  it("renders Wycena as read-only text with formatted value", () => {
    const order = { ...BASE_ORDER, quotedPriceCents: 34000 };
    render(<OrderDrawerCoreFields order={order} onOrderUpdate={vi.fn()} />);
    // Wycena and Do zapłaty both render "340,00 zł" when advance is 0 — locate via the Wycena label
    const wycenaLabel = screen.getByText(/^Wycena$/i);
    const wycenaRow = wycenaLabel.parentElement!;
    expect(wycenaRow.textContent).toMatch(/340,00/);
    // No editable input for wycena
    const wycenaInput = wycenaRow.querySelector("input");
    expect(wycenaInput).toBeNull();
  });

  it("shows Czas w warsztacie label and days when receivedAt is set", () => {
    const recv = new Date(NOW - 5 * 86_400_000).toISOString();
    const order = { ...BASE_ORDER, receivedAt: recv };
    render(<OrderDrawerCoreFields order={order} onOrderUpdate={vi.fn()} />);
    expect(screen.getByText(/czas w warsztacie/i)).toBeInTheDocument();
    expect(screen.getByText(/5 dni/i)).toBeInTheDocument();
  });

  it("applies text-magenta class when urgent (>= 14 days)", () => {
    const recv = new Date(NOW - 14 * 86_400_000).toISOString();
    const order = { ...BASE_ORDER, receivedAt: recv, urgent: true };
    const { container } = render(<OrderDrawerCoreFields order={order} onOrderUpdate={vi.fn()} />);
    const urgentEl = container.querySelector(".text-magenta");
    expect(urgentEl).not.toBeNull();
    expect(urgentEl?.textContent).toMatch(/14/);
  });
});
