import Link from "next/link";
import type { Route } from "next";
import type { ClientDto, Page } from "@/lib/clients/types";

interface Props {
  page: Page<ClientDto>;
  currentPage: number;
  q: string;
}

/** Format ISO date as MM.yyyy for RODO badge. */
function fmtRodoDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${mm}.${d.getUTCFullYear()}`;
}

/** Map preferredChannel to display label. */
function channelLabel(ch: ClientDto["preferredChannel"]): string {
  if (ch === "EMAIL") return "Email";
  if (ch === "SMS") return "SMS";
  if (ch === "WHATSAPP") return "WhatsApp";
  return "—";
}

/** Inline RODO placeholder pill — will be replaced by RodoBadge SC in task 7-10. */
function RodoInline({ rodoConsentAt }: { rodoConsentAt: string | null }) {
  if (rodoConsentAt) {
    return (
      <span className="inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide bg-green/10 text-green">
        zgoda · {fmtRodoDate(rodoConsentAt)}
      </span>
    );
  }
  return (
    <span className="inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide bg-orange/10 text-orange">
      brak zgody RODO
    </span>
  );
}

/** Server-side pagination links — no client router needed. */
function ClientListPagination({
  totalPages,
  currentPage,
  q,
}: {
  totalPages: number;
  currentPage: number;
  q: string;
}) {
  if (totalPages <= 1) return null;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const prevHref = `/admin/clients?page=${currentPage - 1}${qParam}`;
  const nextHref = `/admin/clients?page=${currentPage + 1}${qParam}`;
  return (
    <div className="flex items-center justify-between mt-5 text-[15px]">
      {currentPage > 0 ? (
        <Link href={prevHref as Route} className="px-4 py-2 rounded-md border border-admin-line text-admin-ink hover:bg-acid/10 font-medium">
          ← Poprzednia
        </Link>
      ) : (
        <span className="px-4 py-2 opacity-40">← Poprzednia</span>
      )}
      <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
      {currentPage < totalPages - 1 ? (
        <Link href={nextHref as Route} className="px-4 py-2 rounded-md border border-admin-line text-admin-ink hover:bg-acid/10 font-medium">
          Następna →
        </Link>
      ) : (
        <span className="px-4 py-2 opacity-40">Następna →</span>
      )}
    </div>
  );
}

const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-admin-mute uppercase tracking-[0.08em]";
const tdCls = "px-4 py-3.5 text-[15px] text-admin-ink";

/**
 * Server Component.
 * Renders a paginated table of clients with inline RODO badge + channel pill.
 * Receives a pre-fetched Page<ClientDto> from the parent page SC.
 * Pagination uses plain Link anchors (no client router — pure SC).
 * NOTE: RodoInline is a placeholder. Replace with <RodoBadge> once task 7-10 lands.
 */
export function ClientListTable({ page, currentPage, q }: Props) {
  return (
    <div>
      <div className="overflow-x-auto border border-admin-line rounded">
        <table className="w-full border-collapse">
          <thead className="bg-admin-surface border-b border-admin-line">
            <tr>
              <th className={thCls}>Imię i nazwisko</th>
              <th className={thCls}>Telefon</th>
              <th className={thCls}>E-mail</th>
              <th className={thCls}>Kanał</th>
              <th className={thCls}>Status RODO</th>
            </tr>
          </thead>
          <tbody>
            {page.content.map((client) => (
              <tr
                key={client.id}
                className="border-b border-admin-line hover:bg-acid/5 transition-colors"
              >
                <td className={tdCls}>
                  <Link
                    href={`/admin/clients/${client.id}` as Route}
                    className="font-medium hover:underline"
                  >
                    {client.lastName ? `${client.lastName}, ${client.firstName}` : client.firstName}
                  </Link>
                </td>
                <td className={tdCls + " text-admin-mute"}>{client.phone ?? "—"}</td>
                <td className={tdCls + " text-admin-mute"}>{client.email ?? "—"}</td>
                <td className={tdCls}>
                  <span className="inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide bg-admin-bg border border-admin-line text-admin-ink">
                    {channelLabel(client.preferredChannel)}
                  </span>
                </td>
                <td className={tdCls}>
                  <RodoInline rodoConsentAt={client.rodoConsentAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClientListPagination totalPages={page.totalPages} currentPage={currentPage} q={q} />
    </div>
  );
}
