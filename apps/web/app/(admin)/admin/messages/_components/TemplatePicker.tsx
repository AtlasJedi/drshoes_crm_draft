"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getTemplates } from "@/lib/messaging/api";
import type { TemplateDto } from "@/lib/messaging/types";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.templatepicker");

interface Props {
  onSelect: (body: string) => void;
}

/**
 * Plain-HTML dropdown that loads templates and fills the composer body on selection.
 * No Radix dependency — uses click-outside + Esc dismiss via document listeners.
 * Trigger button exposes aria-haspopup/aria-expanded; items are keyboard-reachable via Tab.
 */
export function TemplatePicker({ onSelect }: Props) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(err => log.error("op=getTemplates outcome=error", { err: String(err) }));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to trigger so keyboard users aren't stranded
    triggerRef.current?.focus();
  }, []);

  // Dismiss on outside click or Esc key
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function handleSelect(t: TemplateDto) {
    onSelect(t.body);
    close();
  }

  return (
    <div ref={rootRef} className="relative">
      <IconBtn
        label="Szablon"
        triggerRef={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
        </svg>
      </IconBtn>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 mb-1 z-50 min-w-[200px] rounded-md border border-admin-line bg-white shadow-md py-1">
          {templates.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-admin-mute">Brak szablonów</div>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
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
