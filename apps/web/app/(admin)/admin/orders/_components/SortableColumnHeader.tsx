"use client";

/**
 * Clickable table column header that manages sort state via URL search params.
 * Active column shows ↑ (asc) or ↓ (desc) caret; inactive columns show nothing.
 * Click on active column toggles direction; click on a different column resets to DESC.
 */
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";

const log = createLogger("sortable-column-header");

export type SortField = "createdAt" | "receivedAt" | "code" | "status" | "pickedUpAt";
type SortDir = "asc" | "desc";

interface Props {
  field: SortField;
  label: string;
  className?: string;
}

/** Parse ?sort=<field>,<dir> from URLSearchParams. Defaults to createdAt,desc. */
export function parseSortParam(sp: URLSearchParams): { field: SortField; dir: SortDir } {
  const raw = sp.get("sort");
  if (raw) {
    const [f, d] = raw.split(",");
    const validFields: SortField[] = ["createdAt", "receivedAt", "code", "status", "pickedUpAt"];
    const validDirs: SortDir[] = ["asc", "desc"];
    if (validFields.includes(f as SortField) && validDirs.includes(d as SortDir)) {
      return { field: f as SortField, dir: d as SortDir };
    }
  }
  return { field: "createdAt", dir: "desc" };
}

export function SortableColumnHeader({ field, label, className }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { field: activeField, dir: activeDir } = parseSortParam(searchParams);

  const isActive = activeField === field;
  const nextDir: SortDir = isActive && activeDir === "desc" ? "asc" : "desc";

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", `${field},${nextDir}`);
    // Reset to page 0 on sort change
    params.delete("page");
    const url = `/admin/orders?${params.toString()}` as Route;
    log.info("op=sortChange", { field, dir: nextDir });
    router.replace(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 hover:text-admin-ink transition-colors ${className ?? ""}`}
      aria-label={`Sortuj po: ${label}`}
    >
      <span>{label}</span>
      {isActive && (
        <span aria-hidden="true" className="text-acid font-bold">
          {activeDir === "desc" ? "↓" : "↑"}
        </span>
      )}
    </button>
  );
}
