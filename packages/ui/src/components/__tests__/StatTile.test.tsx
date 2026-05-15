import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatTile } from "../StatTile";

describe("StatTile", () => {
  it("renders label", () => {
    render(<StatTile label="W realizacji" value="14" accent="#d8ff3a" />);
    expect(screen.getByText("W realizacji")).toBeInTheDocument();
  });

  it("renders value", () => {
    render(<StatTile label="Przychód" value="18 240 zł" accent="#d8ff3a" />);
    expect(screen.getByText("18 240 zł")).toBeInTheDocument();
  });

  it("renders sub when provided", () => {
    render(<StatTile label="x" value="0" sub="↑ 3 vs zeszły tydzień" accent="#d8ff3a" />);
    expect(screen.getByText("↑ 3 vs zeszły tydzień")).toBeInTheDocument();
  });

  it("does not render sub when omitted", () => {
    const { container } = render(<StatTile label="x" value="0" accent="#d8ff3a" />);
    // No sub element present
    expect(container.querySelectorAll("[data-sub]").length).toBe(0);
  });

  it("renders the accent colour box with correct background", () => {
    const { container } = render(<StatTile label="x" value="0" accent="#ff2e7e" />);
    // accent decorative element carries the color in style
    const accentEl = container.querySelector("[data-accent]") as HTMLElement;
    expect(accentEl.style.background).toBe("rgb(255, 46, 126)");
  });

  it("has .admin-card wrapper", () => {
    const { container } = render(<StatTile label="x" value="0" accent="#d8ff3a" />);
    expect((container.firstChild as HTMLElement).className).toContain("admin-card");
  });
});
