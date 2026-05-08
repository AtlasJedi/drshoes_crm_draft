import type { MeResponse } from "@/lib/auth/types";

interface Props {
  me: MeResponse;
}

/** Server component — renders the admin sidebar navigation and user identity footer. */
export function AdminSidebar({ me }: Props) {
  return (
    <aside className="w-60 border-r border-admin-line bg-admin-surface p-4 flex flex-col">
      <div className="font-display text-lg mb-6">Dr Shoes</div>

      <nav className="space-y-1 text-sm flex-1">
        <div className="text-admin-mute uppercase text-xs tracking-wide">Pulpit</div>
        <div className="px-2 py-1 rounded bg-acid/30 font-medium">Dashboard</div>

        <div className="text-admin-mute uppercase text-xs tracking-wide mt-4">Operacje</div>
        <div className="px-2 py-1 rounded text-admin-mute cursor-not-allowed">
          Zamówienia (0B)
        </div>
        <div className="px-2 py-1 rounded text-admin-mute cursor-not-allowed">
          Klienci (0B)
        </div>
      </nav>

      <div className="mt-8 pt-4 border-t border-admin-line text-xs text-admin-mute">
        Zalogowany jako
        <br />
        <span className="text-admin-ink font-medium">{me.fullName}</span>
        <div className="font-mono text-[10px]">{me.role}</div>
      </div>
    </aside>
  );
}
