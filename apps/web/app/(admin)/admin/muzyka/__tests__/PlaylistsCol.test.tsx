import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistsCol } from "../components/PlaylistsCol";
import type { PlaylistSummary } from "@/lib/music";

const PLAYLISTS: PlaylistSummary[] = [
  { id: "1", name: "Lo-fi szlif", trackCount: 12, updatedAt: "2026-05-18T10:00:00Z" },
  { id: "2", name: "Klasyka szewstwa", trackCount: 5, updatedAt: "2026-05-18T09:00:00Z" },
];

function renderCol(overrides?: Partial<React.ComponentProps<typeof PlaylistsCol>>) {
  const props = {
    playlists: PLAYLISTS,
    activeId: null,
    onSelect: vi.fn(),
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  };
  return { ...render(<PlaylistsCol {...props} />), props };
}

describe("PlaylistsCol", () => {
  it("renders the list of playlists", () => {
    renderCol();
    // CSS text-transform:uppercase is applied by the browser; testing-library sees original case
    expect(screen.getByText(/lo-fi szlif/i)).toBeInTheDocument();
    expect(screen.getByText(/klasyka szewstwa/i)).toBeInTheDocument();
    // Check track counts appear — use aria-label on the row which contains the count
    expect(screen.getByLabelText("Playlista: Lo-fi szlif")).toBeInTheDocument();
    expect(screen.getByLabelText("Playlista: Klasyka szewstwa")).toBeInTheDocument();
  });

  it("clicking '+ Nowa' calls onNew", () => {
    const { props } = renderCol();
    fireEvent.click(screen.getByRole("button", { name: /Nowa playlista/i }));
    expect(props.onNew).toHaveBeenCalledTimes(1);
  });
});
