// apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNotes.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OrderDrawerNotes } from "../OrderDrawerNotes";

vi.mock("@/lib/timeline/api", () => ({
  getOrderTimeline: vi.fn(),
}));

import { getOrderTimeline } from "@/lib/timeline/api";
const mockGetTimeline = vi.mocked(getOrderTimeline);

const NOTE_EVENTS = [
  {
    id: "e1", kind: "STATUS_CHANGED", occurredAt: "2026-05-02T14:32:00Z",
    actorFullName: "Tomek", labels: {}, note: "Klientka prosiła o oryginalny szew żółty",
  },
  {
    id: "e2", kind: "STATUS_CHANGED", occurredAt: "2026-05-03T09:10:00Z",
    actorFullName: "Daniel", labels: {}, note: "Powiedziałem że odbiór możliwy 8.05",
  },
] as const;

describe("OrderDrawerNotes", () => {
  beforeEach(() => { mockGetTimeline.mockReset(); });

  it("renders sticky notes from timeline events with notes", async () => {
    mockGetTimeline.mockResolvedValue([...NOTE_EVENTS]);
    render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/oryginalny szew/i)).toBeInTheDocument());
    expect(screen.getByText(/Powiedziałem/i)).toBeInTheDocument();
  });

  it("first note has rotate(-0.3deg), second note has rotate(0.4deg)", async () => {
    mockGetTimeline.mockResolvedValue([...NOTE_EVENTS]);
    const { container } = render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/oryginalny szew/i)).toBeInTheDocument());
    const cards = container.querySelectorAll("[data-note-card]");
    expect(cards[0].getAttribute("style")).toMatch(/-0\.3/);
    expect(cards[1].getAttribute("style")).toMatch(/0\.4/);
  });

  it("renders empty state when no notes exist", async () => {
    mockGetTimeline.mockResolvedValue([]);
    render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
    await waitFor(() =>
      expect(screen.getByText(/brak notatek/i)).toBeInTheDocument(),
    );
  });

  it("filters out timeline events without a note", async () => {
    mockGetTimeline.mockResolvedValue([
      { id: "e0", kind: "ORDER_CREATED", occurredAt: "2026-05-01T10:00:00Z",
        actorFullName: null, labels: {}, note: null },
      ...NOTE_EVENTS,
    ]);
    const { container } = render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
    await waitFor(() => expect(container.querySelectorAll("[data-note-card]").length).toBe(2));
  });
});
