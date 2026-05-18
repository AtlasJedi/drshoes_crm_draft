import { createLogger } from "@/lib/log";

const log = createLogger("music.client");

export interface Track {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export type MusicError =
  | "invalid_query"
  | "music_search_failed"
  | "music_disabled"
  | "network";

export class MusicSearchError extends Error {
  constructor(public code: MusicError) {
    super(code);
    this.name = "MusicSearchError";
  }
}

export async function searchMusic(q: string, signal?: AbortSignal): Promise<Track[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  try {
    const r = await fetch(
      `/api/admin/music/search?q=${encodeURIComponent(trimmed)}`,
      { signal, credentials: "include" }
    );
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: MusicError };
      const code = body.error ?? "music_search_failed";
      log.warn("op=music.search.fetch outcome=http_fail status=" + r.status + " code=" + code);
      throw new MusicSearchError(code);
    }
    return (await r.json()) as Track[];
  } catch (e) {
    if (e instanceof MusicSearchError) throw e;
    if ((e as Error)?.name === "AbortError") throw e;
    log.warn("op=music.search.fetch outcome=network msg=" + (e as Error).message);
    throw new MusicSearchError("network");
  }
}

// ──────────────────────────────────────────────────────────────
// Playlist API
// ──────────────────────────────────────────────────────────────

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  updatedAt: string;
}

export interface PlaylistTrack {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: PlaylistTrack[];
}

export type PlaylistErrorCode =
  | "duplicate_name"
  | "invalid_name"
  | "playlist_not_found"
  | "network";

export class PlaylistError extends Error {
  constructor(public code: PlaylistErrorCode) {
    super(code);
    this.name = "PlaylistError";
  }
}

const PLAYLISTS_BASE = "/api/admin/music/playlists";

function statusToPlaylistCode(status: number, body: { error?: string }): PlaylistErrorCode {
  if (status === 404 || body.error === "playlist_not_found") return "playlist_not_found";
  if (status === 409 || body.error === "duplicate_name") return "duplicate_name";
  if (status === 400 || body.error === "invalid_name") return "invalid_name";
  return "network";
}

async function apiRequest<T>(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: "include",
    signal,
  };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  try {
    const r = await fetch(path, opts);
    if (!r.ok) {
      const b = await r.json().catch(() => ({})) as { error?: string };
      const code = statusToPlaylistCode(r.status, b);
      log.warn(`op=playlist.request outcome=http_fail method=${method} path=${path} status=${r.status} code=${code}`);
      throw new PlaylistError(code);
    }
    if (r.status === 204) return undefined as T;
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof PlaylistError) throw e;
    if ((e as Error)?.name === "AbortError") throw e;
    log.warn(`op=playlist.request outcome=network_fail method=${method} path=${path} msg=${(e as Error).message}`);
    throw new PlaylistError("network");
  }
}

export async function listPlaylists(signal?: AbortSignal): Promise<PlaylistSummary[]> {
  return apiRequest<PlaylistSummary[]>(PLAYLISTS_BASE, "GET", undefined, signal);
}

export async function getPlaylist(id: string, signal?: AbortSignal): Promise<PlaylistDetail> {
  return apiRequest<PlaylistDetail>(`${PLAYLISTS_BASE}/${id}`, "GET", undefined, signal);
}

export async function createPlaylist(name: string): Promise<PlaylistSummary> {
  return apiRequest<PlaylistSummary>(PLAYLISTS_BASE, "POST", { name });
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  await apiRequest<void>(`${PLAYLISTS_BASE}/${id}`, "PATCH", { name });
}

export async function deletePlaylist(id: string): Promise<void> {
  await apiRequest<void>(`${PLAYLISTS_BASE}/${id}`, "DELETE");
}

export async function addTrackToPlaylist(id: string, track: Track): Promise<PlaylistTrack> {
  return apiRequest<PlaylistTrack>(`${PLAYLISTS_BASE}/${id}/tracks`, "POST", {
    videoId: track.videoId,
    title: track.title,
    channelTitle: track.channelTitle,
    thumbnailUrl: track.thumbnailUrl,
  });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  await apiRequest<void>(`${PLAYLISTS_BASE}/${playlistId}/tracks/${trackId}`, "DELETE");
}
