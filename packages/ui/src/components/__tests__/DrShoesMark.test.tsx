import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DrShoesMark } from "../DrShoesMark";

describe("DrShoesMark", () => {
  it("renders the Dr and Shoes text parts", () => {
    const { container } = render(<DrShoesMark size={1} color="#0a0a0a" accent="#d8ff3a" />);
    expect(container.textContent).toContain("Dr");
    expect(container.textContent).toContain("Shoes");
  });

  it("renders the accent dot as a span with the accent color", () => {
    const { container } = render(<DrShoesMark size={1} color="#0a0a0a" accent="#d8ff3a" />);
    const dot = container.querySelector("span");
    expect(dot?.textContent).toBe(".");
    // JSDOM normalises hex → rgb() in .style, so compare via .style.color
    expect(dot?.style.color).toBe("rgb(216, 255, 58)");
  });

  it("scales font-size by size prop", () => {
    const { container } = render(<DrShoesMark size={0.5} color="#0a0a0a" accent="#d8ff3a" />);
    const inner = container.firstChild as HTMLElement;
    // fontSize = 64 * 0.5 = 32
    expect(inner.style.fontSize).toBe("32px");
  });

  it("applies color to wrapper text", () => {
    const { container } = render(<DrShoesMark size={1} color="#ffffff" accent="#d8ff3a" />);
    const inner = container.firstChild as HTMLElement;
    expect(inner.style.color).toBe("rgb(255, 255, 255)");
  });
});
