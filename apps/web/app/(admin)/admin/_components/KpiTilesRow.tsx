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
        accent="#B8D4C8"
      />
      <StatTile
        data-testid="kpi-tile-ready"
        label="Gotowe do odbioru"
        value={String(kpis.readyForPickupCount)}
        sub="czekają na klienta"
        accent="#F0C896"
      />
      <StatTile
        data-testid="kpi-tile-in-progress-money"
        label="Pieniądze w realizacji"
        value={kpis.inProgressMoneyFormatted}
        sub="otwarte zlecenia"
        accent="#C8D4E8"
      />
      <StatTile
        data-testid="kpi-tile-picked-up-money"
        label={`Wydane · ${monthLabel}`}
        value={kpis.pickedUpMoneyMonthFormatted}
        sub="ten miesiąc"
        accent="#D4C8B4"
      />
    </div>
  );
}
