/**
 * Smoke tests for OrderDrawer rip-and-replace (task v2-F).
 * Verifies the new component tree renders and footer action buttons are present.
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
vi.mock("../OrderDrawerInfoBlock", () => ({
  OrderDrawerInfoBlock: () => <div data-testid="info-block" />,
}));
vi.mock("../OrderDrawerOpis", () => ({
  OrderDrawerOpis: () => <div data-testid="opis" />,
}));
vi.mock("../OrderDrawerStatusGrid", () => ({
  OrderDrawerStatusGrid: () => <div data-testid="status-grid" />,
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
  urgent: false,
};

describe("OrderDrawer — rip-and-replace (task v2-F)", () => {
  it("renders DR-code in header", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByText("DR-1042")).toBeInTheDocument();
  });

  it("renders client name in header", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByText(/Magdalena Kowalska/i)).toBeInTheDocument();
  });

  it("renders new info-block component", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByTestId("info-block")).toBeInTheDocument();
  });

  it("renders new status-grid component", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByTestId("status-grid")).toBeInTheDocument();
  });

  it("renders footer oznacz jako wydane button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByRole("button", { name: /oznacz jako wydane/i })).toBeInTheDocument();
  });

  it("renders footer wiadomość button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByRole("button", { name: /wiadomość/i })).toBeInTheDocument();
  });

  it("renders footer anuluj button", () => {
    render(<OrderDrawer initialOrder={MOCK_ORDER} />);
    expect(screen.getByRole("button", { name: /anuluj zlecenie/i })).toBeInTheDocument();
  });
});
