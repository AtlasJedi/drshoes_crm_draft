// Empty / loading / unmatched states for the Messages page
// Files:
//   …/_components/EmptyThreadList.tsx
//   …/_components/EmptyThreadSelected.tsx
//   …/_components/UnmatchedThreadPanel.tsx
//   …/_components/MessagesLoadingStates.tsx
window.M5 = window.M5 || {};
const { Avatar, ChannelChip } = window.M5;

function EmptyState({ icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-12 h-12 rounded-full bg-paper border border-admin-line flex items-center justify-center text-admin-mute mb-3">
        {icon}
      </div>
      <div className="text-[14px] font-semibold">{title}</div>
      {body && <div className="text-[13px] text-admin-mute mt-1 max-w-[280px] leading-relaxed">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function UnmatchedThreadPanel() {
  return (
    <div className="flex-1 bg-paper flex flex-col">
      <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center gap-3">
        <Avatar raw="+48 506 220 119" size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-pink-800">+48 506 220 119</span>
            <ChannelChip channel="SMS" />
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">niesparowane</span>
          </div>
          <div className="meta-tag text-admin-mute mt-1.5">otrzymane dziś · 11:02</div>
        </div>
      </div>
      <div className="flex-1 px-6 py-5 space-y-4">
        <div className="bg-white border border-admin-line rounded-lg px-3.5 py-2.5 text-[14px] max-w-[78%]">
          Dzień dobry, czy mogę przynieść kurtkę jutro o 15?
        </div>
        <div className="rounded-md border border-pink-200 bg-pink-50 p-4">
          <div className="text-[13px] font-semibold text-pink-900 mb-1">Ten numer nie jest przypisany do żadnego klienta</div>
          <div className="text-[12px] text-pink-800/80 mb-3 leading-relaxed">Zanim odpowiesz, wybierz akcję — composer pojawi się dopiero po przypisaniu.</div>
          <div className="flex flex-wrap gap-2">
            <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-ink text-paper text-[12.5px] font-semibold hover:bg-ink/90">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Przypisz do klienta
            </button>
            <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-white border border-admin-line text-[12.5px] font-semibold hover:bg-admin-hover">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
              Utwórz nowego klienta
            </button>
            <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium text-admin-mute hover:text-ink hover:bg-admin-hover">
              Odrzuć
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.M5.EmptyAndStates = function EmptyAndStates() {
  return (
    <div className="grid grid-cols-2 divide-x divide-admin-line">
      {/* Left — empty thread list & no-selection */}
      <div className="bg-white">
        <div className="px-4 py-3 border-b border-admin-line">
          <div className="meta-tag text-admin-mute uppercase">Filtr: nieprzeczytane</div>
        </div>
        <EmptyState
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
          title="Brak nieprzeczytanych"
          body={'Wszystkie wątki zostały przeczytane. Sprawdź filtr „Wszystkie" by zobaczyć całą historię.'}
        />
        <div className="border-t border-admin-line">
          <div className="px-4 py-3 border-b border-admin-line">
            <div className="meta-tag text-admin-mute uppercase">Brak wyboru</div>
          </div>
          <EmptyState
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            title="Wybierz wątek z listy"
            body="Klik w wątek po lewej stronie otworzy historię konwersacji i composer."
          />
        </div>
        <div className="border-t border-admin-line">
          <div className="px-4 py-3 border-b border-admin-line">
            <div className="meta-tag text-admin-mute uppercase">Cold start (brak wątków)</div>
          </div>
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>}
            title="Brak wiadomości"
            body="Gdy klient odpowie na maila lub SMS-a, wątek pojawi się tutaj."
            action={<button className="h-8 px-3 rounded-md bg-ink text-paper text-[12.5px] font-semibold">Wyślij pierwszą wiadomość</button>}
          />
        </div>
      </div>

      {/* Right — unmatched + loading */}
      <div className="bg-paper flex flex-col">
        <div className="px-4 py-3 border-b border-admin-line bg-white">
          <div className="meta-tag text-admin-mute uppercase">Niesparowane — wymagana akcja</div>
        </div>
        <UnmatchedThreadPanel />
        <div className="border-t border-admin-line bg-white px-4 py-3">
          <div className="meta-tag text-admin-mute uppercase mb-3">Loading skeleton — lista wątków</div>
          <div className="space-y-2">
            {[0,1,2].map(i => (
              <div key={i} className="flex gap-3 items-center">
                <div className="w-9 h-9 rounded-full bg-admin-line animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-admin-line animate-pulse" style={{ width: ["62%","48%","72%"][i] }} />
                  <div className="h-2.5 rounded bg-admin-line/60 animate-pulse" style={{ width: ["88%","70%","54%"][i] }} />
                </div>
                <div className="w-10 h-2.5 rounded bg-admin-line/70 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="meta-tag text-admin-mute uppercase mt-4 mb-2">Send error</div>
          <div className="flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Nie udało się wysłać. <button className="font-semibold hover:underline">Spróbuj ponownie</button>
          </div>
        </div>
      </div>
    </div>
  );
};
