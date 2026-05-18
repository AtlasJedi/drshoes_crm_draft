"use client";

/**
 * AddToPlaylistDropdown — designer State D dropdown, 1:1 port.
 * Shown on a search result row OR the now-playing card.
 * ~55 LOC.
 */

import type { Track, PlaylistSummary } from "@/lib/music";

const COLORS = ["c-acid", "c-pink", "c-blue", "c-orange", ""];

interface Props {
  track: Track;
  playlists: PlaylistSummary[];
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onNewPlaylist: () => void;
}

const ICO_PLUS = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export function AddToPlaylistDropdown({
  track: _track,
  playlists,
  onAddToQueue,
  onAddToPlaylist,
  onNewPlaylist,
}: Props) {
  return (
    <div className="dd" role="menu" aria-label="Dodaj do playlisty">
      <div className="dd-h">Dodaj do playlisty</div>
      <div className="dd-list">
        {/* Queue option */}
        <button
          type="button"
          className="dd-row"
          style={{ background: "rgba(216,255,58,.12)" }}
          onClick={onAddToQueue}
          role="menuitem"
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mute)", letterSpacing: ".14em" }}>⊕</span>
          <span className="nm" style={{ color: "var(--ink)" }}>Kolejka</span>
          <span className="ct">dodaj do następnych</span>
        </button>
        {/* Existing playlists */}
        {playlists.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={"dd-row " + (COLORS[i % COLORS.length] ?? "")}
            onClick={() => onAddToPlaylist(p.id)}
            role="menuitem"
          >
            <span className="sw" />
            <span className="nm">{p.name}</span>
            <span className="ct">{p.trackCount}</span>
          </button>
        ))}
      </div>
      <button type="button" className="dd-new" onClick={onNewPlaylist} role="menuitem">
        <span className="plus">{ICO_PLUS}</span>
        Nowa playlista…
      </button>
    </div>
  );
}
