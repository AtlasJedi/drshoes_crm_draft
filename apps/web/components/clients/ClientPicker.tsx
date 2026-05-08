"use client";

import { useState, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { searchClients, getClient } from "@/lib/clients/api";
import type { ClientDto, ClientSearchResult } from "@/lib/clients/types";
import { ClientPickerResults } from "./ClientPickerResults";
import { ClientCreateModal } from "./ClientCreateModal";

const log = createLogger("client-picker");

interface ClientPickerProps {
  value: ClientDto | ClientSearchResult | null;
  onChange: (client: ClientDto) => void;
  disabled?: boolean;
}

function chipLabel(c: ClientDto | ClientSearchResult): string {
  if ("fullName" in c) {
    return `${c.fullName} · ${c.phone ?? c.email ?? "—"}`;
  }
  return `${c.firstName} ${c.lastName ?? ""} · ${c.phone ?? c.email ?? "—"}`.trim();
}

export function ClientPicker({ value, onChange, disabled }: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    log.debug("op=search input", { qLen: query.length });
    const id = setTimeout(async () => {
      log.info("op=searchClients", { qLen: query.length });
      const hits = await searchClients(query).catch(() => []);
      log.info("op=searchClients result", { qLen: query.length, hits: hits.length });
      setResults(hits);
      setOpen(true);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  async function handleSelect(c: ClientSearchResult) {
    log.info("op=selectClient", { clientId: c.id });
    const full = await getClient(c.id);
    onChange(full);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border border-admin-line rounded-sm bg-admin-surface">
        <span className="flex-1 text-sm truncate">{chipLabel(value)}</span>
        {!disabled && (
          <button type="button" onClick={handleClear} aria-label="Wyczyść" className="text-admin-mute hover:text-ink text-xs">
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder="Wyszukaj klienta…"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          className="w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid disabled:opacity-60"
        />
        {open && (
          <ClientPickerResults
            results={results}
            onSelect={handleSelect}
            onAddNew={() => { setOpen(false); setModalOpen(true); }}
          />
        )}
      </div>
      <ClientCreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreate={(c) => { onChange(c); setModalOpen(false); }}
      />
    </>
  );
}
