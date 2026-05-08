/**
 * /admin/triggers — list all triggers with toggle control.
 * Read-only except for the enabled toggle; create/edit is M3 scope.
 */
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getTriggersServer } from "@/lib/messaging/api-server";
import { TriggerToggle } from "./_components/TriggerToggle";

const log = createLogger("admin-triggers-page");

/** Polish labels for event type codes */
const EVENT_LABELS_PL: Record<string, string> = {
  STATUS_CHANGE: "zmiana statusu",
  STATUS_CHANGE_FROM: "zmiana statusu (z konkretnego)",
  ORDER_RECEIVED: "zlecenie przyjęte",
  BEFORE_PICKUP_X_DAYS: "X dni przed odbiorem",
  AFTER_HANDOVER_Y_DAYS: "Y dni po wydaniu",
  RESERVATION_EXPIRING: "wygasająca rezerwacja",
};

export default async function TriggersPage() {
  let triggers: import("@/lib/messaging/types").TriggerDto[] = [];
  let fetchError = false;

  try {
    triggers = await getTriggersServer();
    log.info("op=fetchTriggers outcome=success", { count: triggers.length });
  } catch (err) {
    log.error("op=fetchTriggers outcome=error", { message: String(err) });
    fetchError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Wyzwalacze</h1>
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : triggers.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          <p>Brak wyzwalaczy.</p>
        </div>
      ) : (
        <div className="border border-admin-line rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-admin-surface border-b border-admin-line">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Zdarzenie</th>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Szablon</th>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-admin-line last:border-0 hover:bg-admin-surface/50"
                >
                  <td className="px-4 py-3 text-admin-ink">{t.name}</td>
                  <td className="px-4 py-3 text-admin-mute">
                    {EVENT_LABELS_PL[t.event] ?? t.event}
                  </td>
                  <td className="px-4 py-3 text-admin-mute">{t.templateName}</td>
                  <td className="px-4 py-3">
                    <TriggerToggle id={t.id} initialEnabled={t.enabled} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/triggers/${t.id}` as Route}
                      className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
                    >
                      szczegóły
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
