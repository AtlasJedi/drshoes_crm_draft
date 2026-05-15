import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { I } from "../icons";

const iconKeys = Object.keys(I) as (keyof typeof I)[];

describe("I (icon record)", () => {
  it("exports at least 25 icon keys", () => {
    expect(iconKeys.length).toBeGreaterThanOrEqual(25);
  });

  it("every value is truthy (not null/undefined)", () => {
    for (const key of iconKeys) {
      const el = I[key];
      expect(el, `Icon "${key}" must be truthy`).toBeTruthy();
    }
  });

  it("every icon element renders an svg tag", () => {
    for (const key of iconKeys) {
      const { container } = render(<>{I[key]}</>);
      expect(container.querySelector("svg"), `Icon "${key}" must contain an svg`).toBeTruthy();
    }
  });
});
