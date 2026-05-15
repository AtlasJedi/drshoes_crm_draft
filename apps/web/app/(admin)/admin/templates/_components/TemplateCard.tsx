"use client";

// TemplateCard — left-column card for a single message template.
// Design: name (t-display), channel chip (t-mono inverse), inactive badge.
// < 50 LOC per granulate directive.

import { createLogger } from "@/lib/log";
import type { TemplateDto } from "@/lib/messaging/types";

const log = createLogger("templates.card");

interface Props {
  template: TemplateDto;
  onEdit: (t: TemplateDto) => void;
}

export function TemplateCard({ template: t, onEdit }: Props) {
  log.debug("op=TemplateCard.render", { id: t.id });
  return (
    <div
      data-testid="template-card"
      className="admin-card flex gap-3 items-start"
      style={{ padding: 14, opacity: t.active ? 1 : 0.6 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="t-display" style={{ fontSize: 16 }}>{t.name}</div>
          <span
            className="t-mono"
            style={{
              fontSize: 9,
              padding: "1px 5px",
              background: "var(--ink)",
              color: "var(--paper)",
              letterSpacing: ".05em",
            }}
          >
            {t.channel}
          </span>
          {!t.active && (
            <span className="t-mono opacity-55" style={{ fontSize: 10 }}>
              nieaktywny
            </span>
          )}
        </div>
        {t.subject && (
          <div className="t-mono mt-0.5 opacity-60 truncate" style={{ fontSize: 11 }}>
            {t.subject}
          </div>
        )}
      </div>
      <button
        className="btn-clean shrink-0"
        style={{ fontSize: 11, padding: "3px 8px" }}
        onClick={() => onEdit(t)}
        aria-label="edytuj"
      >
        edytuj
      </button>
    </div>
  );
}
