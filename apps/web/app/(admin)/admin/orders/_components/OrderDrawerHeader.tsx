"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Pill, I } from "@drshoes/ui";
import { createLogger } from "@/lib/log";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("order-drawer-header");

interface Props {
  code: string;
  status: OrderStatus;
  clientName?: string | null;
  receivedAt?: string | null;
}

const TZ = "Europe/Warsaw";
function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ,
  });
}

export function OrderDrawerHeader({ code, status, clientName, receivedAt }: Props) {
  log.debug("op=render", { code, status });
  const sub = [
    clientName,
    receivedAt ? `przyjęte ${fmtShortDate(receivedAt)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "16px 20px", borderBottom: "2px solid var(--ink)",
      background: "#fff",
    }}>
      <Dialog.Close asChild>
        <button className="btn-clean" style={{ padding: 6 }} aria-label="Zamknij">
          <I.close />
        </button>
      </Dialog.Close>

      <div style={{ flex: 1 }}>
        <Dialog.Title className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>
          {code}
        </Dialog.Title>
        {sub && (
          <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>

      <Pill status={status} />

      <button className="btn-clean" aria-label="Więcej opcji">
        <I.more />
      </button>
    </div>
  );
}
