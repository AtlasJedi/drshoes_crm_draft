"use client";

import { useState, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { getTemplates } from "@/lib/messaging/api";
import type { TemplateDto } from "@/lib/messaging/types";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.templatepicker");

interface Props {
  onSelect: (body: string, subject?: string | null) => void;
}

/**
 * Plain-HTML dropdown that loads templates and fills the composer body on selection.
 * No Radix dependency — uses click-outside dismiss via document listener. ~50 LOC.
 */
export function TemplatePicker({ onSelect }: Props) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(err => log.error("op=getTemplates outcome=error", { err: String(err) }));
  }, []);

  // Dismiss on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSelect(t: TemplateDto) {
    onSelect(t.body, t.subject);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <IconBtn label="Szablon" onClick={() => setOpen(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
        </svg>
      </IconBtn>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[200px] rounded-md border border-admin-line bg-white shadow-md py-1">
          {templates.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-admin-mute">Brak szablonów</div>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              className="w-full text-left px-3 py-2 text-[13px] cursor-pointer hover:bg-admin-hover outline-none"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
