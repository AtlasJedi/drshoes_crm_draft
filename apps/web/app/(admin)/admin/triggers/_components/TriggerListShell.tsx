"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button, Chip } from "@repo/ui";
import { getTriggers } from "@/lib/messaging/api";
import type { TriggerDto } from "@/lib/messaging/types";
import { TriggerCard } from "./TriggerCard";
import { TriggerEditPanel } from "./TriggerEditPanel";

const log = createLogger("triggers.listshell");
type Filter = "active" | "disabled" | "manual";

export function TriggerListShell() {
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<TriggerDto | null>(null);

  usePageHeader({
    title: "Triggery",
    subtitle: "zautomatyzowane wiadomości",
    right: <Button variant="primary" size="sm">+ Nowy trigger</Button>,
  });

  useEffect(() => {
    getTriggers()
      .then(ts => {
        log.info("op=getTriggers outcome=ok", { count: ts.length });
        setTriggers(ts);
      })
      .catch(err => log.error("op=getTriggers outcome=error", { err: String(err) }));
  }, []);

  const filtered = triggers.filter(t =>
    filter === "active"   ? t.enabled && !t.requiresManualConfirmation :
    filter === "disabled" ? !t.enabled :
    t.requiresManualConfirmation,
  );
  const activeCt  = triggers.filter(t => t.enabled && !t.requiresManualConfirmation).length;
  const disabledCt = triggers.filter(t => !t.enabled).length;
  const manualCt  = triggers.filter(t => t.requiresManualConfirmation).length;

  function handleSaved() {
    setEditing(null);
    getTriggers().then(setTriggers).catch(() => {});
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: 24 }}>
      {/* LEFT */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            <Chip active={filter === "active"} onClick={() => setFilter("active")}>
              aktywne ({activeCt})
            </Chip>
            <Chip active={filter === "disabled"} onClick={() => setFilter("disabled")}>
              wyłączone ({disabledCt})
            </Chip>
            <Chip active={filter === "manual"} onClick={() => setFilter("manual")}>
              do potwierdzenia ({manualCt})
            </Chip>
          </div>
          <Link
            href={"/admin/templates" as Route}
            className="btn-clean"
            style={{ fontSize: 12 }}
          >
            biblioteka szablonów →
          </Link>
        </div>
        {filtered.length === 0 && (
          <div className="t-mono text-[12px] text-admin-mute py-8 text-center">
            Brak triggerów w tym filtrze
          </div>
        )}
        {filtered.map(t => (
          <TriggerCard key={t.id} trigger={t} onEdit={setEditing} />
        ))}
      </div>
      {/* RIGHT */}
      <div>
        {editing ? (
          <TriggerEditPanel
            trigger={editing}
            onClose={() => setEditing(null)}
            onSaved={handleSaved}
          />
        ) : (
          <div
            className="admin-card flex items-center justify-center t-mono text-[12px] text-admin-mute"
            style={{ padding: 40, minHeight: 200 }}
          >
            wybierz trigger do edycji
          </div>
        )}
      </div>
    </div>
  );
}
