import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddToPlaylistDropdown } from "../components/AddToPlaylistDropdown";
import type { Track, PlaylistSummary } from "@/lib/music";

const TRACK: Track = {
  videoId: "abc123",
  title: "Test Track",
  channelTitle: "Test Channel",
  thumbnailUrl: "https://example.com/t.jpg",
};

const PLAYLISTS: PlaylistSummary[] = [
  { id: "pl1", name: "Lo-fi", trackCount: 3, updatedAt: "2026-05-18T10:00:00Z" },
  { id: "pl2", name: "Klasyka", trackCount: 10, updatedAt: "2026-05-18T09:00:00Z" },
];

function renderDropdown(overrides?: Partial<React.ComponentProps<typeof AddToPlaylistDropdown>>) {
  const props = {
    track: TRACK,
    playlists: PLAYLISTS,
    onAddToQueue: vi.fn(),
    onAddToPlaylist: vi.fn(),
    onNewPlaylist: vi.fn(),
    ...overrides,
  };
  return { ...render(<AddToPlaylistDropdown {...props} />), props };
}

describe("AddToPlaylistDropdown", () => {
  it("lists existing playlists and the queue option", () => {
    renderDropdown();
    expect(screen.getByText("Kolejka")).toBeInTheDocument();
    // CSS text-transform:uppercase is applied by browser; testing-library sees original case
    expect(screen.getByText(/lo-fi/i)).toBeInTheDocument();
    expect(screen.getByText(/klasyka/i)).toBeInTheDocument();
    expect(screen.getByText("Nowa playlista…")).toBeInTheDocument();
  });

  it("clicking a playlist row calls onAddToPlaylist with the correct id", () => {
    const { props } = renderDropdown();
    fireEvent.click(screen.getByText(/lo-fi/i));
    expect(props.onAddToPlaylist).toHaveBeenCalledWith("pl1");
  });
});
