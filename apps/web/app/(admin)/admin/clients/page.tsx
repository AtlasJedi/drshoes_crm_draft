import { createLogger } from "@/lib/log";
import { listClientsServer, searchClientsServer } from "@/lib/clients/api-server";
import type { ClientSearchResult } from "@/lib/clients/types";
import { ClientListSearchBox } from "./_components/ClientListSearchBox";
import { ClientListTable } from "./_components/ClientListTable";
import { ClientsPageHeaderSetter } from "./_components/ClientsPageHeaderSetter";
import { ClientSearchResultsTable } from "./_components/ClientSearchResultsTable";

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
    <div className="h-full flex flex-col">
      <ClientsPageHeaderSetter total={pageData?.totalElements} />
      {/* SHRINK-0: page chrome — search box. Never scrolls. */}
      <div className="shrink-0 mb-4">
        <ClientListSearchBox initialQ={q} />
      </div>

      {/* FLEX-1: scrollable table/results region */}
      <div className="flex-1 min-h-0 overflow-auto">
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
    </div>
  );
}

