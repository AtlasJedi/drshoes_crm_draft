"use client";

// TemplateListShell — client shell for /admin/templates.
// Left: list of TemplateCards. Right: TemplateEditPanel (when one is selected).
// usePageHeader wires topbar title + "+ Nowy szablon" button.
// < 55 LOC per granulate directive.

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button } from "@drshoes/ui";
import { getTemplates } from "@/lib/messaging/api";
import type { TemplateDto } from "@/lib/messaging/types";
import { TemplateCard } from "./TemplateCard";
import { TemplateEditPanel } from "./TemplateEditPanel";

const log = createLogger("templates.listshell");

export function TemplateListShell() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [editing, setEditing] = useState<TemplateDto | null>(null);

  usePageHeader({
    title: "Szablony wiadomości",
    subtitle: `${templates.length} szablonów`,
    right: <Button variant="primary">+ Nowy szablon</Button>,
  });

  useEffect(() => {
    getTemplates()
      .then(ts => {
        log.info("op=getTemplates outcome=ok", { count: ts.length });
        setTemplates(ts);
      })
      .catch(err => log.error("op=getTemplates outcome=error", { err: String(err) }));
  }, []);

  function handleSaved() {
    setEditing(null);
    getTemplates().then(setTemplates).catch(() => {});
  }

  return (
    <div
      className="grid grid-cols-admin-trig"
      style={{ gap: 20, padding: 24 }}
    >
      <div className="flex flex-col gap-2">
        {templates.length === 0 && (
          <div className="t-mono text-[12px] text-admin-mute py-8 text-center">
            Brak szablonów
          </div>
        )}
        {templates.map(t => (
          <TemplateCard key={t.id} template={t} onEdit={setEditing} />
        ))}
      </div>
      <div>
        {editing ? (
          <TemplateEditPanel
            template={editing}
            onClose={() => setEditing(null)}
            onSaved={handleSaved}
          />
        ) : (
          <div
            className="admin-card flex items-center justify-center t-mono text-[12px] text-admin-mute"
            style={{ padding: 40, minHeight: 160 }}
          >
            wybierz szablon do edycji
          </div>
        )}
      </div>
    </div>
  );
}
