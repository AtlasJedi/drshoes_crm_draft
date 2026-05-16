import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RowQuickActionsMenu } from "../RowQuickActionsMenu";
import type { OrderListRow } from "@/lib/orders/types";

// Mock the child modal/dialog components
vi.mock("../StatusChangeTriggerDialog", () => ({
  StatusChangeTriggerDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="status-trigger-dialog">StatusChangeTriggerDialog</div> : null,
}));
vi.mock("../MessageComposerModal", () => ({
  MessageComposerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="message-composer">MessageComposerModal</div> : null,
}));
vi.mock("../PhotoUploader", () => ({
  PhotoUploader: () => <div data-testid="photo-uploader">PhotoUploader</div>,
}));

// Stub trigger/status fetch used by RowQuickActionsMenu
vi.mock("@/lib/messaging/api", () => ({
  getTriggers: () => Promise.resolve([]),
}));
vi.mock("@/lib/orders/api", () => ({
  changeStatus: () => Promise.resolve({}),
}));
vi.mock("@/lib/locations", () => ({
  listLocations: () => Promise.resolve([]),
  addOrderNote: () => Promise.resolve({}),
}));

const row: OrderListRow = {
  id: "order-abc-123",
  code: "DR-001",
  clientId: "client-xyz",
  status: "PRZYJETE",
  totalPriceCents: 5000,
  currency: "PLN",
  description: "Naprawa buta",
  plannedPickupAt: null,
  version: 0,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  receivedAt: null,
  pickedUpAt: null,
  quotedPriceCents: 0,
  advancePaidCents: 0,
  clientName: "Test Klient",
  location: null,
  urgent: false,
};

describe("RowQuickActionsMenu", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button (three-dot)", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /opcje/i })).toBeInTheDocument();
  });

  it("menu opens on trigger button click", async () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /opcje/i }));
    expect(screen.getByText(/zmień status/i)).toBeInTheDocument();
    expect(screen.getByText(/wyślij wiadomość/i)).toBeInTheDocument();
    expect(screen.getByText(/dodaj zdjęcie/i)).toBeInTheDocument();
  });

  it("clicking Zmień status opens status picker panel", async () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /opcje/i }));
    await user.click(screen.getByText(/zmień status/i));
    // Status picker step should be visible
    expect(screen.getByRole("combobox", { name: /nowy status/i })).toBeInTheDocument();
  });

  it("clicking Wyślij wiadomość opens MessageComposerModal", async () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /opcje/i }));
    await user.click(screen.getByText(/wyślij wiadomość/i));
    expect(screen.getByTestId("message-composer")).toBeInTheDocument();
  });

  it("clicking Dodaj zdjęcie mounts PhotoUploader", async () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /opcje/i }));
    await user.click(screen.getByText(/dodaj zdjęcie/i));
    expect(screen.getByTestId("photo-uploader")).toBeInTheDocument();
  });
});
