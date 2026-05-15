// apps/web/app/(public)/_components/__tests__/StickyNav.test.tsx
// Vitest + RTL unit tests for StickyNav.

import React from "react";
import { render, screen } from "@testing-library/react";
import { StickyNav } from "../StickyNav";

describe("StickyNav", () => {
  it("renders without crashing (snapshot)", () => {
    const { container } = render(<StickyNav />);
    expect(container).toMatchSnapshot();
  });

  it("has Aktualności link pointing to #aktualnosci", () => {
    render(<StickyNav />);
    const link = screen.getByRole("link", { name: /aktualności/i });
    expect(link).toHaveAttribute("href", "#aktualnosci");
  });

  it("has Sklep link pointing to #sklep", () => {
    render(<StickyNav />);
    const link = screen.getByRole("link", { name: /sklep/i });
    expect(link).toHaveAttribute("href", "#sklep");
  });

  it("has Kontakt link pointing to #kontakt", () => {
    render(<StickyNav />);
    const link = screen.getByRole("link", { name: /kontakt/i });
    expect(link).toHaveAttribute("href", "#kontakt");
  });

  it("has CTA button linking to #zamow", () => {
    render(<StickyNav />);
    const link = screen.getByRole("link", { name: /zamów/i });
    expect(link).toHaveAttribute("href", "#zamow");
  });
});
