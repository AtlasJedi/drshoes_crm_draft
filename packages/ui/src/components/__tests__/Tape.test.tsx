import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Tape } from "../Tape";

describe("Tape", () => {
  it("renders children", () => {
    render(<Tape>hello</Tape>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("defaults to acid color class", () => {
    const { container } = render(<Tape>x</Tape>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("tape");
    expect(el.className).not.toContain("tape-pink");
    expect(el.className).not.toContain("tape-blue");
  });

  it("applies tape-pink class when color=pink", () => {
    const { container } = render(<Tape color="pink">y</Tape>);
    expect((container.firstChild as HTMLElement).className).toContain("tape-pink");
  });

  it("applies tape-blue class when color=blue", () => {
    const { container } = render(<Tape color="blue">z</Tape>);
    expect((container.firstChild as HTMLElement).className).toContain("tape-blue");
  });

  it("applies tape-paper class when color=paper", () => {
    const { container } = render(<Tape color="paper">w</Tape>);
    expect((container.firstChild as HTMLElement).className).toContain("tape-paper");
  });

  it("applies custom angle via style", () => {
    const { container } = render(<Tape angle={3}>a</Tape>);
    const style = (container.firstChild as HTMLElement).getAttribute("style");
    expect(style).toContain("rotate(3deg)");
  });
});
