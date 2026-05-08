"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { createTemplate, updateTemplate, deleteTemplate } from "@/lib/messaging/api";
import type { TemplateDto, Channel } from "@/lib/messaging/types";

const log = createLogger("template-form");

interface Props {
  initial?: TemplateDto;
}

export function TemplateForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "EMAIL");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const inputCls =
    "w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm";
  const labelCls = "block text-sm font-medium text-admin-ink mb-1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    setIsError(false);

    try {
      const payload = {
        name,
        channel,
        subject: channel === "EMAIL" ? (subject || null) : null,
        body,
        active,
      };

      if (initial) {
        await updateTemplate(initial.id, payload);
        log.info("op=updateTemplate outcome=success", { id: initial.id });
      } else {
        await createTemplate(payload);
        log.info("op=createTemplate outcome=success", { name });
      }

      setFeedback("Zapisano");
      router.push("/admin/templates" as Route);
      router.refresh();
    } catch (err) {
      log.error("op=save outcome=error", { err: String(err) });
      setFeedback("Nie udało się zapisać. Spróbuj ponownie.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!confirm("Usunąć szablon? Tej operacji nie można cofnąć.")) return;

    try {
      await deleteTemplate(initial.id);
      log.info("op=deleteTemplate outcome=success", { id: initial.id });
      router.push("/admin/templates" as Route);
      router.refresh();
    } catch (err) {
      log.error("op=deleteTemplate outcome=error", { err: String(err) });
      setFeedback("Nie udało się usunąć szablonu.");
      setIsError(true);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 max-w-2xl">
      {/* Name */}
      <div>
        <label htmlFor="name" className={labelCls}>
          Nazwa <span className="text-magenta">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          required
          disabled={submitting}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="np. Potwierdzenie przyjęcia"
        />
      </div>

      {/* Channel */}
      <div>
        <label htmlFor="channel" className={labelCls}>Kanał</label>
        <select
          id="channel"
          value={channel}
          disabled={submitting}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className={inputCls + " bg-white"}
        >
          <option value="EMAIL">EMAIL</option>
          <option value="SMS">SMS</option>
        </select>
      </div>

      {/* Subject — email only */}
      {channel === "EMAIL" && (
        <div>
          <label htmlFor="subject" className={labelCls}>Temat</label>
          <input
            id="subject"
            type="text"
            value={subject ?? ""}
            disabled={submitting}
            onChange={(e) => setSubject(e.target.value)}
            className={inputCls}
            placeholder="Temat wiadomości e-mail"
          />
        </div>
      )}

      {/* Body */}
      <div>
        <label htmlFor="body" className={labelCls}>
          Treść <span className="text-magenta">*</span>
        </label>
        <p className="text-xs text-admin-mute mb-1">
          Zmienne: {"{{clientName}}"}, {"{{orderNumber}}"}, {"{{shopName}}"}
        </p>
        <textarea
          id="body"
          value={body}
          required
          disabled={submitting}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm resize-y"
          placeholder="Treść wiadomości…"
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          checked={active}
          disabled={submitting}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-admin-line accent-acid"
        />
        <label htmlFor="active" className="text-sm text-admin-ink cursor-pointer">
          Aktywny
        </label>
      </div>

      {/* Feedback */}
      {feedback && (
        <p
          aria-live="polite"
          className={`text-sm ${isError ? "text-magenta" : "text-green-600"}`}
        >
          {feedback}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded bg-acid text-ink font-medium text-sm hover:bg-acid/80 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Zapisywanie…" : "Zapisz"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="px-5 py-2 rounded border border-magenta text-magenta font-medium text-sm hover:bg-magenta/10 disabled:opacity-50 transition-colors"
          >
            Usuń
          </button>
        )}
      </div>
    </form>
  );
}
