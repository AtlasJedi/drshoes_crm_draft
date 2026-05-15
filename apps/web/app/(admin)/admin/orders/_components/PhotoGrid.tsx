"use client";
// 6-column photo grid with relative wrappers for label overlay + dashed upload tile.

import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PhotoCard } from "./PhotoCard";

interface Props {
  photos: Photo[];
  onCardClick: (p: Photo) => void;
  onRelabel: (p: Photo, label: PhotoLabel) => void;
  onDelete: (p: Photo) => void;
}

export function PhotoGrid({ photos, onCardClick, onRelabel, onDelete }: Props) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {photos.map((p) => (
        <div key={p.id} className="relative">
          <PhotoCard
            photo={p}
            onClick={() => onCardClick(p)}
            onRelabel={(label) => onRelabel(p, label)}
            onDelete={() => onDelete(p)}
          />
        </div>
      ))}
      {/* Dashed upload tile — TODO M10: wire file picker */}
      <div
        style={{
          aspectRatio: "1",
          border: "1.5px dashed var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(0,0,0,0.4)",
          fontSize: 22,
          cursor: "pointer",
        }}
        aria-label="Dodaj zdjęcie"
        role="button"
        tabIndex={0}
      >
        +
      </div>
    </div>
  );
}
