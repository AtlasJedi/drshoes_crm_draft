import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMe } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { BrowserOtelInit } from "@/components/admin/BrowserOtelInit";
import { PageHeaderProvider } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { AdminMusicShell } from "@/app/(admin)/admin/_components/AdminMusicShell";
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

  // Messages route owns its full viewport (no padding, no scroll wrapper) so
  // it can host its own fixed-window layout. Other routes scroll INSIDE the
  // content wrapper so AdminTopbar stays sticky instead of scrolling away.
  const isMessagesRoute = path.startsWith("/admin/messages");

  return (
    <PageHeaderProvider>
      <AdminMusicShell>
        <div className="adm-side">
          <BrowserOtelInit />
          <AdminSidebar me={me} />
        </div>
        <div className="adm-main">
          <AdminTopbar />
          <div className={isMessagesRoute ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-hidden p-6"}>
            {children}
          </div>
        </div>
      </AdminMusicShell>
    </PageHeaderProvider>
  );
}
