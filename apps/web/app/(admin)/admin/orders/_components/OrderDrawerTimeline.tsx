"use client";

import { useState, useEffect, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getOrderTimeline } from "@/lib/timeline/api";
import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline/types";

const log = createLogger("order-timeline");

const KIND_ICONS: Record<TimelineEventKind, string> = {
  ORDER_CREATED:        "🆕",
  ORDER_UPDATED:        "✏️",
  ORDER_NOTE:           "📝",
  STATUS_CHANGED:       "🔄",
  ASSIGNEE_CHANGED:     "👤",
  PICKUP_DATE_CHANGED:  "📅",
  ITEM_ADDED:           "➕",
  ITEM_EDITED:          "📝",
  ITEM_REMOVED:         "🗑️",
  ORDER_SOFT_DELETED:   "🗂️",
  MESSAGE_SENT:         "✉️",
  PHOTO_UPLOADED:       "📷",
  PHOTO_DELETED:        "🗑️",
  PHOTO_RELABELED:      "🏷️",
  MESSAGE_DELIVERED:    "✅",
  MESSAGE_FAILED:       "⚠️",
  MESSAGE_RECEIVED:     "📥",
  THREAD_MARKED_READ:   "✓",
  THREAD_ASSIGNED:      "👤",
  THREAD_DISCARDED:     "🗑️",
};

const KIND_LABELS_PL: Record<TimelineEventKind, string> = {
  ORDER_CREATED:        "Zamówienie utworzone",
  ORDER_UPDATED:        "Zamówienie zaktualizowane",
  ORDER_NOTE:           "Notatka",
  STATUS_CHANGED:       "Status zmieniony",
  ASSIGNEE_CHANGED:     "Przypisany zmieniony",
  PICKUP_DATE_CHANGED:  "Data odbioru zmieniona",
  ITEM_ADDED:           "Dodano pozycję",
  ITEM_EDITED:          "Edytowano pozycję",
  ITEM_REMOVED:         "Usunięto pozycję",
  ORDER_SOFT_DELETED:   "Zamówienie usunięte",
  MESSAGE_SENT:         "Wysłano wiadomość",
  PHOTO_UPLOADED:       "Przesłano zdjęcie",
  PHOTO_DELETED:        "Usunięto zdjęcie",
  PHOTO_RELABELED:      "Zmieniono etykietę zdjęcia",
  MESSAGE_DELIVERED:    "Wiadomość doręczona",
  MESSAGE_FAILED:       "Wiadomość nie doręczona",
  MESSAGE_RECEIVED:     "Otrzymano wiadomość",
  THREAD_MARKED_READ:   "Wątek oznaczony jako przeczytany",
  THREAD_ASSIGNED:      "Wątek przypisany do klienta",
  THREAD_DISCARDED:     "Wątek odrzucony",
};

const fmt = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" });

function formatTs(iso: string): string {
  try { return fmt.format(new Date(iso)); } catch { return iso; }
}

interface Props {
  orderId: string;
  refreshKey: number;
}

export function OrderDrawerTimeline({ orderId, refreshKey }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getOrderTimeline(orderId);
      log.info("op=loadTimeline outcome=ok", { orderId, count: data.length });
      setEvents(data);
    } catch (err: unknown) {
      log.warn("op=loadTimeline outcome=error", { orderId, err });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <div className="px-6 py-4 border-t border-admin-line space-y-3">
      <p className="text-xs font-medium text-admin-mute uppercase tracking-wide">Historia</p>

      {loading && (
        <p className="text-xs text-admin-mute italic">Ładowanie historii…</p>
      )}

      {!loading && error && (
        <div className="space-y-1">
          <p className="text-xs text-red-600">Nie udało się załadować historii. Spróbuj ponownie.</p>
          <button type="button" onClick={() => void load()} className="text-xs text-acid hover:underline font-medium">
            Ponów
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-admin-mute italic">Brak zdarzeń.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <ol className="space-y-2">
          {events.map((ev, i) => (
            <li key={ev.id ?? `${ev.kind}-${i}`} className="flex gap-2 text-xs">
              <span className="mt-0.5 shrink-0" aria-hidden="true">{KIND_ICONS[ev.kind]}</span>
              <div className="min-w-0">
                <span className="font-medium text-ink">{KIND_LABELS_PL[ev.kind]}</span>
                {ev.actorFullName && (
                  <span className="text-admin-mute"> · {ev.actorFullName}</span>
                )}
                <div className="text-admin-mute">{formatTs(ev.occurredAt)}</div>
                {ev.note && (
                  <blockquote className="mt-1 border-l-2 border-gray-300 pl-2 text-sm text-gray-700">
                    {ev.note}
                  </blockquote>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
