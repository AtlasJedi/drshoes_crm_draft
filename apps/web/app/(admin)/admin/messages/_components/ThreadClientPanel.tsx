"use client";

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { getClient } from "@/lib/clients/api";
import type { ClientDto } from "@/lib/clients/types";
import type { MessageThreadDto } from "@/lib/messaging/types";

const log = createLogger("messaging.clientpanel");

interface Props {
  thread: MessageThreadDto;
}

/**
 * Right-rail panel showing client contact info, preferred channel, active order
 * placeholder, and totals.
 *
 * Active order section always renders "—": recentOrderId/recentOrderCode/
 * recentOrderStatus are not on MessageThreadDto (plan errata #2 — no backend
 * slice added in M5). totalOrders likewise stubbed as "—".
 * "Razem" (spent total) stubbed as "—" — pricing column deferred per M5 spec.
 */
export function ThreadClientPanel({ thread }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);

  useEffect(() => {
    if (!thread.clientId) return;
    let cancelled = false;
    getClient(thread.clientId)
      .then(c => {
        if (!cancelled) setClient(c);
      })
      .catch(err =>
        log.error("op=getClient outcome=error", {
          clientId: thread.clientId,
          err: String(err),
        })
      );
    return () => {
      cancelled = true;
    };
  }, [thread.clientId]);

  if (!thread.clientId || !client) return null;

  const initials =
    client.firstName && client.lastName
      ? (client.firstName.charAt(0) + client.lastName.charAt(0)).toUpperCase()
      : (client.firstName?.charAt(0) ?? "?").toUpperCase();

  const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ");

  // 3-way channel chip color (plan errata #3)
  const channelCls =
    thread.channel === "EMAIL"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : thread.channel === "WHATSAPP"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-violet-50 text-violet-700 border-violet-200";

  return (
    <aside className="w-[320px] shrink-0 border-l border-admin-line bg-paper flex flex-col overflow-auto">
      {/* Identity section */}
      <div className="px-5 py-5 border-b border-admin-line">
        <div className="flex flex-col items-center text-center">
          <div
            className="bg-ink text-paper flex items-center justify-center rounded-full font-semibold text-[20px]"
            style={{ width: 56, height: 56 }}
          >
            {initials}
          </div>
          <div className="mt-2.5 font-semibold text-[15px]">{fullName}</div>
          <div className="text-[11px] text-admin-mute mt-0.5">
            klient od {new Date(client.createdAt).getFullYear()}
          </div>
        </div>
      </div>

      {/* Contact section */}
      <div className="px-5 py-4 border-b border-admin-line space-y-2.5">
        {client.email && (
          <div>
            <div className="text-[10px] text-admin-mute uppercase mb-0.5">Email</div>
            <div className="text-[13px] font-mono">{client.email}</div>
          </div>
        )}
        {client.phone && (
          <div>
            <div className="text-[10px] text-admin-mute uppercase mb-0.5">Telefon</div>
            <div className="text-[13px] font-mono">{client.phone}</div>
          </div>
        )}
        <div>
          <div className="text-[10px] text-admin-mute uppercase mb-0.5">Preferowany kanał</div>
          <span
            className={
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " +
              channelCls
            }
          >
            {thread.channel}
          </span>
        </div>
      </div>

      {/* Active order section — always "—" (plan errata #2: fields absent from DTO) */}
      <div className="px-5 py-4 border-b border-admin-line">
        <div className="text-[10px] text-admin-mute uppercase mb-2">Aktywne zlecenie</div>
        {/* TODO(M6+): add recentOrderId to MessageThreadDto when backend enriches it */}
        <div className="text-[13px] text-admin-mute">—</div>
      </div>

      {/* Totals row */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-admin-mute uppercase">Wszystkie</div>
          {/* TODO(M6+): totalOrders not on DTO */}
          <div className="text-[20px] font-semibold leading-tight mt-0.5">—</div>
        </div>
        <div>
          <div className="text-[10px] text-admin-mute uppercase">Razem</div>
          {/* TODO(M5+): pricing column on Order needed — stubbed as — */}
          <div className="text-[20px] font-semibold leading-tight mt-0.5">—</div>
        </div>
      </div>
    </aside>
  );
}
