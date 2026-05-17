// Admin screens for Dr Shoes — toned-down graffiti accents on clean layouts
const { Tape, Stamp, Sticker, PhImg, Pill, Stat, Splatter, SprayCanIcon, ShoeIcon, JacketIcon, BrushIcon, I, DrShoesMark, ORDERS, PRODUCTS, CLIENTS, NEWS, STATUS_INFO } = window.DrShoes;

// shared sidebar
function AdminSidebar({ active }) {
  const items = [
    { k: "Dashboard", icon: I.dash },
    { k: "Zamówienia", icon: I.list || I.dash },
    { k: "Kalendarz", icon: I.calendar },
    { k: "Kanban", icon: I.dash },
    { k: "Klienci", icon: I.user },
    { k: "Sklep", icon: I.store },
    { k: "Aktualności", icon: I.news },
    { k: "Wiadomości", icon: I.msg },
    { k: "Triggery", icon: I.zap },
    { k: "Ustawienia", icon: I.set },
  ];
  return (
    <aside style={{
      width: 230, background: "var(--ink)", color: "var(--paper)",
      display: "flex", flexDirection: "column", flexShrink: 0,
      borderRight: "3px solid var(--acid)",
    }}>
      <div style={{ padding: "20px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <DrShoesMark size={0.32} color="var(--paper)" accent="var(--acid)" />
        <div className="t-mono" style={{ fontSize: 10, opacity: 0.55, marginTop: 4, letterSpacing: ".15em" }}>panel pracowni · v2.4</div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", padding: "14px 0", flex: 1 }}>
        {items.map(it => (
          <a key={it.k} className={"sb-link " + (active === it.k ? "active" : "")}>
            <span style={{ width: 18, display: "flex", alignItems: "center" }}>{it.icon}</span>
            <span>{it.k}</span>
            {it.k === "Wiadomości" && active !== "Wiadomości" && <span style={{ marginLeft: "auto", background: "var(--pink)", color: "var(--paper)", fontSize: 10, padding: "2px 6px", borderRadius: 999 }}>3</span>}
          </a>
        ))}
      </nav>
      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--acid)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18 }}>DR</div>
        <div style={{ flex: 1 }}>
          <div className="t-stencil" style={{ fontSize: 12, color: "var(--paper)" }}>Daniel Roj</div>
          <div className="t-mono" style={{ fontSize: 10, opacity: 0.55 }}>admin · pracownia</div>
        </div>
        <span style={{ color: "var(--paper)", opacity: 0.55 }}>{I.power}</span>
      </div>
    </aside>
  );
}

function AdminTopbar({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "18px 28px", background: "var(--paper)", borderBottom: "2px solid var(--ink)", gap: 18 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="t-display" style={{ fontSize: 38, margin: 0 }}>{title}</h1>
          {subtitle && <span className="t-mono" style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", letterSpacing: ".05em" }}>{subtitle}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1.5px solid var(--ink)", background: "#fff", boxShadow: "2px 2px 0 var(--ink)", width: 280 }}>
          <span style={{ color: "rgba(0,0,0,0.45)" }}>{I.search}</span>
          <input placeholder="Szukaj zlecenia, klienta…" style={{ border: 0, outline: 0, background: "transparent", flex: 1, fontFamily: "var(--font-body)", fontSize: 13 }} />
          <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,0,0,0.2)", padding: "1px 5px" }}>⌘K</span>
        </div>
        <button className="btn-clean" style={{ padding: 8, position: "relative" }}>{I.bell}<span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, background: "var(--pink)", borderRadius: 999 }} /></button>
        {right}
      </div>
    </div>
  );
}

// =============================================================
// 1. DASHBOARD
// =============================================================

function AdminDashboard() {
  return (
    <div className="admin" data-screen-label="Admin · Dashboard" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Dashboard" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <AdminTopbar title="Dashboard" subtitle="czwartek · 7 maja 2026"
          right={<button className="btn-clean primary">{I.plus} Nowe zlecenie</button>}
        />
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* big stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            <Stat label="W realizacji" value="14" sub="↑ 3 vs zeszły tydzień" accent="var(--acid)" />
            <Stat label="Gotowe do odbioru" value="6" sub="2 zaległe > 5 dni" accent="var(--pink)" />
            <Stat label="Nowe rezerwacje (7d)" value="9" sub="3 oczekują potwierdzenia" accent="var(--blue)" />
            <Stat label="Przychód · maj" value="18 240 zł" sub="↑ 22% m/m" accent="var(--acid)" />
          </div>

          {/* main chart + secondary */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <div className="admin-card" style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div>
                  <div className="t-display" style={{ fontSize: 22 }}>Zlecenia / tydzień</div>
                  <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>ostatnie 8 tygodni</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="chip">tydzień</span>
                  <span className="chip active">miesiąc</span>
                  <span className="chip">kwartał</span>
                </div>
              </div>
              {/* bar chart */}
              <svg viewBox="0 0 720 220" style={{ width: "100%", height: 220 }}>
                <g stroke="rgba(0,0,0,0.08)">
                  <line x1="0" y1="40" x2="720" y2="40" /><line x1="0" y1="90" x2="720" y2="90" />
                  <line x1="0" y1="140" x2="720" y2="140" /><line x1="0" y1="190" x2="720" y2="190" />
                </g>
                {[
                  [12, 8], [14, 6], [9, 11], [16, 10], [11, 14], [18, 9], [22, 12], [19, 16]
                ].map((d, i) => {
                  const x = 30 + i * 86;
                  const top = 190 - d[0] * 7;
                  const top2 = top - d[1] * 7;
                  return (
                    <g key={i}>
                      <rect x={x} y={top} width="40" height={190 - top} fill="var(--ink)" />
                      <rect x={x} y={top2} width="40" height={top - top2} fill="var(--acid)" stroke="var(--ink)" />
                      <text x={x + 20} y="210" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(0,0,0,0.5)">T{i + 11}</text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <span className="t-mono" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--ink)" }} /> naprawy</span>
                <span className="t-mono" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--acid)", border: "1px solid var(--ink)" }} /> custom</span>
              </div>
            </div>

            <div className="admin-card" style={{ padding: 22 }}>
              <div className="t-display" style={{ fontSize: 22, marginBottom: 14 }}>Mix zleceń</div>
              <svg viewBox="0 0 200 200" style={{ width: "100%", height: 180 }}>
                <circle cx="100" cy="100" r="78" fill="none" stroke="var(--paper-2)" strokeWidth="34" />
                <circle cx="100" cy="100" r="78" fill="none" stroke="var(--acid)" strokeWidth="34" strokeDasharray="220 490" transform="rotate(-90 100 100)" />
                <circle cx="100" cy="100" r="78" fill="none" stroke="var(--pink)" strokeWidth="34" strokeDasharray="160 490" transform="rotate(60 100 100)" />
                <circle cx="100" cy="100" r="78" fill="none" stroke="var(--blue)" strokeWidth="34" strokeDasharray="110 490" transform="rotate(180 100 100)" />
                <text x="100" y="98" textAnchor="middle" fontFamily="Anton" fontSize="34" fill="var(--ink)">42</text>
                <text x="100" y="118" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(0,0,0,0.55)">aktywne</text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <Legend color="var(--acid)" label="Naprawy" v="45%" />
                <Legend color="var(--pink)" label="Custom buty" v="33%" />
                <Legend color="var(--blue)" label="Custom kurtki" v="22%" />
              </div>
            </div>
          </div>

          {/* lower row: gotowe do odbioru + ostatnie wiadomosci + rezerwacje */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20 }}>
            <div className="admin-card" style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="t-display" style={{ fontSize: 22 }}>Gotowe do odbioru</div>
                <Tape angle={-2}>{6} czeka</Tape>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ORDERS.filter(o => o.status === "gotowe do odbioru").concat(ORDERS.filter(o => o.status === "w realizacji").slice(0,2)).slice(0,4).map(o => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, border: "1px solid var(--line)" }}>
                    <PhImg label="" style={{ width: 44, height: 44, border: "1.5px solid var(--ink)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>{o.id}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{o.client}</span>
                      </div>
                      <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 2 }}>{o.desc}</div>
                    </div>
                    <Pill status={o.status} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card" style={{ padding: 22 }}>
              <div className="t-display" style={{ fontSize: 22, marginBottom: 14 }}>Ostatnie wiadomości</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { name: "Magdalena K.", msg: "Hej, kiedy mogę odebrać moje 1460?", time: "14 min", unread: true, ch: "WhatsApp" },
                  { name: "Filip N.", msg: "Super wyglądają!! Wpadnę w czwartek", time: "1h", unread: true, ch: "Email" },
                  { name: "Aleksandra Z.", msg: "Czy zdjęcia będą dziś?", time: "3h", unread: true, ch: "IG" },
                  { name: "Bartek W.", msg: "Dzięki za info :)", time: "wczoraj", unread: false, ch: "SMS" },
                ].map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--paper-2)", border: "1.5px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{m.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                        <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.msg}</div>
                      <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>{m.ch}</div>
                    </div>
                    {m.unread && <span style={{ width: 8, height: 8, background: "var(--pink)", borderRadius: 999, marginTop: 12 }} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card" style={{ padding: 22 }}>
              <div className="t-display" style={{ fontSize: 22, marginBottom: 14 }}>Świeże rezerwacje</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { who: "Karol J.", what: "AF1 Mid 'Bandana'", when: "dziś · 10:24" },
                  { who: "Iga S.", what: "Vans Authentic 'Drip'", when: "wczoraj · 19:01" },
                  { who: "Adam W.", what: "Jordan 1 'Tag'", when: "wczoraj · 14:50" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: 10, border: "1px dashed var(--line)" }}>
                    <PhImg label="" style={{ width: 40, height: 40, border: "1.5px solid var(--ink)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.who}</div>
                      <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.what}</div>
                      <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>{r.when}</div>
                    </div>
                    <button className="btn-clean" style={{ padding: "4px 8px", fontSize: 11 }}>otwórz</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, v }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 14, height: 14, background: color, border: "1px solid var(--ink)" }} />
      <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
      <span className="t-mono" style={{ fontSize: 12, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

// =============================================================
// 2. ZAMÓWIENIA — list view + drawer
// =============================================================

function OrdersList({ withDrawer = false }) {
  const [view, setView] = useState("list");
  return (
    <div className="admin" data-screen-label="Admin · Zamówienia" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)", position: "relative", overflow: "hidden" }}>
      <AdminSidebar active="Zamówienia" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <AdminTopbar title="Zamówienia" subtitle="42 aktywnych · 6 gotowych do odbioru"
          right={<button className="btn-clean primary">{I.plus} Nowe zlecenie</button>}
        />

        {/* view tabs */}
        <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "inline-flex", border: "2px solid var(--ink)", background: "#fff", boxShadow: "2px 2px 0 var(--ink)" }}>
            {["list", "kalendarz", "kanban"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "8px 16px",
                fontFamily: "var(--font-stencil)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700,
                background: view === v ? "var(--ink)" : "transparent",
                color: view === v ? "var(--paper)" : "var(--ink)",
                border: 0, cursor: "pointer", borderRight: "1px solid var(--ink)",
              }}>{v === "list" ? "Lista" : v === "kalendarz" ? "Kalendarz" : "Kanban"}</button>
            ))}
          </div>
          {/* preset filters */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>presety:</span>
            <span className="chip pink">pilne na ten tydzień (3)</span>
            <span className="chip active">gotowe do odbioru (6)</span>
            <span className="chip">zaległe (2)</span>
            <span className="chip" style={{ background: "transparent", borderStyle: "dashed" }}>+ zapisz widok</span>
          </div>
        </div>

        {/* filter bar */}
        <div style={{ padding: "14px 24px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          <span className="chip active">{I.filter} status: wszystkie</span>
          <span className="chip">typ: wszystkie</span>
          <span className="chip">rzemieślnik: każdy</span>
          <span className="chip">{I.calendar} przyjęcie: maj '26</span>
          <span className="chip">{I.user} klient</span>
          <span className="chip">tag: pilne</span>
          <div style={{ flex: 1 }} />
          <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>9 z 42 zleceń</span>
        </div>

        {/* table */}
        <div style={{ padding: "0 24px 24px", flex: 1 }}>
          <div className="admin-card" style={{ padding: 0, marginTop: 16, overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }}><input type="checkbox" /></th>
                  <th>ID</th>
                  <th>Klient</th>
                  <th>Typ</th>
                  <th>Opis</th>
                  <th>Status</th>
                  <th>Przyjęte</th>
                  <th>Odbiór</th>
                  <th>Rzemieślnik</th>
                  <th style={{ width: 50 }}>Foto</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {ORDERS.map((o, i) => (
                  <tr key={o.id} style={i === 0 && withDrawer ? { background: "rgba(216,255,58,0.18)" } : undefined}>
                    <td><input type="checkbox" /></td>
                    <td className="t-mono" style={{ fontWeight: 700 }}>
                      {o.id}
                      {o.urgent && <span style={{ marginLeft: 6, padding: "1px 5px", background: "var(--pink)", color: "var(--paper)", fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>pilne</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.client}</td>
                    <td className="t-mono" style={{ fontSize: 12 }}>{o.type}</td>
                    <td style={{ color: "rgba(0,0,0,0.7)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.desc}</td>
                    <td><Pill status={o.status} /></td>
                    <td className="t-mono" style={{ fontSize: 12 }}>{o.in}</td>
                    <td className="t-mono" style={{ fontSize: 12 }}>{o.out}</td>
                    <td className="t-mono" style={{ fontSize: 12 }}>{o.craftsman}</td>
                    <td><PhImg label="" style={{ width: 36, height: 36, border: "1.5px solid var(--ink)" }} /></td>
                    <td style={{ color: "rgba(0,0,0,0.5)" }}>{I.more}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {withDrawer && <OrderDrawer />}
    </div>
  );
}

function OrderDrawer() {
  return (
    <aside style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 540,
      background: "var(--paper)", borderLeft: "3px solid var(--ink)",
      boxShadow: "-12px 0 30px rgba(0,0,0,0.18)",
      display: "flex", flexDirection: "column",
      animation: "drawerIn .25s ease",
    }}>
      <style>{`@keyframes drawerIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ padding: "16px 20px", borderBottom: "2px solid var(--ink)", display: "flex", alignItems: "center", gap: 12, background: "#fff" }}>
        <button className="btn-clean" style={{ padding: 6 }}>{I.close}</button>
        <div style={{ flex: 1 }}>
          <div className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>DR-1042</div>
          <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 2 }}>Magdalena Kowalska · przyjęte 02.05.26</div>
        </div>
        <Pill status="w realizacji" />
        <button className="btn-clean">{I.more}</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {/* status timeline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          {["przyjęte", "w realizacji", "czeka", "gotowe", "wydane"].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 26, height: 26,
                  background: i <= 1 ? "var(--ink)" : "#fff",
                  border: "2px solid var(--ink)",
                  color: i <= 1 ? "var(--paper)" : "rgba(0,0,0,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                  borderRadius: i === 1 ? 0 : "50%",
                }}>{i + 1}</div>
                <span className="t-mono" style={{ fontSize: 10, fontWeight: i <= 1 ? 700 : 400, color: i <= 1 ? "var(--ink)" : "rgba(0,0,0,0.5)", letterSpacing: ".05em", textTransform: "uppercase" }}>{s}</span>
              </div>
              {i < 4 && <div style={{ flex: 1, height: 2, background: i < 1 ? "var(--ink)" : "rgba(0,0,0,0.15)", margin: "0 4px" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* tags */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: ".1em", textTransform: "uppercase" }}>tagi:</span>
          <span className="chip pink">pilne</span>
          <span className="chip">stały klient</span>
          <span className="chip" style={{ background: "transparent", borderStyle: "dashed" }}>+ dodaj</span>
        </div>

        {/* item */}
        <div style={{ background: "#fff", border: "1.5px solid var(--ink)", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>Item · 1/1</div>
            <button className="btn-clean" style={{ fontSize: 11, padding: "4px 10px" }}>{I.plus} dodaj item</button>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <PhImg label="DM 1460" style={{ width: 80, height: 80 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Dr. Martens 1460 · czarne</div>
              <div className="t-mono" style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", marginTop: 2 }}>Wymiana podeszwy Vibram + czyszczenie głębokie</div>
              <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                <span className="t-mono" style={{ fontSize: 11 }}><b>340 zł</b></span>
                <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>{I.clock} 4h pracy</span>
                <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>rzemieślnik: Tomek</span>
              </div>
            </div>
          </div>
        </div>

        {/* photo gallery */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>Galeria · 6 zdjęć</div>
            <button className="btn-clean" style={{ fontSize: 11, padding: "4px 10px" }}>{I.upload} dodaj</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {[
              { l: "before", c: "var(--blue)" }, { l: "before", c: "var(--blue)" },
              { l: "trakcie", c: "var(--orange)" }, { l: "trakcie", c: "var(--orange)" },
              { l: "after", c: "var(--green)" }, { l: "+", c: "transparent" },
            ].map((p, i) => p.l === "+" ? (
              <div key={i} style={{ aspectRatio: "1", border: "1.5px dashed var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.4)", fontSize: 22 }}>+</div>
            ) : (
              <div key={i} style={{ position: "relative" }}>
                <PhImg label="" style={{ aspectRatio: "1", width: "100%" }} />
                <span style={{ position: "absolute", left: 3, bottom: 3, padding: "1px 5px", background: p.c, color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".05em" }}>{p.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* notes */}
        <div>
          <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em", marginBottom: 8 }}>Notatki wewnętrzne</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: "#fef4a8", padding: 12, border: "1.5px solid var(--ink)", transform: "rotate(-0.3deg)" }}>
              <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>Tomek · 02.05 · 14:32</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Klientka prosiła o oryginalny szew żółty, mam taki w zapasie</div>
            </div>
            <div style={{ background: "#fef4a8", padding: 12, border: "1.5px solid var(--ink)", transform: "rotate(0.4deg)" }}>
              <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>Daniel · 03.05 · 09:10</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Powiedziałem że odbiór możliwy 8.05 popołudniu</div>
            </div>
          </div>
        </div>

        {/* communication */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>Komunikacja · 4 wiadomości</div>
            <button className="btn-clean primary" style={{ fontSize: 11, padding: "4px 10px" }}>{I.send} wyślij update</button>
          </div>
          <div style={{ background: "#fff", border: "1.5px solid var(--ink)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { from: "Daniel", to: "Magdalena", text: "Buty przyjęte, daję znać przy zmianie statusu", ch: "WhatsApp", t: "02.05 14:30", out: true, status: "doręczono" },
              { from: "Magdalena", text: "Spoko, dzięki!", ch: "WhatsApp", t: "02.05 14:34", out: false },
              { from: "Daniel", to: "Magdalena", text: "Hej, jest postęp — wysyłam zdjęcia", ch: "WhatsApp", t: "05.05 11:12", out: true, status: "doręczono" },
              { from: "Magdalena", text: "Cudo!! Kiedy mogę odebrać?", ch: "WhatsApp", t: "05.05 12:01", out: false },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.out ? "flex-end" : "flex-start" }}>
                <div style={{ background: m.out ? "var(--ink)" : "var(--paper-2)", color: m.out ? "var(--paper)" : "var(--ink)", padding: "8px 12px", maxWidth: "75%", borderRadius: 4 }}>{m.text}</div>
                <div className="t-mono" style={{ fontSize: 9, color: "rgba(0,0,0,0.45)", marginTop: 2, letterSpacing: ".05em" }}>{m.ch} · {m.t}{m.status ? ` · ${m.status}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* footer actions */}
      <div style={{ padding: 14, borderTop: "2px solid var(--ink)", background: "#fff", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-clean primary">zmień status</button>
        <button className="btn-clean acid">oznacz jako wydane</button>
        <button className="btn-clean">{I.send} wiadomość</button>
        <button className="btn-clean">paragon</button>
        <div style={{ flex: 1 }} />
        <button className="btn-clean" style={{ color: "var(--red)", borderColor: "var(--red)" }}>anuluj</button>
      </div>
    </aside>
  );
}

// =============================================================
// 3. KALENDARZ
// =============================================================

function CalendarView() {
  const days = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
  const startOffset = 3; // first day of month is Thursday-ish, just for layout
  const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const today = 7;

  const events = {
    1: [{ s: "wydane", t: "DM 1460", c: "Bartek W." }],
    3: [{ s: "wydane", t: "AF1 LE", c: "Mateusz D." }],
    6: [{ s: "gotowe do odbioru", t: "AF1 'Bandana'", c: "Filip N." }, { s: "gotowe do odbioru", t: "Jordan 1", c: "Kuba M." }],
    7: [{ s: "w realizacji", t: "Vans 'Drip'", c: "Klaudia L." }, { s: "przyjęte", t: "DM 1460", c: "Bartek W." }, { s: "w realizacji", t: "Carhartt", c: "Aleksandra Z." }],
    8: [{ s: "gotowe do odbioru", t: "DM 1460", c: "Magdalena K." }],
    9: [{ s: "gotowe do odbioru", t: "Vans 'Drip'", c: "Klaudia L." }],
    10: [{ s: "czeka na klienta", t: "Carhartt back", c: "Aleksandra Z." }],
    12: [{ s: "w realizacji", t: "Levi's Trucker", c: "Natalia J." }],
    13: [{ s: "przyjęte", t: "DM 1460", c: "Bartek W." }],
    16: [{ s: "w realizacji", t: "AF1 mid", c: "Karolina P." }],
    20: [{ s: "przyjęte", t: "Custom Vans", c: "Tomasz S." }],
    22: [{ s: "w realizacji", t: "Carhartt", c: "Mateusz K." }, { s: "w realizacji", t: "Jordan 4", c: "Igor B." }],
    27: [{ s: "przyjęte", t: "DM 1460", c: "Anna W." }],
  };

  const colorOf = (s) => s === "gotowe do odbioru" ? "var(--green)" : s === "w realizacji" ? "var(--orange)" : s === "przyjęte" ? "var(--blue)" : s === "czeka na klienta" ? "#a17a00" : s === "wydane" ? "rgba(0,0,0,0.35)" : "var(--red)";

  return (
    <div className="admin" data-screen-label="Admin · Kalendarz" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Kalendarz" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AdminTopbar title="Kalendarz" subtitle="planowane odbiory" />
        <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "inline-flex", border: "2px solid var(--ink)", background: "#fff", boxShadow: "2px 2px 0 var(--ink)" }}>
            {["lista", "kalendarz", "kanban"].map(v => (
              <button key={v} style={{
                padding: "8px 16px",
                fontFamily: "var(--font-stencil)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700,
                background: v === "kalendarz" ? "var(--ink)" : "transparent", color: v === "kalendarz" ? "var(--paper)" : "var(--ink)",
                border: 0, cursor: "pointer", borderRight: "1px solid var(--ink)",
              }}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "inline-flex", border: "1.5px solid var(--ink)", background: "#fff" }}>
              {["miesiąc", "tydzień", "dzień"].map(v => (
                <button key={v} style={{
                  padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                  background: v === "miesiąc" ? "var(--acid)" : "transparent", border: 0, cursor: "pointer", borderRight: "1px solid var(--line)",
                }}>{v}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn-clean" style={{ padding: 6 }}>{I.arrowLeft}</button>
              <div className="t-display" style={{ fontSize: 24 }}>Maj 2026</div>
              <button className="btn-clean" style={{ padding: 6 }}>{I.arrow}</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: 24, display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, overflow: "hidden" }}>
          <div className="admin-card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid var(--ink)", background: "var(--paper-2)" }}>
              {days.map(d => (
                <div key={d} className="t-stencil" style={{ padding: "10px 12px", fontSize: 11, letterSpacing: ".1em", color: "var(--ink)", borderRight: "1px solid var(--line)" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", flex: 1 }}>
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={"e" + i} style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "rgba(0,0,0,0.02)" }} />
              ))}
              {monthDays.map(d => {
                const ev = events[d] || [];
                const isToday = d === today;
                return (
                  <div key={d} style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: 6, position: "relative", minHeight: 0, background: isToday ? "rgba(216,255,58,0.20)" : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="t-mono" style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--ink)" : "rgba(0,0,0,0.6)" }}>{d}</span>
                      {isToday && <Tape angle={2} style={{ fontSize: 9, padding: "1px 8px" }}>dziś</Tape>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                      {ev.slice(0, 3).map((e, i) => (
                        <div key={i} style={{
                          padding: "3px 6px",
                          background: colorOf(e.s),
                          color: e.s === "wydane" ? "rgba(0,0,0,0.6)" : "var(--paper)",
                          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                          borderLeft: "2px solid var(--ink)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "grab",
                        }}>{e.t} · {e.c.split(" ")[0]}</div>
                      ))}
                      {ev.length > 3 && <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>+ {ev.length - 3} więcej</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* unscheduled */}
          <div className="admin-card" style={{ padding: 16, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="t-display" style={{ fontSize: 18 }}>Bez terminu</div>
              <span className="chip">{4}</span>
            </div>
            <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 12, letterSpacing: ".05em" }}>przeciągnij na dzień by zaplanować</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { c: "Maciek N.", t: "Custom AF1 — koncept", s: "przyjęte" },
                { c: "Iwona R.", t: "Czyszczenie 6 par", s: "przyjęte" },
                { c: "Łukasz B.", t: "Vans Old Skool — drip", s: "przyjęte" },
                { c: "Marta P.", t: "Carhartt — patches", s: "przyjęte" },
              ].map((x, i) => (
                <div key={i} style={{ padding: 10, border: "1.5px solid var(--ink)", background: "#fff", cursor: "grab", boxShadow: "2px 2px 0 var(--ink)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "rgba(0,0,0,0.4)" }}>{I.drag}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{x.c}</span>
                  </div>
                  <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 2, marginLeft: 24 }}>{x.t}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
              <div className="t-stencil" style={{ fontSize: 11, letterSpacing: ".1em", marginBottom: 8 }}>Legenda</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.keys(STATUS_INFO).map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 8, background: colorOf(s), border: "1px solid var(--ink)" }} />
                    <span className="t-mono" style={{ fontSize: 11 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// 4. KANBAN
// =============================================================

function KanbanView() {
  const cols = [
    { k: "przyjęte", color: "var(--blue)", count: 5 },
    { k: "w realizacji", color: "var(--orange)", count: 14 },
    { k: "czeka na klienta", color: "#c89c00", count: 3 },
    { k: "gotowe do odbioru", color: "var(--green)", count: 6 },
    { k: "wydane", color: "rgba(0,0,0,0.35)", count: 2 },
  ];

  const cardsBy = {
    "przyjęte": [
      { id: "DR-1039", c: "Bartek W.", t: "Vibram, DM 1460", due: "13.05", urgent: false },
      { id: "DR-1044", c: "Maciek N.", t: "Custom AF1 — concept", due: "20.05", urgent: false },
      { id: "DR-1045", c: "Iwona R.", t: "Czyszczenie 6 par", due: "11.05", urgent: true },
    ],
    "w realizacji": [
      { id: "DR-1042", c: "Magdalena K.", t: "DM 1460 — Vibram", due: "08.05", urgent: true },
      { id: "DR-1038", c: "Klaudia L.", t: "Vans 'Drip'", due: "09.05", urgent: true },
      { id: "DR-1036", c: "Natalia J.", t: "Levi's Trucker — back piece", due: "12.05", urgent: false },
      { id: "DR-1043", c: "Karolina P.", t: "AF1 mid — flames", due: "16.05", urgent: false },
    ],
    "czeka na klienta": [
      { id: "DR-1040", c: "Aleksandra Z.", t: "Carhartt — back panel", due: "10.05", urgent: false },
      { id: "DR-1046", c: "Damian M.", t: "Custom NB — kolory", due: "—", urgent: false },
    ],
    "gotowe do odbioru": [
      { id: "DR-1041", c: "Filip N.", t: "AF1 'Bandana'", due: "06.05", urgent: false },
      { id: "DR-1035", c: "Kuba M.", t: "Jordan 1 — drip swoosh", due: "07.05", urgent: false },
      { id: "DR-1047", c: "Joanna T.", t: "DM 1460", due: "06.05", urgent: true },
    ],
    "wydane": [
      { id: "DR-1037", c: "Mateusz D.", t: "Czyszczenie + impregnacja", due: "30.04", urgent: false },
    ],
  };

  return (
    <div className="admin" data-screen-label="Admin · Kanban" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Kanban" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AdminTopbar title="Kanban" subtitle="przeciągnij kartę by zmienić status"
          right={<button className="btn-clean primary">{I.plus} Nowe zlecenie</button>}
        />
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ display: "inline-flex", border: "2px solid var(--ink)", background: "#fff", boxShadow: "2px 2px 0 var(--ink)" }}>
            {["lista", "kalendarz", "kanban"].map(v => (
              <button key={v} style={{
                padding: "8px 16px", fontFamily: "var(--font-stencil)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700,
                background: v === "kanban" ? "var(--ink)" : "transparent", color: v === "kanban" ? "var(--paper)" : "var(--ink)",
                border: 0, cursor: "pointer", borderRight: "1px solid var(--ink)",
              }}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 24, display: "grid", gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", gap: 16 }}>
          {cols.map(col => (
            <div key={col.k} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ background: col.color, color: col.k === "wydane" ? "var(--ink)" : "var(--paper)", padding: "10px 12px", border: "2px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="t-stencil" style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>{col.k}</div>
                <span className="t-mono" style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.85)", color: "var(--ink)", padding: "1px 7px", borderRadius: 999 }}>{col.count}</span>
              </div>
              <div style={{ background: "rgba(0,0,0,0.03)", border: "2px solid var(--ink)", borderTop: "none", padding: 8, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 200 }}>
                {(cardsBy[col.k] || []).map(c => (
                  <div key={c.id} className="admin-card" style={{ padding: 10, cursor: "grab" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>{c.id}</span>
                      {c.urgent && <span style={{ padding: "1px 5px", background: "var(--pink)", color: "var(--paper)", fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>pilne</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <PhImg label="" style={{ width: 40, height: 40, border: "1.5px solid var(--ink)", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.c}</div>
                        <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.6)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.t}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px dashed var(--line)" }}>
                      <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.55)" }}>{I.calendar} {c.due}</span>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--paper-2)", border: "1.5px solid var(--ink)", fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>T</span>
                    </div>
                  </div>
                ))}
                <button className="btn-clean" style={{ padding: "6px 8px", justifyContent: "center", fontSize: 11, opacity: 0.7, borderStyle: "dashed", boxShadow: "none" }}>{I.plus} dodaj</button>
              </div>
            </div>
          ))}
        </div>

        {/* status-change confirm pop */}
        <div style={{ position: "absolute", right: 28, bottom: 28, width: 320, background: "#fff", border: "2px solid var(--ink)", boxShadow: "5px 5px 0 var(--pink), 5px 5px 0 1.5px var(--ink)", padding: 16 }}>
          <div className="t-stencil" style={{ fontSize: 12, letterSpacing: ".1em", color: "var(--pink)" }}>Status zmieniony</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>DR-1041 → gotowe do odbioru</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", marginTop: 6 }}>Wysłać wiadomość do klienta? Trigger „Gotowe — przyjdź odebrać" przygotowany.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-clean primary" style={{ fontSize: 12 }}>{I.send} wyślij</button>
            <button className="btn-clean" style={{ fontSize: 12 }}>podgląd</button>
            <div style={{ flex: 1 }} />
            <button className="btn-clean" style={{ fontSize: 12, padding: 6 }}>{I.close}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// 5. WIADOMOŚCI
// =============================================================

function Messaging() {
  const convs = [
    { name: "Magdalena Kowalska", last: "Cudo!! Kiedy mogę odebrać?", t: "12:01", ch: "WhatsApp", unread: true, active: true, order: "DR-1042" },
    { name: "Filip Nowak", last: "Super, wpadnę w czwartek po 17", t: "11:30", ch: "Email", unread: true, order: "DR-1041" },
    { name: "Aleksandra Zając", last: "Czy zdjęcia będą dziś?", t: "10:14", ch: "IG DM", unread: true, order: "DR-1040" },
    { name: "Bartek Wiśniewski", last: "Dzięki, rozumiem", t: "wczoraj", ch: "SMS", order: "DR-1039" },
    { name: "Klaudia Lewandowska", last: "Można ten odcień zielonego?", t: "wczoraj", ch: "WhatsApp", order: "DR-1038" },
    { name: "Mateusz Dąbrowski", last: "Wszystko ok, polecam!", t: "30.04", ch: "Email", order: "DR-1037" },
    { name: "Natalia Jankowska", last: "Wgrałam referencje do dropbox", t: "29.04", ch: "Email", order: "DR-1036" },
    { name: "Kuba Mazur", last: "5/5 robota", t: "28.04", ch: "IG DM", order: "DR-1035" },
  ];
  return (
    <div className="admin" data-screen-label="Admin · Wiadomości" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Wiadomości" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AdminTopbar title="Wiadomości" subtitle="3 nieprzeczytane · zunifikowana skrzynka" />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 280px", overflow: "hidden", borderTop: "1px solid var(--line)" }}>
          {/* convo list */}
          <div style={{ borderRight: "2px solid var(--ink)", display: "flex", flexDirection: "column", background: "#fff" }}>
            <div style={{ padding: 12, borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1.5px solid var(--ink)" }}>
                <span style={{ color: "rgba(0,0,0,0.45)" }}>{I.search}</span>
                <input placeholder="Szukaj…" style={{ border: 0, outline: 0, flex: 1, fontFamily: "var(--font-body)", fontSize: 12 }} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="chip active" style={{ fontSize: 11 }}>nieprzeczytane (3)</span>
                <span className="chip" style={{ fontSize: 11 }}>wymaga odp.</span>
                <span className="chip" style={{ fontSize: 11 }}>wszystkie</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="chip" style={{ fontSize: 11 }}>WhatsApp</span>
                <span className="chip" style={{ fontSize: 11 }}>Email</span>
                <span className="chip" style={{ fontSize: 11 }}>SMS</span>
                <span className="chip" style={{ fontSize: 11 }}>IG</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {convs.map((c, i) => (
                <div key={i} style={{
                  padding: 12, borderBottom: "1px solid var(--line)", cursor: "pointer",
                  background: c.active ? "rgba(216,255,58,0.20)" : "transparent",
                  borderLeft: c.active ? "3px solid var(--ink)" : "3px solid transparent",
                  display: "flex", gap: 10,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--paper-2)", border: "1.5px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, flexShrink: 0 }}>{c.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", flexShrink: 0 }}>{c.t}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span className="t-mono" style={{ fontSize: 9, padding: "1px 5px", background: "var(--ink)", color: "var(--paper)", letterSpacing: ".05em" }}>{c.ch}</span>
                      <span className="t-mono" style={{ fontSize: 9, color: "rgba(0,0,0,0.5)" }}>{c.order}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: c.unread ? 600 : 400 }}>{c.last}</div>
                  </div>
                  {c.unread && <span style={{ width: 8, height: 8, background: "var(--pink)", borderRadius: 999, alignSelf: "center" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* thread */}
          <div style={{ display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, background: "#fff" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--paper-2)", border: "1.5px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700 }}>M</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Magdalena Kowalska</div>
                <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>WhatsApp · powiązane: <a style={{ color: "var(--blue)" }}>DR-1042</a> · stały klient</div>
              </div>
              <button className="btn-clean">{I.user} profil</button>
              <button className="btn-clean">otwórz zlecenie {I.arrow}</button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { out: true, t: "Hej Magda, buty przyjęte. Damy znać przy zmianie statusu", time: "02.05 · 14:30" },
                { out: false, t: "Spoko, dzięki!", time: "02.05 · 14:34" },
                { out: true, attach: true, t: "Postępy — wysyłam zdjęcia z pracowni", time: "05.05 · 11:12" },
                { out: false, t: "Cudo!! Kiedy mogę odebrać?", time: "05.05 · 12:01" },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.out ? "flex-end" : "flex-start", gap: 4 }}>
                  <div style={{
                    background: m.out ? "var(--ink)" : "#fff",
                    color: m.out ? "var(--paper)" : "var(--ink)",
                    padding: "10px 14px", maxWidth: "70%",
                    border: m.out ? "none" : "1.5px solid var(--ink)",
                  }}>
                    {m.attach && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                        <PhImg dark label="" style={{ aspectRatio: "1", width: 90, border: "none" }} />
                        <PhImg dark label="" style={{ aspectRatio: "1", width: 90, border: "none" }} />
                      </div>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{m.t}</div>
                  </div>
                  <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>{m.time}{m.out ? " · doręczono" : ""}</div>
                </div>
              ))}
            </div>

            {/* composer */}
            <div style={{ borderTop: "2px solid var(--ink)", background: "#fff", padding: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select style={{ padding: "5px 8px", border: "1.5px solid var(--ink)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
                  <option>WhatsApp</option><option>Email</option><option>SMS</option>
                </select>
                <select style={{ padding: "5px 8px", border: "1.5px solid var(--ink)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
                  <option>szablon: brak</option><option>Gotowe — przyjdź odebrać</option><option>Zdjęcia w trakcie</option><option>Prośba o opinię</option>
                </select>
                <span className="chip" style={{ fontSize: 10 }}>powiązane: DR-1042</span>
                <div style={{ flex: 1 }} />
                <button className="btn-clean" style={{ fontSize: 11, padding: "4px 10px" }}>podgląd</button>
              </div>
              <textarea rows={3} placeholder="Napisz wiadomość…" style={{ width: "100%", border: "1.5px solid var(--ink)", padding: 10, fontFamily: "var(--font-body)", fontSize: 13, resize: "none" }} defaultValue="Hej Magda, buty są gotowe! Możesz wpaść w czwartek lub piątek między 11–19. Wysłać Ci jeszcze parę zdjęć po wykończeniu?" />
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <button className="btn-clean" style={{ padding: 6 }}>{I.paperclip}</button>
                <button className="btn-clean" style={{ padding: 6 }}>{I.image}</button>
                <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>2 zdjęcia z DR-1042 załączone</span>
                <div style={{ flex: 1 }} />
                <button className="btn-clean primary">{I.send} wyślij</button>
              </div>
            </div>
          </div>

          {/* client side panel */}
          <div style={{ borderLeft: "1px solid var(--line)", background: "#fff", padding: 18, overflow: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--acid)", border: "2px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 28 }}>MK</div>
              <div className="t-display" style={{ fontSize: 22, marginTop: 10, lineHeight: 1 }}>Magdalena Kowalska</div>
              <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 4 }}>klient od 03.2024</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}><Sticker style={{ fontSize: 10, padding: "4px 10px" }} angle={-2}>stały klient</Sticker></div>
            </div>
            <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <Row k="Telefon" v="+48 602 113 224" />
              <Row k="Email" v="m.kowalska@…" />
              <Row k="Preferowany kanał" v="WhatsApp" />
              <Row k="Zleceń" v="4" />
              <Row k="Łącznie" v="2 140 zł" />
            </div>
            <div style={{ paddingTop: 14, marginTop: 14, borderTop: "1px solid var(--line)" }}>
              <div className="t-stencil" style={{ fontSize: 11, marginBottom: 8 }}>Aktywne zlecenia</div>
              <div style={{ padding: 10, border: "1.5px solid var(--ink)", display: "flex", gap: 8, alignItems: "center" }}>
                <PhImg label="" style={{ width: 36, height: 36 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-mono" style={{ fontSize: 11, fontWeight: 700 }}>DR-1042</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>DM 1460 — Vibram</div>
                </div>
                <Pill status="w realizacji" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span className="t-mono" style={{ color: "rgba(0,0,0,0.55)" }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

// =============================================================
// 6. TRIGGERY
// =============================================================

function Triggers() {
  const triggers = [
    { name: "Przyjęcie zlecenia → potwierdzenie", event: "Zmiana statusu na: przyjęte", ch: "Email + SMS", delay: "natychmiast", active: true, manual: false, sent: 142, rep: 38 },
    { name: "W realizacji → update", event: "Zmiana statusu na: w realizacji", ch: "WhatsApp", delay: "+2h", active: true, manual: false, sent: 98, rep: 42 },
    { name: "Gotowe — przyjdź odebrać", event: "Zmiana statusu na: gotowe do odbioru", ch: "Email + SMS", delay: "natychmiast", active: true, manual: true, sent: 76, rep: 71 },
    { name: "Przypominajka odbioru (3 dni)", event: "3 dni po: gotowe do odbioru", ch: "SMS", delay: "+3 dni", active: true, manual: false, sent: 18, rep: 14 },
    { name: "Prośba o opinię", event: "5 dni po: wydane", ch: "Email", delay: "+5 dni", active: true, manual: false, sent: 64, rep: 21 },
    { name: "Anulowanie zlecenia", event: "Zmiana statusu na: anulowane", ch: "Email", delay: "natychmiast", active: false, manual: true, sent: 4, rep: 2 },
  ];
  return (
    <div className="admin" data-screen-label="Admin · Triggery" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Triggery" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <AdminTopbar title="Triggery" subtitle="zautomatyzowane wiadomości"
          right={<button className="btn-clean primary">{I.plus} Nowy trigger</button>}
        />
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
          {/* list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="chip active">aktywne (5)</span>
                <span className="chip">wyłączone (1)</span>
                <span className="chip">do potwierdzenia (1)</span>
              </div>
              <button className="btn-clean">biblioteka szablonów {I.arrow}</button>
            </div>
            {triggers.map((t, i) => (
              <div key={i} className="admin-card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start", opacity: t.active ? 1 : 0.55, borderLeftWidth: 5, borderLeftStyle: "solid", borderLeftColor: t.manual ? "var(--pink)" : "var(--blue)" }}>
                <div style={{ width: 38, height: 38, background: "var(--ink)", color: "var(--acid)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{I.zap}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div className="t-display" style={{ fontSize: 18 }}>{t.name}</div>
                    {t.manual && <span className="chip pink" style={{ fontSize: 10, padding: "2px 8px" }}>wymaga potwierdzenia</span>}
                  </div>
                  <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 4 }}>
                    <strong>kiedy:</strong> {t.event} · <strong>kanał:</strong> {t.ch} · <strong>opóźnienie:</strong> {t.delay}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    <span className="t-mono" style={{ fontSize: 11 }}><b>{t.sent}</b> wysłane</span>
                    <span className="t-mono" style={{ fontSize: 11 }}><b>{Math.round(t.sent * 0.62)}</b> otwarte</span>
                    <span className="t-mono" style={{ fontSize: 11 }}><b>{t.rep}</b> odpowiedzi</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <Toggle on={t.active} />
                  <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px" }}>edytuj</button>
                </div>
              </div>
            ))}
          </div>

          {/* trigger editor */}
          <div className="admin-card" style={{ padding: 22, alignSelf: "flex-start", position: "sticky", top: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Tape angle={-2}>edytujesz</Tape>
              <button className="btn-clean" style={{ padding: 4 }}>{I.close}</button>
            </div>
            <div className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>Gotowe — przyjdź odebrać</div>
            <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 4 }}>76 wysłanych · 71 odpowiedzi · 93% open rate</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
              <div className="field"><label>Nazwa</label><input defaultValue="Gotowe — przyjdź odebrać" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="field">
                  <label>Zdarzenie</label>
                  <select><option>Zmiana statusu na: gotowe do odbioru</option></select>
                </div>
                <div className="field">
                  <label>Opóźnienie</label>
                  <select><option>natychmiast</option><option>+2h</option><option>+1 dzień</option></select>
                </div>
              </div>
              <div className="field">
                <label>Kanał</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="chip active">Email</span>
                  <span className="chip active">SMS</span>
                  <span className="chip">WhatsApp</span>
                </div>
              </div>
              <div className="field">
                <label>Treść · placeholdery klikalne</label>
                <textarea rows={6} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} defaultValue={`Cześć {imię_klienta}!\n\nTwoje {typ_pracy} czeka na odbiór 🎉\nNumer zlecenia: {numer_zlecenia}\nZdjęcia tu: {link_do_zdjęć}\n\nPracownia czynna pn–pt 11–19, sob 12–16.\n\n— Dr Shoes`} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["{imię_klienta}", "{numer_zlecenia}", "{typ_pracy}", "{data_odbioru}", "{link_do_zdjęć}"].map(p => (
                  <span key={p} className="chip" style={{ fontSize: 10, padding: "2px 8px" }}>{p}</span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--paper-2)", border: "1px dashed var(--ink)" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="t-mono" style={{ fontSize: 11, fontWeight: 700 }}>Wymaga ręcznego potwierdzenia</span>
                  <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.55)" }}>trafia do skrzynki „do wysłania"</span>
                </div>
                <Toggle on={true} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-clean primary" style={{ flex: 1, justifyContent: "center" }}>zapisz zmiany</button>
                <button className="btn-clean" style={{ flex: 1, justifyContent: "center" }}>{I.send} test do siebie</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{
      width: 40, height: 22,
      background: on ? "var(--ink)" : "rgba(0,0,0,0.2)",
      borderRadius: 999, position: "relative", cursor: "pointer",
      border: "1.5px solid var(--ink)",
    }}>
      <div style={{
        position: "absolute", top: 1, left: on ? 19 : 1,
        width: 16, height: 16, background: on ? "var(--acid)" : "#fff",
        borderRadius: "50%", border: "1.5px solid var(--ink)",
        transition: "left .15s",
      }} />
    </div>
  );
}

// =============================================================
// 7. SKLEP ADMIN
// =============================================================

function ShopAdmin() {
  return (
    <div className="admin" data-screen-label="Admin · Sklep" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      <AdminSidebar active="Sklep" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <AdminTopbar title="Sklep" subtitle="6 par · 1 zarezerwowana · 1 sprzedana"
          right={<button className="btn-clean primary">{I.plus} Dodaj parę</button>}
        />
        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
          {/* products grid */}
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <span className="chip active">wszystkie (6)</span>
              <span className="chip">dostępne (4)</span>
              <span className="chip">zarezerwowane (1)</span>
              <span className="chip">sprzedane (1)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {PRODUCTS.map(p => (
                <div key={p.id} className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ position: "relative", aspectRatio: "1", borderBottom: "1.5px solid var(--ink)" }}>
                    <PhImg label={p.name} style={{ width: "100%", height: "100%", border: "none" }} />
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      {p.status === "dostępne" ? <Stamp color="green" angle={-3}>dostępne</Stamp>
                        : p.status === "zarezerwowane" ? <Stamp color="pink">rezerwacja</Stamp>
                        : <Stamp color="ink">sprzedane</Stamp>}
                    </div>
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                      <button className="btn-clean" style={{ padding: 5 }}>{I.edit}</button>
                      <button className="btn-clean" style={{ padding: 5 }}>{I.eye}</button>
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.55)" }}>{p.brand} · {p.size}</div>
                    <div className="t-display" style={{ fontSize: 18, marginTop: 2 }}>{p.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <div className="t-display" style={{ fontSize: 22 }}>{p.price}</div>
                      {p.status === "zarezerwowane" && <span className="t-mono" style={{ fontSize: 10, color: "var(--pink)", fontWeight: 700 }}>2 rezerwacje</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* selected product detail */}
          <div className="admin-card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Tape>edytujesz · AF1 Mid 'Bandana'</Tape>
              <button className="btn-clean" style={{ padding: 4 }}>{I.close}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
              {[1,2,3,4].map(i => (
                <PhImg key={i} label={`zdjęcie ${i}`} style={{ aspectRatio: "1" }} />
              ))}
            </div>
            <button className="btn-clean" style={{ width: "100%", justifyContent: "center", borderStyle: "dashed", marginBottom: 14 }}>{I.upload} dodaj zdjęcie</button>

            <div style={{ display: "grid", gap: 10 }}>
              <div className="field"><label>Nazwa</label><input defaultValue="AF1 Mid 'Bandana'" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <div className="field"><label>Marka</label><input defaultValue="Nike" /></div>
                <div className="field"><label>Rozmiar</label><input defaultValue="EU 43" /></div>
                <div className="field"><label>Cena</label><input defaultValue="990 zł" /></div>
              </div>
              <div className="field"><label>Opis</label><textarea rows={3} defaultValue="Custom AF1 mid · paisley bandana motif na bocznych panelach. Acrylic Angelus, fixer Saphir. 100% ręcznie." /></div>
              <div className="field"><label>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="chip">dostępne</span>
                  <span className="chip active">zarezerwowane</span>
                  <span className="chip">sprzedane</span>
                </div>
              </div>
            </div>

            {/* reservations */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
              <div className="t-stencil" style={{ fontSize: 12, letterSpacing: ".1em", marginBottom: 8 }}>Rezerwacje · 2</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { who: "Karol Jastrzębski", phone: "+48 511 003 887", time: "dziś · 10:24", note: "może wpaść w czwartek" },
                  { who: "Mateusz Kowalik", phone: "+48 663 119 408", time: "wczoraj · 18:55", note: "jeśli nie odbierze pierwszy" },
                ].map((r, i) => (
                  <div key={i} style={{ padding: 10, border: "1.5px solid var(--ink)", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{i+1}. {r.who}</span>
                      <span className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>{r.time}</span>
                    </div>
                    <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.7)" }}>{r.phone}</div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>„{r.note}"</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px" }}>potwierdź sprzedaż</button>
                      <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px" }}>{I.send} pisz</button>
                      <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)", borderColor: "var(--red)" }}>anuluj</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn-clean primary" style={{ flex: 1, justifyContent: "center" }}>zapisz</button>
              <button className="btn-clean" style={{ color: "var(--red)", borderColor: "var(--red)" }}>{I.trash}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AdminScreens = {
  AdminDashboard, OrdersList, OrderDrawer, CalendarView, KanbanView, Messaging, Triggers, ShopAdmin,
};
