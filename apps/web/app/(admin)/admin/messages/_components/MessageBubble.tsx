"use client";

import { createLogger } from "@/lib/log";
import { retryMessage } from "@/lib/messaging/api";
import { MessageStatusBadge } from "@/app/(admin)/admin/orders/_components/MessageStatusBadge";
import type { MessageDto } from "@/lib/messaging/types";

const log = createLogger("messaging.bubble");

interface Props {
  message: MessageDto;
  clientName: string | null;
  onRetried?: () => void;
}

/**
 * Single message bubble. INBOUND = left, OUTBOUND = right.
 * Reuses existing MessageStatusBadge from M4. ~55 LOC.
 */
export function MessageBubble({ message: m, clientName, onRetried }: Props) {
  const inbound = m.direction === "INBOUND";
  const ts = m.sentAt
    ? new Date(m.sentAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" })
    : "—";

  async function handleRetry() {
    log.info("op=retryMessage", { messageId: m.id });
    try {
      await retryMessage(m.id);
      onRetried?.();
    } catch (err) {
      log.error("op=retryMessage outcome=error", { messageId: m.id, err: String(err) });
    }
  }

  return (
    <div className={"flex " + (inbound ? "justify-start" : "justify-end")}>
      <div className={"max-w-[78%] " + (inbound ? "" : "items-end flex flex-col")}>
        <div className="text-[11px] text-admin-mute mb-1 flex items-center gap-2">
          {inbound ? (
            <><span className="font-semibold text-ink/80">{clientName ?? m.id}</span><span>·</span><span>{ts}</span></>
          ) : (
            <><span>{ts}</span><MessageStatusBadge status={m.deliveryStatus} /></>
          )}
        </div>
        <div className={(inbound ? "bg-white border border-admin-line text-ink" : "bg-ink text-paper") + " rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed"}>
          {m.body}
        </div>
        {m.deliveryStatus === "FAILED" && !inbound && (
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <span className="flex-1">{m.errorMessage ?? "Nie udało się wysłać."}</span>
            <button type="button" onClick={handleRetry} className="font-semibold hover:underline shrink-0">Wyślij ponownie →</button>
          </div>
        )}
      </div>
    </div>
  );
}
