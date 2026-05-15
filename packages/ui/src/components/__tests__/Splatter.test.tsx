import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Splatter } from "../Splatter";

describe("Splatter", () => {
  it("renders an svg element", () => {
    const { container } = render(<Splatter color="#d8ff3a" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("sets width and height from size prop", () => {
    const { container } = render(<Splatter color="#d8ff3a" size={180} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("180");
    expect(svg.getAttribute("height")).toBe("180");
  });

  it("uses default size 220 when not specified", () => {
    const { container } = render(<Splatter color="red" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("220");
  });

  it("fills circles with the provided color", () => {
    const { container } = render(<Splatter color="#ff2e7e" />);
    const g = container.querySelector("g");
    expect(g?.getAttribute("fill")).toBe("#ff2e7e");
  });

  it("is absolutely positioned with pointer-events none", () => {
    const { container } = render(<Splatter color="blue" />);
    const svg = container.querySelector("svg")!;
    const style = svg.getAttribute("style") ?? "";
    expect(style).toContain("position: absolute");
    expect(style).toContain("pointer-events: none");
  });
});
