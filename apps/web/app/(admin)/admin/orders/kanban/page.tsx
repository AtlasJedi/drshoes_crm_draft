/**
 * /admin/orders/kanban — Kanban board view.
 * Server Component: fetches board + triggers; hands data to KanbanBoardWrapper
 * (client island that owns dnd state) via initialColumns + triggers props.
 *
 * Pattern mirrors apps/web/app/(admin)/admin/orders/calendar/page.tsx (6-16).
 * Design: admin.jsx:660-714 for board layout.
 * State primitives: @/components/state/* shipped in 6-12.
 */

import { Suspense } from "react";
import { createLogger } from "@/lib/log";
import { getKanbanBoardServer } from "@/lib/kanban/api-server";
import { getTriggersServer } from "@/lib/messaging/api-server";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { KanbanBoardWrapper } from "../_components/kanban/KanbanBoardWrapper";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { Skeleton } from "@/components/state/Skeleton";

const log = createLogger("kanban-page");

export default async function KanbanPage() {
  let board: Awaited<ReturnType<typeof getKanbanBoardServer>> | null = null;
  let triggers: Awaited<ReturnType<typeof getTriggersServer>> = [];
  let fetchError = false;

  const [boardResult, triggersResult] = await Promise.allSettled([
    getKanbanBoardServer(),
    getTriggersServer(),
  ]);

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

  return (
    <div className="flex flex-col h-full">
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
    </div>
  );
}
