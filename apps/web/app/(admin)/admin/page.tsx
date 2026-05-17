/**
 * /admin — Dashboard page.
 * Five components: KpiTilesRow + OrdersWeekChart + MixDonut (upper rows)
 * + ReadyForPickupPanel + RecentMessagesPanel + FreshReservationsPanel (lower row).
 * Server component — Suspense boundaries provide loading skeletons.
 * ~65 LOC.
 */
import { Suspense } from "react";
import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
import { KpiTilesRow } from "./_components/KpiTilesRow";
import { OrdersWeekChart } from "./_components/OrdersWeekChart";
import { MixDonut } from "./_components/MixDonut";
import { ReadyForPickupPanel } from "./_components/ReadyForPickupPanel";
import { RecentMessagesPanel } from "./_components/RecentMessagesPanel";
import { FreshReservationsPanel } from "./_components/FreshReservationsPanel";
import { Skeleton } from "@/components/state/Skeleton";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { DashboardPageHeaderSetter } from "./_components/DashboardPageHeaderSetter";

async function KpiSection() {
  let kpis;
  try {
    kpis = await getDashboardKpisServer();
  } catch {
    return <ErrorBanner message="Nie udało się załadować KPI." />;
  }
  return <KpiTilesRow kpis={kpis} />;
}

async function ChartsSection({ period }: { period: string }) {
  let charts;
  try {
    charts = await getDashboardChartsServer(period);
  } catch {
    return <ErrorBanner message="Nie udało się załadować wykresów." />;
  }
  const total = charts.mixByType.reduce((s, r) => s + r.count, 0);
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-5">
      <OrdersWeekChart rows={charts.ordersPerWeek} period={period} />
      <MixDonut mix={charts.mixByType} totalActive={total} />
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const period = (sp.period ?? "WEEK").toUpperCase();
  const safePeriod = ["WEEK", "MONTH", "QUARTER"].includes(period) ? period : "WEEK";
  return (
    <div className="h-full flex flex-col">
      <DashboardPageHeaderSetter />
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-col gap-5">
          <Suspense fallback={<Skeleton height="h-24" />}>
            <KpiSection />
          </Suspense>

          <Suspense fallback={<Skeleton height="h-52" />}>
            <ChartsSection period={safePeriod} />
          </Suspense>

          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-5">
            <Suspense fallback={<Skeleton height="h-12" rows={3} />}>
              <ReadyForPickupPanel />
            </Suspense>
            <Suspense fallback={<Skeleton height="h-10" rows={4} />}>
              <RecentMessagesPanel />
            </Suspense>
            {/* FreshReservationsPanel uses static placeholder until M10 backend slice ships */}
            <FreshReservationsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
