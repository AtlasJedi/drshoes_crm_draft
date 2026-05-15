import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FreshReservationsPanel } from "../FreshReservationsPanel";

describe("FreshReservationsPanel", () => {
  it("renders heading", () => {
    render(<FreshReservationsPanel />);
    expect(screen.getByText("Świeże rezerwacje")).toBeInTheDocument();
  });

  it("renders placeholder reservation client names", () => {
    render(<FreshReservationsPanel />);
    expect(screen.getByText("Karol J.")).toBeInTheDocument();
    expect(screen.getByText("Iga S.")).toBeInTheDocument();
    expect(screen.getByText("Adam W.")).toBeInTheDocument();
  });

  it("renders 'otwórz' buttons for each row", () => {
    render(<FreshReservationsPanel />);
    const buttons = screen.getAllByRole("button", { name: /otwórz/i });
    expect(buttons).toHaveLength(3);
  });

  it("renders product names", () => {
    render(<FreshReservationsPanel />);
    expect(screen.getByText("AF1 Mid 'Bandana'")).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    render(<FreshReservationsPanel rows={[]} />);
    expect(screen.getByText("Brak rezerwacji")).toBeInTheDocument();
  });
});
