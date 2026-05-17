// Showcase host — loads each .tsx file's source via fetch and lays out
// the section frames around live previews.
const { useState, useEffect } = React;
const {
  LocationsList,
  LocationFormModal,
  OrderDrawerNoteComposer,
  LocationMoveChip,
} = window.M10;

// ── source loader ─────────────────────────────────────────────────
function useSource(filename) {
  const [src, setSrc] = useState("// loading…");
  useEffect(() => {
    fetch(`./components/${filename}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(setSrc)
      .catch((err) => setSrc(`// failed to load (${err})`));
  }, [filename]);
  return src;
}

function CodePane({ filename, label }) {
  const src = useSource(filename);
  return (
    <div className="pane">
      <div className="pane-head">
        <span>source</span>
        <span className="right">{label || filename}</span>
      </div>
      <div className="pane-body dark">
        <pre className="code">{src}</pre>
      </div>
    </div>
  );
}

function SectionFrame({ num, title, file, notes, children, codeFile, codeLabel, solo }) {
  return (
    <section className="sec" id={`c${parseInt(num, 10)}`}>
      <header className="sec-head">
        <div className="sec-left">
          <span className="sec-num">{num}</span>
          <span className="sec-name">{title}</span>
          <code className="sec-file">{file}</code>
        </div>
        <div className="sec-notes">{notes}</div>
      </header>
      <div className={`split ${solo ? "solo" : ""}`}>
        {children}
        {!solo && <CodePane filename={codeFile} label={codeLabel} />}
      </div>
    </section>
  );
}

function PreviewPane({ children, bg, pad }) {
  return (
    <div className="pane">
      <div className="pane-head">
        <span>preview</span>
        <span className="right">live</span>
      </div>
      <div className="pane-body" style={{ background: bg || "#f7f5ef", padding: pad ?? 24 }}>
        {children}
      </div>
    </div>
  );
}

// ── data ───────────────────────────────────────────────────────────
const SAMPLE_LOCATIONS = [
  { id: 1, name: "półka 1", position: 1, active: true },
  { id: 2, name: "półka 2", position: 2, active: true },
  { id: 3, name: "suszarka", position: 3, active: true },
  { id: 4, name: "szuflada", position: 4, active: true },
  { id: 9, name: "regał stary", position: 99, active: false },
];

// ── section 5: drawer header mockup ────────────────────────────────
function DrawerHeaderMock({ location }) {
  return (
    <div className="hdr-mockup">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute, #6b6960)", letterSpacing: ".08em" }}>
            DR-2026-0042
          </div>
          <div className="t-display" style={{ fontSize: 22, marginTop: 2 }}>
            Marek Kowalski
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute, #6b6960)", marginTop: 4 }}>
            przyjęte · 12 maja 2026
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <span className="status-pill">w realizacji</span>
          {location && (
            <span aria-label="Aktualne miejsce" className="loc-pill added-outline">
              <span aria-hidden>📍</span>
              {location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── section 6: sidebar mockup ──────────────────────────────────────
function SidebarMock({ activePath }) {
  const Sec = ({ label, children }) => (
    <div>
      <div className="sb-section-label">{label}</div>
      {children}
    </div>
  );
  const Link = ({ href, children, icon }) => (
    <a className={`sb-link${activePath === href ? " active" : ""}`} href="#">
      <span style={{ width: 16, display: "inline-flex" }}>{icon}</span>
      <span>{children}</span>
    </a>
  );
  return (
    <div className="sb-mockup">
      <div className="sb-brand">DR.SHOES</div>
      <Sec label="Pulpit">
        <Link href="/admin" icon={<Square />}>Dziś</Link>
      </Sec>
      <Sec label="Operacje">
        <Link href="/admin/orders" icon={<Square />}>Zlecenia</Link>
        <Link href="/admin/kanban" icon={<Square />}>Kanban</Link>
        <Link href="/admin/clients" icon={<Square />}>Klienci</Link>
      </Sec>
      <Sec label="Komunikacja">
        <Link href="/admin/messages" icon={<Square />}>Wiadomości</Link>
      </Sec>
      <Sec label="Sklep">
        <Link href="/admin/shop" icon={<Square />}>Sklep</Link>
      </Sec>
      <div className="added-outline" style={{ margin: "0 4px" }}>
        <Sec label={<span>Konfiguracja <span className="added-tag">added</span></span>}>
          <Link href="/admin/settings/miejsca" icon={<Pin />}>Miejsca</Link>
        </Sec>
      </div>
    </div>
  );
}

function Square() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  );
}
function Pin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s-8-7-8-13a8 8 0 1 1 16 0c0 6-8 13-8 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// ── App ───────────────────────────────────────────────────────────
function App() {
  return (
    <div>
      {/* 1 — LocationsList */}
      <SectionFrame
        num="01"
        title="LocationsList"
        file="/admin/settings/miejsca/_components/LocationsList.tsx"
        codeFile="LocationsList.tsx"
        notes={
          <>
            Wygląda jak inwentaryzacyjny rejestr w warsztacie. Aktywne miejsca u góry (sort: <code>position</code> → <code>name</code>), nieaktywne na dole z <code>opacity .5</code> i kursywą "(nieaktywne)". <code>data-active</code> na rzędzie jest kontraktem testowym. Pusty stan na dole.
          </>
        }
      >
        <PreviewPane>
          <div className="variant-row">
            <div>
              <div className="variant-label">— stan z danymi —</div>
              <LocationsList
                locations={SAMPLE_LOCATIONS}
                onEdit={() => {}}
                onDeactivate={() => {}}
              />
            </div>
            <div>
              <div className="variant-label">— stan pusty —</div>
              <LocationsList locations={[]} onEdit={() => {}} onDeactivate={() => {}} />
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>

      {/* 2 — LocationFormModal */}
      <SectionFrame
        num="02"
        title="LocationFormModal"
        file="/admin/settings/miejsca/_components/LocationFormModal.tsx"
        codeFile="LocationFormModal.tsx"
        notes={
          <>
            <code>@radix-ui/react-dialog</code> · paper bg · 2px ink border · pop-pink shadow dla emfazy. Zapisuje przez <code>createLocation</code> lub <code>updateLocation</code>. Walidacja: nazwa niepusta, max 64. Mapuje błąd <code>duplicate_name</code> na polski tekst.
          </>
        }
      >
        <PreviewPane bg="rgba(10,10,10,.55)" pad={24}>
          <div className="variant-row">
            <div className="modal-preview-bg" style={{ background: "transparent", padding: 0 }}>
              <LocationFormModal target={null} onClose={() => {}} />
            </div>
            <div className="modal-preview-bg" style={{ background: "transparent", padding: 0 }}>
              <LocationFormModal
                target={{ id: 4, name: "szuflada", position: 4, active: true, simulateError: true }}
                onClose={() => {}}
              />
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>

      {/* 3 — OrderDrawerNoteComposer */}
      <SectionFrame
        num="03"
        title="OrderDrawerNoteComposer"
        file="/admin/orders/_components/OrderDrawerNoteComposer.tsx"
        codeFile="OrderDrawerNoteComposer.tsx"
        notes={
          <>
            Sekcja między photo gridem a <code>OrderDrawerNotes</code>. Textarea + select miejsca. "dodaj wpis" disabled gdy notatka pusta i miejsce niezmienione (no-op). Mapuje backendowe kody błędów na polskie copy.
          </>
        }
      >
        <PreviewPane>
          <div className="drawer-shell">
            <div className="t-stencil" style={{ fontSize: 14, marginBottom: 8 }}>DR-2026-0042 · zdjęcia</div>
            <div className="photos">
              <div className="ph-tile" /><div className="ph-tile" /><div className="ph-tile" /><div className="ph-tile" />
            </div>

            <OrderDrawerNoteComposer
              currentLocation="półka 1"
              locations={SAMPLE_LOCATIONS.filter((l) => l.active)}
            />

            <div style={{ marginTop: 16 }}>
              <div
                className="t-mono"
                style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--admin-mute, #6b6960)", marginBottom: 4 }}
              >
                Historia
              </div>
              <div className="drawer-history-row">
                <span className="dot" />
                <div style={{ flex: 1 }}>
                  <div>przeniesione na suszarkę po czyszczeniu.</div>
                  <div style={{ marginTop: 6 }}>
                    <LocationMoveChip from="półka 1" to="suszarka" />
                  </div>
                </div>
                <span className="when">12 maj · 14:08</span>
              </div>
              <div className="drawer-history-row">
                <span className="dot" />
                <div style={{ flex: 1 }}>
                  <span>Status zmieniony: <strong>przyjęte → w realizacji</strong></span>
                </div>
                <span className="when">12 maj · 09:20</span>
              </div>
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>

      {/* 4 — LocationMoveChip */}
      <SectionFrame
        num="04"
        title="LocationMoveChip"
        file="/admin/orders/_components/_LocationMoveChip.tsx"
        codeFile="_LocationMoveChip.tsx"
        notes={
          <>
            Inline chip wewnątrz wpisu w <code>OrderDrawerNotes</code>. Trzy stany: <em>from + to</em>, <em>tylko to</em>, oraz <em>oba null</em> (renderuje nic). Strzałka <code>→</code> ma <code>aria-hidden</code>.
          </>
        }
      >
        <PreviewPane>
          <div className="variant-row">
            <div>
              <div className="variant-label">— from + to (przeniesienie) —</div>
              <LocationMoveChip from="półka 1" to="suszarka" />
            </div>
            <div>
              <div className="variant-label">— tylko to (pierwsze umieszczenie) —</div>
              <LocationMoveChip from={null} to="półka 3" />
            </div>
            <div>
              <div className="variant-label">— oba null —</div>
              <span className="t-mono" style={{ fontSize: 11, color: "var(--admin-mute, #6b6960)" }}>
                <code>return null</code> · element jest pusty
              </span>
            </div>
            <div>
              <div className="variant-label">— w kontekście wpisu —</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", maxWidth: 460 }}>
                <span style={{ width: 8, height: 8, background: "var(--ink)", marginTop: 7 }} />
                <div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>klient zadzwonił, prosi o szybsze – dałem na suszarkę.</div>
                  <LocationMoveChip from="szuflada" to="suszarka" />
                </div>
              </div>
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>

      {/* 5 — OrderDrawerHeader patch */}
      <SectionFrame
        num="05"
        title="OrderDrawerHeader · patch"
        file="/admin/orders/_components/OrderDrawerHeader.tsx"
        codeFile="OrderDrawerHeader.patch.tsx"
        codeLabel="OrderDrawerHeader.patch.tsx"
        notes={
          <>
            Dodaje opcjonalny prop <code>location</code> oraz acid-pill (📍 + nazwa) obok istniejącego status pill. Pill nie ma akcji na razie. <code>aria-label="Aktualne miejsce"</code>.
          </>
        }
      >
        <PreviewPane>
          <div className="variant-row">
            <div>
              <div className="variant-label">— z miejscem —</div>
              <DrawerHeaderMock location="suszarka" />
            </div>
            <div>
              <div className="variant-label">— bez miejsca (pill ukryty) —</div>
              <DrawerHeaderMock location={null} />
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>

      {/* 6 — AdminSidebarNav patch */}
      <SectionFrame
        num="06"
        title="AdminSidebarNav · patch"
        file="/components/admin/AdminSidebarNav.tsx"
        codeFile="AdminSidebarNav.patch.tsx"
        codeLabel="AdminSidebarNav.patch.tsx"
        notes={
          <>
            Nowa sekcja <strong>KONFIGURACJA</strong> po <strong>SKLEP</strong>. Jeden link <em>Miejsca</em> → <code>/admin/settings/miejsca</code>. Active-state: acid border-left + acid tint tła (już istniejące <code>.sb-link.active</code>).
          </>
        }
      >
        <PreviewPane>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div>
              <div className="variant-label">— pathname inny (idle) —</div>
              <SidebarMock activePath="/admin/orders" />
            </div>
            <div>
              <div className="variant-label">— pathname = /admin/settings/miejsca (active) —</div>
              <SidebarMock activePath="/admin/settings/miejsca" />
            </div>
          </div>
        </PreviewPane>
      </SectionFrame>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
