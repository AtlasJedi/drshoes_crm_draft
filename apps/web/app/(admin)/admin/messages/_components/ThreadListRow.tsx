import type { MessageThreadDto } from "@/lib/messaging/types";

interface Props {
  thread: MessageThreadDto;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Single row: client name or raw sender, channel chip, unread bullet, preview. */
export function ThreadListRow({ thread: t, selected, onSelect }: Props) {
  const isUnread = t.unreadCount > 0;
  const channelCls = t.channel === "EMAIL"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";
  const initials = t.clientName
    ? t.clientName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const avatarCls = t.clientName
    ? "bg-ink text-paper"
    : "bg-pink-100 text-pink-700 ring-1 ring-pink-300";

  return (
    <div
      role="button" tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(t.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
      className={"relative flex gap-3 px-4 py-3 border-b border-admin-line cursor-pointer " + (selected ? "bg-paper" : "hover:bg-admin-hover/60")}
    >
      {selected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-acid" />}
      <div className={avatarCls + " flex items-center justify-center rounded-full font-semibold shrink-0 text-[13px]"} style={{ width: 36, height: 36 }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {t.unmatched
            ? <span className="font-mono text-[13px] font-semibold text-pink-800 truncate">{t.rawSender}</span>
            : <span className={"text-[14px] truncate " + (isUnread ? "font-semibold text-ink" : "font-medium text-ink/85")}>{t.clientName}</span>
          }
          <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + channelCls}>{t.channel}</span>
          {t.unmatched && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">niesparowane</span>
          )}
        </div>
        <div className={"text-[13px] mt-1 truncate " + (isUnread ? "text-ink" : "text-admin-mute")}>{t.lastMessagePreview}</div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0 pl-1">
        <span className={"text-[11px] " + (isUnread ? "text-ink font-semibold" : "text-admin-mute")}>
          {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }) : "—"}
        </span>
        {isUnread && (
          <span className="mt-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold">{t.unreadCount}</span>
        )}
      </div>
    </div>
  );
}
