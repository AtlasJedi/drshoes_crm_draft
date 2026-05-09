"use client";

import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PhotoCard } from "./PhotoCard";

interface Props {
  photos: Photo[];
  onCardClick: (p: Photo) => void;
  onRelabel: (p: Photo, label: PhotoLabel) => void;
  onDelete: (p: Photo) => void;
}

export function PhotoGrid({ photos, onCardClick, onRelabel, onDelete }: Props) {
  if (photos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        Brak zdjęć. Prześlij pierwsze zdjęcie.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {photos.map((p) => (
        <PhotoCard
          key={p.id}
          photo={p}
          onClick={() => onCardClick(p)}
          onRelabel={(label) => onRelabel(p, label)}
          onDelete={() => onDelete(p)}
        />
      ))}
    </div>
  );
}
