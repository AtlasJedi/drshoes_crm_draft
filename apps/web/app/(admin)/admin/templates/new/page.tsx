import Link from "next/link";
import type { Route } from "next";
import { TemplateForm } from "../_components/TemplateForm";
import { NewTemplatePageHeaderSetter } from "./_components/NewTemplatePageHeaderSetter";

export default function NewTemplatePage() {
  return (
    <div>
      <NewTemplatePageHeaderSetter />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Nowy szablon</h1>
        <Link
          href={"/admin/templates" as Route}
          className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
        >
          ← Wróć do szablonów
        </Link>
      </div>

      <TemplateForm />
    </div>
  );
}
