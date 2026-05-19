import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MixDonut } from "../MixDonut";
import type { MixByTypeRowDto } from "@/lib/dashboard/types";

const mix: MixByTypeRowDto[] = [
  { kind: "CZYSZCZENIE", count: 19, percent: 55 },
  { kind: "CUSTOM",      count: 23, percent: 45 },
];

describe("MixDonut", () => {
  it("renders heading", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
  });

  it("renders legend labels in Polish", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Czyszczenie")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("renders total active count in SVG center", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders 'aktywne' caption", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("aktywne")).toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<MixDonut mix={mix} totalActive={42} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders percent labels in legend", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renders zero state without crashing", () => {
    render(<MixDonut mix={[]} totalActive={0} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
