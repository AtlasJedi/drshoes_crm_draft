"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music";
import { MusicSearchError, searchMusic } from "@/lib/music";
import { createLogger } from "@/lib/log";

const log = createLogger("music.searchbar");

interface Props {
  onPick: (track: Track) => void;
}

const DEBOUNCE_MS = 300;

export function SearchBar({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [errCode, setErrCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setErrCode(null);
      return;
    }
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

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Wpisz tytuł utworu albo artystę"
        className="w-full px-3 py-2 border border-line bg-paper text-ink rounded outline-none focus:border-ink"
        aria-label="Szukaj muzyki"
        maxLength={100}
      />
      {errCode && (
        <div role="alert" className="px-3 py-2 border border-red-500 text-red-700 text-sm">
          {errCode === "music_disabled"
            ? "Klucz YouTube nie jest skonfigurowany."
            : "Nie udało się wyszukać. Spróbuj jeszcze raz."}
        </div>
      )}
      {loading && <div className="text-xs opacity-60">Szukam…</div>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border border-line">
          {results.map((t) => (
            <li key={t.videoId}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-paper-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.thumbnailUrl} alt="" width={64} height={48} className="flex-none object-cover" />
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs opacity-60 truncate">{t.channelTitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
