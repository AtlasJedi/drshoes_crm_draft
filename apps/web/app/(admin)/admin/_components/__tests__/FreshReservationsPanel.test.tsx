import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FreshReservationsPanel } from "../FreshReservationsPanel";

// api is imported by the component — mock it so tests stay synchronous/prop-driven
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const PLACEHOLDER_ROWS = [
  { id: "res-1", clientName: "Karol J.",  productName: "AF1 Mid 'Bandana'",    when: "dziś · 10:24"     },
  { id: "res-2", clientName: "Iga S.",    productName: "Vans Authentic 'Drip'", when: "wczoraj · 19:01" },
  { id: "res-3", clientName: "Adam W.",   productName: "Jordan 1 'Tag'",        when: "wczoraj · 14:50" },
];

describe("FreshReservationsPanel", () => {
  it("renders heading", () => {
    render(<FreshReservationsPanel rows={PLACEHOLDER_ROWS} />);
    expect(screen.getByText("Świeże rezerwacje")).toBeInTheDocument();
  });

  it("renders placeholder reservation client names", () => {
    render(<FreshReservationsPanel rows={PLACEHOLDER_ROWS} />);
    expect(screen.getByText("Karol J.")).toBeInTheDocument();
    expect(screen.getByText("Iga S.")).toBeInTheDocument();
    expect(screen.getByText("Adam W.")).toBeInTheDocument();
  });

  it("renders 'otwórz' buttons for each row", () => {
    render(<FreshReservationsPanel rows={PLACEHOLDER_ROWS} />);
    const buttons = screen.getAllByRole("button", { name: /otwórz/i });
    expect(buttons).toHaveLength(3);
  });

  it("renders product names", () => {
    render(<FreshReservationsPanel rows={PLACEHOLDER_ROWS} />);
    expect(screen.getByText("AF1 Mid 'Bandana'")).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    render(<FreshReservationsPanel rows={[]} />);
    expect(screen.getByText("Brak rezerwacji")).toBeInTheDocument();
  });
});
