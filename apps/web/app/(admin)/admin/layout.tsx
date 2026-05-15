import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMe } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { BrowserOtelInit } from "@/components/admin/BrowserOtelInit";
import { PageHeaderProvider } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { createLogger } from "@/lib/log";

const log = createLogger("admin-layout");

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-pathname") ?? "";

  // Login page is nested under (admin)/admin/ — skip auth guard to avoid redirect loop.
  // Quicklogin is a demo/handoff convenience page that auto-submits the test admin creds.
  if (path.startsWith("/admin/login") || path.startsWith("/admin/quicklogin")) {
    return <>{children}</>;
  }

  const me = await getMe();
  if (!me) {
    log.info("op=guard outcome=redirect-to-login", { path });
    redirect(`/admin/login?next=${encodeURIComponent(path || "/admin")}`);
  }

  log.info("op=guard outcome=ok", { path, userId: me.id, role: me.role });

  return (
    <PageHeaderProvider>
      <div className="min-h-screen bg-admin-bg text-admin-ink flex">
        <BrowserOtelInit />
        <AdminSidebar me={me} />
        <main className="flex-1 flex flex-col overflow-auto">
          <AdminTopbar />
          <div className="flex-1 p-6">{children}</div>
        </main>
      </div>
    </PageHeaderProvider>
  );
}
