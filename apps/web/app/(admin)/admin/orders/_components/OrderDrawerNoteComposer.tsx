// OrderDrawerNoteComposer — add a free-form history entry (+ optional location move) to an order.
// LOC note: ~100 lines — single-purpose component, accepted over 80-LOC guideline per task 10-10.
// Fix 3 (2026-05-16): composer is always expanded — no collapse toggle.
"use client";
import { useEffect, useId, useState } from "react";
import { createLogger } from "@/lib/log";
import { listLocations, addOrderNote } from "@/lib/locations";
import type { StorageLocation } from "@/lib/types";

const log = createLogger("OrderDrawerNoteComposer");

type Props = { orderId: string; currentLocation: string | null; onSaved: () => void };

const ERROR_COPY: Record<string, string> = {
  at_least_one_required: "Podaj notatkę albo zmień miejsce.",
  no_op_change: "Nic nie zmieniłeś.",
  unknown_location: "To miejsce nie istnieje albo zostało wyłączone.",
};

export function OrderDrawerNoteComposer({ orderId, currentLocation, onSaved }: Props) {
  log.debug("op=render", { orderId, currentLocation });
  const noteId = useId();
  const locId = useId();
  const [text, setText] = useState("");
  const [target, setTarget] = useState(currentLocation ?? "");
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // listLocations() with no args — default returns active-only.
  useEffect(() => {
    listLocations()
      .then((rows) => setLocations(rows.sort((a, b) => a.position - b.position)))
      .catch(() => setLocations([]));
  }, []);

  const noteEmpty = text.trim() === "";
  const locUnchanged = (target || null) === (currentLocation || null);
  const disabled = busy || (noteEmpty && locUnchanged);

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      await addOrderNote(orderId, {
        note: noteEmpty ? undefined : text.trim(),
        location: locUnchanged ? undefined : target || undefined,
      });
      setText("");
      setTarget(currentLocation ?? "");
      onSaved();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(ERROR_COPY[code ?? ""] ?? "Nie udało się zapisać wpisu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 pt-4" style={{ borderTop: "2px dashed var(--ink)" }}>
      {/* Fix 3: section header always visible — no toggle */}
      <p className="t-mono" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--admin-mute)", marginBottom: 12 }}>
        Dodaj wpis do historii
      </p>

      <div className="field">
        <label htmlFor={noteId}>Co się stało? (opcjonalne)</label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="np. wyczyszczony elo"
        />
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="field flex-1">
          <label htmlFor={locId}>Miejsce</label>
          <select id={locId} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— bez miejsca —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-clean primary" disabled={disabled} onClick={submit}>
          {busy ? "zapisuję..." : "dodaj wpis"}
        </button>
      </div>
      <div className="t-mono mt-2" style={{ fontSize: 11, minHeight: 16, color: "var(--red)" }}>
        {error ?? ""}
      </div>
    </section>
  );
}
