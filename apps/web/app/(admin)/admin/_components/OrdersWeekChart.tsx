/**
 * Stacked bar chart — orders by period (week/month/quarter).
 * Chip row (tydzień/miesiąc/kwartał) triggers full-page server re-render via URL param.
 * Server component — chips are Next.js <Link> elements.
 *
 * Bars and legend are driven entirely by KIND_ORDER from lib/orders/status.ts.
 * Adding a new OrderItemKind requires zero changes here.
 */
import Link from "next/link";
import { Chip } from "@drshoes/ui";
import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";
import { KIND_COLORS, KIND_LABELS_PL, KIND_ORDER } from "@/lib/orders/status";

interface Props {
  rows: OrdersPerWeekRowDto[];
  period?: string;
}

const VIEW_H = 220;
const BAR_BOTTOM = 190;
const SCALE = 7;

const CHIPS = [
  { label: "tydzień",  period: "WEEK",    subtitle: "ostatnie 8 tygodni" },
  { label: "miesiąc",  period: "MONTH",   subtitle: "ostatnie 6 miesięcy" },
  { label: "kwartał",  period: "QUARTER", subtitle: "ostatnie 4 kwartały" },
];

export function OrdersWeekChart({ rows, period = "WEEK" }: Props) {
  const activePeriod = period.toUpperCase();
  const activeChip = CHIPS.find(c => c.period === activePeriod) ?? CHIPS[0]!;

  return (
    <div className="admin-card p-[22px]">
      <div className="flex justify-between items-start mb-[18px]">
        <div>
          <div className="t-display text-[22px]">Zlecenia / {activeChip.label}</div>
          <div className="t-mono text-[11px] text-admin-mute">{activeChip.subtitle}</div>
        </div>
        <div className="flex gap-1.5">
          {CHIPS.map((c) => (
            <Link key={c.period} href={`?period=${c.period}`}>
              <Chip active={activePeriod === c.period}>
                {c.label}
              </Chip>
            </Link>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 720 ${VIEW_H}`} style={{ width: "100%", height: VIEW_H }}>
        <g stroke="rgba(0,0,0,0.08)">
          <line x1="0" y1="40" x2="720" y2="40" />
          <line x1="0" y1="90" x2="720" y2="90" />
          <line x1="0" y1="140" x2="720" y2="140" />
          <line x1="0" y1="190" x2="720" y2="190" />
        </g>
        {rows.map((row, i) => {
          const x = 30 + i * 86;
          const label = row.weekIso.replace(/^\d{4}-/, "");
          // Stack rects bottom-up in KIND_ORDER. cumY tracks the top of the next segment.
          let cumY = BAR_BOTTOM;
          const rects = KIND_ORDER.map((kind) => {
            const count = row.byKind[kind] ?? 0;
            const h = count * SCALE;
            const y = cumY - h;
            cumY = y;
            if (h === 0) return null;
            return (
              <rect
                key={kind}
                x={x} y={y}
                width="40" height={h}
                fill={KIND_COLORS[kind]}
              />
            );
          });
          return (
            <g key={row.weekIso}>
              {rects}
              <text x={x + 20} y="210" textAnchor="middle" fontSize="10"
                fontFamily="JetBrains Mono" fill="rgba(0,0,0,0.5)">{label}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend — driven by KIND_ORDER; adding a kind updates this automatically */}
      <div className="flex flex-wrap gap-4 mt-2">
        {KIND_ORDER.map((kind) => (
          <span key={kind} className="t-mono text-[11px] inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ background: KIND_COLORS[kind] }}
            />
            {KIND_LABELS_PL[kind]}
          </span>
        ))}
      </div>
    </div>
  );
}
