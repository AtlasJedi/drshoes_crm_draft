"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PHOTO_LABEL_PL, PHOTO_LABELS } from "@/lib/photos/types";

const log = createLogger("photo-lightbox");

interface Props {
  photo: Photo | null;
  photos?: Photo[];
  onClose: () => void;
  onNavigate?: (p: Photo) => void;
  onRelabel?: (p: Photo, label: PhotoLabel) => void;
}

export function PhotoLightbox({ photo, photos, onClose, onNavigate, onRelabel }: Props) {
  const [relabelling, setRelabelling] = useState(false);

  const idx = photo && photos ? photos.findIndex((p) => p.id === photo.id) : -1;
  const prevPhoto = idx > 0 && photos ? (photos[idx - 1] ?? null) : null;
  const nextPhoto = idx >= 0 && photos && idx < photos.length - 1 ? (photos[idx + 1] ?? null) : null;

  // Reset relabelling state when photo changes
  useEffect(() => { setRelabelling(false); }, [photo?.id]);

  // Keyboard: Escape = close, ArrowLeft/Right = navigate
  useEffect(() => {
    if (!photo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && prevPhoto && onNavigate) {
        log.info("op=lightbox.nav direction=prev", { photoId: prevPhoto.id });
        onNavigate(prevPhoto);
      } else if (e.key === "ArrowRight" && nextPhoto && onNavigate) {
        log.info("op=lightbox.nav direction=next", { photoId: nextPhoto.id });
        onNavigate(nextPhoto);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, prevPhoto, nextPhoto, onClose, onNavigate]);

  return (
    <Dialog.Root open={photo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            {photo?.originalFilename ?? "Zdjęcie"}
          </Dialog.Title>

          {photo && (
            <>
              <img
                src={photo.fileUrl}
                alt={photo.originalFilename}
                className="max-h-[80vh] max-w-[90vw] object-contain"
              />

              {/* Metadata strip with inline relabel */}
              <div className="mt-4 flex items-center gap-3 rounded bg-white/10 px-4 py-2 text-sm text-white">
                <span className="max-w-[200px] truncate">{photo.originalFilename}</span>
                <span>•</span>
                {onRelabel && relabelling ? (
                  <select
                    autoFocus
                    value={photo.label}
                    className="rounded bg-white/20 px-2 py-0.5 text-sm text-white"
                    onChange={(e) => {
                      const label = e.target.value as PhotoLabel;
                      log.info("op=lightbox.relabel", { photoId: photo.id, label });
                      onRelabel(photo, label);
                      setRelabelling(false);
                    }}
                    onBlur={() => setRelabelling(false)}
                  >
                    {PHOTO_LABELS.map((l) => (
                      <option key={l} value={l} className="text-black">
                        {PHOTO_LABEL_PL[l]}
                      </option>
                    ))}
                  </select>
                ) : onRelabel ? (
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => setRelabelling(true)}
                  >
                    {PHOTO_LABEL_PL[photo.label]}
                  </button>
                ) : (
                  <span>{PHOTO_LABEL_PL[photo.label]}</span>
                )}
                <span>•</span>
                <span>{(photo.sizeBytes / 1024).toFixed(0)} KB</span>
              </div>

              {/* Prev / Next navigation */}
              {photos && photos.length > 1 && onNavigate && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!prevPhoto}
                    className="rounded bg-white/10 px-4 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-30"
                    onClick={() => { if (prevPhoto) { log.info("op=lightbox.nav direction=prev", { photoId: prevPhoto.id }); onNavigate(prevPhoto); } }}
                  >
                    ← Poprzednie
                  </button>
                  <span className="text-xs text-white/60">{idx + 1} / {photos.length}</span>
                  <button
                    type="button"
                    disabled={!nextPhoto}
                    className="rounded bg-white/10 px-4 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-30"
                    onClick={() => { if (nextPhoto) { log.info("op=lightbox.nav direction=next", { photoId: nextPhoto.id }); onNavigate(nextPhoto); } }}
                  >
                    Następne →
                  </button>
                </div>
              )}
            </>
          )}

          <Dialog.Close className="absolute right-4 top-4 rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20">
            Zamknij
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
