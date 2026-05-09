"use client";

import { useRef, useState } from "react";
import { createLogger } from "@/lib/log";
import type { PhotoLabel } from "@/lib/photos/types";
import { PHOTO_LABEL_PL, PHOTO_LABELS } from "@/lib/photos/types";
import { uploadPhoto } from "@/lib/photos/api";

const log = createLogger("photo-uploader");

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

interface Props {
  orderId: string;
  onUploaded: () => void;
}

interface ProgressItem { name: string; status: "pending" | "ok" | "err"; reason?: string; }

export function PhotoUploader({ orderId, onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<PhotoLabel>("OTHER");
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    const arr = Array.from(files);
    const next: ProgressItem[] = arr.map((f) => ({ name: f.name, status: "pending" }));
    setItems(next);

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i]!;
      try {
        await uploadPhoto(orderId, f, label);
        next[i] = { name: f.name, status: "ok" };
      } catch (e) {
        const reason = e instanceof Error ? e.message : "unknown";
        log.warn("op=photo.upload outcome=failed", { name: f.name, reason });
        next[i] = { name: f.name, status: "err", reason };
      }
      setItems([...next]);
    }
    setBusy(false);
    onUploaded();
    if (next.every((i) => i.status === "ok")) {
      setOpen(false);
      setItems([]);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
      >
        Prześlij zdjęcia
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        Etykieta:
        <select
          value={label}
          onChange={(e) => setLabel(e.target.value as PhotoLabel)}
          className="rounded border px-2 py-1"
        >
          {PHOTO_LABELS.map((l) => (
            <option key={l} value={l}>{PHOTO_LABEL_PL[l]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Przesyłanie…" : "Prześlij"}
        </button>
        <button
          onClick={() => { setOpen(false); setItems([]); }}
          disabled={busy}
          className="rounded border px-3 py-1 text-sm"
        >
          Anuluj
        </button>
      </div>
      {items.length > 0 && (
        <ul className="text-xs">
          {items.map((it, i) => (
            <li key={i} className={it.status === "err" ? "text-red-600" : it.status === "ok" ? "text-green-700" : "text-neutral-500"}>
              {it.status === "ok" ? "✓ " : it.status === "err" ? "✗ " : "… "}
              {it.name}
              {it.reason && `: ${it.reason}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
