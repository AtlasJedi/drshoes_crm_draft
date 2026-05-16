/**
 * Server Component.
 * Pagination nav for /admin/clients list — plain Link anchors, no client router.
 * ~30 LOC.
 */
import Link from "next/link";
import type { Route } from "next";

interface Props {
  totalPages: number;
  currentPage: number;
  q: string;
}

export function ClientListPagination({ totalPages, currentPage, q }: Props) {
  if (totalPages <= 1) return null;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const prevHref = `/admin/clients?page=${currentPage - 1}${qParam}`;
  const nextHref = `/admin/clients?page=${currentPage + 1}${qParam}`;
  const linkCls = "px-4 py-2 rounded-md border border-admin-line text-admin-ink hover:bg-acid/10 font-medium";
  return (
    <div className="flex items-center justify-between mt-5 text-[15px]">
      {currentPage > 0 ? (
        <Link href={prevHref as Route} className={linkCls}>← Poprzednia</Link>
      ) : (
        <span className="px-4 py-2 opacity-40">← Poprzednia</span>
      )}
      <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
      {currentPage < totalPages - 1 ? (
        <Link href={nextHref as Route} className={linkCls}>Następna →</Link>
      ) : (
        <span className="px-4 py-2 opacity-40">Następna →</span>
      )}
    </div>
  );
}
