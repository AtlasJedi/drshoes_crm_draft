"use client";

/**
 * PlaylistsCol — left column, designer State C/D Playlists column, 1:1 port.
 * ~70 LOC.
 */

import type { PlaylistSummary } from "@/lib/music";

const COLORS = ["c-acid", "c-pink", "c-blue", "c-orange", ""];

function initials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/[\s·\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("") || "?";
}

const ICO_DOWNLOAD = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 4v12M6 14l6 6 6-6" /><line x1="4" y1="22" x2="20" y2="22" />
  </svg>
);
const ICO_TRASH = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
  </svg>
);
const ICO_PLUS = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

interface Props {
  playlists: PlaylistSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function PlaylistsCol({ playlists, activeId, onSelect, onLoad, onDelete, onNew }: Props) {
  return (
    <div className="col">
      <div className="col-h">
        <h2>Playlisty</h2>
        <button type="button" className="btn-plus" onClick={onNew} aria-label="Nowa playlista">
          <span style={{ display: "flex" }}>{ICO_PLUS}</span>Nowa
        </button>
      </div>
      <div className="col-body">
        {playlists.length === 0 ? (
          <div className="empty" style={{ paddingTop: 56 }}>
            <div className="stencil-blob">Pusto</div>
            <div className="lbl">Brak playlist</div>
            <div className="hint">Zapisz kolejkę albo dodaj utwory z wyszukiwarki by stworzyć pierwszą.</div>
          </div>
        ) : (
          playlists.map((p, i) => (
            <div
              key={p.id}
              className={"pl-row " + (COLORS[i % COLORS.length] ?? "") + (p.id === activeId ? " active" : "")}
              onClick={() => onSelect(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(p.id); }}
              aria-label={"Playlista: " + p.name}
            >
              {p.id === activeId && <span className="now" aria-hidden="true" />}
              <span className="sw" aria-hidden="true">{initials(p.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{p.name}</div>
                <span className="ct">{p.trackCount} {p.trackCount === 1 ? "utwór" : "utworów"} · wsp.</span>
              </div>
              <div className="acts">
                <button
                  type="button"
                  className="ico-btn load"
                  title="Załaduj do kolejki"
                  aria-label={"Załaduj do kolejki: " + p.name}
                  onClick={(e) => { e.stopPropagation(); onLoad(p.id); }}
                >
                  {ICO_DOWNLOAD}
                </button>
                <button
                  type="button"
                  className="ico-btn"
                  title="Usuń"
                  aria-label={"Usuń playlistę: " + p.name}
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                >
                  {ICO_TRASH}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
