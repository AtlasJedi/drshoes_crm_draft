import type { MeResponse } from "@/lib/auth/types";
import { AdminSidebarNav } from "./AdminSidebarNav";

interface Props {
  me: MeResponse;
}

/** SC shell — nav is delegated to AdminSidebarNav (CC) for usePathname() active-state. */
export function AdminSidebar({ me }: Props) {
  return (
    <aside className="w-60 border-r border-admin-line bg-admin-surface p-4 flex flex-col">
      <div className="font-display text-lg mb-6">Dr Shoes</div>

      <AdminSidebarNav />

      <div className="mt-8 pt-4 border-t border-admin-line text-xs text-admin-mute">
        Zalogowany jako
        <br />
        <span className="text-admin-ink font-medium">{me.fullName}</span>
        <div className="font-mono text-[10px]">{me.role}</div>
      </div>
    </aside>
  );
}
