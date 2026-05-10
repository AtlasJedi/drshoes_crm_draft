import type { TriggerDto } from "@/lib/messaging/types";
import type { TriggerPreview } from "@/app/(admin)/admin/orders/_components/StatusChangeTriggerDialog";

/**
 * Compute a trigger preview for a prospective status transition.
 * Looks for a STATUS_CHANGE trigger whose eventParams.toStatus matches targetStatus.
 * Shared by OrderDrawerStatusChanger and useKanbanDnd.
 */
export function previewForStatus(
  targetStatus: string,
  triggers: TriggerDto[],
): TriggerPreview {
  const matched = triggers.find((t) => {
    if (t.event !== "STATUS_CHANGE") return false;
    try {
      const params = JSON.parse(t.eventParams) as { toStatus?: string };
      return params.toStatus === targetStatus;
    } catch {
      return false;
    }
  });
  if (!matched) return { kind: "none" };
  if (!matched.enabled) return { kind: "disabled", triggerName: matched.name };
  let channels: string[] = [];
  try {
    channels = JSON.parse(matched.channels) as string[];
  } catch {
    // leave channels empty if parse fails
  }
  return {
    kind: "match",
    templateName: matched.templateName,
    channels,
    delayMinutes: matched.delayMinutes,
    requiresManualConfirmation: matched.requiresManualConfirmation,
  };
}
