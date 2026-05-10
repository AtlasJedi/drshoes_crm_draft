"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
        router.push("/admin/clients");
      } else {
        router.push(`/admin/clients?q=${encodeURIComponent(value)}`);
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
      className="w-full max-w-lg h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm"
      aria-label="Szukaj klienta"
    />
  );
}
