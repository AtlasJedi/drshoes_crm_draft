"use client";

interface Props {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0..100
  hasNext: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (v: number) => void;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  playing,
  currentTime,
  duration,
  volume,
  hasNext,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onNext,
  onSeek,
  onVolume,
}: Props) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="flex flex-col gap-3 p-3 border border-line bg-paper">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onSkipBack} className="px-2 py-1 hover:bg-paper-2" aria-label="-10s">
          ⏪ 10s
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          className="px-4 py-2 bg-ink text-paper rounded"
          aria-label={playing ? "Pauza" : "Odtwarzaj"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={onSkipForward} className="px-2 py-1 hover:bg-paper-2" aria-label="+10s">
          10s ⏩
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="px-2 py-1 hover:bg-paper-2 disabled:opacity-30"
          aria-label="Następny"
        >
          ⏭
        </button>
        <div className="ml-auto text-xs opacity-70 tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full"
        aria-label="Pasek postępu"
        step={1}
      />

      <div className="flex items-center gap-2">
        <span className="text-xs opacity-60">🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="flex-1"
          aria-label="Głośność"
        />
        <span className="text-xs opacity-60 w-10 tabular-nums text-right">{volume}%</span>
        <div
          className="hidden md:block flex-1 h-1 bg-paper-2 relative"
          aria-hidden="true"
          title="progress"
        >
          <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
