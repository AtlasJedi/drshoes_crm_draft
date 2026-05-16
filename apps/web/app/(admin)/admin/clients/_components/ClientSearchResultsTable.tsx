/**
 * Server Component.
 * Renders a flat search-results table for /admin/clients?q=...
 * Uses .tbl CSS class from globals.css (M9 graffiti style).
 * ~38 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import type { ClientSearchResult } from "@/lib/clients/types";

interface Props {
  results: ClientSearchResult[];
}

export function ClientSearchResultsTable({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
        Brak wyników wyszukiwania.
      </div>
    );
  }
  const tdMute = "px-4 py-3.5 text-[15px] text-admin-mute";
  return (
    <div className="overflow-x-auto border border-admin-line rounded">
      <table className="tbl w-full">
        <thead>
          <tr>
            <th>Imię i nazwisko</th>
            <th>Telefon</th>
            <th>E-mail</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3.5 text-[15px] text-admin-ink">
                <Link
                  href={`/admin/clients/${r.id}` as Route}
                  className="font-medium hover:underline"
                >
                  {r.fullName}
                </Link>
              </td>
              <td className={tdMute}>{r.phone ?? "—"}</td>
              <td className={tdMute}>{r.email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
