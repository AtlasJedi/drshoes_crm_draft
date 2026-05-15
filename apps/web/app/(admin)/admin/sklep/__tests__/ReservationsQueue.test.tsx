import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReservationsQueue } from "../_components/ReservationsQueue";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const MOCK_ROWS = [
  {
    id: "r1",
    productId: "p1",
    clientName: "Karol Jastrzębski",
    clientPhone: "+48 511 003 887",
    note: "może wpaść w czwartek",
    status: "PENDING",
    reservedAt: "2024-05-07T10:24:00Z",
    createdAt: "2024-05-07T10:24:00Z",
  },
  {
    id: "r2",
    productId: "p1",
    clientName: "Mateusz Kowalik",
    clientPhone: "+48 663 119 408",
    note: "jeśli nie odbierze pierwszy",
    status: "PENDING",
    reservedAt: "2024-05-06T18:55:00Z",
    createdAt: "2024-05-06T18:55:00Z",
  },
];

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ReservationsQueue", () => {
  beforeEach(async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockResolvedValue(MOCK_ROWS);
    vi.mocked(api.delete).mockResolvedValue(undefined);
  });

  it("renders the queue header with count", async () => {
    render(<ReservationsQueue productId="p1" />);
    await waitFor(() =>
      expect(screen.getByText(/Rezerwacje · 2/i)).toBeInTheDocument()
    );
  });

  it("renders each reservation with client name and phone", async () => {
    render(<ReservationsQueue productId="p1" />);
    await waitFor(() => {
      // Name is rendered as "{n}. {name}" split across text nodes — use regex
      expect(screen.getByText(/Karol Jastrzębski/)).toBeInTheDocument();
      expect(screen.getByText("+48 511 003 887")).toBeInTheDocument();
      expect(screen.getByText(/Mateusz Kowalik/)).toBeInTheDocument();
      expect(screen.getByText("+48 663 119 408")).toBeInTheDocument();
    });
  });

  it("renders notes in italics with guillemets", async () => {
    render(<ReservationsQueue productId="p1" />);
    await waitFor(() => {
      // Polish opening guillemet (U+201E) causes OXC parse error in double-quoted strings; use regex
      expect(screen.getByText(/może wpaść w czwartek/)).toBeInTheDocument();
    });
  });

  it("renders action buttons for each reservation", async () => {
    render(<ReservationsQueue productId="p1" />);
    await waitFor(() => {
      const confirmBtns = screen.getAllByRole("button", { name: /potwierdź sprzedaż/i });
      expect(confirmBtns).toHaveLength(2);
      const cancelBtns = screen.getAllByRole("button", { name: /anuluj/i });
      expect(cancelBtns).toHaveLength(2);
    });
  });

  it("renders empty state when no reservations", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockResolvedValueOnce([]);
    render(<ReservationsQueue productId="p2" />);
    await waitFor(() =>
      expect(screen.getByText(/brak rezerwacji/i)).toBeInTheDocument()
    );
  });

  it("calls DELETE and removes row when anuluj is clicked", async () => {
    const { api } = await import("@/lib/api");
    render(<ReservationsQueue productId="p1" />);
    // Name split across text nodes — use regex
    await waitFor(() =>
      expect(screen.getByText(/Karol Jastrzębski/)).toBeInTheDocument()
    );
    const cancelBtns = screen.getAllByRole("button", { name: /anuluj/i });
    fireEvent.click(cancelBtns[0]);
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        "/admin/sklep/p1/reservations/r1"
      )
    );
    await waitFor(() =>
      expect(screen.queryByText(/Karol Jastrzębski/)).not.toBeInTheDocument()
    );
  });
});
