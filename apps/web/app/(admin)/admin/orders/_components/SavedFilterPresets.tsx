"use client";

/**
 * Saved-filter preset chip row.
 * Two compound presets ("Pilne na ten tydzień", "Zaległe") + one chip per OrderStatus,
 * so the row covers every status available for orders.
 * Uses <Chip> from @repo/ui per M9 design-parity reskin.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { createLogger } from "@/lib/log";
import { Chip } from "@drshoes/ui";
import { STATUS_LABELS_PL, STATUS_ORDER } from "@/lib/orders/status";
import type { OrderStatus, OrderListRow } from "@/lib/orders/types";

const log = createLogger("saved-filter-presets");

interface Preset {
  label: string;
  params: () => Record<string, string | string[]>;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}


function buildPresets(): Preset[] {
  const statusPresets: Preset[] = STATUS_ORDER.map((s) => ({
    label: STATUS_LABELS_PL[s],
    params: () => ({ status: s }),
  }));

  return [
    {
      label: "Pilne na ten tydzień",
      params: () => {
        const today = new Date();
        const plus7 = new Date(today);
        plus7.setDate(plus7.getDate() + 7);
        return { tag: "pilne", plannedPickupAtFrom: toIsoDate(today), plannedPickupAtTo: toIsoDate(plus7) };
      },
    },
    {
      label: "Zaległe",
      params: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return { plannedPickupAtTo: toIsoDate(yesterday), status: ["W_REALIZACJI", "GOTOWE_DO_ODBIORU"] };
      },
    },
    ...statusPresets,
  ];
}

function isActive(preset: Preset, current: URLSearchParams): boolean {
  const required = preset.params();
  for (const [k, v] of Object.entries(required)) {
    if (Array.isArray(v)) {
      const got = current.getAll(k).sort();
      const want = [...v].sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) return false;
    } else {
      if (current.get(k) !== v) return false;
    }
  }
  return true;
}

function hasAnyFilter(params: URLSearchParams): boolean {
  const filterKeys = ["status", "type", "craftsmanId", "q", "tag", "plannedPickupAtFrom", "plannedPickupAtTo", "sort", "urgent"];
  return filterKeys.some((k) => params.has(k));
}

interface Props {
  rows?: OrderListRow[];
}

export function SavedFilterPresets({ rows = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presets = buildPresets();

  const pilneActive = searchParams.get("urgent") === "true";
  const pilneCount = rows.filter((r) => r.urgent).length;

  function togglePilne() {
    const p = new URLSearchParams(searchParams.toString());
    if (pilneActive) {
      p.delete("urgent");
      log.info("op=togglePilne action=off");
    } else {
      p.delete("page");
      p.set("urgent", "true");
      log.info("op=togglePilne action=on");
    }
    router.replace(`/admin/orders?${p.toString()}`);
  }

  function applyPreset(preset: Preset) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(preset.params())) {
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else p.set(k, v);
    }
    log.info("op=applyPreset", { label: preset.label, params: p.toString() });
    router.replace(`/admin/orders?${p.toString()}`);
  }

  function clearAllFilters() {
    log.info("op=clearAllFilters");
    router.replace("/admin/orders");
  }

  const activeIdx = presets.findIndex((pr) => isActive(pr, searchParams));
  const anyFilterActive = hasAnyFilter(searchParams);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
      <span className="font-mono text-[11px] text-admin-mute uppercase tracking-widest">Presety:</span>

      {anyFilterActive && (
        <Chip onClick={clearAllFilters} aria-label="Wyczyść wszystkie filtry">
          Wszystkie
        </Chip>
      )}

      <Chip
        active={pilneActive}
        color="pink"
        aria-pressed={pilneActive}
        data-testid="preset-pilne"
        onClick={togglePilne}
      >
        Pilne{pilneCount > 0 && <span className="ml-1 font-semibold">· {pilneCount}</span>}
      </Chip>

      {presets.map((preset, i) => {
        const active = i === activeIdx;
        const isFirst = i === 0;
        return (
          <Chip
            key={preset.label}
            active={active}
            color={isFirst ? "pink" : "default"}
            aria-pressed={active}
            onClick={() => {
              if (active) {
                log.info("op=toggleOffPreset", { label: preset.label });
                router.replace("/admin/orders");
              } else {
                applyPreset(preset);
              }
            }}
          >
            {preset.label}
          </Chip>
        );
      })}
    </div>
  );
}
