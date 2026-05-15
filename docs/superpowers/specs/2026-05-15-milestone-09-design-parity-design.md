# Milestone 9 — Design Parity (admin + landing)

**Status:** spec written 2026-05-15 — awaiting owner review
**Goal:** Bring the live application up to parity with `handoff/design/` (admin.jsx + landing.jsx + styles.css). Current admin is functional but visually trimmed-down ("ewidentnie okrojony"); current public site is a placeholder.
**Approach selected:** **A · Fundament-first** (8 waves, 43 tasks, design system before view rewrites)
**Owner directive:** "chcemy mieć super produkt"

---

## 1. Scope and non-goals

### In scope

- **Design system rewrite** in `packages/ui/`: tokens (colours, fonts, shadows), font loading (add Anton + Big Shoulders Stencil Display), primitive components (Tape, Stamp, Sticker, Pill, Chip, Splatter, PhImg, DrShoesMark, AdminCard, StatTile, Toggle, Button, icons).
- **Admin shell rewrite**: dark `--ink` ribbon sidebar with acid right border, stencil-font links, brand mark, avatar+power footer. New `AdminTopbar` (global search + bell button) integrated via a `PageHeader` React context.
- **Admin views parity** (every page reskinned to match design):
  - Dashboard: 4 stat tiles with accent bars, stacked 8-week bar chart, 3-segment donut, three lower panels including new "Świeże rezerwacje".
  - Orders list: graffiti `.tbl` styling, status `<Pill>`, preset chips, filter bar.
  - Order drawer: **NEW** 5-step status timeline, **NEW** sticky-note internal notes, restyled photo grid with before/trakcie/after labels, restyled communication panel, footer actions.
  - Calendar: month/week/day toggle restyle, **NEW** "Bez terminu" unscheduled-orders side panel.
  - Kanban: full-width colour-band column headers, restyled cards, **NEW** post-drag status-change confirmation popup with trigger preview.
  - Messages: 3-column layout (320 / 1fr / 280), restyled list and thread, **NEW** right `<ClientMiniProfile>` side-panel.
  - Triggers: filter chips, stats per trigger (sent/open/replies), **NEW** sticky edit panel with clickable `{placeholder}` chips, `wymaga ręcznego potwierdzenia` toggle, `test do siebie` button.
  - Templates: editor parity with Triggers (text-only, no event/delay).
  - Sklep admin: product grid with `<Stamp>` overlay, edit panel, **NEW** reservations queue per product.
  - Clients: reskin only (functionality shipped in M7).
- **Public landing** (`/`): full per-design StickyNav + Hero + Services + NewsTeaser + SklepTeaser + Contact + Footer. Landing links to `/sklep` and `/aktualnosci` placeholders (which remain stubs).
- **Tests:** vitest snapshot per primitive + view-level smoke; 3 new Playwright specs (sidebar nav sweep, dashboard parity, landing smoke).

### Non-goals (hard out)

- Real `/sklep` and `/aktualnosci` implementations — owner-locked stubs only (memory: `project_scope_post_m5`, 2026-05-10).
- Mobile responsive — design is desktop-first, smartphone deferred.
- Light/dark mode toggle — design has one paper+ink palette.
- New favicon / meta / SEO polish — deferred to a later milestone.
- Animation library — CSS transitions only, matching design.
- Backend feature additions — only allowed if a Stat-tile DTO field is genuinely missing, in which case a small backend slice is acceptable.

### What gets touched

- `packages/ui/` — `src/tokens.ts` rewrite, `src/fonts.ts` rewrite, new `src/components/*` files, `tailwind-preset.ts` extended.
- `apps/web/app/layout.tsx` — load 5 next/font instances and emit `--font-*` CSS variables.
- `apps/web/app/globals.css` — graffiti utility classes (`.t-display`, `.t-stencil`, `.t-tag`, `.t-mono`, `.sb-link`, `.tbl`, `.field`, `.admin-card`, `.btn-clean`, etc.).
- `apps/web/components/admin/AdminSidebar.tsx` + `AdminSidebarNav.tsx` rewrite.
- `apps/web/components/admin/AdminTopbar.tsx` — NEW.
- `apps/web/app/(admin)/admin/layout.tsx` + every page under `(admin)/admin/**` and its `_components/`.
- `apps/web/app/(public)/page.tsx` — full landing rewrite.

### Status quo to preserve

- Backend suite 398/0/0/0 stays green.
- Existing 203 vitest tests must keep passing (snapshot updates expected, behaviour regressions are not).
- Playwright e2e 3/3 stays green.
- `lib/log.ts` named-logger pattern — every new component does `log.debug('op=<name>.render', { props })` per dispatch-protocol clause #7 ("extensive structured logging").

---

## 2. Design system architecture

### 2.1 Tokens — `packages/ui/src/tokens.ts` rewrite

```ts
export const colors = {
  ink: "#0a0a0a",
  ink2: "#1a1a1a",
  ink3: "#2a2a2a",
  paper: "#f4efe6",
  paper2: "#ebe4d4",
  paper3: "#ddd3bd",
  adminBg: "#f7f5ef",
  adminSurface: "#ffffff",
  adminLine: "#e3ddcc",
  adminInk: "#1a1a1c",
  adminMute: "#6b6960",
  acid: "#d8ff3a",
  magenta: "#ff2e7e",
  pink: "#ff2e7e",   // alias for design fidelity
  blue: "#2b5cff",
  orange: "#ff5a1f",
  green: "#18b06b",
  red: "#e1342b",
  line: "rgba(10,10,10,0.18)",
  line2: "rgba(10,10,10,0.08)",
} as const;

export const orderStatusColor = {
  WSTEPNIE_PRZYJETE: colors.adminMute,
  PRZYJETE: colors.blue,
  W_REALIZACJI: colors.orange,
  CZEKA_NA_KLIENTA: "#a17a00",  // dark yellow per design
  GOTOWE_DO_ODBIORU: colors.green,
  WYDANE: colors.ink3,
  ANULOWANE: colors.red,
} as const;
```

Note: `orderStatusColor` mapping changes (M7 had GOTOWE_DO_ODBIORU mapped to magenta; design pill is green). Update `Pill` consumer call-sites accordingly.

### 2.2 Fonts — `packages/ui/src/fonts.ts` rewrite

```ts
export const fontDescriptors = {
  display: { name: "Anton",                          weights: [400],      subsets: ["latin","latin-ext"] },
  stencil: { name: "Big Shoulders Stencil Display",  weights: [700,800],  subsets: ["latin","latin-ext"] },  // NEW
  marker:  { name: "Permanent Marker",               weights: [400],      subsets: ["latin","latin-ext"] },
  body:    { name: "Inter Tight",                    weights: [300,400,500,600,700,800], subsets: ["latin","latin-ext"] },
  mono:    { name: "JetBrains Mono",                 weights: [400,500,700], subsets: ["latin","latin-ext"] },
} as const;

export const cssVars = {
  fontDisplay: "var(--font-display)",
  fontStencil: "var(--font-stencil)",
  fontMarker:  "var(--font-marker)",
  fontBody:    "var(--font-body)",
  fontMono:    "var(--font-mono)",
} as const;
```

`apps/web/app/layout.tsx` loads all five fonts via `next/font/google` and emits the CSS variables in `<body className={...fontVars}>`.

### 2.3 Tailwind preset extensions

`packages/ui/tailwind-preset.ts` adds:

- `fontFamily.stencil = [cssVars.fontStencil, "Impact", "sans-serif"]`
- `boxShadow`:
  - `'pop':       '5px 5px 0 #0a0a0a'`
  - `'pop-sm':    '3px 3px 0 #0a0a0a'`
  - `'pop-card':  '3px 3px 0 #0a0a0a'`
  - `'pop-pink':  '-6px 6px 0 #ff2e7e, -6px 6px 0 1.5px #0a0a0a'`
  - `'pop-acid':  '-6px 6px 0 #d8ff3a, -6px 6px 0 1.5px #0a0a0a'`
  - `'pop-blue':  '-6px 6px 0 #2b5cff, -6px 6px 0 1.5px #0a0a0a'`
- `gridTemplateColumns`:
  - `'admin-msg-3': '320px 1fr 280px'`
  - `'admin-trig':  '1.4fr 1fr'`
  - `'admin-sklep': '1.5fr 1fr'`
- `aspectRatio.4-3`, `aspectRatio.16-10` if needed beyond Tailwind defaults.

### 2.4 Primitive components

New files under `packages/ui/src/components/`. Each ≤ 80 LOC per repo granulate directive:

| File | Export | Props | LOC budget |
|---|---|---|---|
| `Tape.tsx` | `<Tape>` | `children, angle?, color?='acid'\|'pink'\|'blue'\|'paper'` | <40 |
| `Stamp.tsx` | `<Stamp>` | `children, color?='green'\|'pink'\|'ink'\|'blue', angle?` | <40 |
| `Sticker.tsx` | `<Sticker>` | `children, angle?` | <30 |
| `Pill.tsx` | `<Pill>` | `status: OrderStatus` | <50 |
| `Chip.tsx` | `<Chip>` | `children, active?, color?='default'\|'pink', onClick?, icon?` | <40 |
| `Splatter.tsx` | `<Splatter>` | `color, size, style` SVG noise blob | <50 |
| `PhImg.tsx` | `<PhImg>` | `label, dark?, aspectRatio?, style?` diagonal-stripe placeholder | <40 |
| `DrShoesMark.tsx` | `<DrShoesMark>` | `size, color, accent` SVG wordmark | <60 |
| `AdminCard.tsx` | `<AdminCard>` | `children, padding?` 1.5px border + pop-card shadow wrapper | <30 |
| `StatTile.tsx` | `<StatTile>` | `label, value, sub, accent` left-accent bar | <50 |
| `Toggle.tsx` | `<Toggle>` | `on, onChange?` ink ribbon + acid dot | <40 |
| `Button.tsx` | `<Button>` | `variant='primary'\|'acid'\|'pink'\|'paper'\|'ghost', size?='md'\|'sm', children` | <60 |
| `icons.tsx` | `I.<name>` | record of ~25 1-stroke SVG icons (search, plus, bell, calendar, zap, user, send, paperclip, image, arrow, arrowLeft, close, more, edit, eye, upload, trash, filter, drag, clock, power, set, news, msg, store, dash, list) | <200 |
| `index.ts` | barrel | re-exports all of the above | <20 |

### 2.5 Utility classes — `apps/web/app/globals.css`

Graffiti styles that don't translate cleanly to Tailwind utilities:

- Typography: `.t-display`, `.t-stencil`, `.t-tag`, `.t-mono` (replicated from `handoff/design/styles.css`).
- Sidebar links: `.sb-link`, `.sb-link:hover`, `.sb-link.active`.
- Table: `.tbl`, `.tbl th`, `.tbl td`, `.tbl tr:hover td`.
- Form fields: `.field`, `.field label`, `.field input/textarea/select`, `.field *:focus`.
- Cards: `.admin-card`.
- Buttons: `.btn-clean`, `.btn-clean.primary`, `.btn-clean.acid`, `.btn`, `.btn-acid`, `.btn-pink`, `.btn-paper`, `.btn-ghost`, `.btn-sm`.
- Image placeholders: `.ph-img`, `.ph-img.dark`.
- Tape/Stamp/Sticker/Spray-frame/Drip/Halftone/Noise — full graffiti utility set from design `styles.css`.
- Animation keyframes: `@keyframes drawerIn`, `@keyframes hoverZoom`.

### 2.6 Tests for design system

- `packages/ui/src/components/__tests__/*.test.tsx` — vitest snapshot test per primitive (Tape, Stamp, Sticker, Pill, Chip, Splatter, PhImg, DrShoesMark, AdminCard, StatTile, Toggle, Button).
- `Pill` test: every `OrderStatus` value renders with correct colour.
- `StatTile` test: accent left-bar renders for every supported colour token.

---

## 3. Admin shell

### 3.1 `AdminSidebar.tsx` rewrite

- 230px wide, `bg-ink text-paper`, 3px acid right border, flex column.
- Header: `<DrShoesMark size={0.32} color="paper" accent="acid" />` + `<div class="t-mono opacity-55">panel pracowni · v2.4</div>`.
- Nav sections (existing structure stays; only labels and styling change):
  - **PULPIT**: Dashboard
  - **OPERACJE**: Zamówienia / Klienci / Wiadomości (with `MessagesNavItem` unread badge)
  - **KOMUNIKACJA**: Triggery / Szablony wiadomości
  - **SKLEP**: Sklep / Aktualności
- Each link uses `.sb-link` styling: stencil font 13px, uppercase, letter-spacing 0.08em, 10×14 padding, border-left transparent → `--acid` on `.active`.
- Footer: 36px circular acid avatar with initials (from `me.fullName`) + name (`t-stencil 12px`) + role (`t-mono 10px`) + power icon button that POSTs to `/logout`.

### 3.2 `AdminTopbar.tsx` (NEW)

- `flex items-center px-7 py-4 bg-paper border-b-2 border-ink gap-4`.
- Left flex-1: title (`t-display fontSize:38`) + subtitle (`t-mono 12px opacity-55`).
- Right: global search (280px, `border-ink shadow-pop-sm`, ⌘K hint), bell button (`btn-clean` with pink notification dot when unread > 0), optional `right` slot.
- Bell click → opens `<NotificationsPopover>` (deferred to a follow-up task — initial impl just shows the dot).
- Search: input is a placeholder for now (M9 ships UI only; full `/admin/search?q=` handler is a tracked follow-up).

### 3.3 `AdminPageHeaderContext` (NEW)

```ts
// apps/web/app/(admin)/admin/_components/PageHeaderContext.tsx
type PageHeader = { title: string; subtitle?: string; right?: ReactNode };
const PageHeaderContext = createContext<{ set: (h: PageHeader) => void; current: PageHeader | null }>(...);
export function usePageHeader(h: PageHeader) { useEffect(() => set(h), [h.title, h.subtitle]); }
export function PageHeaderProvider({ children }) { ... }
```

`AdminLayout` wraps children in `<PageHeaderProvider>` and renders `<AdminTopbar>` reading from context. Each page calls `usePageHeader({ title: 'Dashboard', subtitle: 'czwartek · 7 maja 2026' })`.

### 3.4 `AdminLayout` rewrite

```tsx
return (
  <PageHeaderProvider>
    <div className="min-h-screen bg-admin-bg text-admin-ink flex">
      <BrowserOtelInit />
      <AdminSidebar me={me} />
      <main className="flex-1 flex flex-col overflow-auto">
        <AdminTopbar />
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  </PageHeaderProvider>
);
```

### 3.5 Tests for shell

- `AdminSidebar.test.tsx` — snapshot with mock `me`; active state when pathname matches.
- `AdminTopbar.test.tsx` — snapshot with various `PageHeader` values; bell renders pink dot when `unread > 0`.
- `AdminPageHeaderContext.test.tsx` — context updates trigger topbar re-render.
- Playwright `admin-sidebar-nav.spec.ts` — click every link, assert correct page loaded and link active.

---

## 4. Admin views — parity per page

Each view is one task in the implementation plan. Granulate per dispatch-protocol clause #6: Java < 120 LOC (n/a here), TS modules < 80 LOC.

### 4.1 Dashboard (`app/(admin)/admin/page.tsx`)

- Grid `grid-cols-4 gap-4`: 4 `<StatTile>` (W realizacji acid / Gotowe do odbioru pink / Nowe rezerwacje 7d blue / Przychód maj acid). Data from existing `KpiTilesRow`.
- Grid `2fr 1fr gap-5`:
  - `<OrdersWeekChart>` restyle: stacked bar 8 weeks (naprawy ink + custom acid stacked), chip toggles (tydzień/miesiąc/kwartał) for time range, legend below.
  - `<MixDonut>` restyle: 3 segments (Naprawy acid / Custom buty pink / Custom kurtki blue), centre count + "aktywne" caption, legend rows below.
- Grid `1.2fr 1fr 1fr gap-5`:
  - `<ReadyForPickupPanel>` restyle with `Tape "{N} czeka"` header, PhImg thumbnail per order, t-mono ID + bold client name + desc, `<Pill>` status.
  - `<RecentMessagesPanel>` restyle: circular avatar with initial, name + time, channel mono-chip, preview, pink unread dot.
  - `<FreshReservationsPanel>` NEW: 3 cards with PhImg + client + product + timestamp + "otwórz" button. Data source: latest 3 product reservations (existing API).

### 4.2 Orders list (`app/(admin)/admin/orders/page.tsx`)

- View tabs (Lista/Kalendarz/Kanban) in stencil-uppercase style (existing tab logic keeps).
- Preset chips row: pink "pilne (3)", active acid "gotowe (6)", outline "zaległe (2)", dashed "+ zapisz widok".
- Filter bar: chip-style filter selectors (status/typ/rzemieślnik/przyjęcie/klient/tag) + counter "9 z 42" on the right.
- `.tbl` styling for `OrdersTable`. Status column → `<Pill>`. Photo column → `<PhImg>` 36×36. Existing `SortableColumnHeader`, `BulkActionBar`, `SavedFilterPresets` keep — they get re-skinned.

### 4.3 Order drawer (`_components/OrderDrawer.tsx`)

- `aside` positioned fixed right, 540px, 3px ink left border, large left shadow, `drawerIn` animation.
- Header: close button + `t-display 26px` DR-ID + `<Pill>` + more button.
- **NEW** 5-step timeline `<OrderDrawerStatusTimeline>`: circles (active = ink+paper text, future = white+border-ink+muted text) + step name beneath, connecting 2px line ink for past, line2 for future.
- **NEW** tag chips row: existing tags + dashed "+ dodaj" (add-tag UI deferred to M10 — the chip is present but disabled with tooltip "wkrótce").
- Items list as `<AdminCard>` with `t-stencil "Item · 1/1"` header + add-item button.
- Photo grid `grid-cols-6 gap-1.5` with label overlay `before/trakcie/after` colour-coded + dashed "+" upload tile.
- **NEW** `<OrderDrawerNotes>` sticky-notes: two yellow notepads `bg-[#fef4a8] border border-ink rotate-(±0.3deg)` per note, mono timestamp + name, body text. Data: existing `audit_log` entries with `note` field (V015) filtered to current order.
- `<OrderDrawerMessages>` restyle as chat bubbles (ink for outbound, paper-2 for inbound), composer in `_components/OrderDrawerMessages.tsx`.
- Footer actions in `.btn-clean` style: zmień status / oznacz jako wydane (acid) / wiadomość / paragon / anuluj (red).

### 4.4 Calendar (`app/(admin)/admin/orders/calendar/page.tsx`)

- View tabs row identical to Orders.
- Month/Tydzień/Dzień toggle (existing m8-fb-2 logic) — restyle as `border-ink` segmented buttons, active = acid.
- Month grid: 7-col cells with today highlight (`acid 20%` bg + `Tape "dziś"`).
- Event chips: `borderLeft 2px ink`, status-colored bg, white text (or ink for `wydane`), mono 10px, ellipsis on overflow.
- **NEW** `<UnscheduledOrdersPanel>` 280px right `<AdminCard>`: header `t-display 18 "Bez terminu"` + count chip, mono caption "przeciągnij na dzień by zaplanować", list of cards with drag handle. Drag-drop interaction deferred to M10 (the UI is present, dragging just doesn't connect anywhere yet — call it out in a comment).

### 4.5 Kanban (`app/(admin)/admin/orders/kanban/page.tsx`)

- 5-col grid, each `min-w-60` flex column.
- Column header: full-width band in status colour, paper text (or ink for `wydane`), 2px ink border, t-stencil label + count chip.
- Cards as `<AdminCard>` (3px ink shadow): DR-id mono, urgent tag if applicable, PhImg + client + desc, dashed-top divider, due date + craftsman avatar.
- **NEW** post-drag status-change popup: when card moves between columns, reuse existing `StatusChangeTriggerDialog` rendered as a 320px fixed-position popup at `bottom-7 right-7` with `bg-white border-2 border-ink shadow-pop-pink` + Tape "Status zmieniony" + DR-id + new status + trigger preview + wyślij/podgląd/close actions.
- "+ dodaj" dashed-border button at the bottom of each column (click → open new-order modal, deferred to M10 implementation — UI button only).

### 4.6 Messages (`app/(admin)/admin/messages/page.tsx`)

- Grid `grid-cols-admin-msg-3` (320 / 1fr / 280).
- Left list: search box `border-ink`, filter chips row (nieprzeczytane / wymaga odp. / wszystkie) + channel chips (WhatsApp/Email/SMS/IG). Each list item: 36px avatar, name+time row, channel-chip + order-id row, preview line, pink unread dot.
- Centre thread: header with client info + `otwórz zlecenie` link button. Chat bubbles ink for outbound, white-bordered for inbound, optional attached-image grid inline. Composer: channel select, template select, related-order chip, attach buttons, send.
- **NEW** right `<ClientMiniProfile>` 280px: 64px acid avatar (initials), name `t-display 22`, "klient od MM.YYYY" sub, sticker row (e.g. "stały klient"), key/value rows (Telefon, Email, Preferowany kanał, Zleceń, Łącznie), divider, "Aktywne zlecenia" mini-list with PhImg + DR-id + name + status pill.

### 4.7 Triggers (`app/(admin)/admin/triggers/page.tsx`)

- Grid `grid-cols-admin-trig` (1.4fr / 1fr).
- Left: filter chips (aktywne/wyłączone/do potwierdzenia) + "biblioteka szablonów" link button. `<TriggerCard>` list: 38px ink-bg zap icon, name `t-display 18`, `manual` pink chip if applicable, mono meta line (kiedy/kanał/opóźnienie), stats row (sent / open / replies), right column: `<Toggle>` + edit button.
- Right `<TriggerEditPanel>` sticky-top-20: `<Tape>edytujesz</Tape>` + close button, name `t-display 26`, stats sub, then form: name input, event+delay grids, channel chips, content textarea (mono font), **clickable placeholder chips** `{imię_klienta} {numer_zlecenia} {typ_pracy} {data_odbioru} {link_do_zdjęć}` (click inserts at cursor position), "wymaga ręcznego potwierdzenia" toggle row, save + "test do siebie" actions.

### 4.8 Templates (`app/(admin)/admin/templates/page.tsx`)

- Same edit-in-place pattern as Triggers, simplified: list + edit panel.
- Edit panel: name + channel select + content textarea + placeholder chips + save + preview + "test do siebie".

### 4.9 Sklep admin (`app/(admin)/admin/sklep/page.tsx`)

- Grid `grid-cols-admin-sklep` (1.5fr / 1fr).
- Left: filter chips (wszystkie/dostępne/zarezerwowane/sprzedane), 2-col product grid. `<ProductCard>` = PhImg `aspect-square` + `<Stamp>` overlay (dostępne green / rezerwacja pink / sprzedane ink) top-left + edit/eye btn-clean top-right + brand/size t-mono + name t-display + price t-display 22 + reservations counter (pink "2 rezerwacje") if any.
- Right `<ProductEditPanel>`: Tape "edytujesz · {name}" + close, 4-photo grid + dashed upload, form (name/brand/size/price/desc), status chips row, **NEW** `<ReservationsQueue>` divided list: each reservation = `1. Name + timestamp + phone + note + actions (potwierdź sprzedaż / pisz / anuluj-red)`.

### 4.10 Clients (`app/(admin)/admin/clients/page.tsx` + detail) — RESKIN ONLY

- M7 already shipped functionality. Wave 8 task 9-41 audits and reskins: search → t-mono input, list → `.tbl`, statuses → `<Pill>`, detail page header → `t-display`, RodoBadge restyle.

---

## 5. Public landing (`app/(public)/page.tsx`)

Rewrite from current 9-line placeholder to ~400-line full landing per `handoff/design/landing.jsx`. Split into components under `app/(public)/_components/`:

- `<StickyNav>` — top: ink bg, acid border-bottom, brand-mark left, stencil link nav right (Aktualności/Sklep/Kontakt) + acid "Zamów" CTA. Links anchor to in-page sections.
- `<Hero>` — ink bg full-bleed, b-roll `<PhImg dark>` background, two `<Splatter>` (acid top-right, pink bottom-left), two `<Tape>` ("est. 2014 · Wrocław", "pracownia · nie sklep"), `<h1>Dr<span acid>.</span>Shoes</h1>` with `font-size: clamp(96px, 14vw, 220px)`, tag-font tagline, 2 CTA buttons (`btn btn-acid` "Zamów custom" + `btn btn-paper` "Oddaj buty do naprawy"), absolute sticker "@dr_shoes · 38.4k" + scroll cue at bottom-right.
- `<Services>` — paper bg, "co robimy" tape + h2 "Trzy rzeczy. Robimy je dobrze.", 3-tile `grid-cols-3 gap-5`. Each tile: 3px ink border + `shadow-pop` (8px), aspect 3/4, PhImg background, large tag number (01/02/03) top-left, Tape label bottom-left, icon badge bottom-right. Uses `zoom-card` hover.
- `<NewsTeaser>` — ink bg, "aktualności" tape + h2 "Co się dzieje", `grid-cols-3 gap-5` with first tile `gridRow span 2` + `spray-frame pink`. Each card: PhImg cover (aspect 16/10 or 4/3) + content panel with date mono + h3 t-display + excerpt + "czytaj →" link. Data: static placeholder array (real news loads when stub is unlocked).
- `<SklepTeaser>` — paper bg, "sklep" tape + h2 "Pary do wzięcia", "płatność i odbiór w pracowni" notice box. Filter pills (Wszystkie/Nike/Vans/Jordan/Dr. Martens — non-functional placeholder), 4-tile product grid with Stamp overlay. Data: static placeholder array.
- `<Contact>` — paper bg, workshop hours + address + IG/email/phone + map placeholder iframe (Google Maps embed for Wrocław workshop — owner provides coords later, use generic Wrocław centre for now).
- `<Footer>` — minimal mono, copyright + small links.

Stubs `/sklep` and `/aktualnosci` keep their existing M7 implementation (which is just a "for implementation" placeholder).

### Test for landing

- Vitest `_components/Hero.test.tsx`, `Services.test.tsx`, etc. — snapshot each.
- Playwright `public-landing.spec.ts` — scroll-snap smoke, click each anchor link, click both hero CTAs (verify nav target).

---

## 6. Implementation strategy

### 6.1 Wave breakdown

8 waves, 43 tasks (`9-1` through `9-43`). Each task ≤ 80 LOC frontend or ≤ 120 LOC if it includes a backend slice.

- **Wave 1 — Design system** (14 tasks)
  - 9-1 Tokens + fonts + Tailwind preset + `apps/web/app/layout.tsx` font wiring + `globals.css` utility classes (combined, ~250 LOC; fundament-first dispatch — solo, then rest of wave 1 parallel)
  - 9-2 `Tape.tsx`
  - 9-3 `Stamp.tsx`
  - 9-4 `Sticker.tsx`
  - 9-5 `Pill.tsx`
  - 9-6 `Chip.tsx`
  - 9-7 `Splatter.tsx`
  - 9-8 `PhImg.tsx`
  - 9-9 `DrShoesMark.tsx`
  - 9-10 `AdminCard.tsx`
  - 9-11 `StatTile.tsx`
  - 9-12 `Toggle.tsx`
  - 9-13 `Button.tsx`
  - 9-14 `icons.tsx`
- **Wave 2 — Admin shell** (3 tasks)
  - 9-15 `AdminSidebar` rewrite
  - 9-16 `AdminTopbar` + `AdminPageHeaderContext`
  - 9-17 `AdminLayout` integration + page.tsx callsites use `usePageHeader`
- **Wave 3 — Dashboard** (5 tasks)
  - 9-18 `<StatTile>` integration in `KpiTilesRow` restyle
  - 9-19 `<OrdersWeekChart>` restyle (stacked bar + chip toggles)
  - 9-20 `<MixDonut>` restyle (3-segment + legend)
  - 9-21 `<ReadyForPickupPanel>` restyle + `<RecentMessagesPanel>` restyle (combined; both small)
  - 9-22 `<FreshReservationsPanel>` NEW
- **Wave 4 — Orders list + drawer** (5 tasks)
  - 9-23 Orders list page reskin (.tbl + Pill + Chip filters)
  - 9-24 OrderDrawer step-timeline NEW
  - 9-25 OrderDrawer sticky-notes NEW (`<OrderDrawerNotes>`)
  - 9-26 OrderDrawer photo grid + items + tags reskin
  - 9-27 OrderDrawer footer actions + header reskin
- **Wave 5 — Calendar + Kanban** (2 tasks)
  - 9-28 Calendar reskin + `<UnscheduledOrdersPanel>` NEW
  - 9-29 Kanban reskin + post-drag status-change popup integration
- **Wave 6 — Messages + Triggers + Templates + Sklep** (5 tasks)
  - 9-30 Messages 3-col layout + `<ClientMiniProfile>` NEW
  - 9-31 Triggers `<TriggerEditPanel>` NEW + placeholder chips + manual-confirm toggle + "test do siebie"
  - 9-32 Templates editor parity
  - 9-33 Sklep admin product grid + edit panel reskin
  - 9-34 Sklep admin `<ReservationsQueue>` NEW
- **Wave 7 — Public landing** (6 tasks)
  - 9-35 `<StickyNav>`
  - 9-36 `<Hero>` (+ `<Splatter>` use)
  - 9-37 `<Services>`
  - 9-38 `<NewsTeaser>`
  - 9-39 `<SklepTeaser>`
  - 9-40 `<Contact>` + `<Footer>` (combined)
- **Wave 8 — Polish + audit + tag** (3 tasks)
  - 9-41 Parity audit with screenshots (Playwright sweep, compare to design renders side-by-side, file issues)
  - 9-42 Clients reskin (post-audit, addresses what audit finds)
  - 9-43 milestone-9 README update + git tag local

### 6.2 Dispatch protocol

Per dispatch-protocol directive (memory: `feedback_dispatch_protocol.md`, 2026-05-08):

- THIN prompts — subagents read the plan from disk, write their own `docs/dispatch-log/9-*-<UTC>.md`.
- `docs/dispatch-log/tasks.json` is the authoritative cross-session tracker (entries `9-1`..`9-42`).
- **Combined single-stage** for all M9 tasks — per anti-bloat directive 2026-05-11, frontend / visual / no-security work does NOT use TWO-STAGE.
  - Exception: if Wave 8 audit finds a backend DTO field genuinely missing (e.g. "Świeże rezerwacje" needs `reservedAt` on the public-reservation entity that isn't yet exposed), that becomes its own backend slice and gets TWO-STAGE.
- Wave 1 task 9-1 (tokens+fonts+preset) is the **foundation**: dispatched solo, owner approves before wave 1 fans out parallel.
- Within each wave, dispatches are parallel where there are no cross-file deps. Across waves they're sequential (wave 2 cannot start before wave 1's tokens are merged, etc.).
- Commit format: `feat(ui)|feat(admin)|feat(public): <subject> [milestone:9][task:9-N]` with `Refs: <dispatch-log-path>` in body.

### 6.3 Estimated size

- 43 tasks across 8 waves.
- ~3000 LOC frontend, ~0 backend (unless audit finds a gap).
- +50 vitest snapshot tests + view-level smoke.
- +3 Playwright specs (admin sidebar nav sweep, dashboard parity smoke, public landing smoke).

### 6.4 Risks and mitigations

- **Token rewrite blast radius.** Changing `acid #e6ff3a → #d8ff3a` is a visible shift on every existing pill/badge/avatar. *Mitigation*: 9-1 dispatched solo, owner approves the new tokens visually (start the stack, screenshot 3 key pages with the new tokens applied to existing components) before proceeding.
- **Font swap (Bungee → Anton).** Anton requires `next/font/google` to fetch on first build; could slow cold-start by 5-10s. *Mitigation*: pre-warm via `next.config.js` font experimental optimisations. Existing test fixtures using `font-display` won't break — variable name unchanged.
- **Existing 203 vitest could fail.** Snapshot changes expected; behaviour regressions are not. *Mitigation*: each task dispatch includes snapshot updates as part of its commit. Anything beyond snapshots is a regression and gets reverted.
- **`AdminPageHeaderContext` re-render storms.** If `usePageHeader` is called inside a frequently-re-rendering component, the topbar could flash. *Mitigation*: context setter wrapped in `useEffect` with `[title, subtitle]` deps; callsites must pass stable strings (no inline objects).
- **Public landing increases page weight.** Adding next/font for 5 families + many icon SVGs + Splatter SVGs may push the public LCP. *Mitigation*: keep Hero PhImg as `next/image` with `priority`, defer other PhImg loads. Audit Lighthouse score in wave 8.

### 6.5 Rollback path

Each wave commits to `main` as it lands. Owner can `git revert <wave-N-merge-commit>` to roll back a single wave. The `milestone-9` tag is only applied at the very end (9-42), so partial M9 can ship without forcing the tag.

---

## 7. Out of scope (explicit deferrals)

The following are real gaps in the design but explicitly deferred to **M10 backlog** (do not let them creep into M9):

- Real `/admin/search?q=` handler (topbar search input lives in M9 as a visual element only).
- Notifications popover behind the topbar bell.
- Drag-drop wiring for calendar `<UnscheduledOrdersPanel>` (UI ships, drag handlers stub `onDragEnd: () => alert('wkrótce')`).
- Drag-drop wiring for kanban "+ dodaj" column button (UI ships, click stubs new-order modal trigger).
- Add-tag flow on the order drawer (chip is present but disabled with tooltip).
- Light/dark mode toggle.
- Mobile responsive layout.
- Real `/sklep` and `/aktualnosci` (locked stubs).
- Map iframe embed coordinates for `<Contact>` — use a generic Wrocław centre until owner supplies precise coords.

These deferrals are tracked in `docs/superpowers/ROADMAP.md` under the M10 candidate list.

---

## 8. Resume from a fresh session

After `/clear`, paste:

```
Read docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md.
Then read docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md (once written).
Verify HEAD with git log --oneline -1.
Confirm task status:
  python3 -c "import json;d=json.load(open('docs/dispatch-log/tasks.json'));[print(t['id'],t['status']) for t in d['tasks'] if t['id'].startswith('9-')]"
Then dispatch the next pending task per the dispatch template.
```
