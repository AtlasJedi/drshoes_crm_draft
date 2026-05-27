"use client";

/**
 * OrderDrawerPhotos — 4-col photo grid with clickable empty tiles.
 * Replaces the separate "Prześlij zdjęcia" button with an inline photo-add tile
 * at the end of the grid. Matches handoff .photos / .photo-add spec.
 * < 80 LOC per granulated-code rule.
 */

import { useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/log";
import type { Photo } from "@/lib/photos/types";
import { listPhotos, uploadPhoto, deletePhoto } from "@/lib/photos/api";
import { PhotoLightbox } from "./PhotoLightbox";

const log = createLogger("order-drawer-photos");
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

export function OrderDrawerPhotos({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setPhotos(await listPhotos(orderId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się pobrać zdjęć.";
      log.warn("op=photos.list outcome=failed", { orderId, msg });
      setError(msg);
    }
  }

  useEffect(() => { void refresh(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await uploadPhoto(orderId, file, "OTHER");
      } catch (e) {
        log.warn("op=photos.upload outcome=failed", { name: file.name });
        setError(e instanceof Error ? e.message : "Błąd uploadu.");
      }
    }
    setUploading(false);
    await refresh();
  }

  async function onDelete(p: Photo) {
    if (!confirm("Usunąć zdjęcie? Tej akcji nie da się cofnąć.")) return;
    try { await deletePhoto(p.id); await refresh(); }
    catch { log.warn("op=photos.delete outcome=failed", { photoId: p.id }); }
  }

  const addTileStyle: React.CSSProperties = {
    aspectRatio: "1",
    background: "var(--paper)",
    border: "2px dashed var(--ink)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, cursor: uploading ? "not-allowed" : "pointer",
    color: "var(--ink)", transition: "background .15s, border-color .15s, transform .1s",
    opacity: uploading ? 0.5 : 1,
  };

  return (
    <section aria-label="Zdjęcia">
      <p className="t-display" style={{ fontSize: 18, textTransform: "uppercase", letterSpacing: "-.01em", marginBottom: 10 }}>
        Zdjęcia <span className="t-mono" style={{ fontSize: 10, color: "var(--admin-mute)", letterSpacing: ".12em" }}>· {photos?.length ?? 0}</span>
      </p>
      {error && <p className="text-sm" style={{ color: "var(--red)", marginBottom: 6 }}>{error}</p>}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="sr-only"
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {/* Existing photo tiles */}
        {(photos ?? []).map((p) => (
          <div key={p.id} style={{ aspectRatio: "1", border: "1.5px solid var(--ink)", position: "relative", overflow: "hidden", cursor: "pointer" }}
            onClick={() => setOpen(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <button type="button" aria-label="Usuń zdjęcie"
              onClick={(e) => { e.stopPropagation(); void onDelete(p); }}
              style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, background: "var(--ink)", color: "var(--paper)", border: "1.5px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 5l14 14M19 5L5 19" /></svg>
            </button>
          </div>
        ))}

        {/* Add tile */}
        <button type="button" className="photo-add" aria-label="Wgraj zdjęcie" style={addTileStyle}
          onClick={() => fileRef.current?.click()}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1 }}>+</span>
          <span className="t-mono" style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--admin-mute)" }}>
            {uploading ? "wgrywa…" : "wgraj"}
          </span>
        </button>
      </div>

      <PhotoLightbox photo={open} photos={photos ?? undefined} onClose={() => setOpen(null)}
        onNavigate={setOpen} onRelabel={async () => { await refresh(); }} />
    </section>
  );
}
