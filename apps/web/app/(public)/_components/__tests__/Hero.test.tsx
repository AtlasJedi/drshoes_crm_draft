// apps/web/app/(public)/_components/__tests__/Hero.test.tsx
// Vitest + RTL unit tests for Hero section.

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Hero } from "../Hero";

describe("Hero", () => {
  it("matches snapshot", () => {
    const { container } = render(<Hero />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the Dr.Shoes headline", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders two Splatter elements", () => {
    const { container } = render(<Hero />);
    const splatters = container.querySelectorAll('[data-testid="splatter"]');
    expect(splatters.length).toBe(2);
  });

  it('"Zamów custom" CTA links to #zamow', () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /Zamów custom/i })
    ).toHaveAttribute("href", "#zamow");
  });

  it('"Oddaj buty do naprawy" CTA links to #zamow', () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /Oddaj buty do naprawy/i })
    ).toHaveAttribute("href", "#zamow");
  });
});
