// apps/web/app/(public)/_components/__tests__/NewsTeaser.test.tsx
// Vitest + RTL unit tests for NewsTeaser and NewsTeaserCard.

import React from "react";
import { render, screen } from "@testing-library/react";
import { NewsTeaser } from "../NewsTeaser";

describe("NewsTeaser", () => {
  it("renders the aktualnosci tape label", () => {
    render(<NewsTeaser />);
    expect(screen.getByText("aktualności")).toBeInTheDocument();
  });

  it("renders the section heading with 'dzieje'", () => {
    render(<NewsTeaser />);
    expect(screen.getByText(/co się/i)).toBeInTheDocument();
    expect(screen.getByText("dzieje")).toBeInTheDocument();
  });

  it("renders exactly 4 news tiles (1 hero + 3 small)", () => {
    render(<NewsTeaser />);
    const articles = document.querySelectorAll("article");
    expect(articles).toHaveLength(4);
  });

  it("renders the hero tile with Stamp 'świeże'", () => {
    render(<NewsTeaser />);
    expect(screen.getByText("świeże")).toBeInTheDocument();
  });

  it("hero tile title is the first news entry", () => {
    render(<NewsTeaser />);
    expect(screen.getByText(/Świeży drop/i)).toBeInTheDocument();
  });

  it("renders 'Wszystkie wpisy' CTA link", () => {
    render(<NewsTeaser />);
    expect(screen.getByText(/Wszystkie wpisy/)).toBeInTheDocument();
  });

  it("small tiles render their dates", () => {
    render(<NewsTeaser />);
    expect(screen.getByText("02.05.26")).toBeInTheDocument();
    expect(screen.getByText("28.04.26")).toBeInTheDocument();
    expect(screen.getByText("20.04.26")).toBeInTheDocument();
  });
});
