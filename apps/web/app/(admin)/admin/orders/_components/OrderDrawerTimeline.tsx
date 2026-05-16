"use client";

import { useState, useEffect, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getOrderTimeline } from "@/lib/timeline/api";
import type { TimelineEvent, TimelineEventKind } from "@/lib/timeline/types";
import { LocationMoveChip } from "./_LocationMoveChip";
import { HistoryIcon } from "./HistoryIcon";
import type { HistoryIconKind } from "./HistoryIcon";

const log = createLogger("order-timeline");

// Status hex colors for status_change icon tile (mirrors handoff design tokens)
const STATUS_COLOR: Partial<Record<string, string>> = {
  PRZYJETE:          "#2b5cff",
  W_REALIZACJI:      "#ff5a1f",
  CZEKA_NA_KLIENTA:  "#e1342b",
  GOTOWE_DO_ODBIORU: "#18b06b",
  WYDANE:            "#0a0a0a",
  ANULOWANE:         "#e1342b",
};

const KIND_LABELS_PL: Record<TimelineEventKind, string> = {
  ORDER_CREATED:        "Zlecenie utworzone",
  ORDER_UPDATED:        "Zaktualizowano zlecenie",
  ORDER_NOTE:           "Notatka",
  STATUS_CHANGED:       "Status zmieniony",
  DONE:                 "Wydane klientowi",
  ASSIGNEE_CHANGED:     "Przypisany zmieniony",
  PICKUP_DATE_CHANGED:  "Data odbioru zmieniona",
  ITEM_ADDED:           "Dodano pozycję",
  ITEM_EDITED:          "Edytowano pozycję",
  ITEM_REMOVED:         "Usunięto pozycję",
  ORDER_SOFT_DELETED:   "Zlecenie usunięte",
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

function kindToIcon(ev: TimelineEvent): { kind: HistoryIconKind; statusColor?: string } {
  switch (ev.kind) {
    case "ORDER_CREATED":  return { kind: "creation" };
    case "ORDER_NOTE":     return { kind: "note" };
    case "MESSAGE_SENT":
    case "MESSAGE_RECEIVED":
    case "MESSAGE_DELIVERED":
    case "MESSAGE_FAILED": return { kind: "message" };
    case "DONE":           return { kind: "done" };
    case "STATUS_CHANGED": {
      // Extract toStatus from labels if available; fall back to orange
      const toStatus = ev.labels?.toStatus ?? ev.labels?.orderId ?? undefined;
      return { kind: "status_change", statusColor: toStatus ? STATUS_COLOR[toStatus] : "#ff5a1f" };
    }
    default:               return { kind: "status_change", statusColor: "#6b6960" };
  }
}

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
      <p className="t-stencil" style={{ fontSize: 15, letterSpacing: ".1em", color: "var(--ink)" }}>
        Historia <span className="t-mono" style={{ fontSize: 10, color: "var(--admin-mute)", letterSpacing: ".12em" }}>· {events.length} wpisów</span>
      </p>

      {loading && <p className="text-xs text-admin-mute italic">Ładowanie historii…</p>}

      {!loading && error && (
        <div className="space-y-1">
          <p className="text-xs" style={{ color: "var(--red)" }}>Nie udało się załadować historii.</p>
          <button type="button" onClick={() => void load()} className="text-xs text-acid hover:underline font-medium">Ponów</button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-admin-mute italic">Brak zdarzeń.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {events.map((ev, i) => {
            const icon = kindToIcon(ev);
            return (
              <div key={ev.id ?? `${ev.kind}-${i}`} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "flex-start" }}>
                <HistoryIcon kind={icon.kind} statusColor={icon.statusColor} />
                <div style={{ paddingTop: 1 }}>
                  <div className="t-stencil" style={{ fontWeight: 800, fontSize: 14, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--ink)" }}>
                    {KIND_LABELS_PL[ev.kind] ?? ev.kind}
                  </div>
                  <div className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute)", marginTop: 2 }}>
                    {ev.actorFullName && <span>{ev.actorFullName} · </span>}
                    {formatTs(ev.occurredAt)}
                  </div>
                  {(ev.locationFrom != null || ev.locationTo != null) && (
                    <div className="mt-1"><LocationMoveChip from={ev.locationFrom ?? null} to={ev.locationTo ?? null} /></div>
                  )}
                  {ev.note && (
                    <blockquote style={{ marginTop: 6, padding: "8px 12px", background: "var(--paper)", borderLeft: "3px solid var(--ink)", fontSize: 13, lineHeight: 1.45 }}>
                      {ev.note}
                    </blockquote>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
