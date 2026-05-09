// Artifact 3 — Sidebar "Wiadomości" item with unread count badge
// File: apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx
window.M5 = window.M5 || {};

function MessagesNavItem({ unread = 0, active = false }) {
  const fmt = unread > 99 ? "99+" : String(unread);
  return (
    <a
      href="/admin/messages"
      className={
        "group flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium transition-colors "
        + (active
            ? "bg-white/10 text-paper"
            : "text-paper/75 hover:bg-white/5 hover:text-paper")
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span className="flex-1">Wiadomości</span>
      {unread > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10.5px] font-bold leading-none">
          {fmt}
        </span>
      )}
    </a>
  );
}

window.M5.SidebarItemShowcase = function SidebarItemShowcase() {
  return (
    <div className="bg-[#1a1814] p-4 space-y-1">
      <div className="meta-tag text-paper/40 mb-2 px-3">— stany —</div>
      <MessagesNavItem unread={0} />
      <MessagesNavItem unread={3} />
      <MessagesNavItem unread={47} active />
      <MessagesNavItem unread={142} />
      <div className="meta-tag text-paper/40 mt-4 mb-2 px-3">— w kontekście sidebara —</div>
      <a className="flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium text-paper/75 hover:bg-white/5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><span>Pulpit</span></a>
      <a className="flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium text-paper/75 hover:bg-white/5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg><span>Zlecenia</span></a>
      <MessagesNavItem unread={5} active />
      <a className="flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium text-paper/75 hover:bg-white/5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Klienci</span></a>
    </div>
  );
};
