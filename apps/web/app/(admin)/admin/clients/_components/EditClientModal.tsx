"use client";

/**
 * EditClientModal — Radix Dialog for editing an existing client.
 * Pre-fills from ClientDto prop. Tri-state RODO switch.
 * < 80 LOC (form state in useEditClientModalForm).
 */
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { createLogger } from "@/lib/log";
import { useEditClientModalForm, type Channel } from "./useEditClientModalForm";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("edit-client-modal");

const CHANNEL_OPTS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDto;
}

export function EditClientModal({ open, onOpenChange, client }: EditClientModalProps) {
  const { form, setField, error, fieldError, loading, onSubmit, reset } =
    useEditClientModalForm(client, () => onOpenChange(false));

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
    log.info("op=modal", { open: v, clientId: client.id });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper text-ink p-6 rounded-2xl shadow-xl max-w-lg w-full z-50 focus:outline-none"
          aria-describedby="edit-client-desc"
        >
          <Dialog.Title className="font-display text-xl mb-1">Edytuj klienta</Dialog.Title>
          <Dialog.Description id="edit-client-desc" className="text-sm text-admin-mute mb-4">
            Zaktualizuj dane klienta.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <label className="block" htmlFor="ecm-firstName">
              <span className="text-sm font-medium text-admin-mute">Imię *</span>
              <input id="ecm-firstName" required value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-lastName">
              <span className="text-sm font-medium text-admin-mute">Nazwisko</span>
              <input id="ecm-lastName" value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-phone">
              <span className="text-sm font-medium text-admin-mute">Telefon</span>
              <input id="ecm-phone" type="tel" value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-email">
              <span className="text-sm font-medium text-admin-mute">E-mail</span>
              <input id="ecm-email" type="email" value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            {fieldError && (
              <p role="alert" className="text-sm text-orange">{fieldError}</p>
            )}
            <fieldset>
              <legend className="text-sm font-medium text-admin-mute mb-1">Preferowany kanał</legend>
              <div className="flex gap-4">
                {CHANNEL_OPTS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ecm-channel" value={value}
                      checked={form.channel === value}
                      onChange={() => setField("channel", value)}
                      className="accent-ink" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center justify-between">
              <label htmlFor="ecm-rodo" className="text-sm font-medium text-admin-mute">
                Zgoda RODO
              </label>
              <Switch.Root id="ecm-rodo" checked={form.rodoEnabled}
                onCheckedChange={(v) => setField("rodoEnabled", v)}
                className="w-10 h-6 rounded-full bg-admin-line data-[state=checked]:bg-ink transition-colors focus:outline-none focus:ring-2 focus:ring-acid"
                aria-label="Klient wyraził zgodę RODO"
              >
                <Switch.Thumb className="block w-4 h-4 bg-paper rounded-full shadow translate-x-1 data-[state=checked]:translate-x-5 transition-transform" />
              </Switch.Root>
            </div>
            <label className="block" htmlFor="ecm-notes">
              <span className="text-sm font-medium text-admin-mute">Notatki</span>
              <textarea id="ecm-notes" value={form.notes} rows={3}
                onChange={(e) => setField("notes", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid resize-none" />
            </label>
            {error && <p role="alert" className="text-sm text-orange">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <button type="button"
                  className="h-10 px-4 border border-admin-line rounded-sm text-sm hover:bg-acid/10">
                  Anuluj
                </button>
              </Dialog.Close>
              <button type="submit" disabled={loading}
                className="h-10 px-4 bg-ink text-paper font-medium rounded-sm hover:bg-admin-ink disabled:opacity-60 text-sm">
                {loading ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
