// apps/web/app/(public)/_components/__tests__/SklepTeaser.test.tsx
// Vitest + RTL unit tests for SklepTeaser.

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SklepTeaser } from "../SklepTeaser";

describe("SklepTeaser", () => {
  it("matches snapshot", () => {
    const { container } = render(<SklepTeaser />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders 4 product tiles", () => {
    const { container } = render(<SklepTeaser />);
    expect(container.querySelectorAll('[data-testid="product-tile"]').length).toBe(4);
  });

  it("renders filter pill for Nike", () => {
    render(<SklepTeaser />);
    expect(screen.getByRole("button", { name: "Nike" })).toBeInTheDocument();
  });

  it("renders filter pill for Vans", () => {
    render(<SklepTeaser />);
    expect(screen.getByRole("button", { name: "Vans" })).toBeInTheDocument();
  });

  it("renders the notice box with payment info", () => {
    render(<SklepTeaser />);
    expect(screen.getByText(/Płatność i odbiór wyłącznie/i)).toBeInTheDocument();
  });

  it("renders 5 filter buttons total", () => {
    render(<SklepTeaser />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
  });

  it("renders the filtruj: label", () => {
    render(<SklepTeaser />);
    expect(screen.getByText(/filtruj:/i)).toBeInTheDocument();
  });

  it("each product tile has a stamp", () => {
    const { container } = render(<SklepTeaser />);
    const tiles = container.querySelectorAll('[data-testid="product-tile"]');
    tiles.forEach((tile) => {
      expect(tile.querySelector(".stamp")).not.toBeNull();
    });
  });
});
