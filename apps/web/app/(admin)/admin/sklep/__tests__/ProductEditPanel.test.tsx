import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProductEditPanel } from "../_components/ProductEditPanel";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const PRODUCT = {
  id: "p1",
  name: "AF1 Mid 'Bandana'",
  brand: "Nike",
  size: "EU 43",
  pricePln: "990 zł",
  status: "dostępne" as const,
  reservationsCount: 0,
  photos: [] as string[],
  description: "Custom AF1",
};

describe("ProductEditPanel", () => {
  it("renders Tape header with product name", () => {
    render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
    expect(screen.getByText(/edytujesz · AF1 Mid 'Bandana'/i)).toBeInTheDocument();
  });

  it("renders form fields (name, brand, size, cena)", () => {
    render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/nazwa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/marka/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rozmiar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cena/i)).toBeInTheDocument();
  });

  it("renders status chip row", () => {
    render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
    expect(screen.getByText("dostępne")).toBeInTheDocument();
    expect(screen.getByText("zarezerwowane")).toBeInTheDocument();
    expect(screen.getByText("sprzedane")).toBeInTheDocument();
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<ProductEditPanel product={PRODUCT} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
