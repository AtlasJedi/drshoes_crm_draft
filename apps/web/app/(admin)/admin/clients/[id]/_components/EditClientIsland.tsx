"use client";
/**
 * CC island: "Edytuj" button that opens EditClientModal.
 * ~20 LOC.
 */
import { useState } from "react";
import type { ClientDto } from "@/lib/clients/types";
import { EditClientModal } from "@/app/(admin)/admin/clients/_components/EditClientModal";

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
      <EditClientModal open={open} onOpenChange={setOpen} client={client} />
    </>
  );
}
