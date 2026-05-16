import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// usePathname returns /admin for "Dashboard active" tests
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/admin") }));
vi.mock("@/lib/messaging/useUnreadCount", () => ({ useUnreadCount: vi.fn(() => 3) }));
vi.mock("@/components/admin/ReportIssueButton", () => ({
  ReportIssueButton: () => <button>report</button>,
}));

// Mock @opentelemetry/api
vi.mock("@opentelemetry/api", () => ({
  trace: { getActiveSpan: () => ({ spanContext: () => ({ traceId: "abc123" }) }) },
}));

import { AdminSidebarNav } from "../AdminSidebarNav";
import { usePathname } from "next/navigation";

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

describe("AdminSidebarNav", () => {
  beforeEach(() => mockUsePathname.mockReturnValue("/admin"));

  it("renders four section headings", () => {
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    expect(screen.getByText("PULPIT")).toBeInTheDocument();
    expect(screen.getByText("OPERACJE")).toBeInTheDocument();
    expect(screen.getByText("KOMUNIKACJA")).toBeInTheDocument();
    expect(screen.getByText("SKLEP")).toBeInTheDocument();
  });

  it("Dashboard link is active on /admin", () => {
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    const dashLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashLink.className).toMatch(/active/);
  });

  it("Zamówienia link is not active on /admin", () => {
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    const link = screen.getByRole("link", { name: /zamówienia/i });
    expect(link.className).not.toMatch(/active/);
  });

  it("MessagesNavItem renders unread badge", () => {
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    // badge text = "3"
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("Triggery link label is rendered", () => {
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    expect(screen.getByRole("link", { name: /triggery/i })).toBeInTheDocument();
  });

  it("highlights Triggery link when on /admin/triggers", () => {
    mockUsePathname.mockReturnValue("/admin/triggers");
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    const link = screen.getByRole("link", { name: /triggery/i });
    expect(link.className).toMatch(/active/);
  });

  it("highlights Triggery link when on a sub-route of /admin/triggers", () => {
    mockUsePathname.mockReturnValue("/admin/triggers/123");
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    const link = screen.getByRole("link", { name: /triggery/i });
    expect(link.className).toMatch(/active/);
  });

  it("does not highlight Triggery when on /admin/templates", () => {
    mockUsePathname.mockReturnValue("/admin/templates");
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    const link = screen.getByRole("link", { name: /triggery/i });
    expect(link.className).not.toMatch(/active/);
  });

  it("renders KONFIGURACJA section with Miejsca link", () => {
    mockUsePathname.mockReturnValue("/admin/settings/miejsca");
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    expect(screen.getByText("KONFIGURACJA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /miejsca/i })).toHaveAttribute(
      "href",
      "/admin/settings/miejsca"
    );
  });

  it("marks Miejsca active when on the route", () => {
    mockUsePathname.mockReturnValue("/admin/settings/miejsca");
    render(<AdminSidebarNav userEmail="x@x.pl" />);
    expect(screen.getByRole("link", { name: /miejsca/i })).toHaveClass("active");
  });
});
