"use client";

import { useEffect, useState, useCallback } from "react";
import { getOrderMessages } from "@/lib/messaging/api";
import type { MessageDto } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";
import { MessageRow } from "./MessageRow";

const log = createLogger("messaging.thread");

interface Props {
  orderId: string;
  refreshKey: number;
  onComposeClick: () => void;
}

export function OrderDrawerMessages({ orderId, refreshKey, onComposeClick }: Props) {
  const [items, setItems] = useState<MessageDto[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await getOrderMessages(orderId);
      setItems(data);
      setState("ok");
      log.info("op=load outcome=ok", { orderId, count: data.length });
    } catch (e) {
      setState("err");
      log.warn("op=load outcome=error", { orderId, err: String(e) });
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

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
            onClick={() => void load()}
            className="text-xs text-acid hover:underline font-medium"
          >
            Ponów
          </button>
        </div>
      )}

      {state === "ok" && items.length === 0 && (
        <p className="text-xs text-admin-mute italic">Brak wiadomości.</p>
      )}

      {state === "ok" && items.length > 0 && (
        <div className="space-y-0">
          {items.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
        </div>
      )}
    </section>
  );
}
