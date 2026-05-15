import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProductCard } from "../_components/ProductCard";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const PRODUCT = {
  id: "p1",
  name: "AF1 Mid 'Bandana'",
  brand: "Nike",
  size: "EU 43",
  pricePln: "990 zł",
  status: "zarezerwowane" as const,
  reservationsCount: 2,
  photos: [] as string[],
  description: "Custom AF1 mid",
};

describe("ProductCard", () => {
  it("renders product name and brand+size", () => {
    render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
    // name appears in both PhImg label and the display div — at least one must exist
    expect(screen.getAllByText("AF1 Mid 'Bandana'").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nike · EU 43/i)).toBeInTheDocument();
  });

  it("renders price", () => {
    render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
    expect(screen.getByText("990 zł")).toBeInTheDocument();
  });

  it("renders reservations counter when status is zarezerwowane", () => {
    render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
    expect(screen.getByText(/2 rezerwacje/i)).toBeInTheDocument();
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    render(<ProductCard product={PRODUCT} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
    expect(onEdit).toHaveBeenCalledWith(PRODUCT);
  });
});
