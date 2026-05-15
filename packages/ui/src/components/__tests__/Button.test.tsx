import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Zamów</Button>);
    expect(screen.getByText("Zamów")).toBeInTheDocument();
  });

  it("primary variant has .btn class and no colour modifier", () => {
    const { container } = render(<Button variant="primary">x</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("btn");
    expect(el.className).not.toContain("btn-acid");
  });

  it("acid variant has .btn-acid class", () => {
    const { container } = render(<Button variant="acid">x</Button>);
    expect((container.firstChild as HTMLElement).className).toContain("btn-acid");
  });

  it("pink variant has .btn-pink class", () => {
    const { container } = render(<Button variant="pink">x</Button>);
    expect((container.firstChild as HTMLElement).className).toContain("btn-pink");
  });

  it("paper variant has .btn-paper class", () => {
    const { container } = render(<Button variant="paper">x</Button>);
    expect((container.firstChild as HTMLElement).className).toContain("btn-paper");
  });

  it("ghost variant has .btn-ghost class", () => {
    const { container } = render(<Button variant="ghost">x</Button>);
    expect((container.firstChild as HTMLElement).className).toContain("btn-ghost");
  });

  it("sm size adds .btn-sm class", () => {
    const { container } = render(<Button size="sm">x</Button>);
    expect((container.firstChild as HTMLElement).className).toContain("btn-sm");
  });

  it("calls onClick handler", () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>click</Button>);
    fireEvent.click(screen.getByText("click"));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("renders as <button> by default", () => {
    const { container } = render(<Button>x</Button>);
    expect(container.firstChild?.nodeName).toBe("BUTTON");
  });

  it("renders as <a> when href provided", () => {
    const { container } = render(<Button href="/test">link</Button>);
    expect(container.firstChild?.nodeName).toBe("A");
  });
});
