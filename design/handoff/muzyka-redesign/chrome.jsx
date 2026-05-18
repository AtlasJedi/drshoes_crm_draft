/* shared admin chrome — sidebar, topbar, mini-player */

const ICO = {
  dash:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  list:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  cal:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>,
  kan:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18"/><rect x="11" y="3" width="6" height="12"/><rect x="19" y="3" width="2" height="6"/></svg>,
  user:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>,
  store: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M8 13h8"/></svg>,
  news:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>,
  msg:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12c0 4.4-4 8-9 8-1.5 0-3-.4-4.3-1L3 20l1.3-4C3.4 14.6 3 13.3 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"/></svg>,
  zap:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L4 14h7l-2 8 9-12h-7z"/></svg>,
  set:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  music: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17V5l12-2v12"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="15" r="3"/></svg>,
  search:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>,
  bell:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  play:  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l14 8-14 8V4z"/></svg>,
  pause: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  skip:  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l12 8-12 8V4z"/><rect x="17" y="4" width="3" height="16"/></svg>,
  vol:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>,
  arrR:  <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  plus:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M10 11v6M14 11v6"/></svg>,
  download: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 4v12M6 12l6 6 6-6M4 20h16"/></svg>,
  x:     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 5l14 14M19 5L5 19"/></svg>,
  drag:  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>,
};

const SIDE_ITEMS = [
  { group: "Pulpit" },
  { k: "Dashboard", icon: ICO.dash },
  { group: "Operacje" },
  { k: "Zamówienia", icon: ICO.list, badge: "42" },
  { k: "Kalendarz", icon: ICO.cal },
  { k: "Kanban", icon: ICO.kan },
  { k: "Klienci", icon: ICO.user },
  { k: "Wiadomości", icon: ICO.msg, badge: "3" },
  { group: "Komunikacja" },
  { k: "Triggery", icon: ICO.zap },
  { k: "Szablony", icon: ICO.news },
  { group: "Sklep" },
  { k: "Sklep", icon: ICO.store },
  { k: "Aktualności", icon: ICO.news },
  { group: "Przerwa" },
  { k: "Muzyka", icon: ICO.music, nowPlaying: true },
];

function Sidebar({ active, playing }) {
  return (
    <aside className="side">
      <div className="side-brand">
        <div className="mk">DR_SHOES</div>
        <div className="ver">panel pracowni · v2.4</div>
      </div>
      <nav className="side-nav">
        {SIDE_ITEMS.map((it, i) => {
          if (it.group) return <div key={"g"+i} className="side-grp">{it.group}</div>;
          const isActive = active === it.k;
          return (
            <a key={it.k} className={"side-link" + (isActive ? " active" : "")}>
              <span className="ico">{it.icon}</span>
              <span>{it.k}</span>
              {it.nowPlaying && playing && <span className="now-dot" title="gra teraz" />}
              {it.badge && !it.nowPlaying && (
                <span style={{
                  marginLeft: "auto",
                  background: it.k === "Wiadomości" ? "var(--pink)" : "rgba(255,255,255,.1)",
                  color: it.k === "Wiadomości" ? "#fff" : "rgba(255,255,255,.7)",
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  padding: "2px 6px", letterSpacing: ".08em",
                }}>{it.badge}</span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="side-foot">
        <div className="av">DR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">Daniel Roj</div>
          <div className="ro">admin · pracownia</div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title, subtitle, right }) {
  return (
    <div className="top">
      <div className="top-l">
        <h1 className="top-ttl">{title}</h1>
        {subtitle && <div className="top-sub">{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="top-search">
          <span style={{ color: "rgba(0,0,0,.45)", display: "flex" }}>{ICO.search}</span>
          <input placeholder="Szukaj zlecenia, klienta…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="top-bell">{ICO.bell}</button>
        {right}
      </div>
    </div>
  );
}

/* ─── MINI-PLAYER ─────────────────────────────── */
function MiniPlayer({ track, paused, volPopout, openLink = true }) {
  if (!track) return null;
  return (
    <div className="mini">
      <div className="mini-l">
        <div className="mini-thumb">YT</div>
        <div className="mini-meta">
          <div className="mini-title">{track.title}</div>
          <div className="mini-ch">{track.channel}</div>
        </div>
      </div>
      <div className="mini-r">
        <div className="mini-ctl">
          <button className={"mini-btn play"} aria-label={paused ? "Odtwórz" : "Pauza"}>
            {paused ? ICO.play : ICO.pause}
          </button>
          <button className={"mini-btn" + (track.nextDisabled ? " disabled" : "")} aria-label="Następny">
            {ICO.skip}
          </button>
        </div>
        <div className="mini-prog">
          <span className="time">{track.t || "1:42"}</span>
          <div className="bar">
            <div className="fill" style={{ width: (track.progress || 0.38) * 100 + "%" }} />
          </div>
          <span className="time">{track.dur || "4:25"}</span>
        </div>
        <div className="mini-vol">
          <button className="ico-btn" aria-label="Głośność">{ICO.vol}</button>
          {volPopout && (
            <div className="popout">
              <div className="vlabel">68</div>
              <div className="vbar"><div className="vfill" style={{ height: "68%" }} /></div>
            </div>
          )}
        </div>
        {openLink && (
          <a className="mini-open" href="#">
            /admin/muzyka <span style={{ width: 12, height: 12 }}>{ICO.arrR}</span>
          </a>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ICO, Sidebar, Topbar, MiniPlayer });
