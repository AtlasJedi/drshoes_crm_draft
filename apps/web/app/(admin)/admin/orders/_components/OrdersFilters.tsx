"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { STATUS_ORDER, STATUS_LABELS_PL, KIND_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus, OrderItemKind } from "@/lib/orders/types";
import type { UserStubDto } from "@/lib/users/types";

const log = createLogger("orders-filters");

const ALL_KINDS: OrderItemKind[] = ["NAPRAWA", "CUSTOM_BUTY", "CUSTOM_KURTKA"];

interface Props {
  initial: {
    status?: OrderStatus;
    type?: string[];
    craftsmanId?: string;
    q?: string;
  };
  users: UserStubDto[];
}

export function OrdersFilters({ initial, users }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(updates: Record<string, string | string[] | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page"); // reset to page 0 on filter change
    for (const [k, v] of Object.entries(updates)) {
      p.delete(k);
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else if (v) p.set(k, v);
    }
    log.info("op=filterChange", { ...updates });
    router.replace(`/admin/orders?${p.toString()}` as Route);
  }

  function onStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    push({ status: e.target.value || undefined });
  }

  function onKind(kind: OrderItemKind, checked: boolean) {
    const current = initial.type ?? [];
    const next = checked ? [...current, kind] : current.filter((k) => k !== kind);
    push({ type: next.length ? next : undefined });
  }

  function onCraftsman(e: React.ChangeEvent<HTMLSelectElement>) {
    push({ craftsmanId: e.target.value || undefined });
  }

  function onQ(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q: val || undefined }), 250);
  }

  const selectCls =
    "border border-admin-line rounded px-2 py-1 text-sm bg-admin-surface text-admin-ink focus:outline-none focus:ring-1 focus:ring-acid";

  return (
    <div className="flex flex-wrap gap-4 items-end mb-6 p-4 border border-admin-line rounded bg-admin-surface">
      {/* Status */}
      <label className="flex flex-col gap-1 text-xs text-admin-mute">
        Status
        <select className={selectCls} value={initial.status ?? ""} onChange={onStatus}>
          <option value="">Wszystkie</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS_PL[s]}</option>
          ))}
        </select>
      </label>

      {/* Kind checkboxes */}
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs text-admin-mute mb-1">Typ</legend>
        <div className="flex gap-3">
          {ALL_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-1 text-sm text-admin-ink cursor-pointer">
              <input
                type="checkbox"
                checked={(initial.type ?? []).includes(k)}
                onChange={(e) => onKind(k, e.target.checked)}
                className="accent-acid"
              />
              {KIND_LABELS_PL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Assignee */}
      <label className="flex flex-col gap-1 text-xs text-admin-mute">
        Wykonawca
        <select className={selectCls} value={initial.craftsmanId ?? ""} onChange={onCraftsman}>
          <option value="">Wszyscy</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </label>

      {/* Search */}
      <label className="flex flex-col gap-1 text-xs text-admin-mute">
        Szukaj
        <input
          type="search"
          defaultValue={initial.q ?? ""}
          onChange={onQ}
          placeholder="Szukaj…"
          className={selectCls + " w-52"}
        />
      </label>
    </div>
  );
}
