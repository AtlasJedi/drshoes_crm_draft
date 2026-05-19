/**
 * /admin — Dashboard page.
 * Role-aware layout:
 *   OWNER: KpiTilesRow + charts row + (PilnePanel wide | RecentMessagesPanel)
 *   non-OWNER (EMPLOYEE/CRAFTSMAN/OFFICE): PilnePanel full-width + MixDonut stats card
 * Server component — Suspense boundaries provide loading skeletons.
 * ~80 LOC.
 */
import { Suspense } from "react";
import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
import { KpiTilesRow } from "./_components/KpiTilesRow";
import { OrdersWeekChart } from "./_components/OrdersWeekChart";
import { MixDonut } from "./_components/MixDonut";
import { PilnePanel } from "./_components/PilnePanel";
import { RecentMessagesPanel } from "./_components/RecentMessagesPanel";
import { AdminCard } from "@drshoes/ui";
import { Skeleton } from "@/components/state/Skeleton";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { DashboardPageHeaderSetter } from "./_components/DashboardPageHeaderSetter";
import { getMe } from "@/lib/auth/session";

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

async function MixDonutSection({ period }: { period: string }) {
  let charts;
  try {
    charts = await getDashboardChartsServer(period);
  } catch {
    return <ErrorBanner message="Nie udało się załadować wykresów." />;
  }
  const total = charts.mixByType.reduce((s, r) => s + r.count, 0);
  return (
    <AdminCard padding={22}>
      <div className="t-display text-[22px] mb-[14px]">Statystyki pozycji</div>
      <MixDonut mix={charts.mixByType} totalActive={total} />
    </AdminCard>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const period = (sp.period ?? "WEEK").toUpperCase();
  const safePeriod = ["WEEK", "MONTH", "QUARTER"].includes(period) ? period : "WEEK";

  const me = await getMe();
  const isOwner = me?.role === "OWNER";

  return (
    <div className="h-full flex flex-col">
      <DashboardPageHeaderSetter />
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-col gap-5">
          {isOwner ? (
            /* ── OWNER layout ── */
            <>
              <Suspense fallback={<Skeleton height="h-24" />}>
                <KpiSection />
              </Suspense>

              <Suspense fallback={<Skeleton height="h-52" />}>
                <ChartsSection period={safePeriod} />
              </Suspense>

              {/* Row 3: Pilne (wide) | Nowe wiadomości */}
              <div className="grid grid-cols-[1.5fr_1fr] gap-4 max-sm:grid-cols-1">
                <Suspense fallback={<Skeleton height="h-12" rows={4} />}>
                  <PilnePanel />
                </Suspense>
                <Suspense fallback={<Skeleton height="h-10" rows={4} />}>
                  <RecentMessagesPanel />
                </Suspense>
              </div>
            </>
          ) : (
            /* ── Worker layout (EMPLOYEE / CRAFTSMAN / OFFICE) ── */
            <>
              <Suspense fallback={<Skeleton height="h-12" rows={5} />}>
                <PilnePanel />
              </Suspense>

              <Suspense fallback={<Skeleton height="h-52" />}>
                <MixDonutSection period={safePeriod} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
