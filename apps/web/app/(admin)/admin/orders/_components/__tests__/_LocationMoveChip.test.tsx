import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationMoveChip } from "../_LocationMoveChip";

describe("LocationMoveChip", () => {
  it("renders from → to when both present", () => {
    render(<LocationMoveChip from="półka 1" to="suszarka" />);
    expect(screen.getByText(/półka 1/)).toBeInTheDocument();
    expect(screen.getByText(/suszarka/)).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it("renders only 'do X' when from is null", () => {
    render(<LocationMoveChip from={null} to="suszarka" />);
    expect(screen.getByText(/suszarka/)).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("renders nothing when both null", () => {
    const { container } = render(<LocationMoveChip from={null} to={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
