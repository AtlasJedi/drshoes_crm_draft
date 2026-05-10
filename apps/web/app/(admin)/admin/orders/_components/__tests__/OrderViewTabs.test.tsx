import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderViewTabs } from "../OrderViewTabs";

// next/link renders an <a> in tests
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("OrderViewTabs", () => {
  it("renders three tabs: Lista, Kalendarz, Kanban", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Lista")).toBeInTheDocument();
    expect(screen.getByText("Kalendarz")).toBeInTheDocument();
    expect(screen.getByText("Kanban")).toBeInTheDocument();
  });

  it("highlights the active tab with aria-current=page", () => {
    render(<OrderViewTabs active="calendar" />);
    const calTab = screen.getByText("Kalendarz").closest("a")!;
    expect(calTab).toHaveAttribute("aria-current", "page");
  });

  it("non-active tabs do not carry aria-current", () => {
    render(<OrderViewTabs active="list" />);
    const calTab = screen.getByText("Kalendarz").closest("a")!;
    expect(calTab).not.toHaveAttribute("aria-current");
  });

  it("Lista tab points to /admin/orders", () => {
    render(<OrderViewTabs active="kanban" />);
    expect(screen.getByText("Lista").closest("a")).toHaveAttribute("href", "/admin/orders");
  });

  it("Kalendarz tab points to /admin/orders/calendar", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Kalendarz").closest("a")).toHaveAttribute(
      "href",
      "/admin/orders/calendar",
    );
  });

  it("Kanban tab points to /admin/orders/kanban", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Kanban").closest("a")).toHaveAttribute(
      "href",
      "/admin/orders/kanban",
    );
  });
});
