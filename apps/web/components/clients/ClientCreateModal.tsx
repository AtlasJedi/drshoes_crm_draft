"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { createClient } from "@/lib/clients/api";
import { HttpError } from "@/lib/api";
import type { ClientDto, CreateClientRequest } from "@/lib/clients/types";

const log = createLogger("client-create-modal");

interface ClientCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (client: ClientDto) => void;
}

export function ClientCreateModal({ open, onOpenChange, onCreate }: ClientCreateModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setError(null); setLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone && !email) { setError("Podaj telefon lub e-mail."); return; }
    setError(null);
    setLoading(true);
    log.info("op=createClient attempt");
    const req: CreateClientRequest = { firstName, lastName: lastName || null, phone: phone || null, email: email || null };
    try {
      const client = await createClient(req);
      log.info("op=createClient outcome=ok", { clientId: client.id });
      reset();
      onCreate(client);
    } catch (err) {
      const msg = err instanceof HttpError && (err.status === 409 || err.status === 400)
        ? "Klient z tym kontaktem już istnieje lub dane są nieprawidłowe."
        : "Wystąpił błąd. Spróbuj ponownie.";
      log.warn("op=createClient outcome=error", { status: err instanceof HttpError ? err.status : "unknown" });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); log.info("op=modal", { open: v }); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper text-ink p-6 rounded-2xl shadow-xl max-w-lg w-full z-50">
          <Dialog.Title className="font-display text-xl mb-1">Nowy klient</Dialog.Title>
          <Dialog.Description className="text-sm text-admin-mute mb-4">Wypełnij dane nowego klienta.</Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-admin-mute">Imię *</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-admin-mute">Nazwisko</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-admin-mute">Telefon</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-admin-mute">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            {error && <p role="alert" className="text-sm text-orange">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <button type="button" className="h-10 px-4 border border-admin-line rounded-sm text-sm hover:bg-acid/10">Anuluj</button>
              </Dialog.Close>
              <button type="submit" disabled={loading}
                className="h-10 px-4 bg-ink text-paper font-medium rounded-sm hover:bg-admin-ink disabled:opacity-60 text-sm">
                {loading ? "Zapisywanie…" : "Dodaj klienta"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
