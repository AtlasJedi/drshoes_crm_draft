"use client";

/**
 * MusicProvider — lifts all music state from MusicClient into a React Context
 * that wraps the admin shell. The YouTube iframe lives in PersistentMiniPlayer
 * (always mounted while current != null), never on the /admin/muzyka page.
 *
 * State persisted to localStorage via music-storage.ts (throttled 1s writes).
 * Playlist state (CRUD) extended in Slice B.
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
import type {
  Track,
  PlaylistSummary,
  PlaylistDetail,
} from "@/lib/music";
import {
  listPlaylists,
  getPlaylist,
  createPlaylist as apiCreatePlaylist,
  renamePlaylist as apiRenamePlaylist,
  deletePlaylist as apiDeletePlaylist,
  addTrackToPlaylist as apiAddTrack,
  removeTrackFromPlaylist as apiRemoveTrack,
} from "@/lib/music";
import { loadMusicState, saveMusicState } from "@/lib/music-storage";
import { createLogger } from "@/lib/log";

const log = createLogger("music.provider");

// ──────────────────────────────────────────────
// Re-exports for consumers
// ──────────────────────────────────────────────

export type { PlaylistSummary, PlaylistDetail } from "@/lib/music";

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
  playlists: PlaylistSummary[];
  playlistDetail: Record<string, PlaylistDetail>;
  playlistsLoading: boolean;
  playlistsError: string | null;
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
  // ── playlist actions ──
  reloadPlaylists: () => Promise<void>;
  loadPlaylistDetail: (id: string) => Promise<PlaylistDetail>;
  createPlaylist: (name: string) => Promise<PlaylistSummary>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (id: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  loadPlaylistToQueue: (id: string) => Promise<void>;
  saveQueueAsPlaylist: (name: string) => Promise<PlaylistSummary>;
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

export const MusicContext = createContext<MusicContextValue | null>(null);

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

  // ── playlist state ─────────────────────────────────────────
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistDetail, setPlaylistDetail] = useState<Record<string, PlaylistDetail>>({});
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

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

  // ── playlist initial load on mount ───────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reloadPlaylistsImpl(); }, []);

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

  // ── playlist actions ──────────────────────────────────

  /** Defined as plain async fn so useEffect (no stale-closure risk) and the
   *  exposed `reloadPlaylists` action can both call it. */
  async function reloadPlaylistsImpl() {
    setPlaylistsLoading(true);
    setPlaylistsError(null);
    try {
      const data = await listPlaylists();
      setPlaylists(data);
      log.info("op=music.playlists.loaded count=" + data.length);
    } catch (e) {
      const msg = (e as Error).message ?? "network";
      log.warn("op=music.playlists.load outcome=fail msg=" + msg);
      setPlaylistsError(msg);
    } finally {
      setPlaylistsLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reloadPlaylists = useCallback(async () => { await reloadPlaylistsImpl(); }, []);

  const loadPlaylistDetail = useCallback(async (id: string): Promise<PlaylistDetail> => {
    const detail = await getPlaylist(id);
    setPlaylistDetail((prev) => ({ ...prev, [id]: detail }));
    log.info("op=music.playlist.detail.loaded id=" + id + " trackCount=" + detail.tracks.length);
    return detail;
  }, []);

  const createPlaylist = useCallback(async (name: string): Promise<PlaylistSummary> => {
    const pl = await apiCreatePlaylist(name);
    setPlaylists((prev) => [pl, ...prev]);
    log.info("op=music.playlist.created id=" + pl.id + " name=" + pl.name);
    return pl;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renamePlaylist = useCallback(async (id: string, name: string): Promise<void> => {
    await apiRenamePlaylist(id, name);
    await reloadPlaylistsImpl();
    log.info("op=music.playlist.renamed id=" + id + " name=" + name);
  }, []);

  const deletePlaylist = useCallback(async (id: string): Promise<void> => {
    await apiDeletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setPlaylistDetail((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    log.info("op=music.playlist.deleted id=" + id);
  }, []);

  const addTrackToPlaylist = useCallback(async (id: string, track: Track): Promise<void> => {
    await apiAddTrack(id, track);
    setPlaylists((prev) =>
      prev.map((p) => p.id === id ? { ...p, trackCount: p.trackCount + 1 } : p)
    );
    log.info("op=music.playlist.track.added playlistId=" + id + " videoId=" + track.videoId);
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string): Promise<void> => {
    await apiRemoveTrack(playlistId, trackId);
    setPlaylists((prev) =>
      prev.map((p) => p.id === playlistId ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p)
    );
    setPlaylistDetail((prev) => {
      const existing = prev[playlistId];
      if (!existing) return prev;
      return {
        ...prev,
        [playlistId]: {
          ...existing,
          tracks: existing.tracks.filter((t) => t.id !== trackId),
        },
      };
    });
    log.info("op=music.playlist.track.removed playlistId=" + playlistId + " trackId=" + trackId);
  }, []);

  const loadPlaylistToQueue = useCallback(async (id: string): Promise<void> => {
    const detail = await getPlaylist(id);
    setPlaylistDetail((prev) => ({ ...prev, [id]: detail }));
    if (detail.tracks.length === 0) return;
    const [first, ...rest] = detail.tracks;
    if (!first) return;
    const toTrack = (pt: {
      videoId: string; title: string;
      channelTitle: string; thumbnailUrl: string | null;
    }): Track => ({
      videoId: pt.videoId,
      title: pt.title,
      channelTitle: pt.channelTitle,
      thumbnailUrl: pt.thumbnailUrl ?? "",
    });
    setCurrent(toTrack(first));
    setQueue(rest.map(toTrack));
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    log.info("op=music.playlist.loadToQueue id=" + id + " tracks=" + detail.tracks.length);
  }, []);

  const saveQueueAsPlaylist = useCallback(async (name: string): Promise<PlaylistSummary> => {
    const pl = await apiCreatePlaylist(name);
    const tracks: Track[] = current ? [current, ...queue] : [...queue];
    for (const t of tracks) {
      await apiAddTrack(pl.id, t);
    }
    await reloadPlaylistsImpl();
    log.info("op=music.playlist.saveQueue id=" + pl.id + " trackCount=" + tracks.length);
    return pl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, queue]);

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
    playlists,
    playlistDetail,
    playlistsLoading,
    playlistsError,
    enqueue,
    playNow,
    advance,
    removeFromQueue,
    skipToQueueIndex,
    playPause,
    skipBack,
    skipForward,
    seek,
    setVolume,
    clear,
    reloadPlaylists,
    loadPlaylistDetail,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    loadPlaylistToQueue,
    saveQueueAsPlaylist,
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
