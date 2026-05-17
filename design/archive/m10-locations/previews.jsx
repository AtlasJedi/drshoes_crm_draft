// Live previews — plain JSX reimplementations of the 6 deliverables.
// These mirror the .tsx files but drop TypeScript and external imports
// (@radix-ui, @/lib/*) so they can render here without a build step.
window.M10 = window.M10 || {};

const { useState, useEffect, useId } = React;

// ─── 1. LocationsList ──────────────────────────────────────────────
window.M10.LocationsList = function LocationsList({ locations, onEdit, onDeactivate }) {
  const active = [...locations]
    .filter((l) => l.active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pl"));
  const inactive = [...locations]
    .filter((l) => !l.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const rows = [...active, ...inactive];

  if (rows.length === 0) {
    return (
      <div className="admin-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 24px", textAlign: "center" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 7h18M3 12h18M3 17h18" />
          <path d="M7 4v16M17 4v16" />
        </svg>
        <p className="t-tag" style={{ fontSize: 20, margin: 0, color: "var(--admin-ink, #1a1a1c)" }}>
          Brak miejsc. Dodaj pierwsze za pomocą przycisku powyżej.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 56 }}>#</th>
            <th>Miejsce</th>
            <th style={{ width: 240, textAlign: "right" }}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} data-active={l.active} style={{ opacity: l.active ? 1 : 0.5 }}>
              <td className="t-mono" style={{ color: "var(--admin-mute, #6b6960)" }}>
                {String(l.position).padStart(2, "0")}
              </td>
              <td>
                <span className="t-stencil" style={{ fontSize: 17 }}>{l.name}</span>
                {!l.active && (
                  <span className="t-mono" style={{ marginLeft: 8, fontSize: 11, fontStyle: "italic", color: "var(--admin-mute, #6b6960)" }}>
                    (nieaktywne)
                  </span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ display: "inline-flex", gap: 8 }}>
                  <button type="button" className="btn-clean" aria-label={`Edytuj ${l.name}`} onClick={() => onEdit && onEdit(l)}>
                    edytuj
                  </button>
                  <button
                    type="button"
                    className="btn-clean"
                    aria-label={`Dezaktywuj ${l.name}`}
                    onClick={() => onDeactivate && onDeactivate(l)}
                    disabled={!l.active}
                  >
                    dezaktywuj
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── 2. LocationFormModal (inline-rendered preview, no portal) ─────
window.M10.LocationFormModal = function LocationFormModal({ target, onClose }) {
  const [name, setName] = useState(target ? target.name : "");
  const [error, setError] = useState(target && target.simulateError ? "Miejsce o tej nazwie już istnieje." : null);
  const [busy] = useState(!!(target && target.simulateBusy));
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 64;

  return (
    <div
      style={{
        width: 440, maxWidth: "100%",
        padding: 24,
        background: "var(--paper)",
        border: "2px solid var(--ink)",
        boxShadow: "-6px 6px 0 var(--magenta, #ff2e7e), -6px 6px 0 1.5px var(--ink)",
      }}
    >
      <div className="t-display" style={{ fontSize: 22, margin: 0 }}>
        {target && target.name ? `Edytuj: ${target.name}` : "Nowe miejsce"}
      </div>
      <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="field">
          <label htmlFor="loc-name-preview">Nazwa</label>
          <input
            id="loc-name-preview"
            maxLength={64}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="np. półka 1"
          />
          <div className="t-mono" style={{ fontSize: 11, minHeight: 16, color: "var(--red)" }}>
            {error || ""}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-clean" onClick={() => onClose && onClose(false)} disabled={busy}>
            anuluj
          </button>
          <button type="submit" className="btn-clean primary" disabled={!valid || busy}>
            {busy ? "zapisuję..." : "zapisz"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── 3. OrderDrawerNoteComposer ────────────────────────────────────
window.M10.OrderDrawerNoteComposer = function OrderDrawerNoteComposer({ currentLocation, locations, presetError }) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState(currentLocation || "");
  const [error, setError] = useState(presetError || null);

  const noteEmpty = text.trim() === "";
  const locUnchanged = (target || null) === (currentLocation || null);
  const disabled = noteEmpty && locUnchanged;

  return (
    <section style={{ marginTop: 16, paddingTop: 16, borderTop: "2px dashed var(--ink)" }}>
      <div
        className="t-mono"
        style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--admin-mute, #6b6960)", marginBottom: 12 }}
      >
        Dodaj wpis do historii
      </div>
      <div className="field">
        <label htmlFor="composer-note">Co się stało? (opcjonalne)</label>
        <textarea
          id="composer-note"
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="np. wyczyszczony elo"
        />
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="composer-loc">Miejsce</label>
          <select id="composer-loc" value={target} onChange={(e) => { setTarget(e.target.value); setError(null); }}>
            <option value="">— bez miejsca —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-clean primary" disabled={disabled}>
          dodaj wpis
        </button>
      </div>
      <div className="t-mono" style={{ marginTop: 8, fontSize: 11, minHeight: 16, color: "var(--red)" }}>
        {error || ""}
      </div>
    </section>
  );
};

// ─── 4. LocationMoveChip ───────────────────────────────────────────
window.M10.LocationMoveChip = function LocationMoveChip({ from, to }) {
  if (from == null && to == null) return null;
  const chip = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "1.5px solid var(--ink)", background: "var(--paper-2)",
    fontFamily: "var(--font-mono)", fontSize: 11,
    padding: "2px 8px", lineHeight: 1.4, whiteSpace: "nowrap",
  };
  if (from != null && to != null) {
    return (
      <span style={chip}>
        <span aria-hidden>📍</span>
        <span style={{ fontStyle: "italic", color: "var(--admin-mute, #6b6960)" }}>{from}</span>
        <span aria-hidden>→</span>
        <strong>{to}</strong>
      </span>
    );
  }
  return (
    <span style={chip}>
      <span aria-hidden>📍</span>
      <span>do <strong>{to}</strong></span>
    </span>
  );
};
