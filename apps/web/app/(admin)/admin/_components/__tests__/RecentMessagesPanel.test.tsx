import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/messaging/api-server", () => ({
  listThreadsServer: vi.fn(),
}));

import { listThreadsServer } from "@/lib/messaging/api-server";
import { RecentMessagesPanel } from "../RecentMessagesPanel";
import type { MessageThreadDto } from "@/lib/messaging/types";

const mockListThreads = listThreadsServer as ReturnType<typeof vi.fn>;

const THREADS: MessageThreadDto[] = [
  {
    id: "thr-1",
    clientId: "cli-1",
    rawSender: null,
    channel: "WHATSAPP",
    subject: null,
    lastMessageAt: "2026-05-10T09:46:00Z",
    unreadCount: 1,
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-10T09:46:00Z",
    lastMessagePreview: "Hej, kiedy mogę odebrać moje 1460?",
    unmatched: false,
    clientName: "Magdalena K.",
    clientEmail: null,
    clientPhone: null,
    discardedAt: null,
  },
];

describe("RecentMessagesPanel", () => {
  it("renders heading", async () => {
    mockListThreads.mockResolvedValueOnce(THREADS);
    render(await RecentMessagesPanel());
    expect(screen.getByText("Ostatnie wiadomości")).toBeInTheDocument();
  });

  it("renders client name and message preview", async () => {
    mockListThreads.mockResolvedValueOnce(THREADS);
    render(await RecentMessagesPanel());
    expect(screen.getByText("Magdalena K.")).toBeInTheDocument();
    expect(screen.getByText("Hej, kiedy mogę odebrać moje 1460?")).toBeInTheDocument();
  });

  it("renders unread badge for unread threads", async () => {
    mockListThreads.mockResolvedValueOnce(THREADS);
    const { container } = render(await RecentMessagesPanel());
    expect(container.querySelector("[data-testid='unread-dot']")).not.toBeNull();
  });

  it("renders empty state when no threads", async () => {
    mockListThreads.mockResolvedValueOnce([]);
    render(await RecentMessagesPanel());
    expect(screen.getByText("Brak nowych wiadomości")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockListThreads.mockRejectedValueOnce(new Error("network error"));
    render(await RecentMessagesPanel());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
