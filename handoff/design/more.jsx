// Mobile landing variant + Klienci admin
const { Tape, Stamp, Sticker, PhImg, Pill, Splatter, SprayCanIcon, ShoeIcon, BrushIcon, JacketIcon, I, DrShoesMark, PRODUCTS, NEWS, CLIENTS } = window.DrShoes;

function MobileLanding() {
  return (
    <div data-screen-label="Landing — mobile" style={{ background: "var(--paper)", minHeight: "100%", overflow: "hidden" }}>
      {/* status bar mock */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, background: "var(--ink)", color: "var(--paper)" }}>
        <span>9:41</span>
        <span>● ● ● ●</span>
      </div>

      {/* nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "var(--ink)", color: "var(--paper)", borderBottom: "3px solid var(--acid)" }}>
        <DrShoesMark size={0.32} color="var(--paper)" accent="var(--acid)" />
        <button style={{ background: "var(--acid)", color: "var(--ink)", border: "2px solid var(--paper)", padding: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 2, background: "var(--ink)" }} />
          <span style={{ width: 16, height: 2, background: "var(--ink)" }} />
        </button>
      </div>

      {/* hero */}
      <section style={{ position: "relative", background: "var(--ink)", color: "var(--paper)", padding: "32px 18px 50px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
          <PhImg dark label="" style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
        <Splatter color="var(--acid)" size={220} style={{ top: -60, right: -40, opacity: 0.85 }} />
        <div style={{ position: "relative" }}>
          <Tape>est. 2014 · WRO</Tape>
          <h1 className="t-display" style={{ fontSize: 88, lineHeight: 0.85, margin: "16px 0 4px" }}>
            Dr<span style={{ color: "var(--acid)", WebkitTextStroke: "2px var(--paper)" }}>.</span>Shoes
          </h1>
          <div className="t-tag" style={{ fontSize: 22, color: "var(--acid)", transform: "rotate(-2deg)" }}>
            customy · naprawy · malowanie
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28 }}>
            <a className="btn btn-acid btn-sm" style={{ justifyContent: "center" }}><SprayCanIcon size={14} /> Zamów custom</a>
            <a className="btn btn-paper btn-sm" style={{ justifyContent: "center" }}>Oddaj buty do naprawy</a>
          </div>
        </div>
      </section>

      {/* services */}
      <section style={{ padding: "30px 18px", background: "var(--paper)" }}>
        <Tape color="paper" angle={-2}>co robimy</Tape>
        <h2 className="t-display" style={{ fontSize: 44, margin: "10px 0 16px", lineHeight: 0.9 }}>Trzy <span style={{ color: "var(--pink)" }}>rzeczy</span>.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { Icon: ShoeIcon, label: "Naprawa butów", n: "01", c: "var(--acid)" },
            { Icon: BrushIcon, label: "Custom buty", n: "02", c: "var(--pink)" },
            { Icon: JacketIcon, label: "Custom kurtki", n: "03", c: "var(--blue)" },
          ].map(s => (
            <div key={s.n} style={{ position: "relative", aspectRatio: "16/9", border: "3px solid var(--ink)", overflow: "hidden", boxShadow: "5px 5px 0 var(--ink)" }}>
              <PhImg dark label="" style={{ width: "100%", height: "100%", border: "none" }} />
              <div style={{ position: "absolute", top: 8, left: 10, fontFamily: "var(--font-display)", fontSize: 44, color: s.c, lineHeight: 0.8, mixBlendMode: "screen" }}>{s.n}</div>
              <div style={{ position: "absolute", left: 10, bottom: 10 }}>
                <Tape color={s.c === "var(--pink)" ? "pink" : s.c === "var(--blue)" ? "blue" : "acid"}>{s.label}</Tape>
              </div>
              <div style={{ position: "absolute", right: 10, bottom: 10, background: "var(--paper)", padding: 6, border: "2px solid var(--ink)" }}><s.Icon size={20} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* news */}
      <section style={{ background: "var(--ink)", color: "var(--paper)", padding: "30px 18px" }}>
        <Tape color="acid">aktualności</Tape>
        <h2 className="t-display" style={{ fontSize: 44, margin: "10px 0 16px", lineHeight: 0.9 }}>Co się <span style={{ color: "var(--acid)" }}>dzieje</span></h2>
        <div className="spray-frame pink" style={{ background: "var(--paper)", color: "var(--ink)" }}>
          <div style={{ aspectRatio: "16/10" }}><PhImg label="news cover" style={{ width: "100%", height: "100%", border: "none" }} /></div>
          <div style={{ padding: 16 }}>
            <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>{NEWS[0].date} · pracownia</div>
            <h3 className="t-display" style={{ fontSize: 24, margin: "6px 0 8px" }}>{NEWS[0].title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: "rgba(0,0,0,0.78)" }}>{NEWS[0].excerpt}</p>
          </div>
        </div>
      </section>

      {/* sklep */}
      <section style={{ padding: "30px 18px" }}>
        <Tape color="pink">sklep</Tape>
        <h2 className="t-display" style={{ fontSize: 44, margin: "10px 0 16px", lineHeight: 0.9 }}>Pary <span style={{ color: "var(--blue)" }}>do wzięcia</span></h2>
        <div className="t-mono" style={{ fontSize: 11, padding: "8px 10px", background: "var(--paper-2)", border: "2px solid var(--ink)", marginBottom: 14, lineHeight: 1.4 }}>
          ⚠ Płatność i odbiór wyłącznie na miejscu w pracowni.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PRODUCTS.slice(0, 4).map(p => (
            <div key={p.id} style={{ background: "var(--paper)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)" }}>
              <div style={{ position: "relative", aspectRatio: "1", borderBottom: "2px solid var(--ink)" }}>
                <PhImg label="" style={{ width: "100%", height: "100%", border: "none" }} />
                <div style={{ position: "absolute", top: 6, left: 6 }}>
                  {p.status === "dostępne" ? <Stamp color="green">ok</Stamp> : p.status === "zarezerwowane" ? <Stamp color="pink">rez.</Stamp> : <Stamp color="ink">x</Stamp>}
                </div>
              </div>
              <div style={{ padding: 10 }}>
                <div className="t-mono" style={{ fontSize: 9, color: "rgba(0,0,0,0.55)", letterSpacing: ".08em" }}>{p.brand} · {p.size}</div>
                <div className="t-display" style={{ fontSize: 14, lineHeight: 1, marginTop: 4 }}>{p.name}</div>
                <div className="t-display" style={{ fontSize: 18, marginTop: 6 }}>{p.price}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* contact preview */}
      <section style={{ padding: "30px 18px", background: "var(--paper-2)" }}>
        <Tape color="blue">kontakt</Tape>
        <h2 className="t-display" style={{ fontSize: 44, margin: "10px 0 14px", lineHeight: 0.9 }}>Wpadnij <span style={{ color: "var(--pink)" }}>do nas</span></h2>
        <div style={{ background: "var(--paper)", border: "3px solid var(--ink)", padding: 18, boxShadow: "5px 5px 0 var(--ink)" }}>
          <div className="t-display" style={{ fontSize: 22, lineHeight: 1 }}>ul. Włodkowica 14/2</div>
          <div className="t-mono" style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", marginTop: 4 }}>Wrocław · pn–pt 11–19</div>
          <div className="t-display" style={{ fontSize: 22, marginTop: 14 }}>+48 794 220 118</div>
          <div className="t-mono" style={{ fontSize: 12, marginTop: 4 }}>siema@drshoes.pl</div>
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <Sticker style={{ fontSize: 10, padding: "5px 10px" }}>@dr_shoes</Sticker>
            <Sticker style={{ fontSize: 10, padding: "5px 10px", background: "var(--acid)" }}>kawa free</Sticker>
          </div>
        </div>
      </section>

      <footer style={{ background: "var(--ink)", color: "var(--paper)", padding: "30px 18px", textAlign: "center" }}>
        <DrShoesMark size={0.5} color="var(--paper)" accent="var(--acid)" />
        <div className="t-mono" style={{ fontSize: 10, opacity: 0.55, marginTop: 14 }}>© 2026 Dr Shoes</div>
      </footer>
    </div>
  );
}

// Klienci
const { AdminScreens } = window;
function ClientsView() {
  return (
    <div className="admin" data-screen-label="Admin · Klienci" style={{ display: "flex", height: "100%", width: "100%", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      {React.createElement(window.AdminSidebarComp || (() => null), { active: "Klienci" })}
    </div>
  );
}

// product reservation modal — stand-alone artboard
function ReservationModal() {
  return (
    <div data-screen-label="Landing — modal rezerwacja" style={{ position: "relative", width: "100%", height: "100%", background: "rgba(10,10,10,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.4 }}>
        <PhImg dark label="" style={{ width: "100%", height: "100%", border: "none" }} />
      </div>
      <div style={{ position: "relative", background: "var(--paper)", border: "3px solid var(--ink)", boxShadow: "10px 10px 0 var(--acid), 10px 10px 0 1.5px var(--ink)", width: "100%", maxWidth: 540, overflow: "hidden" }}>
        <div style={{ position: "relative", padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Tape color="pink">rezerwacja · niezobowiązująca</Tape>
          <button style={{ width: 32, height: 32, border: "2px solid var(--ink)", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>{I.close}</button>
        </div>
        <div style={{ padding: "18px 24px 0", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <PhImg label="AF1 Mid" style={{ width: 100, height: 100, flexShrink: 0 }} />
          <div>
            <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>Nike · EU 43</div>
            <h3 className="t-display" style={{ fontSize: 32, margin: "4px 0 2px", lineHeight: 0.9 }}>AF1 Mid 'Bandana'</h3>
            <div className="t-display" style={{ fontSize: 26 }}>990 zł</div>
          </div>
        </div>
        <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field"><label>Imię i nazwisko</label><input placeholder="Filip Nowak" /></div>
            <div className="field"><label>Telefon</label><input placeholder="+48 …" /></div>
          </div>
          <div className="field"><label>Email</label><input placeholder="ty@przyklad.pl" /></div>
          <div className="field"><label>Preferowany termin odbioru</label><input placeholder="np. czwartek po 17" /></div>
          <div className="field"><label>Wiadomość (opcjonalnie)</label><textarea rows={2} placeholder="Coś jeszcze?" /></div>
          <div className="t-mono" style={{ fontSize: 11, padding: "8px 12px", background: "var(--ink)", color: "var(--paper)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--acid)" }}>UWAGA:</strong> płatność i odbiór wyłącznie na miejscu w pracowni.<br />Rezerwacja jest niezobowiązująca przez 48h.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-paper btn-sm" style={{ flex: 1, justifyContent: "center" }}>anuluj</button>
            <button className="btn btn-acid btn-sm" style={{ flex: 2, justifyContent: "center" }}><SprayCanIcon size={14} /> rezerwuję</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Order intake form (custom request) — separate screen
function CustomIntake() {
  return (
    <div data-screen-label="Landing — formularz custom" style={{ background: "var(--paper)", minHeight: "100%", padding: "60px 28px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <Tape color="pink">formularz</Tape>
        <h1 className="t-display" style={{ fontSize: 96, margin: "16px 0 0", lineHeight: 0.9 }}>Zamów <span style={{ color: "var(--acid)", WebkitTextStroke: "2px var(--ink)" }}>custom</span></h1>
        <p className="t-mono" style={{ fontSize: 14, color: "rgba(0,0,0,0.7)", maxWidth: 600, marginTop: 14, lineHeight: 1.5 }}>
          Opisz co masz w głowie. Odpowiadamy w 24h z wyceną i terminem. Możemy się też umówić na konsultację w pracowni.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28, marginTop: 40 }}>
          <form className="admin-card" onSubmit={(e) => e.preventDefault()} style={{ background: "var(--paper)", border: "3px solid var(--ink)", boxShadow: "8px 8px 0 var(--ink)", padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="t-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Co potrzebujesz?</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
                {[
                  { l: "Naprawa butów", a: true },
                  { l: "Custom buty", a: false },
                  { l: "Custom kurtka", a: false },
                ].map(o => (
                  <button key={o.l} type="button" style={{
                    padding: "16px 10px", border: "2px solid var(--ink)",
                    background: o.a ? "var(--acid)" : "var(--paper)",
                    fontFamily: "var(--font-stencil)", fontWeight: 700, fontSize: 13, letterSpacing: ".05em", textTransform: "uppercase",
                    boxShadow: o.a ? "3px 3px 0 var(--ink)" : "none",
                    cursor: "pointer",
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Imię</label><input placeholder="np. Filip" /></div>
              <div className="field"><label>Telefon</label><input placeholder="+48 …" /></div>
            </div>
            <div className="field"><label>Email</label><input placeholder="ty@przyklad.pl" /></div>
            <div className="field"><label>Marka i model</label><input placeholder="Nike Air Force 1 Mid" /></div>
            <div className="field"><label>Opisz pomysł</label><textarea rows={5} placeholder="Co ma się znaleźć na butach? Kolory, motyw, inspiracje. Linki też się przydadzą." /></div>

            <div>
              <label className="t-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Referencje · zdjęcia</label>
              <div style={{
                border: "2.5px dashed var(--ink)", padding: "30px 20px", textAlign: "center", background: "var(--paper-2)",
              }}>
                <div style={{ fontSize: 36, color: "var(--ink)", lineHeight: 1 }}>{I.upload}</div>
                <div className="t-mono" style={{ fontSize: 12, marginTop: 8 }}>upuść zdjęcia tutaj lub <u>wybierz z dysku</u></div>
                <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 4 }}>jpg, png, max 8MB / sztuka · do 6 sztuk</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-acid" style={{ flex: 1, justifyContent: "center" }}><SprayCanIcon size={16} /> Wyślij zapytanie</button>
            </div>
          </form>

          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "var(--ink)", color: "var(--paper)", padding: 20, position: "relative" }}>
              <div className="t-stencil" style={{ fontSize: 12, color: "var(--acid)", letterSpacing: ".1em" }}>Co dalej</div>
              <ol style={{ paddingLeft: 0, listStyle: "none", margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Dostajesz odpowiedź w 24h — wycena + termin",
                  "Konsultacja na miejscu lub mailowo",
                  "Przyjęcie zlecenia i zaliczka 30%",
                  "Robimy. Wysyłamy zdjęcia z postępu.",
                  "Odbiór w pracowni — płatność końcowa.",
                ].map((t, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span className="t-display" style={{ color: "var(--acid)", fontSize: 24, lineHeight: 1, flexShrink: 0, width: 24 }}>{i+1}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t}</span>
                  </li>
                ))}
              </ol>
              <Splatter color="var(--acid)" size={120} style={{ top: -20, right: -20, opacity: 0.3 }} />
            </div>

            <div style={{ background: "var(--paper-2)", border: "2px solid var(--ink)", padding: 18 }}>
              <div className="t-stencil" style={{ fontSize: 12, marginBottom: 8 }}>Czas realizacji</div>
              <div className="t-display" style={{ fontSize: 32, lineHeight: 0.9 }}>2–4 tygodnie</div>
              <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.65)", marginTop: 6 }}>zależy od kolejki i skomplikowania.</div>
            </div>

            <div style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 18 }}>
              <div className="t-stencil" style={{ fontSize: 12, marginBottom: 8 }}>Wolisz IG?</div>
              <div className="t-mono" style={{ fontSize: 13 }}>@dr_shoes na DM. Też działa.</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

window.MoreScreens = { MobileLanding, ReservationModal, CustomIntake };
