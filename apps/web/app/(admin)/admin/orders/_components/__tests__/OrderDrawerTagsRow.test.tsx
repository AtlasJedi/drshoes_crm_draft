// apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerTagsRow.test.tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDrawerTagsRow } from "../OrderDrawerTagsRow";

describe("OrderDrawerTagsRow", () => {
  it("renders a pink chip for 'pilne' tag", () => {
    render(<OrderDrawerTagsRow tags={["pilne"]} />);
    const chip = screen.getByText("pilne").closest("[data-color]");
    expect(chip?.getAttribute("data-color")).toBe("pink");
  });

  it("renders default chip for non-pilne tag", () => {
    render(<OrderDrawerTagsRow tags={["stały klient"]} />);
    const chip = screen.getByText("stały klient").closest("[data-color]");
    expect(chip?.getAttribute("data-color") ?? "default").toBe("default");
  });

  it("renders disabled dashed '+ dodaj' chip", () => {
    render(<OrderDrawerTagsRow tags={[]} />);
    const add = screen.getByText(/\+ dodaj/i).closest("button");
    expect(add).toBeDisabled();
  });

  it("renders empty state without crashing when tags is null", () => {
    render(<OrderDrawerTagsRow tags={null} />);
    expect(screen.getByText(/\+ dodaj/i)).toBeInTheDocument();
  });
});
