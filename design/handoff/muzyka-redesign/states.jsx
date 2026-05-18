/* 5 states A–E + design canvas wrapper */

/* ─── Dashboard content for State A ─── */
function DashboardContent() {
  return (
    <div className="dash">
      <div className="kpi">
        <div className="k">Otwarte zlecenia</div>
        <div className="v">42</div>
        <div className="delta">+6 w tym tyg.</div>
      </div>
      <div className="kpi">
        <div className="k">Do odbioru dziś</div>
        <div className="v">6</div>
        <div className="delta down">2 spóźnione</div>
      </div>
      <div className="kpi">
        <div className="k">Klienci ten msc</div>
        <div className="v">38</div>
        <div className="delta">+12% r/r</div>
      </div>
      <div className="kpi fill">
        <div className="k">Obrót · maj</div>
        <div className="v">14.2k</div>
        <div className="delta" style={{ color: "var(--acid)" }}>+1 840 zł</div>
      </div>

      <div className="dash-wide">
        <h3>Najbliższe odbiory · pon. 18 maj</h3>
        <div className="dash-list">
          <div className="item">
            <div className="av">JK</div>
            <div className="nm">Jan Kowalski · DR-2026-0041
              <small>botki damskie · wymiana fleków + czyszczenie zamszu</small>
            </div>
            <span className="pill ready">Gotowe</span>
          </div>
          <div className="item">
            <div className="av">AN</div>
            <div className="nm">Anna Nowak · DR-2026-0038
              <small>sneakersy adidas · oczyszczenie + impregnacja</small>
            </div>
            <span className="pill urgent">Pilne</span>
          </div>
          <div className="item">
            <div className="av">PW</div>
            <div className="nm">Piotr Wiśniewski · DR-2026-0044
              <small>brogsy męskie · renowacja podeszwy</small>
            </div>
            <span className="pill">W trakcie</span>
          </div>
          <div className="item">
            <div className="av">MK</div>
            <div className="nm">Maria Kowalczyk · DR-2026-0045
              <small>kozaki zamszowe · czyszczenie + flek prawy</small>
            </div>
            <span className="pill">Zaplanowane</span>
          </div>
        </div>
      </div>

      <div className="dash-wide">
        <h3>Statusy zleceń</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { lbl: "Przyjęte", n: 14, c: "var(--paper-2)" },
            { lbl: "W trakcie", n: 18, c: "rgba(216,255,58,.4)" },
            { lbl: "Gotowe", n: 6,  c: "var(--acid)" },
            { lbl: "Odebrane", n: 4, c: "var(--ink)", inv: true },
          ].map(s => (
            <div key={s.lbl} style={{
              padding: "16px 12px",
              background: s.c, color: s.inv ? "var(--paper)" : "var(--ink)",
              border: "1.5px solid var(--ink)",
              boxShadow: "2px 2px 0 var(--ink)",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", opacity: .7 }}>{s.lbl}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1, marginTop: 4 }}>{s.n}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 18, padding: 14,
          background: "rgba(216,255,58,.18)",
          border: "1.5px solid var(--ink)",
          boxShadow: "3px 3px 0 var(--ink)",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mute)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>tip</div>
          <div style={{ fontFamily: "var(--font-stencil)", fontWeight: 800, fontSize: 14, letterSpacing: ".04em" }}>
            Muzyka działa cały czas w panelu — kontroluj z dolnego paska bez wychodzenia z dashboardu.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 5 STATES ─── */

function StateA() {
  return (
    <div className="adm" data-screen-label="A · Dashboard + mini-player">
      <Sidebar active="Dashboard" playing />
      <main className="main">
        <Topbar title="Dashboard" subtitle="pon. · 18 maj 2026 · 11:42" />
        <div className="body">
          <DashboardContent />
        </div>
      </main>
      <MiniPlayer track={CURRENT_TRACK} />
    </div>
  );
}

function StateB() {
  return (
    <div className="adm no-mini" data-screen-label="B · /admin/muzyka pusty">
      <Sidebar active="Muzyka" />
      <main className="main">
        <Topbar
          title="Muzyka"
          subtitle={<>pracownia · wspólne playlisty<br/>nic teraz nie leci</>}
          right={
            <span style={{
              padding: "6px 10px",
              background: "var(--paper-2)",
              border: "1.5px solid var(--ink)",
              fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: ".14em", textTransform: "uppercase",
            }}>cisza · 00:00</span>
          }
        />
        <div className="body">
          <MuzykaPage state="empty" />
        </div>
      </main>
    </div>
  );
}

function StateC() {
  return (
    <div className="adm" data-screen-label="C · /admin/muzyka pełny">
      <Sidebar active="Muzyka" playing />
      <main className="main">
        <Topbar
          title="Muzyka"
          subtitle={<>pracownia · 4 playlisty wspólne<br/>kolejka · 3 w toku</>}
          right={
            <span style={{
              padding: "6px 10px",
              background: "var(--acid)",
              border: "1.5px solid var(--ink)",
              fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: ".14em", textTransform: "uppercase",
              boxShadow: "2px 2px 0 var(--ink)",
            }}>● gra · 01:42</span>
          }
        />
        <div className="body">
          <MuzykaPage state="full" />
        </div>
      </main>
      <MiniPlayer track={CURRENT_TRACK} />
    </div>
  );
}

function StateD() {
  return (
    <div className="adm" data-screen-label="D · dropdown nad wynikiem">
      <Sidebar active="Muzyka" playing />
      <main className="main">
        <Topbar
          title="Muzyka"
          subtitle={<>pracownia · 4 playlisty wspólne<br/>dodawanie do playlisty…</>}
        />
        <div className="body">
          <MuzykaPage state="dropdown" />
        </div>
      </main>
      <MiniPlayer track={CURRENT_TRACK} />
    </div>
  );
}

function StateE() {
  return (
    <div className="adm" data-screen-label="E · modal nowa playlista">
      <Sidebar active="Muzyka" playing />
      <main className="main">
        <Topbar
          title="Muzyka"
          subtitle={<>pracownia · 4 playlisty wspólne<br/>tworzenie playlisty…</>}
        />
        <div className="body">
          <MuzykaPage state="full" />
        </div>
      </main>
      <MiniPlayer track={CURRENT_TRACK} />

      {/* MODAL */}
      <div className="modal-back">
        <div className="modal">
          <div className="modal-tape">nowa playlista · shared</div>
          <div className="modal-h">
            <h2>Nowa playlista</h2>
            <button className="x-btn">{ICO.x}</button>
          </div>
          <div className="modal-b">
            <div className="lbl-row">
              <span><span className="req">*</span>Nazwa playlisty</span>
              <span>widoczna dla całej pracowni</span>
            </div>
            <div className="modal-input">
              <input type="text" defaultValue="Piątek wieczór · slow" autoFocus />
            </div>
            <div className="modal-hint">
              Playlisty są <b style={{ color: "var(--ink)" }}>wspólne</b> — każdy w pracowni może dodawać i usuwać utwory.
              Nazwa pojawi się w lewej kolumnie i w skrócie pod „+ Dodaj”.
            </div>
            <div className="modal-presets">
              <button>poranek</button>
              <button>lo-fi</button>
              <button>klasyka</button>
              <button>piątek</button>
              <button>cardio</button>
              <button>renowacje</button>
            </div>
          </div>
          <div className="modal-f">
            <button className="btn-ghost">Anuluj</button>
            <button className="btn-primary">Zapisz playlistę</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CANVAS ─── */
function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="muzyka-states"
        title="Muzyka v2 · 5 stanów"
        subtitle="mini-player zawsze w chrome adminu · /admin/muzyka jako command center · shared playlists"
      >
        <DCArtboard id="A" label="A · Dashboard + mini-player gra w tle" width={1440} height={900}>
          <StateA />
        </DCArtboard>
        <DCArtboard id="B" label="B · /admin/muzyka — pusty stan (zero playlist, zero kolejki)" width={1440} height={900}>
          <StateB />
        </DCArtboard>
        <DCArtboard id="C" label="C · /admin/muzyka — pełny (4 playlisty · gra · 3 w kolejce · wyniki)" width={1440} height={900}>
          <StateC />
        </DCArtboard>
        <DCArtboard id="D" label="D · Dropdown „+ dodaj do playlisty” otwarty" width={1440} height={900}>
          <StateD />
        </DCArtboard>
        <DCArtboard id="E" label="E · Modal „Nowa playlista”" width={1440} height={900}>
          <StateE />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
