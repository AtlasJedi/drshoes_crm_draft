// /admin/messages — full inbox page mockup
window.M5 = window.M5 || {};
const { ChannelChip, MessageStatusBadge, FilterChip, Avatar, IconBtn } = window.M5;

// ── Page header ──────────────────────────────────────────────
// File: …/_components/MessagesHeader.tsx
function MessagesHeader() {
  return (
    <div className="flex items-end justify-between border-b border-admin-line px-6 py-4 bg-white">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight leading-none">Wiadomości</h1>
        <div className="meta-tag text-admin-mute mt-1.5">odświeżono · {window.M5.SHOP_TS} · live</div>
      </div>
      <div className="flex items-center gap-2">
        <button className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 rounded-md border border-admin-line bg-white hover:bg-admin-hover">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
          Odśwież
        </button>
        <button className="h-8 px-3 text-[13px] font-semibold inline-flex items-center gap-1.5 rounded-md bg-ink text-paper hover:bg-ink/90">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Nowa wiadomość
        </button>
      </div>
    </div>
  );
}

// ── Thread list row ──────────────────────────────────────────
// File: …/_components/ThreadListRow.tsx
function ThreadListRow({ t }) {
  const isUnread = t.unread > 0;
  return (
    <div className={
      "relative flex gap-3 px-4 py-3 border-b border-admin-line cursor-pointer "
      + (t.selected ? "bg-paper" : "hover:bg-admin-hover/60")
    }>
      {t.selected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-acid"/>}
      <Avatar name={t.client} raw={t.rawSender} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {t.unmatched ? (
            <span className="font-mono text-[13px] font-semibold text-pink-800 truncate">{t.rawSender}</span>
          ) : (
            <span className={"text-[14px] truncate " + (isUnread ? "font-semibold text-ink" : "font-medium text-ink/85")}>{t.client}</span>
          )}
          <ChannelChip channel={t.channel} />
          {t.unmatched && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
              niesparowane
            </span>
          )}
        </div>
        <div className={"text-[13px] mt-1 truncate " + (isUnread ? "text-ink" : "text-admin-mute")}>{t.lastPreview}</div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0 pl-1">
        <span className={"meta-tag " + (isUnread ? "text-ink font-semibold" : "text-admin-mute")}>{t.lastTs}</span>
        {isUnread && (
          <span className="mt-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold">
            {t.unread}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Thread list (left column) ────────────────────────────────
// File: …/_components/ThreadList.tsx
function ThreadList() {
  return (
    <aside className="w-[380px] shrink-0 border-r border-admin-line bg-white flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-admin-line">
        <div className="relative mb-3">
          <input type="text" placeholder="Szukaj klienta, treści, numeru…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-admin-line bg-paper text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40" />
          <svg className="absolute left-3 top-2.5 text-admin-mute" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active label="Wszystkie" count={7} />
          <FilterChip label="Nieprzeczytane" count={5} />
          <FilterChip label="Niesparowane" count={2} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {window.M5.THREADS.map(t => <ThreadListRow key={t.id} t={t} />)}
      </div>
    </aside>
  );
}

// ── Selected thread header ───────────────────────────────────
// File: …/_components/ThreadHeader.tsx
function ThreadHeader({ t }) {
  return (
    <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={t.client} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-none truncate">{t.client}</h2>
            <ChannelChip channel={t.channel} />
          </div>
          <div className="meta-tag text-admin-mute mt-1.5 flex items-center gap-3">
            <a href="#" className="hover:text-ink underline-offset-2 hover:underline">→ profil klienta</a>
            <span>·</span>
            <a href="#" className="hover:text-ink underline-offset-2 hover:underline">ostatnie zlecenie {t.orderRef}</a>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn label="Oznacz jako przeczytane">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </IconBtn>
        <IconBtn label="Archiwizuj">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="5"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>
        </IconBtn>
        <IconBtn label="Więcej">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="6" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18" r="1.2"/></svg>
        </IconBtn>
      </div>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────
// File: …/_components/MessageBubble.tsx
function MessageBubble({ m, t }) {
  const inbound = m.dir === "INBOUND";
  return (
    <div className={"flex " + (inbound ? "justify-start" : "justify-end")}>
      <div className={"max-w-[78%] " + (inbound ? "" : "items-end flex flex-col")}>
        <div className="meta-tag text-admin-mute mb-1 flex items-center gap-2">
          {inbound ? (
            <>
              <span className="font-semibold text-ink/80">{t.client}</span>
              <span>·</span>
              <span>{m.ts}</span>
            </>
          ) : (
            <>
              <span>{m.ts}</span>
              {m.status && <MessageStatusBadge status={m.status} />}
            </>
          )}
        </div>
        <div className={
          (inbound
            ? "bg-white border border-admin-line text-ink"
            : "bg-ink text-paper")
          + " rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed"
        }>
          {m.body}
        </div>
        {m.error && (
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <span className="flex-1">{m.error}</span>
            <button className="font-semibold hover:underline shrink-0">Wyślij ponownie →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reply composer ───────────────────────────────────────────
// File: …/_components/ReplyComposer.tsx
function ReplyComposer({ client }) {
  const [channel, setChannel] = React.useState(client.channelDefault);
  const isEmail = channel === "EMAIL";
  const hasEmail = !!client.email;
  const hasPhone = !!client.phone;
  return (
    <div className="border-t border-admin-line bg-white px-6 py-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex bg-paper border border-admin-line rounded-md p-0.5">
          <button onClick={() => setChannel("EMAIL")} disabled={!hasEmail}
            className={"px-3 h-7 text-[12px] font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed "
              + (channel === "EMAIL" ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>
            EMAIL
          </button>
          <button onClick={() => setChannel("SMS")} disabled={!hasPhone}
            className={"px-3 h-7 text-[12px] font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed "
              + (channel === "SMS" ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            SMS
          </button>
        </div>
        <div className="meta-tag text-admin-mute">
          {isEmail ? `wyślij na ${client.email}` : `wyślij na ${client.phone}`}
        </div>
      </div>
      {isEmail && (
        <input type="text" placeholder="Temat" defaultValue="Re: status zlecenia DR-1042"
          className="w-full h-9 px-3 mb-2 rounded-md border border-admin-line bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40" />
      )}
      <div className="relative">
        <textarea
          rows={3}
          placeholder={isEmail ? "Napisz odpowiedź…" : "Napisz odpowiedź (max 160 znaków)…"}
          defaultValue="Cześć Magda! Tak, na czwartek zdążymy. Zostały nam tylko sznurówki i czyszczenie. Damy znać kiedy będzie gotowe. Pozdrawiam ✦"
          className="w-full px-3 py-2.5 rounded-md border border-admin-line bg-white text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40"
        />
        {!isEmail && <div className="absolute bottom-2 right-3 meta-tag text-admin-mute">112 / 160</div>}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <IconBtn label="Załącz">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>
          </IconBtn>
          <IconBtn label="Szablon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          </IconBtn>
          <span className="meta-tag text-admin-mute ml-2">⌘ + Enter — wyślij</span>
        </div>
        <button className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-acid hover:bg-acid-deep text-ink font-semibold text-[13px] border border-ink/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
          Wyślij
        </button>
      </div>
    </div>
  );
}

// ── Right panel (client detail) ──────────────────────────────
// File: …/_components/ThreadClientPanel.tsx
function ThreadClientPanel({ client }) {
  return (
    <aside className="w-[320px] shrink-0 border-l border-admin-line bg-paper flex flex-col">
      <div className="px-5 py-5 border-b border-admin-line">
        <div className="flex flex-col items-center text-center">
          <Avatar name={client.name} size={56} />
          <div className="mt-2.5 font-semibold text-[15px]">{client.name}</div>
          <div className="meta-tag text-admin-mute mt-0.5">klient od 2024 · 4 zlecenia</div>
        </div>
      </div>
      <div className="px-5 py-4 border-b border-admin-line space-y-2.5">
        <div>
          <div className="meta-tag text-admin-mute uppercase mb-0.5">Email</div>
          <div className="text-[13px] font-mono">{client.email}</div>
        </div>
        <div>
          <div className="meta-tag text-admin-mute uppercase mb-0.5">Telefon</div>
          <div className="text-[13px] font-mono">{client.phone}</div>
        </div>
        <div>
          <div className="meta-tag text-admin-mute uppercase mb-0.5">Preferowany kanał</div>
          <ChannelChip channel={client.channelDefault} />
        </div>
      </div>
      <div className="px-5 py-4 border-b border-admin-line">
        <div className="meta-tag text-admin-mute uppercase mb-2">Aktywne zlecenie</div>
        <a href="#" className="block bg-white rounded-md border border-admin-line p-3 hover:border-ink/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] font-semibold">{client.recentOrder.id}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800">
              {client.recentOrder.status}
            </span>
          </div>
          <div className="text-[13px] mt-1.5 leading-snug">{client.recentOrder.title}</div>
          <div className="meta-tag text-admin-mute mt-2">→ otwórz zlecenie</div>
        </a>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div>
          <div className="meta-tag text-admin-mute uppercase">Wszystkie</div>
          <div className="text-[20px] font-semibold leading-tight mt-0.5">{client.ordersTotal}</div>
        </div>
        <div>
          <div className="meta-tag text-admin-mute uppercase">Razem</div>
          <div className="text-[20px] font-semibold leading-tight mt-0.5">{client.spent}</div>
        </div>
      </div>
    </aside>
  );
}

// ── Page composition ─────────────────────────────────────────
window.M5.MessagesPage = function MessagesPage() {
  const t = window.M5.THREADS.find(x => x.selected);
  return (
    <div className="bg-paper">
      <MessagesHeader />
      <div className="flex" style={{ height: 720 }}>
        <ThreadList />
        <main className="flex-1 flex flex-col bg-paper min-w-0">
          <ThreadHeader t={t} />
          <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
            <div className="text-center meta-tag text-admin-mute">— 6 maja 2026 —</div>
            {window.M5.SELECTED_LOG.slice(0, 3).map(m => <MessageBubble key={m.id} m={m} t={t} />)}
            <div className="text-center meta-tag text-admin-mute">— dziś · 7 maja —</div>
            {window.M5.SELECTED_LOG.slice(3).map(m => <MessageBubble key={m.id} m={m} t={t} />)}
          </div>
          <ReplyComposer client={window.M5.SELECTED_CLIENT} />
        </main>
        <ThreadClientPanel client={window.M5.SELECTED_CLIENT} />
      </div>
    </div>
  );
};
