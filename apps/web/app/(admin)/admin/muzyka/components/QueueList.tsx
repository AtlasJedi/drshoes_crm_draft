"use client";

import type { Track } from "@/lib/music";

interface Props {
  current: Track | null;
  queue: Track[];
  onSkipTo: (index: number) => void;
  onRemove: (index: number) => void;
}

export function QueueList({ current, queue, onSkipTo, onRemove }: Props) {
  if (!current && queue.length === 0) {
    return <div className="text-xs opacity-60">Brak kolejnych utworów</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="t-stencil text-[10px] tracking-[.15em] opacity-60">UP NEXT</div>
      {queue.length === 0 ? (
        <div className="text-xs opacity-60">Brak kolejnych utworów</div>
      ) : (
        <ul className="flex flex-col divide-y divide-line border border-line">
          {queue.map((t, i) => (
            <li key={t.videoId + i} className="flex items-center gap-2 px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumbnailUrl} alt="" width={48} height={36} className="flex-none object-cover" />
              <button
                type="button"
                onClick={() => onSkipTo(i)}
                className="flex flex-col min-w-0 text-left flex-1 hover:opacity-80"
                aria-label={`Przejdź do: ${t.title}`}
              >
                <span className="truncate">{t.title}</span>
                <span className="text-xs opacity-60 truncate">{t.channelTitle}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-sm opacity-60 hover:opacity-100 px-2"
                aria-label="Usuń z kolejki"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
