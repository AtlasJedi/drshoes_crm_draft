import { createLogger } from "@/lib/log";
import { listClientsServer, searchClientsServer } from "@/lib/clients/api-server";
import { ClientListSearchBox } from "./_components/ClientListSearchBox";
import { ClientListTable } from "./_components/ClientListTable";
import type { ClientSearchResult } from "@/lib/clients/types";
import Link from "next/link";

const log = createLogger("apps/web/app/(admin)/admin/clients/page");

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);

  log.info("op=render", { q: q.length > 0 ? q : "(none)", page });

  let pageData: Awaited<ReturnType<typeof listClientsServer>> | null = null;
  let searchResults: ClientSearchResult[] | null = null;
  let fetchError = false;

  try {
    if (q.length > 0) {
      searchResults = await searchClientsServer(q);
    } else {
      pageData = await listClientsServer({ page });
    }
  } catch (err) {
    log.error("op=render outcome=error", { message: String(err) });
    fetchError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Klienci</h1>
      </div>

      <div className="mb-4">
        <ClientListSearchBox initialQ={q} />
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : searchResults !== null ? (
        <ClientSearchResultsTable results={searchResults} />
      ) : pageData && pageData.content.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak klientów do wyświetlenia.
        </div>
      ) : pageData ? (
        <ClientListTable page={pageData} currentPage={page} q={q} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search results sub-component (inline — kept here to stay under the 80-LOC
// budget for the page export; extracted if this file grows past budget).
// ---------------------------------------------------------------------------

function ClientSearchResultsTable({ results }: { results: ClientSearchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
        Brak wyników wyszukiwania.
      </div>
    );
  }
  const thCls =
    "px-3 py-2 text-left text-xs font-medium text-admin-mute uppercase tracking-wide";
  const tdCls = "px-3 py-3 text-sm text-admin-ink";
  return (
    <div className="overflow-x-auto border border-admin-line rounded">
      <table className="w-full border-collapse">
        <thead className="bg-admin-surface border-b border-admin-line">
          <tr>
            <th className={thCls}>Imię i nazwisko</th>
            <th className={thCls}>Telefon</th>
            <th className={thCls}>E-mail</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.id}
              className="border-b border-admin-line hover:bg-acid/5 transition-colors"
            >
              <td className={tdCls}>
                <Link
                  href={`/admin/clients/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {r.fullName}
                </Link>
              </td>
              <td className={tdCls + " text-admin-mute"}>{r.phone ?? "—"}</td>
              <td className={tdCls + " text-admin-mute"}>{r.email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
