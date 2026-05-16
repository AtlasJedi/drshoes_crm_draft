/**
 * Smoke tests for OrderDrawer reskin (task 9-27).
 * Verifies new header structure and footer action buttons render correctly.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDrawer } from "../OrderDrawer";
import type { OrderDto } from "@/lib/orders/types";

// @repo/ui is a workspace package not aliased in vitest — stub it out.
vi.mock("@drshoes/ui", () => ({
  Pill: ({ status }: { status: string }) => <span data-testid="pill">{status}</span>,
  I: {
    close: () => <svg data-testid="icon-close" />,
    more: () => <svg data-testid="icon-more" />,
    send: () => <svg data-testid="icon-send" />,
  },
}));

vi.mock("../OrderDrawerHeader", () => ({
  OrderDrawerHeader: ({ code, clientName }: { code: string; clientName?: string | null }) => (
    <div data-testid="drawer-header">
      <span>{code}</span>
      {clientName && <span>{clientName}</span>}
    </div>
  ),
}));
vi.mock("../OrderDrawerStatusTimeline", () => ({
  OrderDrawerStatusTimeline: () => <div data-testid="status-timeline" />,
}));
vi.mock("../OrderDrawerCoreFields", () => ({
  OrderDrawerCoreFields: () => <div data-testid="core-fields" />,
}));
vi.mock("../OrderDrawerStatusChanger", () => ({
  OrderDrawerStatusChanger: () => <div data-testid="status-changer" />,
}));
vi.mock("../OrderDrawerItems", () => ({
  OrderDrawerItems: () => <div data-testid="items" />,
}));
vi.mock("../OrderDrawerTimeline", () => ({
  OrderDrawerTimeline: () => <div data-testid="timeline" />,
}));
vi.mock("../OrderDrawerNotes", () => ({
  OrderDrawerNotes: () => <div data-testid="notes" />,
}));
vi.mock("../OrderDrawerNoteComposer", () => ({
  OrderDrawerNoteComposer: () => <div data-testid="note-composer" />,
}));
vi.mock("../OrderDrawerPhotos", () => ({
  OrderDrawerPhotos: () => <div data-testid="photos" />,
}));
vi.mock("../OrderDrawerMessages", () => ({
  OrderDrawerMessages: () => <div data-testid="messages" />,
}));
vi.mock("../MessageComposerModal", () => ({
  MessageComposerModal: () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const MOCK_ORDER: OrderDto = {
  id: "order-1",
  code: "DR-1042",
  clientId: "c1",
  clientName: "Magdalena Kowalska",
  status: "W_REALIZACJI",
  source: "ADMIN",
  receivedAt: "2026-05-02T12:00:00Z",
  plannedPickupAt: null,
  pickedUpAt: null,
  assignedCraftsmanId: null,
  currentStorageLocationId: null,
  location: null,
  tags: ["pilne"],
  totalPriceCents: 34000,
  currency: "PLN",
  description: "DM 1460 Vibram",
  cancelledReason: null,
  version: 1,
  createdAt: "2026-05-02T10:00:00Z",
  updatedAt: "2026-05-02T12:00:00Z",
  items: [],
  quotedPriceCents: 34000,
  advancePaidCents: 0,
};

describe("OrderDrawer — reskin (task 9-27)", () => {
  it("renders DR-code in t-display header", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByText("DR-1042")).toBeInTheDocument();
  });

  it("renders client name sub in header", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByText(/Magdalena Kowalska/i)).toBeInTheDocument();
  });

  it("renders footer zmień status button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByRole("button", { name: /zmień status/i })).toBeInTheDocument();
  });

  it("renders footer oznacz jako wydane button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByRole("button", { name: /oznacz jako wydane/i })).toBeInTheDocument();
  });

  it("renders footer wiadomość button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByRole("button", { name: /wiadomość/i })).toBeInTheDocument();
  });

  it("renders footer anuluj button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
    expect(screen.getByRole("button", { name: /anuluj zlecenie/i })).toBeInTheDocument();
  });
});
