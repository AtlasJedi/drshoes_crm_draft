"use client";

/**
 * SearchColV2 — middle column. Designer SearchCol + AddDropdown, 1:1 port.
 * Wraps existing search logic + result list with per-row AddToPlaylistDropdown.
 * ~100 LOC.
 */

import { useEffect, useRef, useState } from "react";
import type { Track, PlaylistSummary } from "@/lib/music";
import { MusicSearchError, searchMusic } from "@/lib/music";
import { AddToPlaylistDropdown } from "./AddToPlaylistDropdown";
import { createLogger } from "@/lib/log";

const log = createLogger("music.search-col-v2");
const DEBOUNCE_MS = 300;

const ICO_SEARCH = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

interface Props {
  playlists: PlaylistSummary[];
  onPlay: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onNewPlaylist: (track: Track) => void;
}

export function SearchColV2({ playlists, onPlay, onAddToQueue, onAddToPlaylist, onNewPlaylist }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // videoId
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) { setResults([]); setErrCode(null); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setLoading(true);
      setErrCode(null);
      try {
        const tracks = await searchMusic(trimmed, ctl.signal);
        setResults(tracks);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        const code = e instanceof MusicSearchError ? e.code : "music_search_failed";
        log.warn("op=search outcome=fail code=" + code);
        setErrCode(code);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest(".dd") && !target.closest(".res .add")) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const hasResults = results.length > 0;

  return (
    <div className="col">
      <div className="srch-bar">
        <div className="srch-input">
          <span style={{ color: "var(--mute)", display: "flex" }}>{ICO_SEARCH}</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Wpisz tytuł utworu albo artystę…"
            aria-label="Szukaj muzyki"
            maxLength={100}
          />
          <span className="yt-pill">YT</span>
        </div>
      </div>

      {!hasResults && !loading && !errCode && (
        <div className="empty-mid">
          <div className="big-stencil">CISZA</div>
          <div className="tape-tag">cisza · ничего не играет</div>
          <div className="lead">Zacznij od wyszukiwania albo załaduj playlistę.</div>
          <div className="sub">Wpisz tytuł utworu, nazwę artysty albo wklej link YouTube. Wyniki pojawią się tutaj — dodaj prosto do kolejki albo do playlisty pracowni.</div>
        </div>
      )}

      {errCode && (
        <div role="alert" style={{ padding: "12px 22px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
          {errCode === "music_disabled" ? "Klucz YouTube nie jest skonfigurowany." : "Nie udało się wyszukać. Spróbuj jeszcze raz."}
        </div>
      )}

      {loading && (
        <div style={{ padding: "12px 22px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mute)" }}>Szukam…</div>
      )}

      {hasResults && (
        <>
          <div className="srch-meta">
            <span>Wyniki YouTube · top {results.length}</span>
            <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mute)" }} onClick={() => setQ(q + " ")}>↻ odśwież</button>
          </div>
          <div className="results">
            {results.map((r) => (
              <div key={r.videoId} className="res">
                <button
                  type="button"
                  className="thumb"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => onPlay(r)}
                  aria-label={"Odtwórz: " + r.title}
                >
                  {r.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnailUrl} alt="" />
                  ) : (
                    <div className="play-tri" />
                  )}
                </button>
                <div className="meta">
                  <div className="ti">{r.title}</div>
                  <div className="ch">{r.channelTitle}</div>
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="add"
                    aria-label={"Dodaj: " + r.title}
                    onClick={() => setOpenDropdown((prev) => (prev === r.videoId ? null : r.videoId))}
                  >
                    Dodaj <span className="caret" />
                  </button>
                  {openDropdown === r.videoId && (
                    <AddToPlaylistDropdown
                      track={r}
                      playlists={playlists}
                      onAddToQueue={() => { onAddToQueue(r); setOpenDropdown(null); }}
                      onAddToPlaylist={(pid) => { onAddToPlaylist(pid, r); setOpenDropdown(null); }}
                      onNewPlaylist={() => { onNewPlaylist(r); setOpenDropdown(null); }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
