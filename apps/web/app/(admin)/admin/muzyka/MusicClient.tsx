"use client";

/**
 * MusicClient v2 — three-column command center.
 * Orchestrates PlaylistsCol | SearchColV2 | QueueCol.
 * All state is owned by MusicProvider; this is a thin coordinator.
 * ~90 LOC.
 */

import { useState } from "react";
import { useMusicContext, usePickTrack } from "@/components/admin/music/MusicProvider";
import type { Track } from "@/lib/music";
import { PlaylistsCol } from "./components/PlaylistsCol";
import { SearchColV2 } from "./components/SearchColV2";
import { QueueCol } from "./components/QueueCol";
import { NewPlaylistModal } from "./components/NewPlaylistModal";

type ModalMode =
  | { kind: "new" }
  | { kind: "queue" }
  | { kind: "track"; track: Track }
  | null;

export function MusicClient() {
  const {
    current,
    queue,
    playlists,
    enqueue,
    removeFromQueue,
    skipToQueueIndex,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    loadPlaylistToQueue,
    saveQueueAsPlaylist,
  } = useMusicContext();

  const pick = usePickTrack();

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);

  // ── playlist handlers ──────────────────────────────────────
  async function handleLoadPlaylist(id: string) {
    await loadPlaylistToQueue(id);
    setActivePlaylistId(id);
  }

  async function handleDeletePlaylist(id: string) {
    if (!confirm("Usunąć playlistę? Tej operacji nie można cofnąć.")) return;
    await deletePlaylist(id);
    if (activePlaylistId === id) setActivePlaylistId(null);
  }

  // ── modal save handlers ────────────────────────────────────
  async function handleModalSave(name: string) {
    if (!modal) return;
    if (modal.kind === "queue") {
      await saveQueueAsPlaylist(name);
    } else if (modal.kind === "track") {
      const pl = await createPlaylist(name);
      await addTrackToPlaylist(pl.id, modal.track);
    } else {
      await createPlaylist(name);
    }
  }

  // ── search + add handlers ──────────────────────────────────
  function handleAddToQueue(track: Track) {
    enqueue(track);
  }

  async function handleAddToPlaylist(playlistId: string, track: Track) {
    await addTrackToPlaylist(playlistId, track);
  }

  function handleNewPlaylistForTrack(track: Track) {
    setModal({ kind: "track", track });
  }

  // ── current-track playlist handlers ───────────────────────
  function handleAddCurrentToQueue() {
    if (current) enqueue(current);
  }

  async function handleAddCurrentToPlaylist(playlistId: string) {
    if (current) await addTrackToPlaylist(playlistId, current);
  }

  return (
    <>
      <div className="cmd">
        <PlaylistsCol
          playlists={playlists}
          activeId={activePlaylistId}
          onSelect={setActivePlaylistId}
          onLoad={handleLoadPlaylist}
          onDelete={handleDeletePlaylist}
          onNew={() => setModal({ kind: "new" })}
        />
        <SearchColV2
          playlists={playlists}
          onPlay={pick}
          onAddToQueue={handleAddToQueue}
          onAddToPlaylist={handleAddToPlaylist}
          onNewPlaylist={handleNewPlaylistForTrack}
        />
        <QueueCol
          current={current}
          queue={queue}
          playlists={playlists}
          onRemoveFromQueue={removeFromQueue}
          onSkipToQueue={skipToQueueIndex}
          onAddCurrentToPlaylist={handleAddCurrentToPlaylist}
          onAddCurrentToQueue={handleAddCurrentToQueue}
          onNewPlaylistForCurrent={() => setModal({ kind: "track", track: current! })}
          onSaveQueue={() => setModal({ kind: "queue" })}
        />
      </div>

      {modal && (
        <NewPlaylistModal
          queueMode={modal.kind === "queue"}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
