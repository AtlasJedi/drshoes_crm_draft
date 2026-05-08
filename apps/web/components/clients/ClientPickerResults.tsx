"use client";

import type { ClientSearchResult } from "@/lib/clients/types";

interface ClientPickerResultsProps {
  results: ClientSearchResult[];
  onSelect: (client: ClientSearchResult) => void;
  onAddNew: () => void;
}

/**
 * Dropdown result list for ClientPicker.
 * Extracted to keep ClientPicker.tsx under 80 LOC.
 */
export function ClientPickerResults({
  results,
  onSelect,
  onAddNew,
}: ClientPickerResultsProps) {
  return (
    <ul
      role="listbox"
      className="absolute z-30 mt-1 w-full bg-admin-surface border border-admin-line rounded-sm shadow-lg max-h-56 overflow-y-auto"
    >
      {results.length === 0 && (
        <li className="px-3 py-2 text-sm text-admin-mute">Brak wyników.</li>
      )}
      {results.map((c) => (
        <li key={c.id} role="option" aria-selected="false">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(c); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-acid/20 focus:bg-acid/20 focus:outline-none"
          >
            <span className="font-medium">{c.fullName}</span>
            <span className="ml-2 text-admin-mute">{c.phone ?? c.email ?? ""}</span>
          </button>
        </li>
      ))}
      <li role="option" aria-selected="false">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onAddNew(); }}
          className="w-full text-left px-3 py-2 text-sm text-blue hover:bg-acid/20 focus:bg-acid/20 focus:outline-none border-t border-admin-line"
        >
          + Dodaj nowego klienta
        </button>
      </li>
    </ul>
  );
}
