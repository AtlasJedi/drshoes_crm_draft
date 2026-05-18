/* /admin/muzyka v2 — three-column command center */

const PLAYLISTS = [
  { id: "ranek",   sw: "R",  c: "c-acid",  name: "Pracownia · ranek", count: 18 },
  { id: "lofi",    sw: "L",  c: "",        name: "Lo-fi & szlif",     count: 24 },
  { id: "klasycy", sw: "K",  c: "c-pink",  name: "Klasycy szewstwa",  count: 41 },
  { id: "piatek",  sw: "P",  c: "c-orange",name: "Piątek 18:00",      count: 12 },
];

const SEARCH_RESULTS = [
  { id: 1, title: "Bonobo — Black Sands", channel: "Ninja Tune · Official",   dur: "5:21" },
  { id: 2, title: "Hania Rani — Esja",     channel: "Gondwana Records",        dur: "4:11" },
  { id: 3, title: "Nils Frahm — Says (Official Audio)", channel: "Erased Tapes Records", dur: "8:18" },
  { id: 4, title: "Floating Points — Birth4000", channel: "Pluto Records",     dur: "6:02" },
  { id: 5, title: "Khruangbin — Maria También", channel: "Dead Oceans",        dur: "4:33" },
  { id: 6, title: "Tycho — Awake", channel: "Ghostly International",            dur: "5:08" },
];

const QUEUE = [
  { id: 1, title: "Nils Frahm — Says", channel: "Erased Tapes Records" },
  { id: 2, title: "Bonobo — Cirrus",    channel: "Ninja Tune" },
  { id: 3, title: "Hania Rani — Esja",  channel: "Gondwana Records" },
];

const CURRENT_TRACK = {
  title: "Khruangbin — Maria También",
  channel: "Dead Oceans · Official Music Video",
  t: "1:42", dur: "4:33", progress: 0.38,
};

/* ─── PLAYLISTS column ─── */
function PlaylistsCol({ playlists, activeId, empty }) {
  return (
    <div className="col">
      <div className="col-h">
        <h2>Playlisty</h2>
        <button className="btn-plus"><span style={{ display: "flex" }}>{ICO.plus}</span>Nowa</button>
      </div>
      <div className="col-body">
        {empty ? (
          <div className="empty" style={{ paddingTop: 56 }}>
            <div className="stencil-blob">Pusto</div>
            <div className="lbl">Brak playlist</div>
            <div className="hint">Zapisz kolejkę albo dodaj utwory z wyszukiwarki by stworzyć pierwszą.</div>
          </div>
        ) : (
          playlists.map(p => (
            <div key={p.id} className={"pl-row " + p.c + (p.id === activeId ? " active" : "")}>
              {p.id === activeId && <span className="now" />}
              <span className="sw">{p.sw}</span>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{p.name}</div>
                <span className="ct">{p.count} utworów · wsp.</span>
              </div>
              <div className="acts">
                <button className="ico-btn load" title="Załaduj do kolejki">{ICO.download}</button>
                <button className="ico-btn" title="Usuń">{ICO.trash}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── SEARCH column ─── */
function SearchCol({ results, query, dropdownOn }) {
  if (!results || results.length === 0) {
    return (
      <div className="col">
        <div className="srch-bar">
          <div className="srch-input">
            <span style={{ color: "var(--mute)", display: "flex" }}>{ICO.search}</span>
            <input value={query || ""} placeholder="Wpisz tytuł utworu albo artystę…" readOnly />
            <span className="yt-pill">YT</span>
          </div>
        </div>
        <div className="empty-mid">
          <div className="big-stencil">TISZA</div>
          <div className="tape-tag">cisza · ничего не играет</div>
          <div className="lead">Zacznij od wyszukiwania albo załaduj playlistę.</div>
          <div className="sub">Wpisz tytuł utworu, nazwę artysty albo wklej link YouTube. Wyniki pojawią się tutaj — dodaj prosto do kolejki albo do playlisty pracowni.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="col">
      <div className="srch-bar">
        <div className="srch-input">
          <span style={{ color: "var(--mute)", display: "flex" }}>{ICO.search}</span>
          <input value={query} placeholder="Wpisz tytuł utworu albo artystę…" readOnly />
          <span className="yt-pill">YT</span>
        </div>
      </div>
      <div className="srch-meta">
        <span>Wyniki YouTube · top 6</span>
        <span>↻ odśwież</span>
      </div>
      <div className="results">
        {results.map(r => (
          <div key={r.id} className="res">
            <div className="thumb">
              <div className="play-tri"></div>
              <span className="dur">{r.dur}</span>
            </div>
            <div className="meta">
              <div className="ti">{r.title}</div>
              <div className="ch">{r.channel}</div>
            </div>
            <div style={{ position: "relative" }}>
              <button className="add">
                Dodaj <span className="caret"></span>
              </button>
              {dropdownOn === r.id && <AddDropdown />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddDropdown() {
  return (
    <div className="dd">
      <div className="dd-h">Dodaj do playlisty</div>
      <div className="dd-list">
        <button className="dd-row" style={{ background: "rgba(216,255,58,.12)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mute)", letterSpacing: ".14em" }}>⊕</span>
          <span className="nm" style={{ color: "var(--ink)" }}>Kolejka</span>
          <span className="ct">dodaj do następnych</span>
        </button>
        {PLAYLISTS.map(p => (
          <button key={p.id} className={"dd-row " + p.c}>
            <span className="sw"></span>
            <span className="nm">{p.name}</span>
            <span className="ct">{p.count}</span>
          </button>
        ))}
      </div>
      <button className="dd-new">
        <span className="plus">{ICO.plus}</span>
        Nowa playlista…
      </button>
    </div>
  );
}

/* ─── QUEUE column ─── */
function QueueCol({ current, queue, empty }) {
  return (
    <div className="col">
      <div className="col-h">
        <h2>Teraz gra</h2>
        <span className="count">kolejka · {queue ? queue.length : 0}</span>
      </div>
      {empty ? (
        <div className="col-body">
          <div className="empty" style={{ paddingTop: 56 }}>
            <div className="stencil-blob">·· ··</div>
            <div className="lbl">Nic nie gra</div>
            <div className="hint">Wybierz utwór z wyszukiwarki albo załaduj playlistę.</div>
          </div>
        </div>
      ) : (
        <>
          {current ? (
            <div className="now-card">
              <div className="row">
                <div className="nt"></div>
                <div className="meta">
                  <div className="ti">{current.title}</div>
                  <div className="ch">{current.channel}</div>
                </div>
                <button className="add-now" title="Dodaj do playlisty">{ICO.plus}</button>
              </div>
              <div className="bars" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          ) : null}
          <div style={{
            padding: "10px 18px 4px",
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--mute)", letterSpacing: ".14em",
            textTransform: "uppercase",
            borderBottom: "1px solid var(--line-2)",
          }}>Kolejka — następne {queue.length}</div>
          <div className="col-body" style={{ flex: "0 1 auto" }}>
            <div className="q-list">
              {queue.map(t => (
                <div key={t.id} className="q-row">
                  <span className="drag">{ICO.drag}</span>
                  <div className="qt"></div>
                  <div className="meta">
                    <div className="ti">{t.title}</div>
                    <div className="ch">{t.channel}</div>
                  </div>
                  <button className="x" title="Usuń z kolejki">{ICO.x}</button>
                </div>
              ))}
            </div>
          </div>
          <div className="q-save">
            <button className="btn-full">
              <span style={{ display: "flex" }}>{ICO.plus}</span>
              Zapisz kolejkę jako playlistę
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MuzykaPage({ state }) {
  // state: "empty" | "full" | "dropdown"
  if (state === "empty") {
    return (
      <div className="cmd">
        <PlaylistsCol playlists={[]} empty />
        <SearchCol results={[]} query="" />
        <QueueCol queue={[]} empty />
      </div>
    );
  }
  return (
    <div className="cmd">
      <PlaylistsCol playlists={PLAYLISTS} activeId="ranek" />
      <SearchCol
        results={SEARCH_RESULTS}
        query="bonobo"
        dropdownOn={state === "dropdown" ? 1 : null}
      />
      <QueueCol current={CURRENT_TRACK} queue={QUEUE} />
    </div>
  );
}

Object.assign(window, { MuzykaPage, PLAYLISTS, SEARCH_RESULTS, QUEUE, CURRENT_TRACK });
