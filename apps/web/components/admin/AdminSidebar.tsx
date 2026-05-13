import type { MeResponse } from "@/lib/auth/types";
import { AdminSidebarNav } from "./AdminSidebarNav";

interface Props {
  me: MeResponse;
}

/** SC shell — nav is delegated to AdminSidebarNav (CC) for usePathname() active-state. */
export function AdminSidebar({ me }: Props) {
  return (
    <aside className="w-64 border-r border-admin-line bg-admin-surface p-5 flex flex-col">
      <div className="font-display text-xl mb-7 tracking-tight">Dr Shoes</div>

      <AdminSidebarNav userEmail={me.email} />

      <div className="mt-8 pt-4 border-t border-admin-line text-sm text-admin-mute">
        Zalogowany jako
        <br />
        <span className="text-admin-ink font-medium">{me.fullName}</span>
        <div className="font-mono text-xs mt-0.5">{me.role}</div>
      </div>
    </aside>
  );
}
