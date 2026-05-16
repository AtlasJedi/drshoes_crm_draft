import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ClientDto, Page } from "@/lib/clients/types";

// Mock next/link — renders a plain <a>
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

function makePage(clients: Partial<ClientDto>[]): Page<ClientDto> {
  const full: ClientDto[] = clients.map((c, i) => ({
    id: c.id ?? `id-${i}`,
    firstName: c.firstName ?? "Jan",
    lastName: c.lastName ?? "Kowalski",
    phone: c.phone ?? null,
    email: c.email ?? null,
    preferredChannel: c.preferredChannel ?? null,
    notes: null,
    rodoConsentAt: c.rodoConsentAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  return { content: full, totalElements: full.length, totalPages: 1, number: 0, size: 20, last: true };
}

describe("ClientListTable", () => {
  it("renders client lastName + firstName in row", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Anna", lastName: "Nowak" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/Nowak/)).toBeInTheDocument();
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
  });

  it("links each row to /admin/clients/{id}", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ id: "abc-123", firstName: "Jan", lastName: "Test" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    const link = screen.getByRole("link", { name: /Test/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("abc-123"));
  });

  it("renders green RODO pill when rodoConsentAt set", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: "2026-04-15T10:00:00Z" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/zgoda/i)).toBeInTheDocument();
  });

  it("renders amber RODO pill when rodoConsentAt null", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: null }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/brak zgody/i)).toBeInTheDocument();
  });

  it("shows channel pill SMS", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ preferredChannel: "SMS" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText("SMS")).toBeInTheDocument();
  });

  it("shows pagination when totalPages > 1", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page: Page<ClientDto> = {
      content: [],
      totalElements: 40,
      totalPages: 2,
      number: 0,
      size: 20,
      last: false,
    };
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/Następna/i)).toBeInTheDocument();
  });

  it("does not show pagination when only one page", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Ewa" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.queryByText(/Następna/i)).not.toBeInTheDocument();
  });

  it("table root has .tbl class", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Test" }]);
    const { container } = render(<ClientListTable page={page} currentPage={0} q="" />);
    const table = container.querySelector("table");
    expect(table).toHaveClass("tbl");
  });

  it("renders <RodoBadge> data-testid not inline pill", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: "2026-04-01T00:00:00Z" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByTestId("rodo-badge")).toBeInTheDocument();
  });

  it("channel cell uses .chip class", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ preferredChannel: "EMAIL" }]);
    const { container } = render(<ClientListTable page={page} currentPage={0} q="" />);
    const chip = container.querySelector(".chip");
    expect(chip).toBeInTheDocument();
  });
});
