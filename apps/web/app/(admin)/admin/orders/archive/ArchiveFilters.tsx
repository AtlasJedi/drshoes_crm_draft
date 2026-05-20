"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { Route } from "next";

interface Props {
  q?: string;
  plannedPickupAtFrom?: string;
  plannedPickupAtTo?: string;
}

export function ArchiveFilters({ q, plannedPickupAtFrom, plannedPickupAtTo }: Props) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildParams(overrides: Partial<Props>): string {
    const p = new URLSearchParams();
    const merged = { q, plannedPickupAtFrom, plannedPickupAtTo, ...overrides };
    if (merged.q) p.set("q", merged.q);
    if (merged.plannedPickupAtFrom) p.set("plannedPickupAtFrom", merged.plannedPickupAtFrom);
    if (merged.plannedPickupAtTo) p.set("plannedPickupAtTo", merged.plannedPickupAtTo);
    return p.toString();
  }

  function onQChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(("/admin/orders/archive?" + buildParams({ q: value || undefined })) as Route);
    }, 250);
  }

  function onDateChange(field: "plannedPickupAtFrom" | "plannedPickupAtTo", value: string) {
    router.replace(("/admin/orders/archive?" + buildParams({ [field]: value || undefined })) as Route);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <input
        type="text"
        defaultValue={q ?? ""}
        placeholder="Szukaj (klient, numer…)"
        onChange={(e) => onQChange(e.target.value)}
        className="border border-ink px-2 py-1 text-sm font-mono w-56 focus:outline-none focus:ring-1 focus:ring-ink"
      />
      <input
        type="date"
        defaultValue={plannedPickupAtFrom ?? ""}
        aria-label="Odbiór od"
        onChange={(e) => onDateChange("plannedPickupAtFrom", e.target.value)}
        className="border border-ink px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ink"
      />
      <input
        type="date"
        defaultValue={plannedPickupAtTo ?? ""}
        aria-label="Odbiór do"
        onChange={(e) => onDateChange("plannedPickupAtTo", e.target.value)}
        className="border border-ink px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ink"
      />
    </div>
  );
}
