import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Sticker } from "../Sticker";

describe("Sticker", () => {
  it("renders children", () => {
    render(<Sticker>@dr_shoes · 38.4k</Sticker>);
    expect(screen.getByText("@dr_shoes · 38.4k")).toBeInTheDocument();
  });

  it("has .sticker class", () => {
    const { container } = render(<Sticker>x</Sticker>);
    expect((container.firstChild as HTMLElement).className).toContain("sticker");
  });

  it("applies default -1deg rotation", () => {
    const { container } = render(<Sticker>x</Sticker>);
    const style = (container.firstChild as HTMLElement).getAttribute("style");
    expect(style).toContain("rotate(-1deg)");
  });

  it("applies custom angle", () => {
    const { container } = render(<Sticker angle={2}>x</Sticker>);
    const style = (container.firstChild as HTMLElement).getAttribute("style");
    expect(style).toContain("rotate(2deg)");
  });
});
