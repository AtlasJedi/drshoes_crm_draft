// LocationFormModal — Radix dialog to create or rename a storage location.
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { createLogger } from "@/lib/log";
import { createLocation, updateLocation } from "@/lib/locations";

const log = createLogger("LocationFormModal");

type Target = { id: number; name: string; position: number; active: boolean };
type Props = { target?: Target; onClose: (didSave: boolean) => void };

export function LocationFormModal({ target, onClose }: Props) {
  log.debug("op=render", { editing: !!target });
  const [name, setName] = useState(target?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 64;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (target) await updateLocation(target.id, { name: trimmed });
      else await createLocation(trimmed);
      onClose(true);
    } catch (err: unknown) {
      setError(
        (err as { code?: string })?.code === "location_name_conflict"
          ? "Miejsce o tej nazwie już istnieje."
          : "Nie udało się zapisać. Spróbuj ponownie.",
      );
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !busy && onClose(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 p-6"
          style={{
            background: "var(--paper)",
            border: "2px solid var(--ink)",
            boxShadow: "-6px 6px 0 var(--magenta), -6px 6px 0 1.5px var(--ink)",
          }}
        >
          <Dialog.Title className="t-display" style={{ fontSize: 22, margin: 0 }}>
            {target ? `Edytuj: ${target.name}` : "Nowe miejsce"}
          </Dialog.Title>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <div className="field">
              <label htmlFor="loc-name">Nazwa</label>
              <input
                id="loc-name"
                autoFocus
                maxLength={64}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. półka 1"
              />
              <div className="t-mono" style={{ fontSize: 11, minHeight: 16, color: "var(--red)" }}>
                {error ?? ""}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-clean" onClick={() => onClose(false)} disabled={busy}>
                anuluj
              </button>
              <button type="submit" className="btn-clean primary" disabled={!valid || busy}>
                {busy ? "zapisuję..." : "zapisz"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
