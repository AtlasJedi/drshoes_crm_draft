"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTube, { type YouTubePlayer, type YouTubeEvent } from "react-youtube";
import type { Track } from "@/lib/music";
import { SearchBar } from "./components/SearchBar";
import { PlayerControls } from "./components/PlayerControls";
import { QueueList } from "./components/QueueList";
import { createLogger } from "@/lib/log";

const log = createLogger("music.client");

export function MusicClient() {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime?.() ?? 0);
        setDuration(p.getDuration?.() ?? 0);
      } catch {
        // ignore — iframe not ready yet
      }
    }, 500);
  }, []);

  useEffect(() => () => { pollRef.current && clearInterval(pollRef.current); }, []);

  const pick = useCallback((t: Track) => {
    if (!current) {
      setCurrent(t);
    } else {
      setQueue((q) => [...q, t]);
    }
  }, [current]);

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

  const onReady = (e: YouTubeEvent) => {
    playerRef.current = e.target;
    try {
      e.target.setVolume(volume);
    } catch {
      // ignore
    }
    startPolling();
  };
  const onStateChange = (e: YouTubeEvent) => {
    // YT.PlayerState: PLAYING=1 PAUSED=2 ENDED=0
    const state = (e.data as number) ?? -1;
    setPlaying(state === 1);
  };
  const onEnd = () => {
    log.info("op=music.track.ended");
    advance();
  };

  const playPause = () => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  };
  const skipBack = () => playerRef.current?.seekTo(Math.max(currentTime - 10, 0), true);
  const skipForward = () => playerRef.current?.seekTo(currentTime + 10, true);
  const seek = (s: number) => playerRef.current?.seekTo(s, true);
  const setVolume = (v: number) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <SearchBar onPick={pick} />

      {current && (
        <>
          <div className="flex items-start gap-4">
            <div className="flex-none w-[320px]">
              <YouTube
                videoId={current.videoId}
                opts={{
                  width: "320",
                  height: "180",
                  playerVars: { autoplay: 1, modestbranding: 1, rel: 0 },
                }}
                onReady={onReady}
                onStateChange={onStateChange}
                onEnd={onEnd}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="t-stencil text-[10px] tracking-[.15em] opacity-60">NOW PLAYING</div>
              <div className="text-lg truncate">{current.title}</div>
              <div className="text-sm opacity-70 truncate">{current.channelTitle}</div>
            </div>
          </div>

          <PlayerControls
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            hasNext={queue.length > 0}
            onPlayPause={playPause}
            onSkipBack={skipBack}
            onSkipForward={skipForward}
            onNext={advance}
            onSeek={seek}
            onVolume={setVolume}
          />
        </>
      )}

      <QueueList
        current={current}
        queue={queue}
        onSkipTo={(i) => {
          setQueue((q) => {
            const next = q[i] ?? null;
            const before = q.slice(0, i);
            const after = q.slice(i + 1);
            // current track goes back to head of queue? No — we drop it (simplest).
            setCurrent(next);
            return [...before, ...after];
          });
        }}
        onRemove={(i) => setQueue((q) => q.filter((_, idx) => idx !== i))}
      />
    </div>
  );
}
