"use client";

/**
 * Form state and submit logic for EditClientModal.
 * Extracted to keep EditClientModal.tsx under 80 LOC.
 * < 80 LOC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLogger } from "@/lib/log";
import { updateClient } from "@/lib/clients/api";
import { HttpError } from "@/lib/api";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("edit-client-modal-form");

export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export interface EditFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  channel: Channel;
  rodoEnabled: boolean;
  notes: string;
}

export function initFormState(client: ClientDto): EditFormState {
  return {
    firstName: client.firstName ?? "",
    lastName: client.lastName ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    channel: (client.preferredChannel as Channel) ?? "EMAIL",
    rodoEnabled: client.rodoConsentAt !== null && client.rodoConsentAt !== undefined,
    notes: client.notes ?? "",
  };
}

export function useEditClientModalForm(
  client: ClientDto,
  onClose: () => void,
) {
  const router = useRouter();
  const [form, setForm] = useState<EditFormState>(() => initFormState(client));
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim() && !form.email.trim()) {
      setFieldError("Musi być telefon lub e-mail.");
      return;
    }
    setFieldError(null);
    setError(null);
    setLoading(true);
    log.info("op=editClient attempt", { clientId: client.id });
    try {
      // Determine rodoConsent tri-state relative to original value.
      const wasGranted = client.rodoConsentAt !== null && client.rodoConsentAt !== undefined;
      let rodoConsent: boolean | null = null;
      if (form.rodoEnabled && !wasGranted) rodoConsent = true;
      if (!form.rodoEnabled && wasGranted) rodoConsent = false;

      await updateClient(client.id, {
        firstName: form.firstName || undefined,
        lastName: form.lastName || null,
        phone: form.phone || null,
        email: form.email || null,
        preferredChannel: form.channel,
        rodoConsent,
        notes: form.notes || null,
      });
      log.info("op=editClient outcome=ok", { clientId: client.id });
      onClose();
      router.refresh();
    } catch (err) {
      const is400 = err instanceof HttpError && err.status === 400;
      const msg = is400
        ? "Dane są nieprawidłowe. Sprawdź formularz."
        : "Wystąpił błąd serwera. Spróbuj ponownie.";
      log.warn("op=editClient outcome=error", {
        clientId: client.id,
        status: err instanceof HttpError ? err.status : "unknown",
      });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(initFormState(client));
    setError(null);
    setFieldError(null);
    setLoading(false);
  }

  return { form, setField, error, fieldError, loading, onSubmit, reset };
}
