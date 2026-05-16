"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import type { Route } from "next";
import { I } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import type { OrderDto } from "@/lib/orders/types";
import { OrderDrawerHeader } from "./OrderDrawerHeader";
import { OrderDrawerCoreFields } from "./OrderDrawerCoreFields";
import { OrderDrawerStatusChanger } from "./OrderDrawerStatusChanger";
import { OrderDrawerItems } from "./OrderDrawerItems";
import { OrderDrawerTimeline } from "./OrderDrawerTimeline";
import { OrderDrawerMessages } from "./OrderDrawerMessages";
import { OrderDrawerPhotos } from "./OrderDrawerPhotos";
import { OrderDrawerNotes } from "./OrderDrawerNotes";
import { OrderDrawerNoteComposer } from "./OrderDrawerNoteComposer";
import { MessageComposerModal } from "./MessageComposerModal";
import { OrderDrawerStatusTimeline } from "./OrderDrawerStatusTimeline";

const log = createLogger("order-drawer");


interface Props {
  initialOrder: OrderDto;
}

export function OrderDrawer({ initialOrder }: Props) {
  const [order, setOrder] = useState<OrderDto>(initialOrder);
  const [refreshKey, setRefreshKey] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [markingWydane, setMarkingWydane] = useState(false);
  const [markWydaneError, setMarkWydaneError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleOrderUpdated(updated: OrderDto) {
    setOrder(updated);
    setRefreshKey((k) => k + 1);
  }

  async function markWydane() {
    if (markingWydane || order.status === "WYDANE" || order.status === "ANULOWANE") return;
    setMarkingWydane(true);
    setMarkWydaneError(null);
    try {
      const res = await changeStatus(order.id, "WYDANE", order.version, true);
      log.info("op=mark-wydane outcome=ok", { orderId: order.id, from: order.status });
      handleOrderUpdated(res.order);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        setMarkWydaneError("Konflikt wersji — odśwież drawer i spróbuj ponownie.");
        log.info("op=mark-wydane outcome=conflict", { orderId: order.id });
      } else {
        setMarkWydaneError("Nie udało się oznaczyć jako wydane.");
        log.error("op=mark-wydane outcome=error", { orderId: order.id, status });
      }
    } finally {
      setMarkingWydane(false);
    }
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
            location={order.location}
          />

          <div className="flex-1 overflow-y-auto">
            <OrderDrawerStatusTimeline currentStatus={order.status} />
            <OrderDrawerCoreFields order={order} onOrderUpdate={handleOrderUpdated} />

            <OrderDrawerStatusChanger order={order} onOrderUpdated={handleOrderUpdated} />
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
            <button
              type="button"
              className="btn-clean acid"
              onClick={markWydane}
              disabled={markingWydane || order.status === "WYDANE" || order.status === "ANULOWANE"}
              aria-label="Oznacz jako wydane"
              title={
                order.status === "WYDANE"
                  ? "Zlecenie już wydane"
                  : order.status === "ANULOWANE"
                  ? "Zlecenie anulowane"
                  : "Oznacz jako wydane"
              }
            >
              {markingWydane ? "zapisywanie…" : "oznacz jako wydane"}
            </button>
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
          {markWydaneError && (
            <div
              role="alert"
              style={{
                padding: "8px 14px",
                borderTop: "1px solid var(--admin-line, #d8d2c0)",
                background: "#fff",
                color: "var(--red, #c0392b)",
                fontSize: 12,
              }}
            >
              {markWydaneError}
            </div>
          )}
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
