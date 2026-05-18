"use client";

/**
 * MusicClient — refactored for v2. State is now owned by MusicProvider (context).
 * This component is a thin consumer: search + display current + queue list.
 * The YouTube iframe lives in PersistentMiniPlayer — NOT here.
 *
 * Slice B will replace this page with a three-column layout.
 * ~55 LOC.
 */

import { useMusicContext, usePickTrack } from "@/components/admin/music/MusicProvider";
import { SearchBar } from "./components/SearchBar";
import { PlayerControls } from "./components/PlayerControls";
import { QueueList } from "./components/QueueList";

export function MusicClient() {
  const {
    current,
    queue,
    playing,
    currentTime,
    duration,
    volume,
    playPause,
    skipBack,
    skipForward,
    advance,
    skipToQueueIndex,
    removeFromQueue,
    seek,
    setVolume,
  } = useMusicContext();

  const pick = usePickTrack();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <SearchBar onPick={pick} />

      {current && (
        <>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="t-stencil text-[10px] tracking-[.15em] opacity-60">NOW PLAYING</div>
              <div className="text-lg truncate">{current.title}</div>
              <div className="text-sm opacity-70 truncate">{current.channelTitle}</div>
            </div>
          </div>

          {/* PlayerControls is secondary — the MiniPlayer bar is the primary control.
              Kept visible on /admin/muzyka for convenience. Slice B will replace this. */}
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
        onSkipTo={skipToQueueIndex}
        onRemove={removeFromQueue}
      />
    </div>
  );
}
