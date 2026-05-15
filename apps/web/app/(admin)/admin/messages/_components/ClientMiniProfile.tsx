"use client";

// ClientMiniProfile — right-rail 280px panel: client identity, contact, active orders.
// Fetches GET /admin/clients/{id} + GET /admin/orders?clientId=&status=active statuses.
// Empty state when clientId is null; loading skeleton while fetching.
// < 80 LOC per granulate directive (sub-components extracted to sibling files).

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { getClient } from "@/lib/clients/api";
import { listOrders } from "@/lib/orders/api";
import type { ClientDto } from "@/lib/clients/types";
import type { OrderListRow } from "@/lib/orders/types";
import { ClientMiniProfileIdentity } from "./ClientMiniProfileIdentity";
import { ClientMiniProfileContact } from "./ClientMiniProfileContact";
import { ClientMiniProfileOrders } from "./ClientMiniProfileOrders";

const log = createLogger("messaging.clientminiprofile");

const ACTIVE_STATUSES = [
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
] as const;

function initials(c: ClientDto): string {
  const f = c.firstName?.[0] ?? "";
  const l = c.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function joinedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", {
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}

interface Props {
  clientId: string | null;
}

export function ClientMiniProfile({ clientId }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) { setClient(null); setOrders([]); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getClient(clientId),
      listOrders({ clientId, status: [...ACTIVE_STATUSES] }, 0, 5),
    ])
      .then(([c, page]) => {
        if (cancelled) return;
        log.info("op=ClientMiniProfile.load outcome=ok", { clientId, orders: page.totalElements });
        setClient(c);
        setOrders(page.content);
      })
      .catch((err) => log.error("op=ClientMiniProfile.load outcome=error", { clientId, err: String(err) }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!clientId) {
    return (
      <aside className="border-l border-admin-line bg-white flex items-center justify-center shrink-0" style={{ width: 280 }}>
        <span className="t-mono text-[11px] opacity-40">wybierz wątek</span>
      </aside>
    );
  }

  if (loading && !client) {
    return (
      <aside role="status" className="border-l border-admin-line bg-white p-4 space-y-3 animate-pulse shrink-0" style={{ width: 280 }}>
        <div className="mx-auto rounded-full bg-paper-2 border border-ink" style={{ width: 64, height: 64 }} />
        <div className="h-4 bg-paper-2 rounded mx-6" />
        <div className="h-3 bg-paper-2 rounded mx-10" />
      </aside>
    );
  }

  if (!client) return null;

  const ini = initials(client);
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ");
  const joined = joinedDate(client.createdAt);
  const isRegular = orders.length >= 3;

  return (
    <aside className="border-l border-admin-line bg-white flex flex-col overflow-auto shrink-0" style={{ width: 280 }}>
      <ClientMiniProfileIdentity ini={ini} fullName={fullName} joined={joined} isRegular={isRegular} />
      <ClientMiniProfileContact client={client} />
      <ClientMiniProfileOrders orders={orders} />
    </aside>
  );
}
