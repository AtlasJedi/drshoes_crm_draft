"use client";

import { createLogger } from "@/lib/log";
import { markThreadRead } from "@/lib/messaging/api";
import type { MessageThreadDto } from "@/lib/messaging/types";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.threadheader");

interface Props {
  thread: MessageThreadDto;
  onReadMarked?: () => void;
}

export function ThreadHeader({ thread: t, onReadMarked }: Props) {
  const channelCls = t.channel === "EMAIL"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";
  const initials = t.clientName
    ? t.clientName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  async function handleMarkRead() {
    log.info("op=markRead", { threadId: t.id });
    try {
      await markThreadRead(t.id);
      onReadMarked?.();
    } catch (err) {
      log.error("op=markRead outcome=error", { threadId: t.id, err: String(err) });
    }
  }

  return (
    <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-ink text-paper flex items-center justify-center rounded-full font-semibold shrink-0 text-[15px]" style={{ width: 40, height: 40 }}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-none truncate">{t.clientName ?? t.rawSender}</h2>
            <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + channelCls}>{t.channel}</span>
          </div>
          <div className="text-[11px] text-admin-mute mt-1.5 flex items-center gap-3">
            {t.clientId && (
              <>
                <a href={`/admin/clients/${t.clientId}`} className="hover:text-ink hover:underline underline-offset-2">→ profil klienta</a>
                <span>·</span>
              </>
            )}
            <span>ostatnia aktywność {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" }) : "—"}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn label="Oznacz jako przeczytane" onClick={handleMarkRead}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </IconBtn>
        <IconBtn label="Archiwizuj (wkrótce)" disabled>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="5"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>
        </IconBtn>
        <IconBtn label="Więcej">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="6" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18" r="1.2"/></svg>
        </IconBtn>
      </div>
    </div>
  );
}
