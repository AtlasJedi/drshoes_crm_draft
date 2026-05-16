"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import type { Route } from "next";
import { I } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import type { OrderDto } from "@/lib/orders/types";
import type { UserStubDto } from "@/lib/users/types";
import { OrderDrawerHeader } from "./OrderDrawerHeader";
import { OrderDrawerCoreFields } from "./OrderDrawerCoreFields";
import { OrderDrawerStatusChanger } from "./OrderDrawerStatusChanger";
import { OrderDrawerItems } from "./OrderDrawerItems";
import { OrderDrawerTimeline } from "./OrderDrawerTimeline";
import { OrderDrawerMessages } from "./OrderDrawerMessages";
import { OrderDrawerPhotos } from "./OrderDrawerPhotos";
import { OrderDrawerNotes } from "./OrderDrawerNotes";
import { OrderDrawerNoteComposer } from "./OrderDrawerNoteComposer";
import { OrderDrawerTagsRow } from "./OrderDrawerTagsRow";
import { MessageComposerModal } from "./MessageComposerModal";
import { OrderDrawerStatusTimeline } from "./OrderDrawerStatusTimeline";

const log = createLogger("order-drawer");

/** order.tags is stored as a serialised JSON string (e.g. '["pilne","stały klient"]'). */
function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

interface Props {
  initialOrder: OrderDto;
  users: UserStubDto[];
}

export function OrderDrawer({ initialOrder, users }: Props) {
  const [order, setOrder] = useState<OrderDto>(initialOrder);
  const [refreshKey, setRefreshKey] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleOrderUpdated(updated: OrderDto) {
    setOrder(updated);
    setRefreshKey((k) => k + 1);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      log.info("op=close", { orderId: order.id });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("orderId");
      const qs = params.toString();
      router.replace((qs ? `/admin/orders?${qs}` : "/admin/orders") as Route);
    }
  }

  log.debug("op=open", { orderId: order.id });

  return (
    <Dialog.Root open onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: 540,
            background: "var(--paper, #f4efe6)",
            borderLeft: "3px solid var(--ink, #0a0a0a)",
            boxShadow: "-12px 0 30px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            animation: "drawerIn 0.25s ease",
            zIndex: 50,
          }}
        >
          <OrderDrawerHeader
            code={order.code}
            status={order.status}
            clientName={order.clientName}
            receivedAt={order.receivedAt}
          />

          <div className="flex-1 overflow-y-auto">
            <OrderDrawerStatusTimeline currentStatus={order.status} />
            <OrderDrawerCoreFields order={order} users={users} onOrderUpdate={handleOrderUpdated} />

            <OrderDrawerStatusChanger order={order} onOrderUpdated={handleOrderUpdated} />
            {/* Tags row — after StatusTimeline per spec 9-26; disabled "+ dodaj" stub until M10 */}
            <OrderDrawerTagsRow tags={parseTags(order.tags)} />
            <OrderDrawerItems order={order} onOrderUpdated={handleOrderUpdated} />
            <OrderDrawerTimeline orderId={order.id} refreshKey={refreshKey} />
            <section className="px-6 py-4 border-t border-admin-line">
              <p className="text-xs font-medium text-admin-mute uppercase tracking-wide mb-3">
                Zdjęcia
              </p>
              <OrderDrawerPhotos orderId={order.id} />
            </section>
            <OrderDrawerNoteComposer
              orderId={order.id}
              currentLocation={order.location ?? null}
              onSaved={() => setRefreshKey((k) => k + 1)}
            />
            <OrderDrawerNotes orderId={order.id} refreshKey={refreshKey} />
            <OrderDrawerMessages
              orderId={order.id}
              refreshKey={refreshKey}
              onComposeClick={() => setComposeOpen(true)}
            />
          </div>

          {/* Footer action bar */}
          <div style={{
            padding: 14, borderTop: "2px solid var(--ink)",
            background: "#fff", display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center",
          }}>
            {/* zmień status — scrolls to / triggers the status changer in body */}
            <button className="btn-clean primary">zmień status</button>
            {/* convenience shortcut: marks order WYDANE directly */}
            <button className="btn-clean acid">oznacz jako wydane</button>
            <button className="btn-clean" onClick={() => setComposeOpen(true)}>
              {I.send} wiadomość
            </button>
            <button className="btn-clean">paragon</button>
            <div style={{ flex: 1 }} />
            <button
              className="btn-clean"
              style={{ color: "var(--red)", borderColor: "var(--red)" }}
              aria-label="Anuluj zlecenie"
            >
              anuluj
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Composer modal — rendered outside the drawer scroll container */}
      <MessageComposerModal
        orderId={order.id}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={() => setRefreshKey((k) => k + 1)}
      />
    </Dialog.Root>
  );
}
