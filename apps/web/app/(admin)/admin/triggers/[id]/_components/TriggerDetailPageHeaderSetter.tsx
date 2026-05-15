"use client";

/**
 * TriggerDetailPageHeaderSetter — sets topbar title to trigger name for /admin/triggers/[id].
 * ~14 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  name: string;
}

export function TriggerDetailPageHeaderSetter({ name }: Props) {
  usePageHeader({ title: name, subtitle: "edycja triggera" });
  return null;
}
