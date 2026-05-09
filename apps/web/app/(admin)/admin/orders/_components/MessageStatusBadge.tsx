import type { MessageDto } from "@/lib/messaging/types";

const STATUS_LABEL_PL: Record<NonNullable<MessageDto["deliveryStatus"]>, string> = {
  QUEUED:    "Kolejka",
  SENT:      "Wysłane",
  DELIVERED: "Doręczone",
  FAILED:    "Niedoręczone",
  READ:      "Przeczytane",
};

const STATUS_CLASSES: Record<NonNullable<MessageDto["deliveryStatus"]>, string> = {
  QUEUED:    "bg-neutral-200 text-neutral-700",
  SENT:      "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED:    "bg-red-100 text-red-800",
  READ:      "bg-emerald-100 text-emerald-800",
};

interface Props {
  status: MessageDto["deliveryStatus"];
}

/**
 * Inline status pill for outbound messages.
 * Pure render — no state, no effects. ~25 LOC.
 */
export function MessageStatusBadge({ status }: Props) {
  const label   = STATUS_LABEL_PL[status]  ?? status;
  const classes = STATUS_CLASSES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
