"use client";

// apps/web/app/(admin)/admin/sklep/_components/ReservationsQueue.tsx
// Reservations queue panel for a product in the edit panel.

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { api } from "@/lib/api";

const log = createLogger("sklep.reservationsqueue");

interface ReservationDto {
  id: string;
  productId: string;
  clientName: string;
  clientPhone: string | null;
  note: string | null;
  status: string;
  reservedAt: string;
  createdAt: string;
}

interface Props {
  productId: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ReservationsQueue({ productId }: Props) {
  const [rows, setRows] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  log.debug("op=ReservationsQueue.render", { productId });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<ReservationDto[]>(`/admin/sklep/${productId}/reservations`)
      .then((data) => {
        if (!cancelled) { setRows(data); setLoading(false); }
      })
      .catch((err) => {
        log.error("op=listReservations outcome=error", { productId, err: String(err) });
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  async function handleCancel(id: string) {
    try {
      await api.delete(`/admin/sklep/${productId}/reservations/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      log.info("op=cancelReservation outcome=ok", { productId, id });
    } catch (err) {
      log.error("op=cancelReservation outcome=error", { productId, id, err: String(err) });
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
      <div className="t-stencil mb-2" style={{ fontSize: 12, letterSpacing: ".1em" }}>
        Rezerwacje · {loading ? "…" : rows.length}
      </div>

      {!loading && rows.length === 0 && (
        <div className="t-mono opacity-55" style={{ fontSize: 11 }}>
          Brak rezerwacji
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="admin-card flex flex-col gap-1"
            style={{ padding: 10 }}
          >
            <div className="flex justify-between items-center">
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {i + 1}. {r.clientName}
              </span>
              <span className="t-mono opacity-50" style={{ fontSize: 10 }}>
                {formatWhen(r.reservedAt)}
              </span>
            </div>
            {r.clientPhone && (
              <div className="t-mono" style={{ fontSize: 11 }}>{r.clientPhone}</div>
            )}
            {r.note && (
              <div style={{ fontSize: 11, fontStyle: "italic" }}>„{r.note}&rdquo;</div>
            )}
            <div className="flex gap-1.5 mt-1 flex-wrap">
              <button className="btn-clean" style={{ fontSize: 11, padding: "2px 8px" }} type="button">
                potwierdź sprzedaż
              </button>
              <button className="btn-clean" style={{ fontSize: 11, padding: "2px 8px" }} type="button">
                pisz
              </button>
              <button
                className="btn-clean"
                style={{ fontSize: 11, padding: "2px 8px", color: "var(--red)", borderColor: "var(--red)" }}
                type="button"
                onClick={() => handleCancel(r.id)}
                aria-label={`anuluj rezerwację ${r.clientName}`}
              >
                anuluj
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
