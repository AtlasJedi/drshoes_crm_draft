"use client";
/**
 * CC island: "Edytuj" button that will open EditClientModal (task 7-15).
 * Stub: button is rendered but modal is a no-op until 7-15 replaces this.
 * ~20 LOC.
 */
import { useState } from "react";
import type { ClientDto } from "@/lib/clients/types";

interface Props { client: ClientDto }

export function EditClientIsland({ client }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-client-id={client.id}
        onClick={() => setOpen(true)}
        className="shrink-0 px-4 py-2 rounded border-2 border-ink bg-white text-sm font-medium shadow-[2px_2px_0_var(--ink)] hover:bg-acid/10 transition-colors"
      >
        Edytuj
      </button>
      {/* TODO(7-15): replace with <EditClientModal open={open} onClose={() => setOpen(false)} client={client} /> */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-6 shadow-xl text-sm">
            <p className="mb-4 text-admin-mute">Modal w trakcie implementacji (task 7-15).</p>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border border-admin-line text-sm">
              Zamknij
            </button>
          </div>
        </div>
      )}
    </>
  );
}
