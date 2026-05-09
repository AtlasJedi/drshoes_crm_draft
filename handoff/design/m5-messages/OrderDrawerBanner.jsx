// Artifact 2 — OrderDrawer "client has unread elsewhere" banner
// File: apps/web/app/(admin)/admin/orders/_components/OrderDrawer/UnreadElsewhereBanner.tsx
//
// Shown at the top of the OrderDrawer "Wiadomości" tab when the order's client
// has unread inbound messages on a thread that does NOT belong to this order.
window.M5 = window.M5 || {};

function pluralUnread(n) {
  if (n === 1) return "Klient ma 1 nieprzeczytaną wiadomość";
  if (n >= 2 && n <= 4) return `Klient ma ${n} nieprzeczytane wiadomości`;
  return `Klient ma ${n} nieprzeczytanych wiadomości`;
}

function UnreadElsewhereBanner({ count, threadId }) {
  return (
    <a
      href={`/admin/messages?thread=${threadId}`}
      className="group flex items-center gap-3 mb-4 px-3.5 py-2.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
    >
      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-200 text-amber-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-amber-900 leading-tight">{pluralUnread(count)}</div>
        <div className="text-[11.5px] text-amber-800/80 mt-0.5 leading-tight">na innym wątku — niezwiązanym z tym zleceniem</div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-900 group-hover:text-amber-950">
        Otwórz wątek
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </span>
    </a>
  );
}

window.M5.OrderDrawerBannerShowcase = function OrderDrawerBannerShowcase() {
  return (
    <div className="bg-paper p-6 space-y-6">
      <div>
        <div className="meta-tag text-admin-mute mb-2">— 1 nieprzeczytana —</div>
        <UnreadElsewhereBanner count={1} threadId="t-101" />
      </div>
      <div>
        <div className="meta-tag text-admin-mute mb-2">— 2–4 nieprzeczytane —</div>
        <UnreadElsewhereBanner count={3} threadId="t-101" />
      </div>
      <div>
        <div className="meta-tag text-admin-mute mb-2">— 5+ nieprzeczytanych —</div>
        <UnreadElsewhereBanner count={7} threadId="t-101" />
      </div>
      <div className="border-t border-admin-line pt-5">
        <div className="meta-tag text-admin-mute mb-2">— w kontekście drawer'a Wiadomości —</div>
        <div className="bg-white border border-admin-line rounded-md p-4">
          <UnreadElsewhereBanner count={2} threadId="t-101" />
          <div className="meta-tag text-admin-mute mb-1">— stara historia tego zlecenia —</div>
          <div className="border border-admin-line rounded p-3 text-[13px] text-admin-mute">
            Wiadomości przypisane do <span className="font-mono text-ink">DR-1042</span> renderują się tu poniżej…
          </div>
        </div>
      </div>
    </div>
  );
};
