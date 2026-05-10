/**
 * Four KPI stat tiles — top row of the Dashboard.
 * Layout: admin.jsx:86-91. Pure server component (no client state).
 * ~60 LOC.
 */
import type { DashboardKpiDto } from "@/lib/dashboard/types";

interface TileProps {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  testId: string;
}

function StatTile({ label, value, sub, accent, testId }: TileProps) {
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
      <div className="t-mono text-[11px] text-admin-mute">{sub}</div>
    </div>
  );
}

interface Props {
  kpis: DashboardKpiDto;
}

export function KpiTilesRow({ kpis }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[18px]">
      <StatTile
        testId="kpi-tile-in-progress"
        label="W realizacji"
        value={kpis.inProgressCount}
        sub="zlecenia aktywne"
        accent="var(--acid)"
      />
      <StatTile
        testId="kpi-tile-ready"
        label="Gotowe do odbioru"
        value={kpis.readyForPickupCount}
        sub="czekają na klienta"
        accent="var(--pink)"
      />
      <StatTile
        testId="kpi-tile-intake"
        label="Nowe rezerwacje (7d)"
        value={kpis.todayIntakeCount}
        sub="ostatnie 7 dni"
        accent="var(--blue)"
      />
      <StatTile
        testId="kpi-tile-revenue"
        label={`Przychód · ${new Date().toLocaleString("pl-PL", { month: "long" })}`}
        value={kpis.monthRevenueFormatted}
        sub="ten miesiąc"
        accent="var(--acid)"
      />
    </div>
  );
}
