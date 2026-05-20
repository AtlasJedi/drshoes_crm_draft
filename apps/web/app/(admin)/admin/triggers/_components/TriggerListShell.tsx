"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { Button } from "@drshoes/ui";
import { getTriggers } from "@/lib/messaging/api";
import type { TriggerDto } from "@/lib/messaging/types";
import { TriggerCard } from "./TriggerCard";
import { TriggerEditPanel } from "./TriggerEditPanel";

const log = createLogger("triggers.listshell");
export function TriggerListShell() {
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);
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

  function reloadTriggers() {
    getTriggers().then(setTriggers).catch(() => {});
  }

  function handleSaved() {
    setEditing(null);
    reloadTriggers();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: 24 }}>
      {/* LEFT */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Link
            href={"/admin/templates" as Route}
            className="btn-clean"
            style={{ fontSize: 12 }}
          >
            biblioteka szablonów →
          </Link>
        </div>
        {triggers.length === 0 && (
          <div className="t-mono text-[12px] text-admin-mute py-8 text-center">
            Brak triggerów
          </div>
        )}
        {triggers.map(t => (
          <TriggerCard key={t.id} trigger={t} onEdit={setEditing} onToggled={reloadTriggers} />
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
