import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminSidebarNav } from "../AdminSidebarNav";

// Mock next/navigation (used by NavLink + MessagesNavItem + ReportIssueButton)
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
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
});
