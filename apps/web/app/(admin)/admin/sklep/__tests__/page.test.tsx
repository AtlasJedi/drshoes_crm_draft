import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SklepPage from "../page";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

describe("SklepPage", () => {
  it("renders placeholder card with correct Polish copy", () => {
    render(<SklepPage />);
    expect(screen.getByText("Sklep")).toBeInTheDocument();
    expect(screen.getByText(/do implementacji w przyszłości/i)).toBeInTheDocument();
    expect(screen.getByText(/zarządzane poza panelem/i)).toBeInTheDocument();
  });

  it("renders without console errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SklepPage />);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
