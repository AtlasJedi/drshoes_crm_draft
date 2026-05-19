"use client";

/**
 * OrderDrawerInfoBlock — compact klient row + 4-col stats grid.
 * Replaces the stacked field rows from OrderDrawerCoreFields.
 * Matches design/handoff/order-drawer-redesign/index.html .info-block spec.
 * < 60 LOC per granulated-code rule.
 */

import { createLogger } from "@/lib/log";
import { daysInShop } from "@/lib/orders/dim";
import type { OrderDto } from "@/lib/orders/types";

const log = createLogger("order-drawer-info-block");

function pricePLN(cents: number): string {
  return (cents / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface Props {
  order: OrderDto;
}

export function OrderDrawerInfoBlock({ order }: Props) {
  log.debug("op=render", { orderId: order.id });

  const days = daysInShop({ receivedAt: order.receivedAt, status: order.status });
  const daysLabel = days === null ? "—" : `${days} ${days === 1 ? "dzień" : "dni"}`;
  const balance = Math.max(0, order.quotedPriceCents - order.advancePaidCents);

  return (
    <section
      aria-label="Dane zlecenia"
      style={{ border: "1.5px solid var(--ink)", background: "var(--paper)" }}
    >
      {/* KLIENT row: label · name · phone */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: "1.5px solid var(--ink)",
      }}>
        <span className="t-mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--admin-mute)" }}>
          Klient
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600 }}>
          {order.clientName}
        </span>
        <span className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute)" }}>
          {/* phone is not on OrderDto yet — placeholder */}
        </span>
      </div>

      {/* Stats grid: czas / wycena / zaliczka / do zapłaty */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Czas", value: daysLabel, color: undefined as string | undefined },
          { label: "Wycena", value: `${pricePLN(order.quotedPriceCents)} zł`, color: undefined },
          { label: "Zaliczka", value: order.advancePaidCents > 0 ? pricePLN(order.advancePaidCents) : "0,00", color: "var(--green-dark)" },
          { label: "Do zapłaty", value: `${pricePLN(balance)} zł`, color: "var(--magenta)" },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            data-testid={i === 3 ? "stat-do-zaplaty" : i === 2 ? "stat-zaliczka" : undefined}
            style={{
              padding: "10px 12px 12px",
              borderRight: i < arr.length - 1 ? "1.5px solid var(--ink)" : undefined,
            }}
          >
            <span className="t-mono" style={{ display: "block", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--admin-mute)", marginBottom: 4 }}>
              {stat.label}
            </span>
            <span
              className="t-stencil"
              style={{ fontWeight: 800, fontSize: 18, letterSpacing: ".01em", lineHeight: 1.1, color: stat.color }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
