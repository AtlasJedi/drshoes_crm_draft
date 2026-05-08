import type { MessageDto } from "@/lib/messaging/types";

const fmt = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" });

const STATUS_PL: Record<MessageDto["deliveryStatus"], string> = {
  QUEUED:    "w kolejce",
  SENT:      "wysłana",
  DELIVERED: "dostarczona",
  FAILED:    "błąd",
  READ:      "odczytana",
};

export function MessageRow({ message }: { message: MessageDto }) {
  return (
    <div className="border-b border-admin-line py-2 last:border-b-0">
      <div className="flex items-center gap-2 text-xs text-admin-mute">
        <span className="px-1.5 py-0.5 rounded bg-admin-surface font-medium">
          {message.channel}
        </span>
        <span>{message.sentAt ? fmt.format(new Date(message.sentAt)) : "—"}</span>
        <span className="ml-auto">{STATUS_PL[message.deliveryStatus]}</span>
      </div>
      {message.subject && (
        <div className="mt-1 text-sm font-medium text-ink">{message.subject}</div>
      )}
      <div className="mt-0.5 text-sm whitespace-pre-wrap text-ink">{message.body}</div>
      {message.triggerId && (
        <div className="mt-0.5 text-xs text-admin-mute">automatycznie</div>
      )}
    </div>
  );
}
