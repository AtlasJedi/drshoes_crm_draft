/**
 * Four KPI stat tiles — top row of the Dashboard.
 * Uses <StatTile> primitive from @drshoes/ui with accent blob.
 * Pure server component (no client state).
 * ~45 LOC.
 */
import { StatTile } from "@drshoes/ui";
import type { DashboardKpiDto } from "@/lib/dashboard/types";

interface Props {
  kpis: DashboardKpiDto;
}

export function KpiTilesRow({ kpis }: Props) {
  const monthLabel = new Date().toLocaleString("pl-PL", {
    month: "long",
    timeZone: "Europe/Warsaw",
  });

  return (
    <div className="grid grid-cols-4 gap-[18px]">
      <StatTile
        data-testid="kpi-tile-in-progress"
        label="W realizacji"
        value={String(kpis.inProgressCount)}
        sub="zlecenia aktywne"
        accent="acid"
      />
      <StatTile
        data-testid="kpi-tile-ready"
        label="Gotowe do odbioru"
        value={String(kpis.readyForPickupCount)}
        sub="czekają na klienta"
        accent="pink"
      />
      <StatTile
        data-testid="kpi-tile-intake"
        label="Nowe rezerwacje (7d)"
        value={String(kpis.todayIntakeCount)}
        sub="ostatnie 7 dni"
        accent="blue"
      />
      <StatTile
        data-testid="kpi-tile-revenue"
        label={`Przychód · ${monthLabel}`}
        value={kpis.monthRevenueFormatted}
        sub="ten miesiąc"
        accent="acid"
      />
    </div>
  );
}
