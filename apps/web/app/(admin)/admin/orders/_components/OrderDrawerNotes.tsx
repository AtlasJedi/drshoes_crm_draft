"use client";

import { useEffect, useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getOrderTimeline } from "@/lib/timeline/api";
import type { TimelineEvent } from "@/lib/timeline/types";
import { LocationMoveChip } from "./_LocationMoveChip";

const log = createLogger("order-drawer-notes");

const fmt = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

interface Props {
  orderId: string;
  refreshKey: number;
}

export function OrderDrawerNotes({ orderId, refreshKey }: Props) {
  log.debug("op=OrderDrawerNotes.render", { orderId, refreshKey });
  const [notes, setNotes] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const events = await getOrderTimeline(orderId);
      const withNote = events.filter(
        (ev) => ev.note || ev.kind === "ORDER_NOTE"
      );
      log.info("op=loadNotes outcome=ok", { orderId, count: withNote.length });
      setNotes(withNote);
    } catch (err) {
      log.warn("op=loadNotes outcome=error", { orderId, err });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <div className="px-5 py-4 border-t border-admin-line">
      <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em", marginBottom: 10 }}>
        Notatki wewnętrzne
      </div>

      {loading && (
        <p className="t-mono text-xs opacity-55">Ładowanie…</p>
      )}

      {!loading && notes.length === 0 && (
        <p className="t-mono text-xs opacity-55">Brak notatek wewnętrznych</p>
      )}

      {!loading && notes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((ev, i) => (
            <div
              key={ev.id ?? `note-${i}`}
              data-note-card
              style={{
                background: "#fef4a8",
                padding: 12,
                border: "1.5px solid var(--ink)",
                transform: `rotate(${i % 2 === 0 ? -0.3 : 0.4}deg)`,
              }}
            >
              <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>
                {ev.actorFullName ?? "operator"} · {fmt.format(new Date(ev.occurredAt))}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{ev.note}</div>
              {(ev.locationFrom || ev.locationTo) && (
                <div className="mt-1">
                  <LocationMoveChip from={ev.locationFrom ?? null} to={ev.locationTo ?? null} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
