"use client";

/**
 * MusicSidebarDot — shows the animated now-playing dot next to the Muzyka
 * sidebar link when a track is currently loaded. Reads MusicContext.
 * Matches designer chrome.jsx: `it.nowPlaying && playing && <span className="now-dot" />`
 *
 * Gracefully returns null when rendered outside MusicProvider (e.g. tests
 * that render AdminSidebarNav in isolation).
 * ~20 LOC.
 */

import { useContext } from "react";
import { MusicContext } from "./MusicProvider";

export function MusicSidebarDot() {
  const ctx = useContext(MusicContext);
  if (!ctx?.current) return null;
  return <span className="now-dot" aria-label="Teraz gra" />;
}
