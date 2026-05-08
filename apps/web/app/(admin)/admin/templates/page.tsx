import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getTemplatesServer } from "@/lib/messaging/api-server";

const log = createLogger("admin-templates-page");

export default async function TemplatesPage() {
  let templates: import("@/lib/messaging/types").TemplateDto[] = [];
  let fetchError = false;

  try {
    templates = await getTemplatesServer();
    log.info("op=fetchTemplates outcome=success", { count: templates.length });
  } catch (err) {
    log.error("op=fetchTemplates outcome=error", { message: String(err) });
    fetchError = true;
  }

  const newHref = "/admin/templates/new" as Route;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Szablony wiadomości</h1>
        <Link
          href={newHref}
          className="inline-flex items-center gap-1 px-4 py-2 rounded bg-acid text-ink text-sm font-medium hover:bg-acid/80 transition-colors"
        >
          + Nowy szablon
        </Link>
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : templates.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          <p className="mb-3">Brak szablonów. Utwórz pierwszy.</p>
          <Link
            href={newHref}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-acid text-ink text-sm font-medium hover:bg-acid/80 transition-colors"
          >
            + Nowy szablon
          </Link>
        </div>
      ) : (
        <div className="border border-admin-line rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-admin-surface border-b border-admin-line">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Kanał</th>
                <th className="text-left px-4 py-3 font-medium text-admin-ink">Aktywny</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-admin-line last:border-0 hover:bg-admin-surface/50">
                  <td className="px-4 py-3 text-admin-ink">{t.name}</td>
                  <td className="px-4 py-3 text-admin-mute">{t.channel}</td>
                  <td className="px-4 py-3">
                    <span className={t.active ? "text-green-600" : "text-admin-mute"}>
                      {t.active ? "tak" : "nie"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/templates/${t.id}` as Route}
                      className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
                    >
                      edytuj
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
