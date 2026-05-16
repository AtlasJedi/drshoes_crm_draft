/**
 * Server Component.
 * Renders a paginated table of clients with RodoBadge + channel chip (.chip).
 * Receives a pre-fetched Page<ClientDto> from the parent page SC.
 * Pagination delegates to <ClientListPagination> (plain Link anchors, no router).
 * ~55 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import type { ClientDto, Page } from "@/lib/clients/types";
import { RodoBadge } from "./RodoBadge";
import { ClientListPagination } from "./ClientListPagination";

interface Props {
  page: Page<ClientDto>;
  currentPage: number;
  q: string;
}

/** Map preferredChannel to display label. */
function channelLabel(ch: ClientDto["preferredChannel"]): string {
  if (ch === "EMAIL") return "Email";
  if (ch === "SMS") return "SMS";
  if (ch === "WHATSAPP") return "WhatsApp";
  return "—";
}

const tdCls = "px-4 py-3.5 text-[15px] text-admin-ink";

export function ClientListTable({ page, currentPage, q }: Props) {
  return (
    <div>
      <div className="overflow-x-auto border border-admin-line rounded">
        <table className="tbl w-full">
          <thead>
            <tr>
              <th>Imię i nazwisko</th>
              <th>Telefon</th>
              <th>E-mail</th>
              <th>Kanał</th>
              <th>Status RODO</th>
            </tr>
          </thead>
          <tbody>
            {page.content.map((client) => (
              <tr key={client.id}>
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
                  <span className="chip">{channelLabel(client.preferredChannel)}</span>
                </td>
                <td className={tdCls}>
                  <RodoBadge rodoConsentAt={client.rodoConsentAt ?? null} />
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
