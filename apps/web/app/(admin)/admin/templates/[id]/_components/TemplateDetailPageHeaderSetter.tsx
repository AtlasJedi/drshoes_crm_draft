"use client";

/**
 * TemplateDetailPageHeaderSetter — sets topbar title to template name for /admin/templates/[id].
 * ~14 LOC.
 */
import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

interface Props {
  name: string;
}

export function TemplateDetailPageHeaderSetter({ name }: Props) {
  usePageHeader({ title: name, subtitle: "edycja szablonu" });
  return null;
}
