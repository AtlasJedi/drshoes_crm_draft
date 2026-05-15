import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chip } from "../Chip";

describe("Chip", () => {
  it("renders children", () => {
    render(<Chip>tydzień</Chip>);
    expect(screen.getByText("tydzień")).toBeInTheDocument();
  });

  it("has .chip base class", () => {
    const { container } = render(<Chip>x</Chip>);
    expect((container.firstChild as HTMLElement).className).toContain("chip");
  });

  it("adds .active class when active=true", () => {
    const { container } = render(<Chip active>x</Chip>);
    expect((container.firstChild as HTMLElement).className).toContain("active");
  });

  it("does not add .active when active=false", () => {
    const { container } = render(<Chip active={false}>x</Chip>);
    expect((container.firstChild as HTMLElement).className).not.toContain("active");
  });

  it("adds .pink class when color=pink", () => {
    const { container } = render(<Chip color="pink">x</Chip>);
    expect((container.firstChild as HTMLElement).className).toContain("pink");
  });

  it("calls onClick when clicked", () => {
    const handler = vi.fn();
    render(<Chip onClick={handler}>click me</Chip>);
    fireEvent.click(screen.getByText("click me"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renders icon slot if provided", () => {
    render(<Chip icon={<span data-testid="ico" />}>x</Chip>);
    expect(screen.getByTestId("ico")).toBeInTheDocument();
  });
});
