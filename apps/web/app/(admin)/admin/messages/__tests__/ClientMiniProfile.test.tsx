import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientMiniProfile } from "../_components/ClientMiniProfile";

vi.mock("@/lib/clients/api", () => ({
  getClient: vi.fn().mockResolvedValue({
    id: "c1",
    firstName: "Magdalena",
    lastName: "Kowalska",
    phone: "+48 602 113 224",
    email: "m.kowalska@example.com",
    preferredChannel: "WHATSAPP",
    createdAt: "2024-03-15T10:00:00Z",
    updatedAt: "2024-03-15T10:00:00Z",
    notes: null,
    rodoConsentAt: null,
  }),
}));

vi.mock("@/lib/orders/api", () => ({
  listOrders: vi.fn().mockResolvedValue({
    content: [
      {
        id: "o1",
        code: "DR-1042",
        clientId: "c1",
        clientName: "Magdalena Kowalska",
        status: "W_REALIZACJI",
        totalPriceCents: 0,
        currency: "PLN",
        description: "DM 1460 — Vibram",
        plannedPickupAt: null,
        version: 1,
        updatedAt: "2024-05-01T10:00:00Z",
        createdAt: "2024-04-20T10:00:00Z",
        receivedAt: "2024-04-20T10:00:00Z",
        pickedUpAt: null,
        quotedPriceCents: 0,
        advancePaidCents: 0,
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10,
    last: true,
  }),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("ClientMiniProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty panel when clientId is null", () => {
    render(<ClientMiniProfile clientId={null} />);
    expect(screen.getByText(/wybierz wątek/i)).toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    render(<ClientMiniProfile clientId="c1" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders client identity after load", async () => {
    render(<ClientMiniProfile clientId="c1" />);
    await waitFor(() => expect(screen.getByText("Magdalena Kowalska")).toBeInTheDocument());
    expect(screen.getByText(/klient od 03\.2024/i)).toBeInTheDocument();
  });

  it("renders initials in acid avatar", async () => {
    render(<ClientMiniProfile clientId="c1" />);
    await waitFor(() => expect(screen.getByText("MK")).toBeInTheDocument());
  });

  it("renders contact key-value rows", async () => {
    render(<ClientMiniProfile clientId="c1" />);
    await waitFor(() => {
      expect(screen.getByText("+48 602 113 224")).toBeInTheDocument();
      expect(screen.getByText("m.kowalska@example.com")).toBeInTheDocument();
      expect(screen.getByText("WHATSAPP")).toBeInTheDocument();
    });
  });

  it("renders active orders section with DR code", async () => {
    render(<ClientMiniProfile clientId="c1" />);
    await waitFor(() => {
      expect(screen.getByText("DR-1042")).toBeInTheDocument();
      expect(screen.getByText("DM 1460 — Vibram")).toBeInTheDocument();
    });
  });
});
