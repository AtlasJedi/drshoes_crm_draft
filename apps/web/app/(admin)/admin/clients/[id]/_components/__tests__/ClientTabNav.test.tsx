/**
 * ClientTabNav active-state unit tests.
 * Verifies that the correct tab receives aria-current="page" based on pathname.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock usePathname to return a controllable value
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock next/link — renders a plain <a> in jsdom
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

import { usePathname } from "next/navigation";
import { ClientTabNav } from "../ClientTabNav";

describe("ClientTabNav", () => {
  it("marks Przegląd active on overview route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123");
    render(<ClientTabNav clientId="abc-123" />);
    const przeglad = screen.getByRole("link", { name: /przegląd/i });
    expect(przeglad).toHaveAttribute("aria-current", "page");
    const zlecenia = screen.getByRole("link", { name: /zlecenia/i });
    expect(zlecenia).not.toHaveAttribute("aria-current", "page");
  });

  it("marks Zlecenia active on /zlecenia sub-route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123/zlecenia");
    render(<ClientTabNav clientId="abc-123" />);
    const zlecenia = screen.getByRole("link", { name: /zlecenia/i });
    expect(zlecenia).toHaveAttribute("aria-current", "page");
    const wiadomosci = screen.getByRole("link", { name: /wiadomości/i });
    expect(wiadomosci).not.toHaveAttribute("aria-current", "page");
  });

  it("marks Wiadomości active on /wiadomosci sub-route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123/wiadomosci");
    render(<ClientTabNav clientId="abc-123" />);
    const wiadomosci = screen.getByRole("link", { name: /wiadomości/i });
    expect(wiadomosci).toHaveAttribute("aria-current", "page");
  });

  it("renders all three tab links", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123");
    render(<ClientTabNav clientId="abc-123" />);
    expect(screen.getByRole("link", { name: /przegląd/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /zlecenia/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /wiadomości/i })).toBeInTheDocument();
  });
});
