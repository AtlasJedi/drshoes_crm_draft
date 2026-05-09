"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { listPhotos, relabelPhoto, deletePhoto } from "@/lib/photos/api";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoUploader } from "./PhotoUploader";
import { PhotoLightbox } from "./PhotoLightbox";

const log = createLogger("order-drawer-photos");

export function OrderDrawerPhotos({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);

  async function refresh() {
    try {
      const list = await listPhotos(orderId);
      setPhotos(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się pobrać zdjęć.";
      log.warn("op=photos.list outcome=failed", { orderId, msg });
      setError(msg);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function onRelabel(p: Photo, label: PhotoLabel) {
    try {
      await relabelPhoto(p.id, label);
      await refresh();
    } catch (e) {
      log.warn("op=photos.relabel outcome=failed", { photoId: p.id });
      setError(e instanceof Error ? e.message : "Zmiana etykiety nie powiodła się.");
    }
  }

  async function onDelete(p: Photo) {
    if (!confirm("Usunąć zdjęcie? Tej akcji nie da się cofnąć.")) return;
    try {
      await deletePhoto(p.id);
      await refresh();
    } catch (e) {
      log.warn("op=photos.delete outcome=failed", { photoId: p.id });
      setError(e instanceof Error ? e.message : "Usunięcie nie powiodło się.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoUploader orderId={orderId} onUploaded={refresh} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {photos === null
        ? <p className="text-sm text-neutral-500">Ładowanie…</p>
        : <PhotoGrid photos={photos} onCardClick={setOpen} onRelabel={onRelabel} onDelete={onDelete} />}
      <PhotoLightbox
        photo={open}
        photos={photos ?? undefined}
        onClose={() => setOpen(null)}
        onNavigate={setOpen}
        onRelabel={onRelabel}
      />
    </div>
  );
}
