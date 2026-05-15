"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { KIND_LABELS_PL, STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus, OrderItemKind } from "@/lib/orders/types";
import type { UserStubDto } from "@/lib/users/types";
import { Chip } from "@repo/ui";

const log = createLogger("orders-filters");

const ALL_KINDS: OrderItemKind[] = ["NAPRAWA", "CUSTOM_BUTY", "CUSTOM_KURTKA"];

interface Props {
  initial: {
    status?: OrderStatus[];
    type?: string[];
    craftsmanId?: string;
    q?: string;
  };
  users: UserStubDto[];
  visible?: number;
  total?: number;
}

export function OrdersFilters({ initial, users, visible, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  function push(updates: Record<string, string | string[] | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      p.delete(k);
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else if (v) p.set(k, v);
    }
    log.info("op=filterChange", { ...updates });
    router.replace(`/admin/orders?${p.toString()}` as Route);
  }

  function onKind(kind: OrderItemKind) {
    const current = initial.type ?? [];
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
    push({ type: next.length ? next : undefined });
  }

  function onQ(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push({ q: val || undefined });
      if (!val) setSearchOpen(false);
    }, 250);
  }

  const statusActive = (initial.status ?? []).length > 0;
  const searchActive = !!initial.q;

  return (
    <div className="flex flex-wrap gap-2.5 items-center px-1 py-3" style={{ borderBottom: "1px solid var(--line, rgba(10,10,10,0.18))" }}>
      {/* Status summary chip — read-only display; full multi-select remains in StatusMultiSelect */}
      <Chip active={statusActive}>
        {statusActive
          ? (initial.status ?? []).map((s) => STATUS_LABELS_PL[s]).join(", ")
          : "status: wszystkie"}
      </Chip>

      {/* Kind chips */}
      {ALL_KINDS.map((k) => (
        <Chip
          key={k}
          active={(initial.type ?? []).includes(k)}
          onClick={() => onKind(k)}
        >
          {KIND_LABELS_PL[k]}
        </Chip>
      ))}

      {/* Craftsman chip — display only; full select via dropdown TODO */}
      <Chip active={!!initial.craftsmanId}>
        {initial.craftsmanId
          ? (users.find((u) => u.id === initial.craftsmanId)?.fullName ?? "wybrany")
          : "rzemieślnik: każdy"}
      </Chip>

      {/* Date chip — placeholder, wired in M10 */}
      <Chip>przyjęcie: wszystkie</Chip>

      {/* Search chip + inline input */}
      {searchOpen ? (
        <input
          autoFocus
          type="search"
          defaultValue={initial.q ?? ""}
          onChange={onQ}
          onBlur={() => { if (!initial.q) setSearchOpen(false); }}
          placeholder="Szukaj…"
          className="border border-ink px-2 py-1 font-mono text-[12px] w-40 focus:outline-none focus:ring-1 focus:ring-ink"
        />
      ) : (
        <Chip active={searchActive} onClick={() => setSearchOpen(true)}>
          {searchActive ? `szukaj: ${initial.q}` : "szukaj"}
        </Chip>
      )}

      {/* Spacer + counter */}
      <div style={{ flex: 1 }} />
      {visible != null && total != null && (
        <span className="font-mono text-[11px] text-admin-mute">
          {visible} z {total} zleceń
        </span>
      )}
    </div>
  );
}
