"use client";

/**
 * MusicProvider — lifts all music state from MusicClient into a React Context
 * that wraps the admin shell. The YouTube iframe lives in PersistentMiniPlayer
 * (always mounted while current != null), never on the /admin/muzyka page.
 *
 * State persisted to localStorage via music-storage.ts (throttled 1s writes).
 * ~100 LOC.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { YouTubePlayer } from "react-youtube";
import type { Track } from "@/lib/music";
import { loadMusicState, saveMusicState } from "@/lib/music-storage";
import { createLogger } from "@/lib/log";

const log = createLogger("music.provider");

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MusicState {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface MusicActions {
  enqueue: (t: Track) => void;
  playNow: (t: Track) => void;
  advance: () => void;
  removeFromQueue: (idx: number) => void;
  skipToQueueIndex: (idx: number) => void;
  playPause: () => void;
  skipBack: () => void;
  skipForward: () => void;
  seek: (s: number) => void;
  setVolume: (v: number) => void;
  clear: () => void;
  /** Called by PersistentMiniPlayer to hand us the YT player ref */
  _registerPlayer: (player: YouTubePlayer) => void;
  /** Called by PersistentMiniPlayer on state change event */
  _onStateChange: (ytState: number) => void;
  /** Called by PersistentMiniPlayer when track ends */
  _onEnd: () => void;
  /** Called by PersistentMiniPlayer on ready */
  _onReady: (player: YouTubePlayer) => void;
}

export type MusicContextValue = MusicState & MusicActions;

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusicContext(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicContext must be used inside MusicProvider");
  return ctx;
}

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
}

export function MusicProvider({ children }: Props) {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── localStorage hydration on mount ──────────────────
  useEffect(() => {
    const saved = loadMusicState();
    if (!saved) return;
    if (saved.current) setCurrent(saved.current);
    if (saved.queue.length > 0) setQueue(saved.queue);
    if (saved.volume !== 80) setVolumeState(saved.volume);
  }, []);

  // ── persist state changes to localStorage ────────────
  useEffect(() => {
    saveMusicState({ current, queue, volume });
  }, [current, queue, volume]);

  // ── polling for currentTime / duration ────────────────
  const startPolling = useCallback(() => {
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime?.() ?? 0);
        setDuration(p.getDuration?.() ?? 0);
      } catch {
        // iframe not ready yet — ignore
      }
    }, 500);
  }, []);

  useEffect(() => () => { pollRef.current && clearInterval(pollRef.current); }, []);

  // ── actions ──────────────────────────────────────────
  const enqueue = useCallback((t: Track) => {
    setQueue((q) => [...q, t]);
    log.info("op=music.enqueue", { videoId: t.videoId });
  }, []);

  const playNow = useCallback((t: Track) => {
    setCurrent(t);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    log.info("op=music.playNow", { videoId: t.videoId });
  }, []);

  /** If nothing playing: set as current. Otherwise: append to queue. */
  const pick = useCallback((t: Track) => {
    setCurrent((c) => {
      if (!c) return t;
      setQueue((q) => [...q, t]);
      return c;
    });
  }, []);

  const advance = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) {
        setCurrent(null);
        return q;
      }
      const [next, ...rest] = q;
      setCurrent(next ?? null);
      return rest;
    });
  }, []);

  const removeFromQueue = useCallback((idx: number) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }, []);

  const skipToQueueIndex = useCallback((idx: number) => {
    setQueue((q) => {
      const next = q[idx] ?? null;
      const before = q.slice(0, idx);
      const after = q.slice(idx + 1);
      setCurrent(next);
      return [...before, ...after];
    });
  }, []);

  const playPause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  }, [playing]);

  const skipBack = useCallback(() => {
    playerRef.current?.seekTo(Math.max(currentTime - 10, 0), true);
  }, [currentTime]);

  const skipForward = useCallback(() => {
    playerRef.current?.seekTo(currentTime + 10, true);
  }, [currentTime]);

  const seek = useCallback((s: number) => {
    playerRef.current?.seekTo(s, true);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v);
  }, []);

  const clear = useCallback(() => {
    setCurrent(null);
    setQueue([]);
    setPlaying(false);
  }, []);

  // ── iframe bridge callbacks (used by PersistentMiniPlayer) ──
  const _registerPlayer = useCallback((player: YouTubePlayer) => {
    playerRef.current = player;
  }, []);

  const _onReady = useCallback((player: YouTubePlayer) => {
    playerRef.current = player;
    try { player.setVolume(volume); } catch { /* ignore */ }
    startPolling();
  }, [volume, startPolling]);

  const _onStateChange = useCallback((ytState: number) => {
    // YT.PlayerState: PLAYING=1 PAUSED=2 ENDED=0
    setPlaying(ytState === 1);
  }, []);

  const _onEnd = useCallback(() => {
    log.info("op=music.track.ended");
    advance();
  }, [advance]);

  // ── context value ─────────────────────────────────────
  const value: MusicContextValue = {
    current,
    queue,
    playing,
    currentTime,
    duration,
    volume,
    enqueue,
    playNow,
    advance,
    removeFromQueue,
    skipToQueueIndex,
    // pick is exposed as enqueue-or-play shorthand used by MusicClient
    // For backwards-compat with SearchBar/MusicClient "pick" pattern:
    // calling enqueue when current==null sets current; otherwise appends.
    // We expose this as `enqueue` overloaded by context — but MusicClient
    // needs the "pick" behavior. We keep `enqueue` as the pure append action
    // and expose `playNow` for forcing. MusicClient uses its own adapter below.
    playPause,
    skipBack,
    skipForward,
    seek,
    setVolume,
    clear,
    _registerPlayer,
    _onReady,
    _onStateChange,
    _onEnd,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

/**
 * Convenience: pick a track the way MusicClient used to.
 * If nothing is playing → playNow. Otherwise → enqueue.
 */
export function usePickTrack() {
  const { current, playNow, enqueue } = useMusicContext();
  return useCallback((t: Track) => {
    if (!current) {
      playNow(t);
    } else {
      enqueue(t);
    }
  }, [current, playNow, enqueue]);
}
