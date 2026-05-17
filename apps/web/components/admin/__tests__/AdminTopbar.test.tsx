import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockPathname = "/admin/dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname,
}));

import { AdminTopbar } from "../AdminTopbar";
import { PageHeaderProvider, usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockPathname = "/admin/dashboard";
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

  it("pushes to /admin/orders?q=… on Enter when NOT on orders page", () => {
    mockPathname = "/admin/dashboard";
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

  it("pushes to /admin/orders on Enter when query is empty and NOT on orders page", () => {
    mockPathname = "/admin/dashboard";
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    const input = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/admin/orders");
  });

  it("uses router.replace on Enter when ON the orders page", () => {
    mockPathname = "/admin/orders";
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    const input = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.change(input, { target: { value: "but" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("q=but"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("debounces live filter on orders page after 250ms", async () => {
    vi.useFakeTimers();
    mockPathname = "/admin/orders";
    render(
      <PageHeaderProvider>
        <AdminTopbar />
      </PageHeaderProvider>
    );
    const input = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.change(input, { target: { value: "Jan" } });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("q=Jan"));
    vi.useRealTimers();
  });
});
