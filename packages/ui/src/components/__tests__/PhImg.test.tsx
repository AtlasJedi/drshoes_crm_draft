import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PhImg } from "../PhImg";

describe("PhImg", () => {
  it("renders label text", () => {
    render(<PhImg label="ZDJĘCIE" />);
    expect(screen.getByText("ZDJĘCIE")).toBeInTheDocument();
  });

  it("defaults label to IMG when not specified", () => {
    render(<PhImg />);
    expect(screen.getByText("IMG")).toBeInTheDocument();
  });

  it("has .ph-img base class", () => {
    const { container } = render(<PhImg label="x" />);
    expect((container.firstChild as HTMLElement).className).toContain("ph-img");
  });

  it("adds .dark class when dark=true", () => {
    const { container } = render(<PhImg label="x" dark />);
    expect((container.firstChild as HTMLElement).className).toContain("dark");
  });

  it("does not add .dark class when dark=false", () => {
    const { container } = render(<PhImg label="x" dark={false} />);
    expect((container.firstChild as HTMLElement).className).not.toContain("dark");
  });

  it("passes through style prop", () => {
    const { container } = render(<PhImg label="x" style={{ width: 80, height: 80 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("80px");
    expect(el.style.height).toBe("80px");
  });

  it("passes through aspectRatio style", () => {
    const { container } = render(<PhImg label="x" aspectRatio="4/3" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.aspectRatio).toBe("4/3");
  });
});
