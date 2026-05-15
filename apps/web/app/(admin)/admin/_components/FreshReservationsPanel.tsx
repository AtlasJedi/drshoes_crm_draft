"use client";

/**
 * FreshReservationsPanel — latest 3 product reservations from the backend.
 *
 * Fetches GET /api/admin/sklep/reservations?limit=3 (shipped in task 9-34 / V017).
 * Falls back to static PLACEHOLDER_ROWS if the API call fails (e.g. no data seeded yet).
 */
import { useState, useEffect } from "react";
import { PhImg } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import { api } from "@/lib/api";

const log = createLogger("admin.fresh-reservations");

interface ReservationDto {
  id: string;
  clientName: string;
  clientPhone: string | null;
  note: string | null;
  status: string;
  reservedAt: string;
  createdAt: string;
}

interface ReservationRow {
  id: string;
  clientName: string;
  productName: string;
  when: string;
}

const PLACEHOLDER_ROWS: ReservationRow[] = [
  { id: "res-1", clientName: "Karol J.",  productName: "AF1 Mid 'Bandana'",    when: "dziś · 10:24"     },
  { id: "res-2", clientName: "Iga S.",    productName: "Vans Authentic 'Drip'", when: "wczoraj · 19:01" },
  { id: "res-3", clientName: "Adam W.",   productName: "Jordan 1 'Tag'",        when: "wczoraj · 14:50" },
];

function dtoToRow(r: ReservationDto): ReservationRow {
  const when = new Date(r.createdAt).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    dateStyle: "short",
    timeStyle: "short",
  });
  return { id: r.id, clientName: r.clientName, productName: "—", when };
}

interface Props {
  rows?: ReservationRow[];
}

export function FreshReservationsPanel({ rows: rowsProp }: Props) {
  const [rows, setRows] = useState<ReservationRow[]>(rowsProp ?? PLACEHOLDER_ROWS);
  log.debug("op=FreshReservationsPanel.render", { count: rows.length });

  useEffect(() => {
    if (rowsProp !== undefined) return; // prop-driven (tests / storybook)
    let cancelled = false;
    api.get<ReservationDto[]>("/admin/sklep/reservations?limit=3")
      .then((data) => {
        if (!cancelled) setRows(data.map(dtoToRow));
      })
      .catch((err) => {
        log.warn("op=FreshReservationsPanel.fetch outcome=error — using placeholder", { err: String(err) });
        // keep PLACEHOLDER_ROWS on error
      });
    return () => { cancelled = true; };
  }, [rowsProp]);

  return (
    <div className="admin-card p-[22px]">
      <div className="t-display text-[22px] mb-[14px]">Świeże rezerwacje</div>

      {rows.length === 0 && (
        <p className="t-mono text-[12px] text-admin-mute">Brak rezerwacji</p>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex gap-[10px] p-[10px]"
              style={{ border: "1px dashed var(--line)" }}
            >
              <PhImg
                label=""
                style={{ width: 40, height: 40, border: "1.5px dashed var(--ink)", flexShrink: 0 }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px]">{r.clientName}</div>
                <div className="t-mono text-[11px] text-admin-mute truncate">{r.productName}</div>
                <div className="t-mono text-[10px] text-admin-mute mt-0.5">{r.when}</div>
              </div>
              <button
                className="btn-clean self-center"
                style={{ padding: "4px 8px", fontSize: 11 }}
              >
                otwórz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
