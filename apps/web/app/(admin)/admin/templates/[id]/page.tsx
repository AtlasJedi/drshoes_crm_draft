import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getTemplateServer } from "@/lib/messaging/api-server";
import { TemplateForm } from "../_components/TemplateForm";

const log = createLogger("admin-template-edit-page");

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  log.info("op=render", { id });

  const t = await getTemplateServer(id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">
          Edytuj: {t.name}
        </h1>
        <Link
          href={"/admin/templates" as Route}
          className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
        >
          ← Wróć do szablonów
        </Link>
      </div>

      <TemplateForm initial={t} />
    </div>
  );
}
