import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AdminCard } from "../AdminCard";

describe("AdminCard", () => {
  it("renders children", () => {
    render(<AdminCard>content here</AdminCard>);
    expect(screen.getByText("content here")).toBeInTheDocument();
  });

  it("has .admin-card class", () => {
    const { container } = render(<AdminCard>x</AdminCard>);
    expect((container.firstChild as HTMLElement).className).toContain("admin-card");
  });

  it("applies padding style when padding prop provided", () => {
    const { container } = render(<AdminCard padding={18}>x</AdminCard>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe("18px");
  });

  it("has no inline padding when padding prop omitted", () => {
    const { container } = render(<AdminCard>x</AdminCard>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe("");
  });
});
