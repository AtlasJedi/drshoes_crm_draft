"use client";

/**
 * ReportIssueButton — sidebar "Zgłoś problem" button.
 * Opens a Radix Dialog showing traceId + URL + user.
 * "Kopiuj JSON" copies the bug-report payload to clipboard.
 * Falls back to /api/health warm-up when no active span exists.
 */
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { trace } from "@opentelemetry/api";
import { createLogger } from "@/lib/log";

const log = createLogger("report-issue");

const ZERO_TRACE = "00000000000000000000000000000000";
const JAEGER_BASE = "http://localhost:16686/trace";

interface Props {
  user: string;
}

function readTraceId(): string {
  return trace.getActiveSpan()?.spanContext().traceId ?? ZERO_TRACE;
}

export function ReportIssueButton({ user }: Props) {
  const pathname  = usePathname();
  const [open, setOpen]       = useState(false);
  const [traceId, setTraceId] = useState(ZERO_TRACE);
  const [copied, setCopied]   = useState(false);

  async function handleOpen() {
    let tid = readTraceId();
    if (!tid || tid === ZERO_TRACE) {
      log.info("op=traceWarmup");
      await fetch("/api/health");
      tid = readTraceId();
    }
    setTraceId(tid);
    setCopied(false);
    setOpen(true);
  }

  function buildPayload() {
    return {
      traceId,
      url: pathname,
      user,
      userAgent: navigator.userAgent,
      capturedAt: new Date().toISOString(),
      jaegerUrl: `${JAEGER_BASE}/${traceId}`,
    };
  }

  async function handleCopy() {
    const payload = JSON.stringify(buildPayload(), null, 2);
    await navigator.clipboard.writeText(payload);
    log.info("op=copy outcome=ok", { traceId });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={() => { void handleOpen(); }}
          className="w-full text-left px-2 py-1 rounded text-sm font-medium transition-colors text-admin-mute hover:bg-acid/10 hover:text-ink"
          aria-label="Zgłoś problem"
        >
          Zgłoś problem
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-paper rounded-lg shadow-xl p-6 space-y-4"
          aria-describedby="report-desc"
        >
          <Dialog.Title className="font-display text-lg">Zgłoś problem</Dialog.Title>
          <p id="report-desc" className="text-xs text-admin-mute">
            Skopiuj poniższy JSON i wklej w chacie z Claude.
          </p>

          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-admin-mute w-20 shrink-0">Trace ID</dt>
              <dd className="font-mono text-xs break-all">{traceId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-admin-mute w-20 shrink-0">URL</dt>
              <dd className="font-mono text-xs break-all">{pathname}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-admin-mute w-20 shrink-0">Użytkownik</dt>
              <dd className="text-xs">{user}</dd>
            </div>
          </dl>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { void handleCopy(); }}
              className="flex-1 h-9 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-admin-ink transition-colors"
            >
              {copied ? "Skopiowano ✓" : "Kopiuj JSON"}
            </button>
            <a
              href={`${JAEGER_BASE}/${traceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 flex items-center text-sm font-medium border border-admin-line rounded-sm hover:bg-acid/10 transition-colors"
              aria-label="Otwórz w Jaeger"
            >
              Otwórz w Jaeger
            </a>
          </div>

          <Dialog.Close className="absolute top-4 right-4 text-admin-mute hover:text-ink">×</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
