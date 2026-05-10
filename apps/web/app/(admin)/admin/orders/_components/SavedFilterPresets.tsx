"use client";

/**
 * Hard-coded saved-filter preset chip row.
 * Three presets per spec §7 (locked). The "+ zapisz widok" chip renders disabled.
 * Chip styles mirror admin.jsx:266-272.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { createLogger } from "@/lib/log";

const log = createLogger("saved-filter-presets");

interface Preset {
  label: string;
  /** Returns URLSearchParams entries for this preset. */
  params: () => Record<string, string | string[]>;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildPresets(): Preset[] {
  return [
    {
      label: "Pilne na ten tydzień",
      params: () => {
        const today = new Date();
        const plus7 = new Date(today);
        plus7.setDate(plus7.getDate() + 7);
        return {
          tag: "pilne",
          plannedPickupAtFrom: toIsoDate(today),
          plannedPickupAtTo: toIsoDate(plus7),
        };
      },
    },
    {
      label: "Gotowe do odbioru",
      params: () => ({ status: "GOTOWE_DO_ODBIORU" }),
    },
    {
      label: "Zaległe",
      params: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          plannedPickupAtTo: toIsoDate(yesterday),
          status: ["W_REALIZACJI", "GOTOWE_DO_ODBIORU"],
        };
      },
    },
  ];
}

/** Returns true when the current search params satisfy all of the preset's required params. */
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

export function SavedFilterPresets() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presets = buildPresets();

  function applyPreset(preset: Preset) {
    const p = new URLSearchParams();
    const entries = preset.params();
    for (const [k, v] of Object.entries(entries)) {
      if (Array.isArray(v)) {
        v.forEach((x) => p.append(k, x));
      } else {
        p.set(k, v);
      }
    }
    log.info("op=applyPreset", { label: preset.label, params: p.toString() });
    router.replace(`/admin/orders?${p.toString()}`);
  }

  const activeIdx = presets.findIndex((pr) => isActive(pr, searchParams));

  const chipBase =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-admin-line transition-colors cursor-pointer select-none";
  const chipDefault = chipBase + " bg-admin-surface text-admin-ink hover:bg-acid/10";
  const chipActive = chipBase + " bg-ink text-paper border-ink";
  const chipPink = chipBase + " bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200";
  const chipDisabled =
    chipBase + " bg-transparent border-dashed text-admin-mute cursor-not-allowed opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
      <span className="font-mono text-[11px] text-admin-mute uppercase tracking-widest">
        Presety:
      </span>

      {presets.map((preset, i) => {
        const isFirstPreset = i === 0; // "Pilne" — pink accent per admin.jsx:268
        const active = i === activeIdx;
        const cls = active ? chipActive : isFirstPreset ? chipPink : chipDefault;
        return (
          <button
            key={preset.label}
            type="button"
            className={cls}
            onClick={() => applyPreset(preset)}
            aria-pressed={active}
          >
            {preset.label}
          </button>
        );
      })}

      <button
        type="button"
        className={chipDisabled}
        disabled
        title="Wkrótce: możliwość zapisywania własnych widoków"
        aria-label="Zapisz widok (wkrótce)"
      >
        + zapisz widok
      </button>
    </div>
  );
}
