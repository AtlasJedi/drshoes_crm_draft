// Landing page for Dr Shoes
const { Tape, Stamp, Sticker, PhImg, Splatter, SprayCanIcon, ShoeIcon, JacketIcon, BrushIcon, I, DrShoesMark, PRODUCTS, NEWS } = window.DrShoes;

function StickyNav() {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "var(--ink)", color: "var(--paper)",
      borderBottom: "3px solid var(--acid)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DrShoesMark size={0.42} color="var(--paper)" accent="var(--acid)" />
        </div>
        <nav style={{ display: "flex", gap: 30, alignItems: "center", fontFamily: "var(--font-stencil)", fontSize: 14, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}>
          <a href="#aktualnosci" style={{ color: "var(--paper)", textDecoration: "none" }}>Aktualności</a>
          <a href="#sklep" style={{ color: "var(--paper)", textDecoration: "none" }}>Sklep</a>
          <a href="#kontakt" style={{ color: "var(--paper)", textDecoration: "none" }}>Kontakt</a>
          <a className="btn btn-acid btn-sm" href="#zamow"><SprayCanIcon size={14} /> Zamów</a>
        </nav>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "var(--ink)", color: "var(--paper)" }}>
      {/* full-bleed work image */}
      <div style={{ position: "absolute", inset: 0 }}>
        <PhImg dark label="HERO REEL · workshop b-roll · custom AF1 closeup" style={{ width: "100%", height: "100%", border: "none" }} />
      </div>
      <Splatter color="var(--acid)" size={420} style={{ top: -80, right: -60, opacity: 0.85 }} />
      <Splatter color="var(--pink)" size={280} style={{ bottom: -40, left: 120, opacity: 0.65 }} />

      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "120px 28px 110px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
          <Tape>est. 2014 · Wrocław</Tape>
          <Tape color="pink" angle={1.5}>pracownia · nie sklep</Tape>
        </div>
        <h1 className="t-display" style={{ fontSize: "clamp(96px, 14vw, 220px)", color: "var(--paper)", margin: 0 }}>
          Dr<span style={{ color: "var(--acid)", WebkitTextStroke: "3px var(--paper)" }}>.</span>Shoes
        </h1>
        <div className="t-tag" style={{ fontSize: 36, color: "var(--acid)", transform: "rotate(-2deg)", marginTop: -6, marginLeft: 8 }}>
          customy · naprawy · malowanie — robione ręcznie
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 44, flexWrap: "wrap" }}>
          <a className="btn btn-acid" href="#zamow"><SprayCanIcon size={18} /> Zamów custom</a>
          <a className="btn btn-paper" href="#zamow">Oddaj buty do naprawy</a>
        </div>

        <div style={{ position: "absolute", right: 28, bottom: 30, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <Sticker><span style={{ width: 6, height: 6, background: "var(--acid)", borderRadius: 999 }} /> @dr_shoes · 38.4k</Sticker>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--paper)", opacity: 0.55, letterSpacing: ".15em" }}>↓ scroll</div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const items = [
    { Icon: ShoeIcon, label: "Naprawa butów", tag: "01", img: "naprawa · vibram doszyty", color: "var(--acid)" },
    { Icon: BrushIcon, label: "Custom malowanie butów", tag: "02", img: "custom · AF1 bandana", color: "var(--pink)" },
    { Icon: JacketIcon, label: "Custom kurtki", tag: "03", img: "custom · Carhartt back", color: "var(--blue)" },
  ];
  return (
    <section style={{ padding: "100px 28px 120px", background: "var(--paper)", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <div>
            <Tape color="paper" angle={-2}>co robimy</Tape>
            <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>Trzy <span style={{ color: "var(--pink)" }}>rzeczy</span>.<br />Robimy je dobrze.</h2>
          </div>
          <div className="t-mono" style={{ fontSize: 13, maxWidth: 360, color: "rgba(0,0,0,0.7)", lineHeight: 1.5 }}>
            Każda para to inna historia. Przed wyceną pisz na DM lub wypełnij formularz — odpowiadamy w 24h.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {items.map(({ Icon, label, tag, img, color }) => (
            <a key={tag} href="#zamow" className="zoom-card" style={{
              position: "relative", border: "3px solid var(--ink)", aspectRatio: "3/4", overflow: "hidden",
              background: "var(--paper-2)", textDecoration: "none", color: "var(--ink)",
              boxShadow: "8px 8px 0 var(--ink)",
            }}>
              <PhImg dark label={img} style={{ width: "100%", height: "100%", border: "none" }} />
              <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "var(--font-display)", fontSize: 64, color, lineHeight: 0.8, mixBlendMode: "screen" }}>{tag}</div>
              <div style={{ position: "absolute", left: 14, right: 14, bottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <Tape color={color === "var(--pink)" ? "pink" : color === "var(--blue)" ? "blue" : "acid"} angle={-2}>{label}</Tape>
                </div>
                <div style={{ background: "var(--paper)", padding: 8, border: "2px solid var(--ink)", color: "var(--ink)" }}>
                  <Icon size={26} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function News() {
  const main = NEWS[0];
  const rest = NEWS.slice(1);
  return (
    <section id="aktualnosci" style={{ padding: "100px 28px", background: "var(--ink)", color: "var(--paper)", position: "relative", overflow: "hidden" }}>
      <Splatter color="var(--pink)" size={300} style={{ top: -60, left: -40, opacity: 0.4 }} />
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Tape color="acid">aktualności</Tape>
            <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>Co się <span style={{ color: "var(--acid)" }}>dzieje</span></h2>
          </div>
          <a className="btn btn-acid btn-sm" href="#">Wszystkie wpisy {I.arrow}</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 22 }}>
          <article className="zoom-card spray-frame pink" style={{ background: "var(--paper)", color: "var(--ink)", border: "none", padding: 0, gridRow: "span 2" }}>
            <div style={{ aspectRatio: "16/10", overflow: "hidden", borderBottom: "3px solid var(--ink)" }}>
              <PhImg label="news cover · workshop fresh paint" style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
            <div style={{ padding: 26, position: "relative" }}>
              <div style={{ position: "absolute", top: -22, right: 24 }}>
                <Stamp color="pink" angle={3}>świeże</Stamp>
              </div>
              <div className="t-mono" style={{ fontSize: 12, letterSpacing: ".1em", color: "rgba(0,0,0,0.55)" }}>{main.date} · pracownia</div>
              <h3 className="t-display" style={{ fontSize: 38, margin: "10px 0 12px" }}>{main.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(0,0,0,0.78)", margin: 0 }}>{main.excerpt}</p>
              <div style={{ marginTop: 18 }}>
                <a className="btn btn-paper btn-sm" href="#">czytaj {I.arrow}</a>
              </div>
            </div>
          </article>

          {rest.map((n, i) => (
            <article key={i} className="zoom-card" style={{ background: "var(--paper)", color: "var(--ink)", border: "3px solid var(--paper)" }}>
              <div style={{ aspectRatio: "4/3", overflow: "hidden", borderBottom: "3px solid var(--ink)" }}>
                <PhImg label={`news · ${i+1}`} style={{ width: "100%", height: "100%", border: "none" }} />
              </div>
              <div style={{ padding: 18 }}>
                <div className="t-mono" style={{ fontSize: 11, letterSpacing: ".1em", color: "rgba(0,0,0,0.55)" }}>{n.date}</div>
                <h4 className="t-display" style={{ fontSize: 22, margin: "8px 0 8px", lineHeight: 1 }}>{n.title}</h4>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,0.7)", margin: 0 }}>{n.excerpt}</p>
                <a className="t-mono" href="#" style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--ink)", borderBottom: "2px solid var(--acid)" }}>czytaj →</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sklep() {
  const [filter, setFilter] = useState("wszystkie");
  const filters = [
    { k: "wszystkie", label: "Wszystkie" },
    { k: "Nike", label: "Nike" },
    { k: "Vans", label: "Vans" },
    { k: "Jordan", label: "Jordan" },
    { k: "Dr. Martens", label: "Dr. Martens" },
  ];
  const visible = filter === "wszystkie" ? PRODUCTS : PRODUCTS.filter(p => p.brand === filter);
  const stampFor = (s) => s === "dostępne" ? <Stamp color="green">dostępne</Stamp>
    : s === "zarezerwowane" ? <Stamp color="pink">rezerwacja</Stamp>
    : <Stamp color="ink" angle={-3}>sprzedane</Stamp>;

  return (
    <section id="sklep" style={{ padding: "100px 28px", background: "var(--paper)", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <Tape color="pink">sklep</Tape>
            <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>Pary <span style={{ color: "var(--blue)" }}>do wzięcia</span></h2>
          </div>
          <div className="t-mono" style={{ fontSize: 12, maxWidth: 320, color: "rgba(0,0,0,0.65)", lineHeight: 1.5, padding: "10px 14px", background: "var(--paper-2)", border: "2px solid var(--ink)" }}>
            ⚠ Płatność i odbiór wyłącznie na miejscu w pracowni. Rezerwacja jest niezobowiązująca przez 48h.
          </div>
        </div>

        {/* filters as taped paper labels */}
        <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          <span className="t-mono" style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(0,0,0,0.55)" }}>filtruj:</span>
          {filters.map((f, i) => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: "6px 16px",
              background: filter === f.k ? "var(--acid)" : "var(--paper)",
              border: "2px solid var(--ink)",
              fontFamily: "var(--font-mono)",
              fontWeight: 700, fontSize: 12,
              cursor: "pointer",
              transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)`,
              boxShadow: filter === f.k ? "3px 3px 0 var(--ink)" : "none",
              textTransform: "uppercase", letterSpacing: ".05em",
            }}>{f.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <select className="t-mono" style={{ padding: "6px 10px", border: "2px solid var(--ink)", background: "var(--paper)", fontWeight: 700, fontSize: 12 }}>
            <option>rozmiar: każdy</option><option>EU 40</option><option>EU 41</option><option>EU 42</option><option>EU 43</option><option>EU 44</option>
          </select>
          <select className="t-mono" style={{ padding: "6px 10px", border: "2px solid var(--ink)", background: "var(--paper)", fontWeight: 700, fontSize: 12 }}>
            <option>cena: każda</option><option>do 500 zł</option><option>500–1000 zł</option><option>1000+ zł</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {visible.map((p, i) => (
            <div key={p.id} className="zoom-card" style={{
              background: "var(--paper)",
              border: "3px solid var(--ink)",
              boxShadow: "6px 6px 0 var(--ink)",
              position: "relative",
            }}>
              <div style={{ aspectRatio: "1/1", overflow: "hidden", borderBottom: "3px solid var(--ink)", position: "relative" }}>
                <PhImg label={`${p.brand}\n${p.name}`} style={{ width: "100%", height: "100%", border: "none" }} />
                <div style={{ position: "absolute", top: 14, left: 14 }}>{stampFor(p.status)}</div>
                <div style={{ position: "absolute", top: 14, right: 14, padding: "4px 8px", background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
                  #{String(i+1).padStart(2,"0")}
                </div>
              </div>
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: ".1em" }}>{p.brand} · {p.size}</div>
                <h4 className="t-display" style={{ fontSize: 24, margin: 0, lineHeight: 1 }}>{p.name}</h4>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <div className="t-display" style={{ fontSize: 30 }}>{p.price}</div>
                  {p.status === "dostępne" ? (
                    <button className="btn btn-acid btn-sm">Zarezerwuj</button>
                  ) : p.status === "zarezerwowane" ? (
                    <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.55 }}>Lista oczekujących</button>
                  ) : (
                    <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>—</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Kontakt() {
  return (
    <section id="kontakt" style={{ padding: "100px 28px", background: "var(--paper-2)", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 36 }}>
          <Tape color="blue" angle={-1.5}>kontakt</Tape>
          <h2 className="t-display" style={{ fontSize: 96, margin: "16px 0 0" }}>Wpadnij <span style={{ color: "var(--pink)" }}>do nas</span></h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {/* sticker board */}
          <div style={{
            background: "var(--paper)", border: "3px solid var(--ink)", padding: 28,
            position: "relative", boxShadow: "8px 8px 0 var(--ink)",
            backgroundImage:
              "radial-gradient(rgba(0,0,0,0.05) 1.2px, transparent 1.6px)",
            backgroundSize: "12px 12px",
          }}>
            <div style={{ position: "absolute", top: -16, left: 30 }}><Tape color="paper">pracownia</Tape></div>
            <div style={{ position: "absolute", top: 18, right: 18, transform: "rotate(8deg)" }}><Stamp color="pink">@dr_shoes</Stamp></div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px 18px", marginTop: 18, fontFamily: "var(--font-body)" }}>
              <div style={{ color: "var(--pink)" }}>{I.pin}</div>
              <div>
                <div className="t-display" style={{ fontSize: 22, lineHeight: 1 }}>ul. Włodkowica 14/2</div>
                <div className="t-mono" style={{ fontSize: 13, color: "rgba(0,0,0,0.65)", marginTop: 4 }}>50-072 Wrocław · piętro 2</div>
              </div>

              <div style={{ color: "var(--blue)" }}>{I.clock}</div>
              <div>
                <div className="t-mono" style={{ fontSize: 13, fontWeight: 700 }}>Pn–Pt 11:00 — 19:00</div>
                <div className="t-mono" style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>Sob 12:00 — 16:00 · Nd zamknięte</div>
              </div>

              <div style={{ color: "var(--ink)" }}>{I.phone}</div>
              <div className="t-display" style={{ fontSize: 26 }}>+48 794 220 118</div>

              <div style={{ color: "var(--ink)" }}>{I.mail}</div>
              <div className="t-mono" style={{ fontSize: 14 }}>siema@drshoes.pl</div>

              <div style={{ color: "var(--pink)" }}>{I.ig}</div>
              <div className="t-mono" style={{ fontSize: 14 }}>@dr_shoes · 38.4k followers</div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px dashed rgba(0,0,0,0.3)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Sticker angle={-2}>spawn point</Sticker>
              <Sticker angle={1.5} style={{ background: "var(--acid)" }}>RTV ok</Sticker>
              <Sticker angle={-1}>kawa za free</Sticker>
            </div>
          </div>

          {/* map + contact form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ position: "relative", aspectRatio: "16/9", border: "3px solid var(--ink)", boxShadow: "6px 6px 0 var(--pink), 6px 6px 0 1.5px var(--ink)", overflow: "hidden", background: "#dde7d8" }}>
              {/* fake map */}
              <svg width="100%" height="100%" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
                <rect width="800" height="450" fill="#e6ddc4" />
                {/* roads */}
                <g stroke="#d0c39e" strokeWidth="14" fill="none">
                  <path d="M0 80 L800 110" /><path d="M0 220 L800 240" /><path d="M0 360 L800 340" />
                  <path d="M120 0 L150 450" /><path d="M380 0 L420 450" /><path d="M620 0 L640 450" />
                </g>
                <g stroke="#dcd3b2" strokeWidth="6" fill="none">
                  <path d="M0 150 L800 165" /><path d="M0 290 L800 280" />
                  <path d="M250 0 L260 450" /><path d="M520 0 L530 450" />
                </g>
                {/* blocks */}
                <g fill="#cdbf95" opacity="0.55">
                  <rect x="170" y="125" width="80" height="40" /><rect x="280" y="125" width="80" height="40" />
                  <rect x="170" y="265" width="80" height="40" /><rect x="280" y="180" width="80" height="40" />
                  <rect x="440" y="180" width="80" height="40" /><rect x="550" y="125" width="60" height="40" />
                  <rect x="660" y="265" width="80" height="40" /><rect x="440" y="265" width="80" height="40" />
                </g>
                {/* river hint */}
                <path d="M0 380 Q 200 360 400 390 T 800 380 L800 450 L0 450 Z" fill="#bcd3df" opacity="0.7" />
              </svg>
              <div style={{ position: "absolute", left: "44%", top: "44%", transform: "translate(-50%, -100%)" }}>
                <div style={{ width: 38, height: 38, background: "var(--pink)", border: "3px solid var(--ink)", borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", boxShadow: "3px 3px 0 var(--ink)" }}>
                  <span style={{ transform: "rotate(45deg)", fontSize: 18 }}>×</span>
                </div>
              </div>
              <Splatter color="var(--acid)" size={120} style={{ top: 10, right: 10, opacity: 0.85 }} />
              <div style={{ position: "absolute", left: 14, bottom: 14 }}><Tape color="paper">tutaj</Tape></div>
            </div>

            <form className="admin-card" style={{ padding: 22, background: "var(--paper)", border: "3px solid var(--ink)", boxShadow: "6px 6px 0 var(--ink)", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={(e) => e.preventDefault()}>
              <div className="t-display" style={{ fontSize: 28, lineHeight: 1 }}>Napisz do nas</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field"><label>Imię</label><input placeholder="np. Filip" /></div>
                <div className="field"><label>Email</label><input placeholder="ty@przyklad.pl" /></div>
              </div>
              <div className="field"><label>Wiadomość</label><textarea rows={3} placeholder="Co masz w głowie? Custom, naprawa, projekt?" /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" className="btn btn-paper btn-sm">{I.paperclip} dodaj zdjęcie</button>
                <button type="submit" className="btn btn-acid btn-sm">wyślij {I.send}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "var(--ink)", color: "var(--paper)", padding: "60px 28px 30px", position: "relative" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 28, alignItems: "flex-start" }}>
          <div>
            <DrShoesMark size={0.6} color="var(--paper)" accent="var(--acid)" />
            <p className="t-mono" style={{ fontSize: 12, opacity: 0.65, marginTop: 14, maxWidth: 360, lineHeight: 1.6 }}>
              Pracownia szewska + studio customizacji. Robimy ręcznie od 2014.
            </p>
          </div>
          <div>
            <div className="t-stencil" style={{ fontSize: 12, color: "var(--acid)", marginBottom: 10 }}>Pracownia</div>
            <div className="t-mono" style={{ fontSize: 13, lineHeight: 1.7 }}>
              ul. Włodkowica 14/2<br />50-072 Wrocław<br />+48 794 220 118
            </div>
          </div>
          <div>
            <div className="t-stencil" style={{ fontSize: 12, color: "var(--acid)", marginBottom: 10 }}>Linki</div>
            <div className="t-mono" style={{ fontSize: 13, lineHeight: 1.9 }}>
              <a href="#aktualnosci" style={{ color: "var(--paper)" }}>Aktualności</a><br />
              <a href="#sklep" style={{ color: "var(--paper)" }}>Sklep</a><br />
              <a href="#kontakt" style={{ color: "var(--paper)" }}>Kontakt</a><br />
              <a href="admin.html" style={{ color: "var(--paper)" }}>Panel pracowni →</a>
            </div>
          </div>
          <div>
            <div className="t-stencil" style={{ fontSize: 12, color: "var(--acid)", marginBottom: 10 }}>Social</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <a href="#" style={{ color: "var(--paper)", border: "2px solid var(--paper)", padding: 8, display: "flex" }}>{I.ig}</a>
              <a href="#" style={{ color: "var(--paper)", border: "2px solid var(--paper)", padding: 8, display: "flex" }}>{I.mail}</a>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 50, paddingTop: 22, borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
          <div className="t-mono" style={{ fontSize: 11, opacity: 0.45 }}>© 2026 Dr Shoes — wszystkie prawa zastrzeżone — robione w 🇵🇱</div>
          <button className="btn btn-acid btn-sm" style={{ borderRadius: "50%", width: 56, height: 56, padding: 0, justifyContent: "center" }}><SprayCanIcon size={22} /></button>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div data-screen-label="Landing — full page">
      <StickyNav />
      <Hero />
      <Services />
      <News />
      <Sklep />
      <Kontakt />
      <Footer />
    </div>
  );
}

window.Landing = Landing;
