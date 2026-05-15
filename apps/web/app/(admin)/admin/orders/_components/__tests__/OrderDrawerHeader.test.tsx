/**
 * Tests for OrderDrawerHeader reskin (task 9-27).
 * Verifies code display, client sub-line, Pill, and action buttons.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDrawerHeader } from "../OrderDrawerHeader";

// @repo/ui is a workspace package not aliased in vitest — stub it out.
vi.mock("@repo/ui", () => ({
  Pill: ({ status }: { status: string }) => <span data-testid="pill">{status}</span>,
  I: {
    close: () => <svg data-testid="icon-close" />,
    more: () => <svg data-testid="icon-more" />,
  },
}));

// Minimal Radix Dialog context wrapper (Dialog.Close needs Dialog.Root)
import * as Dialog from "@radix-ui/react-dialog";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <Dialog.Root open>{children}</Dialog.Root>;
}

describe("OrderDrawerHeader — reskin (task 9-27)", () => {
  it("renders order code", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="W_REALIZACJI" />
      </Wrapper>,
    );
    expect(screen.getByText("DR-1042")).toBeInTheDocument();
  });

  it("renders client name in sub-line when provided", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader
          code="DR-1042"
          status="W_REALIZACJI"
          clientName="Jan Kowalski"
          receivedAt="2026-05-02T12:00:00Z"
        />
      </Wrapper>,
    );
    expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
    expect(screen.getByText(/przyjęte/)).toBeInTheDocument();
  });

  it("renders close button with aria-label", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="PRZYJETE" />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });

  it("renders more button with aria-label", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="PRZYJETE" />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: "Więcej opcji" })).toBeInTheDocument();
  });

  it("does not render sub-line when neither clientName nor receivedAt given", () => {
    const { container } = render(
      <Wrapper>
        <OrderDrawerHeader code="DR-0001" status="PRZYJETE" />
      </Wrapper>,
    );
    // sub div uses t-mono class — should be absent
    expect(container.querySelector(".t-mono")).toBeNull();
  });
});
