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
