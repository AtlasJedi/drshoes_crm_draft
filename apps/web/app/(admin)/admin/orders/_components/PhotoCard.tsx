"use client";

import { useState } from "react";
import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PHOTO_LABEL_PL, PHOTO_LABELS } from "@/lib/photos/types";

interface Props {
  photo: Photo;
  onClick: () => void;
  onRelabel: (label: PhotoLabel) => void;
  onDelete: () => void;
}

export function PhotoCard({ photo, onClick, onRelabel, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative aspect-square overflow-hidden rounded border bg-neutral-100">
      <img
        src={photo.fileUrl}
        alt={photo.originalFilename}
        loading="lazy"
        className="h-full w-full cursor-zoom-in object-cover"
        onClick={onClick}
      />
      <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
        {PHOTO_LABEL_PL[photo.label]}
      </span>
      <button
        type="button"
        className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
        aria-label="Opcje zdjęcia"
      >
        ⋯
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-9 z-10 min-w-[160px] rounded border bg-white p-1 shadow-lg">
          {PHOTO_LABELS.map((l) => (
            <button
              key={l}
              type="button"
              disabled={l === photo.label}
              className="block w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-neutral-100 disabled:opacity-40"
              onClick={() => { onRelabel(l); setMenuOpen(false); }}
            >
              {PHOTO_LABEL_PL[l]}
            </button>
          ))}
          <hr className="my-1 border-neutral-200" />
          <button
            type="button"
            className="block w-full cursor-pointer rounded px-2 py-1 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => { onDelete(); setMenuOpen(false); }}
          >
            Usuń
          </button>
        </div>
      )}
    </div>
  );
}
