"use client";

import { useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { sendReply } from "@/lib/messaging/api";
import type { MessageThreadDto } from "@/lib/messaging/types";
import { useReplyComposerState } from "./useReplyComposerState";
import { TemplatePicker } from "./TemplatePicker";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.composer");
const SMS_MAX = 160;

interface Props {
  thread: MessageThreadDto;
  onSent: () => void;
}

/**
 * Channel-aware reply composer. State extracted to useReplyComposerState.
 * Supports: channel toggle (EMAIL/SMS), SMS char counter, ⌘+Enter send,
 * TemplatePicker, inline send-error strip.
 * Subject input removed for EMAIL — backend pins subject via followup template (v2-E).
 * Attach button is disabled ("wkrótce") per M5 scope.
 */
export function ReplyComposer({ thread, onSent }: Props) {
  const st = useReplyComposerState(thread.channel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset composer when thread changes
  useEffect(() => { st.reset(); }, [thread.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!st.body.trim() || st.sending) return;
    log.info("op=sendReply", { threadId: thread.id, channel: st.channel });
    st.setSending(true);
    st.setSendError(null);
    try {
      await sendReply(thread.id, {
        channel: st.channel,
        body: st.body,
      });
      st.reset();
      onSent();
    } catch (err) {
      log.error("op=sendReply outcome=error", { threadId: thread.id, err: String(err) });
      st.setSendError("Nie udało się wysłać. Spróbuj ponownie.");
    } finally {
      st.setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  const hasEmail = !!thread.clientEmail;
  const hasPhone = !!thread.clientPhone;
  const smsLen = st.body.length;

  return (
    <div className="border-t border-admin-line bg-white px-6 py-4 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex bg-paper border border-admin-line rounded-md p-0.5">
          {(["EMAIL", "SMS"] as const).map(ch => (
            <button
              key={ch}
              onClick={() => st.setChannel(ch)}
              disabled={ch === "EMAIL" ? !hasEmail : !hasPhone}
              className={"px-3 h-7 text-[12px] font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed " + (st.channel === ch ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-admin-mute">
          {st.channel === "EMAIL"
            ? `wyślij na ${thread.clientEmail ?? "—"}`
            : `wyślij na ${thread.clientPhone ?? "—"}`}
        </div>
      </div>
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={3}
          value={st.body}
          onChange={e => st.setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={st.channel === "EMAIL" ? "Napisz odpowiedź…" : "Napisz odpowiedź (max 160 znaków)…"}
          className="w-full px-3 py-2.5 rounded-md border border-admin-line bg-white text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40"
        />
        {st.channel === "SMS" && (
          <div className={"absolute bottom-2 right-3 text-[11px] " + (smsLen > SMS_MAX ? "text-red-600" : "text-admin-mute")}>
            {smsLen} / {SMS_MAX}
          </div>
        )}
      </div>
      {st.sendError && (
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          {st.sendError}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <IconBtn label="Załącz (wkrótce)" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </IconBtn>
          <TemplatePicker onSelect={st.fillTemplate} />
          <span className="text-[11px] text-admin-mute ml-2">⌘ + Enter — wyślij</span>
        </div>
        <button
          onClick={handleSend}
          disabled={st.sending || !st.body.trim()}
          className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-acid hover:bg-acid-deep text-ink font-semibold text-[13px] border border-ink/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>
          </svg>
          {st.sending ? "Wysyłanie…" : "Wyślij"}
        </button>
      </div>
    </div>
  );
}
