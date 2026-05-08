/**
 * Client component: toggle a trigger's enabled state.
 * Calls PATCH /admin/triggers/:id/enabled and refreshes the server component.
 */
"use client";
import { useState, useTransition } from "react";
import { toggleTrigger } from "@/lib/messaging/api";
import { createLogger } from "@/lib/log";
import { useRouter } from "next/navigation";

const log = createLogger("trigger-toggle");

export function TriggerToggle({
  id,
  initialEnabled,
}: {
  id: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function flip() {
    const next = !enabled;
    try {
      const updated = await toggleTrigger(id, next);
      setEnabled(updated.enabled);
      log.info("op=toggle outcome=success", { id, enabled: updated.enabled });
      start(() => router.refresh());
    } catch (e) {
      log.error("op=toggle outcome=error", { id, err: String(e) });
    }
  }

  return (
    <button
      onClick={flip}
      disabled={pending}
      className={[
        "inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors",
        enabled
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-admin-surface text-admin-mute hover:bg-admin-line",
        pending ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {enabled ? "Włączony" : "Wyłączony"}
    </button>
  );
}
