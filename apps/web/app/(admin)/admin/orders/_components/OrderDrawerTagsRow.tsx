"use client";
// apps/web/app/(admin)/admin/orders/_components/OrderDrawerTagsRow.tsx
// Renders order tags as colour-coded chips + disabled "dodaj" stub (M10).
// < 30 LOC per granulate directive.

import { createLogger } from "@/lib/log";
import { Chip } from "@repo/ui";

const log = createLogger("order-drawer-tags");

interface Props { tags: string[] | null | undefined; }

export function OrderDrawerTagsRow({ tags }: Props) {
  log.debug("op=OrderDrawerTagsRow.render", { count: tags?.length ?? 0 });
  return (
    <div className="flex flex-wrap gap-2 items-center px-5 py-3 border-b border-admin-line">
      <span
        className="t-mono"
        style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: ".1em", textTransform: "uppercase" }}
      >
        tagi:
      </span>
      {(tags ?? []).map((tag) => (
        <Chip key={tag} color={tag === "pilne" ? "pink" : "default"}>
          {tag}
        </Chip>
      ))}
      {/* TODO M10: wire real tag creation; disabled stub per plan note F */}
      <Chip
        disabled
        title="Dodawanie tagów wkrótce"
        variant="dashed"
        style={{ background: "transparent" }}
      >
        + dodaj
      </Chip>
    </div>
  );
}
