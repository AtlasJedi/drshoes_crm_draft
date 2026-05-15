/**
 * FreshReservationsPanel — latest 3 product reservations.
 *
 * TODO(M10-backend): Replace PLACEHOLDER_ROWS with a real fetch once backend
 * ships GET /api/admin/sklep/reservations?limit=3&sort=createdAt,desc (task 9-34).
 * Expected DTO: { id: string; clientName: string; productName: string; createdAt: string }
 *
 * Pure client component for now (static data). ~60 LOC.
 */
import { PhImg } from "@drshoes/ui";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.fresh-reservations");

interface ReservationRow {
  id: string;
  clientName: string;
  productName: string;
  when: string;
}

// TODO(M10): wire to GET /api/admin/sklep/reservations?limit=3&sort=createdAt,desc after task 9-34 lands V016
const PLACEHOLDER_ROWS: ReservationRow[] = [
  { id: "res-1", clientName: "Karol J.",  productName: "AF1 Mid 'Bandana'",    when: "dziś · 10:24"     },
  { id: "res-2", clientName: "Iga S.",    productName: "Vans Authentic 'Drip'", when: "wczoraj · 19:01" },
  { id: "res-3", clientName: "Adam W.",   productName: "Jordan 1 'Tag'",        when: "wczoraj · 14:50" },
];

interface Props {
  rows?: ReservationRow[];
}

export function FreshReservationsPanel({ rows = PLACEHOLDER_ROWS }: Props) {
  log.debug("op=FreshReservationsPanel.render", { count: rows.length });

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
