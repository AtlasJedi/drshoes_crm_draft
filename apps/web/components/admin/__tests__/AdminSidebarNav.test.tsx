import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminSidebarNav } from "../AdminSidebarNav";

// Default pathname mock — individual tests override via vi.mocked().mockReturnValue()
const mockUsePathname = vi.fn(() => "/admin");

// Mock next/navigation (used by NavLink + MessagesNavItem + ReportIssueButton)
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter:   () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock @opentelemetry/api
vi.mock("@opentelemetry/api", () => ({
  trace: { getActiveSpan: () => ({ spanContext: () => ({ traceId: "abc123" }) }) },
}));

// Mock fetch for health warm-up path
vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true } as Response)));

// Stub navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  configurable: true,
});

describe("AdminSidebarNav", () => {
  it("renders Zgłoś problem button", () => {
    render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
    expect(screen.getByRole("button", { name: /zgłoś problem/i })).toBeTruthy();
  });

  it("opens modal on click", async () => {
    render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeTruthy()
    );
  });

  it("passes user email to the modal", async () => {
    render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() => screen.getByText("misza@drshoes.pl"));
    expect(screen.getByText("misza@drshoes.pl")).toBeTruthy();
  });

  describe("Komunikacja section", () => {
    it("renders Trigery and Szablony wiadomości links", () => {
      render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
      expect(screen.getByRole("link", { name: "Trigery" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Szablony wiadomości" })).toBeTruthy();
    });

    it("highlights Trigery link when on /admin/triggers", () => {
      mockUsePathname.mockReturnValue("/admin/triggers");
      render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
      const link = screen.getByRole("link", { name: "Trigery" });
      expect(link.className).toContain("bg-acid/30");
    });

    it("highlights Trigery link when on a sub-route of /admin/triggers", () => {
      mockUsePathname.mockReturnValue("/admin/triggers/123");
      render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
      const link = screen.getByRole("link", { name: "Trigery" });
      expect(link.className).toContain("bg-acid/30");
    });

    it("highlights Szablony wiadomości link when on /admin/templates", () => {
      mockUsePathname.mockReturnValue("/admin/templates");
      render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
      const link = screen.getByRole("link", { name: "Szablony wiadomości" });
      expect(link.className).toContain("bg-acid/30");
    });

    it("does not highlight Trigery when on /admin/templates", () => {
      mockUsePathname.mockReturnValue("/admin/templates");
      render(<AdminSidebarNav userEmail="misza@drshoes.pl" />);
      const link = screen.getByRole("link", { name: "Trigery" });
      expect(link.className).not.toContain("bg-acid/30");
    });
  });
});
