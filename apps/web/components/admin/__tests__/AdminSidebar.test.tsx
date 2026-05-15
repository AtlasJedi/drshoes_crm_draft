import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock AdminSidebarNav — tested separately
vi.mock("../AdminSidebarNav", () => ({
  AdminSidebarNav: ({ userEmail }: { userEmail: string }) => (
    <nav data-testid="sidebar-nav" data-email={userEmail} />
  ),
}));

import { AdminSidebar } from "../AdminSidebar";
import type { MeResponse } from "@/lib/auth/types";

const me: MeResponse = {
  id: "usr-1",
  email: "daniel@drshoes.pl",
  fullName: "Daniel Roj",
  role: "OWNER",
  lastLoginAt: null,
};

describe("AdminSidebar", () => {
  it("renders panel-pracowni subtitle", () => {
    render(<AdminSidebar me={me} />);
    expect(screen.getByText(/panel pracowni/)).toBeInTheDocument();
  });

  it("derives initials from fullName", () => {
    render(<AdminSidebar me={me} />);
    expect(screen.getByText("DR")).toBeInTheDocument();
  });

  it("renders fullName and role in footer", () => {
    render(<AdminSidebar me={me} />);
    expect(screen.getByText("Daniel Roj")).toBeInTheDocument();
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
  });

  it("logout form posts to /logout", () => {
    render(<AdminSidebar me={me} />);
    const form = document.querySelector("form[action='/logout']");
    expect(form).not.toBeNull();
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
  });

  it("passes userEmail to AdminSidebarNav", () => {
    render(<AdminSidebar me={me} />);
    expect(screen.getByTestId("sidebar-nav")).toHaveAttribute(
      "data-email",
      "daniel@drshoes.pl"
    );
  });
});
