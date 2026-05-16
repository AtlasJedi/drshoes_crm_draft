# M10 visual design prompt — Custom Notes + Storage Locations

> **For the owner:** paste this into a fresh Claude.ai conversation. The assistant
> will produce 6 React component snippets that we'll integrate verbatim into the
> admin app. Save each component output as a file (or paste back into our chat
> here) and we'll wire them into Waves 2 + 3 of M10.

---

## Context

Aplikacja: Dr Shoes — CRM dla warsztatu szewskiego we Wrocławiu. Panel admin
jest oparty o "graffiti" design system shipowany w M9: papier-warm background,
ink-czarne bordery, akcent acid (#d8ff3a) + magenta (#ff2e7e), pop-shadow
offset, fonty stencil + Anton + Permanent Marker.

Dodajemy do panelu **2 niezależne mini-feature'y w M10**:

1. **Storage locations**: admin zarządza prostym zbiorem string-ów (np. "półka 1",
   "suszarka", "szuflada"). Pracownik wybiera w drawer zlecenia gdzie aktualnie
   leży to konkretne zlecenie. Lokację można dezaktywować (soft-delete);
   istniejące zlecenia zachowują nazwę.

2. **Custom notes**: pracownik dodaje wolny wpis do historii zlecenia bez zmiany
   statusu. Notatka zapisuje się chronologicznie razem ze status-changes.
   Notatka może opcjonalnie zawierać ruch lokacji ("przeniosłem z półki na
   suszarkę").

Walidacja na backendzie: w akcji "dodaj wpis" co najmniej jedno z (treść
notatki, zmiana miejsca) musi być wypełnione. Sama zmiana miejsca bez tekstu
notatki jest OK. Sama notatka bez ruchu też OK.

---

## Design system constants (use these verbatim — they MUST match the repo)

```css
:root {
  --ink: #0a0a0a;
  --ink-2: #1a1a1a;
  --ink-3: #2a2a2a;
  --paper: #f4efe6;
  --paper-2: #ebe4d4;
  --paper-3: #ddd3bd;
  --admin-bg: #f7f5ef;
  --admin-surface: #ffffff;
  --admin-line: #e3ddcc;
  --admin-ink: #1a1a1c;
  --admin-mute: #6b6960;
  --acid: #d8ff3a;
  --magenta: #ff2e7e;
  --pink: #ff2e7e;
  --blue: #2b5cff;
  --orange: #ff5a1f;
  --green: #18b06b;
  --red: #e1342b;
  --line: rgba(10, 10, 10, 0.18);
  --line-2: rgba(10, 10, 10, 0.08);
}
```

Typography utility classes:
- `.t-display` (Anton, uppercase, tight tracking, large headings)
- `.t-stencil` (Big Shoulders Stencil Display, uppercase, section/nav labels)
- `.t-tag` (Permanent Marker, marker-style labels)
- `.t-mono` (JetBrains Mono, metadata)

Component utility classes:
- `.admin-card` — 1.5px ink border + 3px ink offset shadow (paper-on-paper card)
- `.btn-clean` — primary action button (paper bg + ink border + ink text)
- `.btn-clean.primary` — emphasized variant (ink bg + paper text)
- `.btn-clean.acid` — acid-bg variant for "ship" actions
- `.tbl` — `<table>` styling: stencil-uppercase th, hover row tint
- `.field` — wraps `<label>` + `<input>` per form row (label above, input full-width with admin-line border, focus ring acid)
- `.tape` — masking-tape pill (rotated, monospace label)
- `.stamp` — stencil rubber-stamp overlay

Box-shadow tokens:
- `shadow-pop` = `5px 5px 0 #0a0a0a` (large)
- `shadow-pop-sm` = `3px 3px 0 #0a0a0a` (cards)
- `shadow-pop-pink` = `-6px 6px 0 #ff2e7e, -6px 6px 0 1.5px #0a0a0a` (alert/dialog)

---

## Deliverables — 6 components

For each component below, produce a **single React component file** (TypeScript +
Tailwind CSS classes + inline `style` for CSS-var bindings). Keep each file
under **80 lines of code**. Add `log.debug("op=render", { props })` line near
the top using the shared `mkLogger` pattern (`import { createLogger } from "@/lib/log"; const log = createLogger("ComponentName");`).

**No emojis except where this prompt explicitly uses them.** Polish UI copy.

### Component 1 — `LocationsList`

**Where it lives:** main content of `/admin/settings/miejsca` page (the admin
settings panel for managing storage locations).

**Props:**
```ts
type Props = {
  locations: Array<{ id: number; name: string; position: number; active: boolean }>;
  onEdit: (l: Props["locations"][0]) => void;
  onDeactivate: (l: Props["locations"][0]) => void;
};
```

**Visual goals:**
- List looks like an inventory ledger — graffiti-warehouse vibe.
- Active locations on top (sorted by `position` then `name`), inactive at the
  bottom rendered with `opacity: 0.5` and italic small "(nieaktywne)" tag.
- Each row: name in stencil uppercase, two action buttons on the right
  (`edytuj`, `dezaktywuj`). Hover row → faint paper-2 tint + cursor.
- Empty state: t-tag text "Brak miejsc. Dodaj pierwsze za pomocą przycisku
  powyżej." with small icon (paint brush or shelf SVG).
- `data-active={l.active}` attribute MUST be present on row element (test
  contract).
- Each button MUST have `aria-label="Edytuj <name>"` / `aria-label="Dezaktywuj
  <name>"` (test contract).

### Component 2 — `LocationFormModal`

**Where it lives:** modal opened from `/admin/settings/miejsca` (add new
location button + edit-existing rows from `LocationsList`).

**Props:**
```ts
type Props = {
  target?: { id: number; name: string; position: number; active: boolean };
  onClose: (didSave: boolean) => void;
};
```

**Visual goals:**
- Built on `@radix-ui/react-dialog`. Overlay = `bg-black/50`. Content fixed
  centered, max-width ~440px.
- Frame: paper bg, 2px ink border, large pop-pink shadow for emphasis.
- Title: `t-display` 22px. Add mode shows "Nowe miejsce"; edit mode shows
  `Edytuj: {target.name}`.
- Single `.field` row with `label "Nazwa"` + `input` (max 64 chars, autofocus).
- Below input, an error placeholder div that shows the message in `var(--red)`
  when set (e.g., "Miejsce o tej nazwie już istnieje.")
- Buttons row right-aligned: `anuluj` (btn-clean) + `zapisz` (btn-clean
  primary). Disabled `zapisz` when name is empty / whitespace.
- Submitting state: button text "zapisuję..." + disabled.
- Test contract: `getByLabelText(/nazwa/i)` resolves to the input;
  `getByRole("button", { name: /zapisz/i })` resolves to submit button.

### Component 3 — `OrderDrawerNoteComposer`

**Where it lives:** inside the `OrderDrawer` (right-side sliding drawer in
`/admin/orders`), as a `<section>` BETWEEN the photo grid section and the
existing `OrderDrawerNotes` (sticky-notes history list).

**Props:**
```ts
type Props = {
  orderId: string;
  currentLocation: string | null;
  onSaved: () => void;
};
```

**Visual goals:**
- Subtle section header (uppercase t-mono 11px, color admin-mute): "DODAJ WPIS
  DO HISTORII".
- Single `.field` row with textarea (rows=2-3, max 1000 chars, label "Co się
  stało? (opcjonalne)"). The textarea gives space for a brief note like
  "wyczyszczony elo".
- Below textarea, a row with two columns: left flex-1 = `.field` with select
  labeled "Miejsce" (options loaded async via `listLocations()` from
  `@/lib/locations`; first option `value=""` is "— bez miejsca —", then the
  active locations sorted by position). Right = `dodaj wpis` button.
- The "dodaj wpis" button is `.btn-clean.primary`. **Disabled** when both
  conditions hold: note is empty/whitespace AND select value equals
  `currentLocation` (no-op rule).
- Error placeholder below buttons (similar to LocationFormModal). Maps backend
  error codes to Polish copy:
  - `at_least_one_required` → "Podaj notatkę albo zmień miejsce."
  - `no_op_change` → "Nic nie zmieniłeś."
  - `unknown_location` → "To miejsce nie istnieje albo zostało wyłączone."
- Component MUST import and call `addOrderNote(orderId, payload)` from
  `@/lib/locations` on submit. After success, clear textarea and call
  `onSaved()` (caller will refresh the drawer's history list).
- Test contract: `getByLabelText(/co się stało/i)` finds the textarea,
  `getByLabelText(/miejsce/i)` finds the select,
  `getByRole("button", { name: /dodaj wpis/i })` finds the submit button.

### Component 4 — `LocationMoveChip`

**Where it lives:** rendered inside each note entry in `OrderDrawerNotes` (the
sticky-notes history list). Shows up only on note rows that carry a location
change.

**Props:**
```ts
type Props = { from: string | null; to: string | null };
```

**Visual goals:**
- Small inline chip — fits next to or below the note text body.
- 1.5px ink border, paper-2 bg, t-mono 11px, padding 2-4px / 6-10px.
- Pin emoji `📍` as a tiny prefix (this is one of the rare allowed emojis —
  it's the universal "location" visual marker).
- Three states:
  - **both `from` and `to` non-null**: render "📍 {from} → {to}" with `→`
    rendered as its own `<span aria-hidden>`. `from` italic-muted, `to`
    bold.
  - **only `to` non-null**: render "📍 do {to}" (no arrow, no from).
  - **both null**: return `null` (do not render anything). Test contract:
    `container.toBeEmptyDOMElement()`.

### Component 5 — `OrderDrawerHeader` location pill (additive)

**Where it lives:** `OrderDrawerHeader` currently displays the order code
("DR-2026-0042"), client name, received date, and a status pill (color-coded
per the order's status). We want to ADD a small location pill BESIDE the
status pill (to the right of it on the same line).

**Spec:**
- Pill is rendered only when `props.location` is a non-empty string.
- Visual: acid (`var(--acid, #d8ff3a)`) background, 1.5px ink border,
  `t-mono` 11px, small padding. `📍 {location}` content.
- Pill carries `aria-label="Aktualne miejsce"` for screen readers.
- The pill is purely visual at this stage — clicking it does nothing (handler
  can be added later to focus the composer textarea).

Just produce the **JSX fragment to inject** into `OrderDrawerHeader.tsx` plus the
new `Props.location?: string | null` field. Do not rewrite the entire header.

### Component 6 — `AdminSidebarNav` KONFIGURACJA section (additive)

**Where it lives:** `AdminSidebarNav.tsx` currently emits sections PULPIT,
OPERACJE, KOMUNIKACJA, SKLEP — each with one or more nav links styled via
`.sb-link` class with active-state behavior.

**Spec:**
- Add a new `KONFIGURACJA` section AFTER `SKLEP`.
- Single link in it: label `Miejsca`, href `/admin/settings/miejsca`.
- Section header styled identically to the other section headers (uppercase
  `t-stencil` 11px, admin-mute color, small margin-bottom).
- Active-state: when `pathname === "/admin/settings/miejsca"`, the link gets
  the existing `.sb-link.active` styling (acid left border, paper text,
  ink-3 background).

Produce just the **JSX fragment for the new section block** to insert into the
existing sections array, plus any imports needed. Do not rewrite the whole
component.

---

## What I expect back

For each component (1-4): a complete `.tsx` file, ready to drop into the repo at
the path I'll specify below. For components 5 and 6: a JSX fragment + import
diff.

File paths (where each component will be installed):
1. `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationsList.tsx`
2. `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationFormModal.tsx`
3. `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx`
4. `apps/web/app/(admin)/admin/orders/_components/_LocationMoveChip.tsx`
5. `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx` (add prop + JSX)
6. `apps/web/components/admin/AdminSidebarNav.tsx` (add section block)

Each component imports types from `@/lib/types` (`StorageLocation` etc.) and
helpers from `@/lib/locations` (`listLocations`, `addOrderNote`,
`createLocation`, `updateLocation`, `deactivateLocation`). All those exports
exist already.

Do NOT include explanatory prose — just the component code. Add a small
top-of-file comment with the component name + one-line purpose.

If you're unsure about a visual decision, default to the most aggressive
graffiti-stencil aesthetic that the existing design system permits. Keep
components tight (≤80 LOC each).

---

## Existing components to mirror in style

If helpful, here are existing admin components in the repo that already nail
the graffiti aesthetic — match their style:

- `OrderDrawerNotes.tsx` (sticky-note history list with rotation + tape)
- `KpiTilesRow.tsx` (left-accent-bar stat tiles with t-display values)
- `OrdersTable.tsx` (`.tbl` graffiti table)
- `AdminSidebarNav.tsx` (the sidebar I'm extending)

If the M9 export pack at `handoff/design/admin.jsx` is accessible to you, that's
the canonical source. Otherwise rely on the CSS vars + utility classes listed
above and your taste.

---

## Polish copy guidelines

All UI strings in Polish. Tone: terse, workshop-floor. Avoid corporate-speak.
Examples: "dodaj wpis" (NOT "dodaj nową notatkę"), "miejsce" (NOT "lokalizacja"),
"zapisz" (NOT "zachowaj"), "anuluj" (NOT "porzuć").

That's it. Output 6 deliverables. No preamble.
