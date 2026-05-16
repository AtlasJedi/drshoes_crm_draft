"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

interface Props {
  initialQ: string;
}

/**
 * Debounced search box for /admin/clients.
 * Pushes ?q=<encoded> on change; clears to /admin/clients on empty.
 * Debounce: 250ms via useEffect cleanup.
 */
export function ClientListSearchBox({ initialQ }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);

  useEffect(() => {
    const id = setTimeout(() => {
      if (value.length === 0) {
        router.push("/admin/clients" as Route);
      } else {
        router.push(`/admin/clients?q=${encodeURIComponent(value)}` as Route);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [value, router]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Szukaj klienta po imieniu, nazwisku, telefonie lub e-mailu…"
      className="t-mono w-full max-w-lg h-10 px-3 border border-ink rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm placeholder:text-admin-mute placeholder:opacity-60"
      aria-label="Szukaj klienta"
    />
  );
}
