/**
 * /admin/triggers/[id] — trigger detail view (read-only).
 * Toggle is available; create/edit form is M3 scope.
 */
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getTriggerServer } from "@/lib/messaging/api-server";
import { TriggerToggle } from "../_components/TriggerToggle";

const log = createLogger("admin-trigger-detail-page");

export default async function TriggerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  log.info("op=render", { id });

  const t = await getTriggerServer(id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">{t.name}</h1>
        <Link
          href={"/admin/triggers" as Route}
          className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
        >
          ← Wróć do wyzwalaczy
        </Link>
      </div>

      <div className="border border-admin-line rounded p-6 space-y-4 text-sm">
        <dl className="grid grid-cols-[160px_1fr] gap-y-3">
          <dt className="font-medium text-admin-ink">Zdarzenie</dt>
          <dd className="text-admin-mute">{t.event}</dd>

          <dt className="font-medium text-admin-ink">Parametry</dt>
          <dd>
            <pre className="font-mono text-xs bg-admin-surface px-3 py-2 rounded overflow-auto whitespace-pre-wrap break-all text-admin-mute">
              {t.eventParams}
            </pre>
          </dd>

          <dt className="font-medium text-admin-ink">Kanały</dt>
          <dd className="text-admin-mute">{t.channels}</dd>

          <dt className="font-medium text-admin-ink">Szablon</dt>
          <dd className="text-admin-mute">{t.templateName}</dd>

          <dt className="font-medium text-admin-ink">Opóźnienie (min)</dt>
          <dd className="text-admin-mute">{t.delayMinutes}</dd>

          <dt className="font-medium text-admin-ink">Wymaga zatwierdzenia</dt>
          <dd className="text-admin-mute">
            {t.requiresManualConfirmation ? "tak" : "nie"}
          </dd>

          <dt className="font-medium text-admin-ink">Status</dt>
          <dd>
            <TriggerToggle id={t.id} initialEnabled={t.enabled} />
          </dd>
        </dl>
      </div>
    </div>
  );
}
