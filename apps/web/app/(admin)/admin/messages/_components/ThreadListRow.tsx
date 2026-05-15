// ThreadListRow — single thread item with graffiti design parity.
// Avatar: 36px paper-2 circle, border-ink, mono initials.
// Active: acid-tinted bg + 3px ink left border.
// Unread dot: 8px pink circle (right rail).
// < 60 LOC per granulate directive.
import type { MessageThreadDto } from "@/lib/messaging/types";

interface Props {
  thread: MessageThreadDto;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function ThreadListRow({ thread: t, selected, onSelect }: Props) {
  const isUnread = t.unreadCount > 0;
  const ini = t.clientName
    ? t.clientName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const displayTime = t.lastMessageAt
    ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Warsaw",
      })
    : "—";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(t.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
      style={{
        borderLeft: selected ? "3px solid var(--ink)" : "3px solid transparent",
        background: selected ? "rgba(216,255,58,0.20)" : "transparent",
      }}
      className="flex gap-2.5 px-3 py-3 border-b border-admin-line cursor-pointer hover:bg-paper/60"
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0 border-[1.5px] border-ink t-mono font-bold"
        style={{ width: 36, height: 36, background: "var(--paper-2, #ebe4d4)", fontSize: 12 }}
      >
        {ini}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
            {t.unmatched ? t.rawSender : t.clientName}
          </span>
          <span className="t-mono shrink-0 opacity-50" style={{ fontSize: 10 }}>{displayTime}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="t-mono"
            style={{
              fontSize: 9,
              padding: "1px 5px",
              background: "var(--ink)",
              color: "var(--paper)",
              letterSpacing: ".05em",
            }}
          >
            {t.channel}
          </span>
        </div>
        <div
          className="mt-1 truncate"
          style={{
            fontSize: 12,
            fontWeight: isUnread ? 600 : 400,
            color: isUnread ? "var(--ink)" : "rgba(0,0,0,0.7)",
          }}
        >
          {t.lastMessagePreview}
        </div>
      </div>
      {isUnread && (
        <span
          className="self-center shrink-0 rounded-full"
          style={{ width: 8, height: 8, background: "var(--pink, #ff2e7e)" }}
        />
      )}
    </div>
  );
}
