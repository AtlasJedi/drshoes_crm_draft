/**
 * Four summary tiles for a client dossier.
 * Server Component — receives ClientSummary DTO, no client-side state.
 * Mirrors KpiTilesRow pattern (admin-card + accent border-top).
 * Spec §6.4.
 * ~60 LOC.
 */
import type { ClientSummary } from "@/lib/clients/types";

interface TileProps {
  label: string;
  value: React.ReactNode;
  accent: string;
  testId: string;
}

function SummaryTile({ label, value, accent, testId }: TileProps) {
  return (
    <div
      data-testid={testId}
      className="admin-card p-5 flex flex-col gap-2"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="t-mono text-[11px] uppercase text-admin-mute leading-none">
        {label}
      </div>
      <div className="font-display text-[2.25rem] leading-none">{value}</div>
    </div>
  );
}

/** Format ISO timestamp as month-year label, e.g. "04.2025" or "—". */
function fmtLastOrder(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}.${yyyy}`;
}

interface Props {
  summary: ClientSummary;
}

export function ClientSummaryTiles({ summary }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[18px] mb-6">
      <SummaryTile
        testId="tile-all-orders"
        label="Wszystkie zlecenia"
        value={summary.orderCount}
        accent="var(--blue)"
      />
      <SummaryTile
        testId="tile-active-orders"
        label="Aktywne"
        value={summary.openOrderCount}
        accent="var(--acid)"
      />
      <SummaryTile
        testId="tile-last-order"
        label="Ostatnie zlecenie"
        value={fmtLastOrder(summary.lastOrderAt)}
        accent="var(--pink)"
      />
      <SummaryTile
        testId="tile-unread-threads"
        label="Nieprzeczytane wątki"
        value={summary.unreadThreadCount}
        accent="var(--acid)"
      />
    </div>
  );
}
