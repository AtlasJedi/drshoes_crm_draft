"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderMessages, retryMessage } from "@/lib/messaging/api";
import type { MessageDto } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";
import { MessageStatusBadge } from "./MessageStatusBadge";

const log = createLogger("messaging.thread");
const POLL_INTERVAL_MS = 10_000;

interface Props {
  orderId: string;
  refreshKey: number;
  onComposeClick: () => void;
}

export function OrderDrawerMessages({ orderId, refreshKey, onComposeClick }: Props) {
  const [items, setItems]   = useState<MessageDto[]>([]);
  const [state, setState]   = useState<"loading" | "ok" | "err">("loading");
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    try {
      const data = await getOrderMessages(orderId);
      setItems(data);
      if (!silent) setState("ok");
      log.info("op=poll.thread outcome=ok", { orderId, count: data.length });
    } catch (e) {
      if (!silent) setState("err");
      log.warn("op=poll.thread outcome=stale-error", { orderId, err: String(e) });
    }
  }, [orderId]);

  // Initial + refreshKey-driven load with race-cancel guard
  useEffect(() => {
    let cancelled = false;
    void load(false).then(() => {
      if (cancelled) return; // discard result if orderId changed before load completed
    });
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  // 10s polling while drawer is mounted
  useEffect(() => {
    pollRef.current = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, [load]);

  async function handleRetry(msg: MessageDto) {
    setRetrying((prev) => new Set(prev).add(msg.id));
    setRetryError((prev) => { const n = { ...prev }; delete n[msg.id]; return n; });
    try {
      log.info("op=message.retry outcome=start", { messageId: msg.id });
      await retryMessage(msg.id);
      log.info("op=message.retry outcome=ok", { messageId: msg.id });
      await load(false);
    } catch (e: unknown) {
      let errText = "Nie udało się ponowić — spróbuj ponownie.";
      if (e && typeof e === "object") {
        const resp = e as { status?: number; body?: { code?: string } };
        if (resp.status === 404) {
          errText = "Nie znaleziono wiadomości.";
        } else if (resp.status === 409 || resp.body?.code === "NOT_RETRYABLE") {
          errText = "Wiadomość nie kwalifikuje się do ponowienia.";
        }
      }
      log.warn("op=message.retry outcome=failed", { messageId: msg.id, err: String(e) });
      setRetryError((prev) => ({ ...prev, [msg.id]: errText }));
    } finally {
      setRetrying((prev) => { const n = new Set(prev); n.delete(msg.id); return n; });
    }
  }

  return (
    <section className="px-6 py-4 border-t border-admin-line">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-medium text-admin-mute uppercase tracking-wide">
          Komunikacja z klientem
        </p>
        <button
          type="button"
          onClick={onComposeClick}
          className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-acid text-paper hover:bg-acid/90 transition-colors"
        >
          Wyślij wiadomość
        </button>
      </div>

      {state === "loading" && (
        <p className="text-xs text-admin-mute italic">Ładowanie wiadomości…</p>
      )}

      {state === "err" && (
        <div className="space-y-1">
          <p className="text-xs text-red-600">Nie udało się załadować wiadomości.</p>
          <button
            type="button"
            onClick={() => void load(false)}
            className="text-xs text-acid hover:underline font-medium"
          >
            Ponów
          </button>
        </div>
      )}

      {state === "ok" && items.length === 0 && (
        <p className="text-xs text-admin-mute italic">Brak wiadomości.</p>
      )}

      {(state === "ok" || items.length > 0) && (
        <div className="space-y-3 mt-1">
          {items.map((msg) => (
            <div key={msg.id} className="text-sm border border-admin-line rounded p-3 space-y-1">
              {/* Retry-chain indicator */}
              {msg.retryOfMessageId !== null && (
                <span className="text-xs text-admin-mute" aria-label="Ponowienie wiadomości">↳ </span>
              )}

              {/* Channel + status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-admin-mute">{msg.channel}</span>
                {msg.direction === "OUTBOUND" && (
                  <MessageStatusBadge status={msg.deliveryStatus} />
                )}
              </div>

              {/* Body */}
              <p className="text-ink whitespace-pre-wrap">{msg.body}</p>

              {/* FAILED: error message + retry button */}
              {msg.direction === "OUTBOUND" && msg.deliveryStatus === "FAILED" && (
                <div className="space-y-1 pt-1">
                  {msg.errorMessage && (
                    <p className="text-xs text-red-600">{msg.errorMessage}</p>
                  )}
                  {retryError[msg.id] && (
                    <p className="text-xs text-red-600">{retryError[msg.id]}</p>
                  )}
                  <button
                    type="button"
                    disabled={retrying.has(msg.id)}
                    onClick={() => void handleRetry(msg)}
                    className="text-xs px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {retrying.has(msg.id) ? "Wysyłanie…" : "Wyślij ponownie"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
