import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageBubble } from "../MessageBubble";
import type { MessageDto } from "@/lib/messaging/types";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/messaging/api", () => ({
  retryMessage: vi.fn().mockResolvedValue(undefined),
}));

const baseMessage: MessageDto = {
  id: "msg-1",
  threadId: "thread-1",
  orderId: "order-1",
  clientId: "client-1",
  direction: "OUTBOUND",
  channel: "EMAIL",
  templateId: null,
  triggerId: null,
  subject: null,
  body: "Hello\nworld",
  deliveryStatus: "DELIVERED",
  providerMessageId: null,
  sentAt: "2024-05-01T10:00:00Z",
  createdAt: "2024-05-01T10:00:00Z",
  errorCode: null,
  errorMessage: null,
  retryOfMessageId: null,
  retryAttempt: 0,
};

describe("MessageBubble", () => {
  it("renders bubble with whitespace-pre-wrap and break-words classes", () => {
    const { container } = render(
      <MessageBubble message={baseMessage} clientName="Jan Kowalski" />
    );
    // The inner bubble div carries both layout classes
    const bubble = container.querySelector(".whitespace-pre-wrap.break-words");
    expect(bubble).not.toBeNull();
  });

  it("renders wrapper with max-w-[min(78%,640px)] class", () => {
    const { container } = render(
      <MessageBubble message={baseMessage} clientName="Jan Kowalski" />
    );
    const wrapper = container.querySelector(".max-w-\\[min\\(78\\%\\,640px\\)\\]");
    expect(wrapper).not.toBeNull();
  });

  it("renders message body text", () => {
    const { container } = render(
      <MessageBubble message={baseMessage} clientName="Jan Kowalski" />
    );
    // RTL normalises whitespace in getByText — use container query to check raw text content
    const bubble = container.querySelector(".whitespace-pre-wrap.break-words");
    expect(bubble?.textContent).toBe("Hello\nworld");
  });

  it("renders INBOUND bubble on left side", () => {
    const msg: MessageDto = { ...baseMessage, direction: "INBOUND" };
    const { container } = render(
      <MessageBubble message={msg} clientName="Jan Kowalski" />
    );
    const outer = container.querySelector(".justify-start");
    expect(outer).not.toBeNull();
  });

  it("renders OUTBOUND bubble on right side", () => {
    const { container } = render(
      <MessageBubble message={baseMessage} clientName={null} />
    );
    const outer = container.querySelector(".justify-end");
    expect(outer).not.toBeNull();
  });

  it("shows retry button when deliveryStatus is FAILED for OUTBOUND", () => {
    const msg: MessageDto = { ...baseMessage, deliveryStatus: "FAILED", errorMessage: "timeout" };
    render(<MessageBubble message={msg} clientName={null} />);
    expect(screen.getByRole("button", { name: /wyślij ponownie/i })).toBeInTheDocument();
  });

  it("does not show retry button for INBOUND messages", () => {
    const msg: MessageDto = { ...baseMessage, direction: "INBOUND", deliveryStatus: "FAILED" };
    render(<MessageBubble message={msg} clientName="Jan" />);
    expect(screen.queryByRole("button", { name: /wyślij ponownie/i })).toBeNull();
  });
});
