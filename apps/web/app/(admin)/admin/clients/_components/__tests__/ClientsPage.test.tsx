/**
 * Smoke tests for /admin/clients page.tsx.
 * Because page.tsx is a Server Component (async function), we test it by
 * calling it as an async function and inspecting the rendered output.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub server-side lib modules
vi.mock("@/lib/clients/api-server", () => ({
  listClientsServer: vi.fn().mockResolvedValue({
    content: [
      {
        id: "c-1",
        firstName: "Jan",
        lastName: "Kowalski",
        phone: "+48123456789",
        email: "jan@example.com",
        preferredChannel: "EMAIL",
        notes: null,
        rodoConsentAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
    last: true,
  }),
  searchClientsServer: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ClientsPage", () => {
  it("renders search input (topbar carries Klienci title via usePageHeader)", async () => {
    // The h1 Klienci heading was moved to the topbar via ClientsPageHeaderSetter.
    // Verify the page renders its main content (search box is the first visible element).
    const { default: Page } = await import("../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders client name from list", async () => {
    const { default: Page } = await import("../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByText(/Kowalski/)).toBeInTheDocument();
  });

  it("renders client list table", async () => {
    const { default: Page } = await import("../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(node as React.ReactElement);
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("shows empty state when content is empty", async () => {
    const { listClientsServer } = await import("@/lib/clients/api-server");
    vi.mocked(listClientsServer).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
      last: true,
    });
    const { default: Page } = await import("../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByText(/brak klientów/i)).toBeInTheDocument();
  });
});
