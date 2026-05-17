// LocationsList — admin ledger of storage locations (graffiti warehouse vibe).
"use client";
import { createLogger } from "@/lib/log";
import type { StorageLocation } from "@/lib/types";

const log = createLogger("LocationsList");

type Props = {
  locations: StorageLocation[];
  onEdit: (l: StorageLocation) => void;
  onDeactivate: (l: StorageLocation) => void;
};

export function LocationsList({ locations, onEdit, onDeactivate }: Props) {
  log.debug("op=render", { count: locations.length });

  const active = [...locations]
    .filter((l) => l.active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pl"));
  const inactive = [...locations]
    .filter((l) => !l.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const rows = [...active, ...inactive];

  if (rows.length === 0) {
    return (
      <div className="admin-card flex flex-col items-center gap-3 py-16 text-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 7h18M3 12h18M3 17h18" />
          <path d="M7 4v16M17 4v16" />
        </svg>
        <p className="t-tag" style={{ fontSize: 20, color: "var(--admin-ink)" }}>
          Brak miejsc. Dodaj pierwsze za pomocą przycisku powyżej.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden" style={{ padding: 0 }}>
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
              <td className="t-mono" style={{ color: "var(--admin-mute)" }}>
                {String(l.position).padStart(2, "0")}
              </td>
              <td>
                <span className="t-stencil" style={{ fontSize: 17 }}>{l.name}</span>
                {!l.active && (
                  <span className="t-mono" style={{ marginLeft: 8, fontSize: 11, fontStyle: "italic", color: "var(--admin-mute)" }}>
                    (nieaktywne)
                  </span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <div className="inline-flex gap-2">
                  <button type="button" className="btn-clean" aria-label={`Edytuj ${l.name}`} onClick={() => onEdit(l)}>
                    edytuj
                  </button>
                  <button
                    type="button"
                    className="btn-clean"
                    aria-label={`Dezaktywuj ${l.name}`}
                    onClick={() => onDeactivate(l)}
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
}
