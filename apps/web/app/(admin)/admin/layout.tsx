import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMe } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { BrowserOtelInit } from "@/components/admin/BrowserOtelInit";
import { createLogger } from "@/lib/log";

const log = createLogger("admin-layout");

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-pathname") ?? "";

  // Login page is nested under (admin)/admin/ — skip auth guard to avoid redirect loop.
  if (path.startsWith("/admin/login")) {
    return <>{children}</>;
  }

  const me = await getMe();
  if (!me) {
    log.info("op=guard outcome=redirect-to-login", { path });
    redirect(`/admin/login?next=${encodeURIComponent(path || "/admin")}`);
  }

  log.info("op=guard outcome=ok", { path, userId: me.id, role: me.role });

  return (
    <div className="min-h-screen bg-admin-bg text-admin-ink flex">
      <BrowserOtelInit />
      <AdminSidebar me={me} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
