import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/messaging/useUnreadCount", () => ({
  useUnreadCount: vi.fn(() => 0),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AdminTopbar } from "../AdminTopbar";
import { PageHeaderProvider, usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { useUnreadCount } from "@/lib/messaging/useUnreadCount";

const mockUnread = useUnreadCount as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockPush.mockReset();
});

function PageSetter({ title, subtitle }: { title: string; subtitle?: string }) {
  usePageHeader({ title, subtitle });
  return null;
}

describe("AdminTopbar", () => {
  it("renders title from context", () => {
    render(
      <PageHeaderProvider>
        <PageSetter title="Dashboard" />
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders subtitle from context", () => {
    render(
      <PageHeaderProvider>
        <PageSetter title="Dashboard" subtitle="czwartek · 7 maja 2026" />
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(screen.getByText("czwartek · 7 maja 2026")).toBeInTheDocument();
  });

  it("renders search input with placeholder", () => {
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(screen.getByPlaceholderText(/szukaj/i)).toBeInTheDocument();
  });

  it("renders cmd-K hint", () => {
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("does NOT render pink dot when unread = 0", () => {
    mockUnread.mockReturnValue(0);
    const { container } = render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(container.querySelector("[data-testid='bell-dot']")).toBeNull();
  });

  it("renders pink dot when unread > 0", () => {
    mockUnread.mockReturnValue(5);
    const { container } = render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    expect(container.querySelector("[data-testid='bell-dot']")).not.toBeNull();
  });

  it("pushes to /admin/orders?q=… on Enter with trimmed query", () => {
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    const input = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.change(input, { target: { value: "  Anna Nowak  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/admin/orders?q=Anna%20Nowak");
  });

  it("pushes to /admin/orders on Enter when query is empty", () => {
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    const input = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/admin/orders");
  });
});
