/**
 * music-storage.ts — localStorage persistence for the MusicProvider.
 *
 * Persists: current track, queue, volume.
 * Does NOT persist: playing state, currentTime — iframe always restarts fresh on reload.
 *
 * SSR-safe: all reads/writes guarded by typeof window check.
 * Throttled writes: max 1× per second via debounce.
 */

import type { Track } from "@/lib/music";

const STORAGE_KEY = "drshoes.music.state";
const WRITE_THROTTLE_MS = 1000;

export interface PersistedMusicState {
  current: Track | null;
  queue: Track[];
  volume: number;
}

export function loadMusicState(): PersistedMusicState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedMusicState;
    // Basic shape validation
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      current: parsed.current ?? null,
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      volume: typeof parsed.volume === "number" ? parsed.volume : 80,
    };
  } catch {
    return null;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced write: always reschedules so the latest state is captured.
 * At most 1 write per WRITE_THROTTLE_MS window (last-write-wins).
 */
export function saveMusicState(state: PersistedMusicState): void {
  if (typeof window === "undefined") return;
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // QuotaExceededError or SecurityError — silently ignore
    }
  }, WRITE_THROTTLE_MS);
}
