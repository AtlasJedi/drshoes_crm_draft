import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Stamp } from "../Stamp";

describe("Stamp", () => {
  it("renders children", () => {
    render(<Stamp>dostępne</Stamp>);
    expect(screen.getByText("dostępne")).toBeInTheDocument();
  });

  it("has .stamp base class", () => {
    const { container } = render(<Stamp>x</Stamp>);
    expect((container.firstChild as HTMLElement).className).toContain("stamp");
  });

  it("defaults to stamp-ink color class", () => {
    const { container } = render(<Stamp>x</Stamp>);
    expect((container.firstChild as HTMLElement).className).toContain("stamp-ink");
  });

  it("applies stamp-green class when color=green", () => {
    const { container } = render(<Stamp color="green">x</Stamp>);
    expect((container.firstChild as HTMLElement).className).toContain("stamp-green");
  });

  it("applies stamp-pink class when color=pink", () => {
    const { container } = render(<Stamp color="pink">x</Stamp>);
    expect((container.firstChild as HTMLElement).className).toContain("stamp-pink");
  });

  it("applies stamp-blue class when color=blue", () => {
    const { container } = render(<Stamp color="blue">x</Stamp>);
    expect((container.firstChild as HTMLElement).className).toContain("stamp-blue");
  });

  it("applies custom angle via style", () => {
    const { container } = render(<Stamp angle={0}>x</Stamp>);
    const style = (container.firstChild as HTMLElement).getAttribute("style");
    expect(style).toContain("rotate(0deg)");
  });
});
