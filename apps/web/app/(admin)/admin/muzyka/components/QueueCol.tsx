"use client";

/**
 * QueueCol — right column. Designer QueueCol, 1:1 port.
 * ~80 LOC.
 */

import type { Track, PlaylistSummary } from "@/lib/music";
import { AddToPlaylistDropdown } from "./AddToPlaylistDropdown";
import { useState } from "react";

const ICO_X = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ICO_PLUS = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

interface Props {
  current: Track | null;
  queue: Track[];
  playlists: PlaylistSummary[];
  onRemoveFromQueue: (idx: number) => void;
  onSkipToQueue: (idx: number) => void;
  onAddCurrentToPlaylist: (playlistId: string) => void;
  onAddCurrentToQueue: () => void;
  onNewPlaylistForCurrent: () => void;
  onSaveQueue: () => void;
}

export function QueueCol({
  current,
  queue,
  playlists,
  onRemoveFromQueue,
  onSkipToQueue,
  onAddCurrentToPlaylist,
  onAddCurrentToQueue,
  onNewPlaylistForCurrent,
  onSaveQueue,
}: Props) {
  const [showCurrentDd, setShowCurrentDd] = useState(false);
  const empty = !current && queue.length === 0;

  return (
    <div className="col">
      <div className="col-h">
        <h2>Teraz gra</h2>
        <span className="count">kolejka · {queue.length}</span>
      </div>

      {empty ? (
        <div className="col-body">
          <div className="empty" style={{ paddingTop: 56 }}>
            <div className="stencil-blob">·· ··</div>
            <div className="lbl">Nic nie gra</div>
            <div className="hint">Wybierz utwór z wyszukiwarki albo załaduj playlistę.</div>
          </div>
        </div>
      ) : (
        <>
          {current && (
            <div className="now-card">
              <div className="row">
                <div className="nt">
                  {current.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={current.thumbnailUrl} alt="" />
                  )}
                </div>
                <div className="meta">
                  <div className="ti">{current.title}</div>
                  <div className="ch">{current.channelTitle}</div>
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="add-now"
                    title="Dodaj do playlisty"
                    aria-label="Dodaj do playlisty"
                    onClick={() => setShowCurrentDd((v) => !v)}
                  >
                    {ICO_PLUS}
                  </button>
                  {showCurrentDd && current && (
                    <AddToPlaylistDropdown
                      track={current}
                      playlists={playlists}
                      onAddToQueue={() => { onAddCurrentToQueue(); setShowCurrentDd(false); }}
                      onAddToPlaylist={(pid) => { onAddCurrentToPlaylist(pid); setShowCurrentDd(false); }}
                      onNewPlaylist={() => { onNewPlaylistForCurrent(); setShowCurrentDd(false); }}
                    />
                  )}
                </div>
              </div>
              <div className="bars" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
              </div>
            </div>
          )}

          {queue.length > 0 && (
            <div style={{ padding: "10px 18px 4px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mute)", letterSpacing: ".14em", textTransform: "uppercase", borderBottom: "1px solid var(--line-2)" }}>
              Kolejka — następne {queue.length}
            </div>
          )}

          <div className="col-body" style={{ flex: "0 1 auto" }}>
            <div className="q-list">
              {queue.map((t, i) => (
                <div key={t.videoId + i} className="q-row">
                  {/* drag handle — visual decoration only; TODO: wire dnd-kit or react-beautiful-dnd in follow-up */}
                  <span className="drag" aria-hidden="true">⠿</span>
                  <div
                    className="qt"
                    aria-hidden="true"
                    onClick={() => onSkipToQueue(i)}
                    style={{ cursor: "pointer" }}
                  >
                    {t.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.thumbnailUrl} alt="" />
                    )}
                  </div>
                  <button
                    type="button"
                    className="meta"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                    onClick={() => onSkipToQueue(i)}
                    aria-label={"Przejdź do: " + t.title}
                  >
                    <div className="ti">{t.title}</div>
                    <div className="ch">{t.channelTitle}</div>
                  </button>
                  <button
                    type="button"
                    className="x"
                    title="Usuń z kolejki"
                    aria-label={"Usuń z kolejki: " + t.title}
                    onClick={() => onRemoveFromQueue(i)}
                  >
                    {ICO_X}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="q-save">
            <button type="button" className="btn-full" onClick={onSaveQueue}>
              <span style={{ display: "flex" }}>{ICO_PLUS}</span>
              Zapisz kolejkę jako playlistę
            </button>
          </div>
        </>
      )}
    </div>
  );
}
