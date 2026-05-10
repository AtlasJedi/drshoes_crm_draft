"use client";

import type { MessageThreadDto } from "@/lib/messaging/types";

interface Props {
  thread: MessageThreadDto;
  onSent?: () => void;
}

/**
 * Reply composer placeholder — implemented in task 5-17.
 * Renders a disabled input bar so the layout is correct.
 */
export function ReplyComposer({ thread: _thread, onSent: _onSent }: Props) {
  return (
    <div className="px-6 py-4 border-t border-admin-line bg-white shrink-0">
      <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-subtle px-4 py-2.5 opacity-50 cursor-not-allowed select-none">
        <span className="text-[13px] text-admin-mute flex-1">Odpowiedz… (wkrótce)</span>
      </div>
    </div>
  );
}
