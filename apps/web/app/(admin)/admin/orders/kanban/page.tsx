/**
 * /admin/orders/kanban — Kanban board view.
 * Server Component: fetches board + triggers; hands data to KanbanBoardWrapper
 * (client island that owns dnd state) via initialColumns + triggers props.
 *
 * Pattern mirrors apps/web/app/(admin)/admin/orders/calendar/page.tsx (6-16).
 * Design: admin.jsx:660-714 for board layout.
 * State primitives: @/components/state/* shipped in 6-12.
 */

import { KanbanPageHeaderSetter } from "./_components/KanbanPageHeaderSetter";
import { Suspense } from "react";
import { createLogger } from "@/lib/log";
import { getKanbanBoardServer } from "@/lib/kanban/api-server";
import { getTriggersServer } from "@/lib/messaging/api-server";
import { getOrderServer } from "@/lib/orders/api-server";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { KanbanBoardWrapper } from "../_components/kanban/KanbanBoardWrapper";
import { OrderDrawer } from "../_components/OrderDrawer";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { Skeleton } from "@/components/state/Skeleton";
import type { OrderDto } from "@/lib/orders/types";

const log = createLogger("kanban-page");

interface SearchParams {
  orderId?: string;
}

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const orderId = sp.orderId;

  let board: Awaited<ReturnType<typeof getKanbanBoardServer>> | null = null;
  let triggers: Awaited<ReturnType<typeof getTriggersServer>> = [];
  let fetchError = false;
  let drawerOrder: OrderDto | null = null;

  const fetches: [
    ReturnType<typeof getKanbanBoardServer>,
    ReturnType<typeof getTriggersServer>,
    ...Array<ReturnType<typeof getOrderServer>>,
  ] = [getKanbanBoardServer(), getTriggersServer()];
  if (orderId) fetches.push(getOrderServer(orderId));

  const [boardResult, triggersResult, ...rest] = await Promise.allSettled(fetches);

  if (boardResult.status === "fulfilled") {
    board = boardResult.value;
  } else {
    log.error("op=fetchKanbanBoard outcome=error", {
      reason: String(boardResult.reason),
    });
    fetchError = true;
  }

  if (triggersResult.status === "fulfilled") {
    triggers = triggersResult.value;
  } else {
    log.warn("op=fetchTriggers outcome=error", {
      reason: String(triggersResult.reason),
    });
    // Triggers failure is non-fatal — board still renders without trigger previews
  }

  if (orderId && rest[0]?.status === "fulfilled") {
    drawerOrder = rest[0].value as OrderDto;
  } else if (orderId && rest[0]?.status === "rejected") {
    log.warn("op=fetchDrawerOrder outcome=error", { orderId, reason: String(rest[0].reason) });
  }

  return (
    <div className="flex flex-col h-full">
      <KanbanPageHeaderSetter />
      {/* Top bar: view switcher */}
      <div className="px-6 pt-4">
        <OrderViewTabs active="kanban" />
      </div>

      {/* Fetch error — shown when board data is unavailable */}
      {fetchError && (
        <div className="px-6 pt-4">
          <ErrorBanner message="Nie udało się załadować tablicy Kanban." />
        </div>
      )}

      {/* Board content — only rendered when board data is available */}
      {board && (
        <Suspense
          fallback={
            <div
              className="flex-1 p-6 grid gap-4"
              style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton height="h-10" />
                  <Skeleton height="h-24" />
                  <Skeleton height="h-24" />
                  <Skeleton height="h-24" />
                </div>
              ))}
            </div>
          }
        >
          <KanbanBoardWrapper
            initialColumns={board.columns}
            triggers={triggers}
          />
        </Suspense>
      )}

      {/* Drawer overlay — opened when ?orderId= is present in the URL */}
      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} />}
    </div>
  );
}
