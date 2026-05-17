/**
 * Donut chart — current order type mix.
 * 4 segments: Usługa acid / Custom pink / Naprawa orange / Renowacje blue.
 * Legend rows with 14px coloured square + label + percent.
 * Pure server component.
 * ~75 LOC.
 */
import type { MixByTypeRowDto } from "@/lib/dashboard/types";
import { KIND_LABELS_PL } from "@/lib/orders/status";

const KIND_COLORS: Record<string, string> = {
  USLUGA:    "var(--acid)",
  NAPRAWA:   "var(--orange)",
  RENOWACJA: "var(--blue)",
  CUSTOM:    "var(--pink)",
};

const CIRC = 490;
const R = 78;
const CX = 100;
const CY = 100;
const STROKE_W = 34;

interface LegendRowProps {
  color: string;
  label: string;
  percent: number;
}

function LegendRow({ color, label, percent }: LegendRowProps) {
  return (
    <div className="flex items-center gap-[10px]">
      <span
        className="inline-block shrink-0"
        style={{ width: 14, height: 14, background: color, border: "1px solid var(--ink)" }}
      />
      <span className="flex-1 text-[13px]">{label}</span>
      <span className="t-mono font-bold text-[12px]">{percent}%</span>
    </div>
  );
}

interface Props {
  mix: MixByTypeRowDto[];
  totalActive: number;
}

export function MixDonut({ mix, totalActive }: Props) {
  const { arcs } = mix.reduce<{
    arcs: Array<{ row: MixByTypeRowDto; dashLen: number; rotation: number }>;
    deg: number;
  }>(
    (acc, row) => {
      const dashLen = (row.percent / 100) * CIRC;
      return {
        arcs: [...acc.arcs, { row, dashLen, rotation: acc.deg }],
        deg: acc.deg + (row.percent / 100) * 360,
      };
    },
    { arcs: [], deg: -90 },
  );

  return (
    <div className="admin-card p-[22px]">
      <div className="t-display text-[22px] mb-[14px]">Mix zleceń</div>
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: 180 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--paper-2)" strokeWidth={STROKE_W} />
        {arcs.map(({ row, dashLen, rotation }) => (
          <circle
            key={row.kind}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={KIND_COLORS[row.kind] ?? "var(--ink)"}
            strokeWidth={STROKE_W}
            strokeDasharray={`${dashLen} ${CIRC}`}
            transform={`rotate(${rotation} ${CX} ${CY})`}
          />
        ))}
        <text x={CX} y={98} textAnchor="middle" fontFamily="Anton" fontSize="34" fill="var(--ink)">
          {totalActive}
        </text>
        <text x={CX} y={118} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(0,0,0,0.55)">
          aktywne
        </text>
      </svg>
      <div className="flex flex-col gap-[6px] mt-[6px]">
        {mix.map((row) => (
          <LegendRow
            key={row.kind}
            color={KIND_COLORS[row.kind] ?? "var(--ink)"}
            label={KIND_LABELS_PL[row.kind as keyof typeof KIND_LABELS_PL] ?? row.kind}
            percent={row.percent}
          />
        ))}
      </div>
    </div>
  );
}
