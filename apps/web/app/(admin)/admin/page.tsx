/**
 * /admin — live Dashboard page.
 * Wires five components: KpiTilesRow + OrdersWeekChart + MixDonut (upper row)
 * + ReadyForPickupPanel + RecentMessagesPanel (lower row).
 * Each data section is independently try/catch isolated in its component;
 * one failing tile/panel does not blank the whole dashboard.
 * Server component — Suspense boundaries provide loading skeletons.
 * ~60 LOC.
 */
import { Suspense } from "react";
import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
import { KpiTilesRow } from "./_components/KpiTilesRow";
import { OrdersWeekChart } from "./_components/OrdersWeekChart";
import { MixDonut } from "./_components/MixDonut";
import { ReadyForPickupPanel } from "./_components/ReadyForPickupPanel";
import { RecentMessagesPanel } from "./_components/RecentMessagesPanel";
import { Skeleton } from "@/components/state/Skeleton";
import { ErrorBanner } from "@/components/state/ErrorBanner";

async function KpiSection() {
  let kpis;
  try {
    kpis = await getDashboardKpisServer();
  } catch {
    return <ErrorBanner message="Nie udało się załadować KPI." />;
  }
  return <KpiTilesRow kpis={kpis} />;
}

async function ChartsSection() {
  let charts;
  try {
    charts = await getDashboardChartsServer();
  } catch {
    return <ErrorBanner message="Nie udało się załadować wykresów." />;
  }
  const total = charts.mixByType.reduce((s, r) => s + r.count, 0);
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-5">
      <OrdersWeekChart rows={charts.ordersPerWeek} />
      <MixDonut mix={charts.mixByType} totalActive={total} />
    </div>
  );
}

export default async function AdminPage() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <Suspense fallback={<Skeleton height="h-24" />}>
        <KpiSection />
      </Suspense>

      <Suspense fallback={<Skeleton height="h-52" />}>
        <ChartsSection />
      </Suspense>

      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        <Suspense fallback={<Skeleton height="h-12" rows={3} />}>
          <ReadyForPickupPanel />
        </Suspense>
        <Suspense fallback={<Skeleton height="h-10" rows={4} />}>
          <RecentMessagesPanel />
        </Suspense>
      </div>
    </div>
  );
}
