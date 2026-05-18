"use client";

/**
 * PersistentMiniPlayer — the bottom mini-player bar + the YouTube iframe host.
 *
 * This is the ONLY place the YouTube iframe is rendered. It is always mounted
 * while current != null. Moving the iframe between DOM nodes would reset
 * playback — so it lives here and never re-parents.
 *
 * Visual: matches designer chrome.jsx MiniPlayer + styles.css .mini* 1:1.
 * Polish copy. ARIA labels per designer JSX.
 * ~90 LOC.
 */

import { useState } from "react";
import YouTube, { type YouTubeEvent } from "react-youtube";
import Link from "next/link";
import type { Route } from "next";
import { useMusicContext } from "./MusicProvider";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── SVG icons (verbatim from designer chrome.jsx) ── */
const ICO = {
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4l14 8-14 8V4z" />
    </svg>
  ),
  pause: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  skip: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l12 8-12 8V4z" />
      <rect x="17" y="4" width="3" height="16" />
    </svg>
  ),
  vol: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a10 10 0 0 1 0 14" />
    </svg>
  ),
  arrR: (
    <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

export function PersistentMiniPlayer() {
  const {
    current,
    queue,
    playing,
    currentTime,
    duration,
    volume,
    playPause,
    advance,
    _onReady,
    _onStateChange,
    _onEnd,
  } = useMusicContext();

  const [volOpen, setVolOpen] = useState(false);

  if (!current) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const nextDisabled = queue.length === 0;

  const handleReady = (e: YouTubeEvent) => {
    _onReady(e.target);
  };

  const handleStateChange = (e: YouTubeEvent) => {
    _onStateChange(e.data as number);
  };

  return (
    <div className="mini" role="region" aria-label="Odtwarzacz muzyki">
      {/* ── hidden YouTube iframe — always mounted while current != null ── */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        <YouTube
          videoId={current.videoId}
          opts={{
            width: "1",
            height: "1",
            playerVars: { autoplay: 1, modestbranding: 1, rel: 0 },
          }}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onEnd={_onEnd}
        />
      </div>

      {/* ── left: thumbnail + meta ── */}
      <div className="mini-l">
        <div className="mini-thumb">YT</div>
        <div className="mini-meta">
          <div className="mini-title">{current.title}</div>
          <div className="mini-ch">{current.channelTitle}</div>
        </div>
      </div>

      {/* ── right: controls + progress + volume + link ── */}
      <div className="mini-r">
        {/* play/pause + skip */}
        <div className="mini-ctl">
          <button
            type="button"
            className="mini-btn play"
            aria-label={playing ? "Pauza" : "Odtwórz"}
            onClick={playPause}
          >
            {playing ? ICO.pause : ICO.play}
          </button>
          <button
            type="button"
            className={"mini-btn" + (nextDisabled ? " disabled" : "")}
            aria-label="Następny"
            onClick={nextDisabled ? undefined : advance}
            disabled={nextDisabled}
          >
            {ICO.skip}
          </button>
        </div>

        {/* progress bar */}
        <div className="mini-prog">
          <span className="time">{fmt(currentTime)}</span>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="time">{fmt(duration)}</span>
        </div>

        {/* volume */}
        <div className="mini-vol">
          <button
            type="button"
            className="ico-btn"
            aria-label="Głośność"
            onClick={() => setVolOpen((v) => !v)}
          >
            {ICO.vol}
          </button>
          {volOpen && (
            <div className="popout" role="tooltip" aria-label="Poziom głośności">
              <div className="vlabel">{volume}</div>
              <div className="vbar">
                <div className="vfill" style={{ height: `${volume}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* open link */}
        <Link href={"/admin/muzyka" as Route} className="mini-open">
          /admin/muzyka <span style={{ width: 12, height: 12 }}>{ICO.arrR}</span>
        </Link>
      </div>
    </div>
  );
}
