/**
 * Donut chart — current order type mix.
 * SVG adapted directly from admin.jsx:136-148.
 * Pure server component.
 * ~80 LOC.
 */
import type { MixByTypeRowDto } from "@/lib/dashboard/types";

const KIND_LABELS: Record<string, string> = {
  NAPRAWA: "Naprawy",
  CUSTOM_BUTY: "Custom buty",
  CUSTOM_KURTKA: "Custom kurtki",
};

const KIND_COLORS: Record<string, string> = {
  NAPRAWA: "var(--acid)",
  CUSTOM_BUTY: "var(--pink)",
  CUSTOM_KURTKA: "var(--blue)",
};

// Donut geometry: r=78, cx=cy=100, circumference≈490
const CIRC = 490;
const R = 78;
const CX = 100;
const CY = 100;
const STROKE_W = 34;

interface Props {
  mix: MixByTypeRowDto[];
  totalActive: number;
}

export function MixDonut({ mix, totalActive }: Props) {
  // Build cumulative rotation offsets for each arc using reduce to avoid mutable variable.
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
        {/* track */}
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
      <div className="flex flex-col gap-1.5 mt-1.5">
        {mix.map((row) => (
          <div key={row.kind} className="flex items-center gap-2 t-mono text-[11px]">
            <span
              className="inline-block w-2.5 h-2.5 shrink-0"
              style={{ background: KIND_COLORS[row.kind] }}
            />
            <span className="flex-1">{KIND_LABELS[row.kind] ?? row.kind}</span>
            <span className="text-admin-mute">{row.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
