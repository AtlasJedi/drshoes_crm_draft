"use client";

/**
 * NewPlaylistModal — designer State E modal, 1:1 port.
 * Used for both "+ Nowa playlista" and "Zapisz kolejkę jako playlistę".
 * ~60 LOC.
 */

import { useRef, useState, useEffect } from "react";

const PRESETS = ["poranek", "lo-fi", "klasyka", "piątek", "cardio", "renowacje"];

interface Props {
  /** If provided, modal header hint shows queue-capture mode */
  queueMode?: boolean;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

export function NewPlaylistModal({ queueMode = false, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Podaj nazwę playlisty."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? "network";
      if (msg === "duplicate_name") setError("Playlista o tej nazwie już istnieje.");
      else if (msg === "invalid_name") setError("Nieprawidłowa nazwa.");
      else setError("Nie udało się zapisać. Spróbuj jeszcze raz.");
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleSave();
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className="modal-back"
      role="dialog"
      aria-modal="true"
      aria-label="Nowa playlista"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-tape">{queueMode ? "zapisz kolejkę · shared" : "nowa playlista · shared"}</div>
        <div className="modal-h">
          <h2>Nowa playlista</h2>
          <button type="button" className="x-btn" aria-label="Zamknij" onClick={onClose}>✕</button>
        </div>
        <div className="modal-b">
          <div className="lbl-row">
            <span><span className="req">*</span>Nazwa playlisty</span>
            <span>widoczna dla całej pracowni</span>
          </div>
          <div className="modal-input">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKey}
              maxLength={120}
              placeholder="np. Piątek wieczór · slow"
              aria-label="Nazwa playlisty"
            />
          </div>
          {error && (
            <div role="alert" style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }}>
              {error}
            </div>
          )}
          <div className="modal-hint">
            Playlisty są <b style={{ color: "var(--ink)" }}>wspólne</b> — każdy w pracowni może dodawać i usuwać utwory.
            {queueMode && " Wszystkie utwory z kolejki zostaną dodane."}
          </div>
          <div className="modal-presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setName(p)}>{p}</button>
            ))}
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn-ghost" onClick={onClose}>Anuluj</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Zapisuję…" : "Zapisz playlistę"}
          </button>
        </div>
      </div>
    </div>
  );
}
