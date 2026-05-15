import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SklepPage from "../page";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/app/(admin)/admin/_components/PageHeaderContext", () => ({
  usePageHeader: vi.fn(),
}));

describe("SklepPage", () => {
  it("renders the sklep shell (not the placeholder card)", () => {
    render(<SklepPage />);
    expect(screen.queryByText(/do implementacji w przyszłości/i)).not.toBeInTheDocument();
  });

  it("renders filter chips", () => {
    render(<SklepPage />);
    // "wszystkie" appears only in the filter chip row
    expect(screen.getByText(/wszystkie/i)).toBeInTheDocument();
    // "dostępne" appears in both filter chips and Stamp overlays — at least one must exist
    expect(screen.getAllByText(/dostępne/i).length).toBeGreaterThan(0);
  });
});
