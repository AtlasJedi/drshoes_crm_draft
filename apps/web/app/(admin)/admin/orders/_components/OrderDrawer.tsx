"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import type { Route } from "next";
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
import { MessageComposerModal } from "./MessageComposerModal";

const log = createLogger("order-drawer");

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
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className={[
            "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-paper shadow-2xl flex flex-col",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
            "duration-200",
          ].join(" ")}
          aria-describedby={undefined}
        >
          <OrderDrawerHeader code={order.code} status={order.status} />

          <div className="flex-1 overflow-y-auto">
            <OrderDrawerCoreFields order={order} users={users} onOrderUpdate={handleOrderUpdated} />

            <OrderDrawerStatusChanger order={order} onOrderUpdated={handleOrderUpdated} />
            <OrderDrawerItems order={order} onOrderUpdated={handleOrderUpdated} />
            <OrderDrawerTimeline orderId={order.id} refreshKey={refreshKey} />
            <section className="px-6 py-4 border-t border-admin-line">
              <p className="text-xs font-medium text-admin-mute uppercase tracking-wide mb-3">
                Zdjęcia
              </p>
              <OrderDrawerPhotos orderId={order.id} />
            </section>
            <OrderDrawerMessages
              orderId={order.id}
              refreshKey={refreshKey}
              onComposeClick={() => setComposeOpen(true)}
            />
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
