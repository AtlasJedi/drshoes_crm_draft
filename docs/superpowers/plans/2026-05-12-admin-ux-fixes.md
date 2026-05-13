# Admin UX fixes — 2026-05-12 (post-M8 demo feedback)

Owner feedback after live test of admin UI. 4 fixes. Opus designs, Sonnet dispatches implement.

Backend port 8081 (host), 8080 (container). Web on 3000. Login `misza@drshoes.pl` / `change-me-on-first-login`.

## Locked decisions

- "Comfortable" density scale is locked (per session 2026-05-12 earlier turn).
- All UI strings Polish, code/comments English.
- Existing design tokens only (palette + status colors per `handoff/DESIGN_SYSTEM.md`). No new design tokens.
- Existing list URL params: `status` can repeat (`?status=PRZYJETE&status=WYDANE`) — backend already accepts arrays.
- Existing `OrdersFilters.tsx` already sends `type[]` as multi-select; mirror that pattern for status.

---

## Task ux-1 — Status multi-select + preset toggle-off

**Files:** `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx`, `apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx`, `apps/web/app/(admin)/admin/orders/page.tsx` (initial.status → string[])

**Goal:** Replace the single-select `<select>` for Status with a multi-select checkbox dropdown that integrates with presets. Make presets toggleable.

### Subtask 1a — multi-select status dropdown

- Build a small `StatusMultiSelect` component (client component, inside `_components/`) that opens a popover on click. Inside: a list of status options with checkboxes. Empty selection means "Wszystkie".
- Header label rules:
  - 0 selected → `Wszystkie`
  - 1 selected → that status's Polish label (use STATUS_LABELS_PL)
  - 2+ selected → `X statusów`
- Use STATUS_ORDER for option ordering (no WSTEPNIE_PRZYJETE — design system says hidden from manual UI; keep PRZYJETE..ANULOWANE).
- Wstępnie przyjęte stays out of the selectable set but should still appear in the displayed pill list if active in URL (defensive).
- Apply selections to URL via `push({ status: array })` similar to existing `onKind`.
- Footer of the popover: `Wyczyść` link (clears status param entirely) and `Zamknij`.
- Close popover on outside-click + Escape.
- A11y: use `role="button"` + `aria-expanded`, `aria-haspopup="listbox"`. Checkboxes are real `<input type=checkbox>`.
- Match the new comfortable scale: `text-[15px]`, `px-3 py-2`, `rounded-md`, focus ring acid. Pill chevron via "▾" character.

### Subtask 1b — Preset toggle-off

- In `SavedFilterPresets.tsx`: when a chip is clicked while it is the **active** preset, clear the URL params (push `/admin/orders` with no query). Otherwise apply.
- Add a separate `Wszystkie` reset chip that appears whenever any filter is active (any of: status, type, craftsmanId, q, tag, plannedPickupAt*, sort). Clicking it clears all params.
- Preserve existing keyboard/click handling, focus styles, log calls.

### ux-1 acceptance

- `?status=PRZYJETE&status=WYDANE` URL → status pill reads "2 statusów" + checkboxes for those two are checked.
- Click an active preset chip a 2nd time → URL becomes `/admin/orders` (no query) and status pill reads "Wszystkie".
- Click `Wszystkie` → same effect.
- Wstępnie przyjęte not in dropdown but if `?status=WSTEPNIE_PRZYJETE` is in URL the pill still says "Wstępnie przyjęte".

### ux-1 testing

Vitest unit covering:
- 0 / 1 / 2 selections produce correct header label.
- Click checked status → URL `status` param removed.
- Preset toggle: click-once activates, click-twice clears.
- `Wszystkie` button hidden when no filters active, shown when any active.

---

## Task ux-2 — Calendar Week + Day views with received + pickup markers

**Files:** `apps/web/app/(admin)/admin/orders/calendar/page.tsx`, new `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarWeekGrid.tsx`, new `CalendarDayGrid.tsx`. Possibly update `lib/calendar/api-server.ts` (no — window is parameterized).

**Goal:** Enable the disabled Tydzień / Dzień toggles. Show both receivedAt and plannedPickupAt markers per day.

### Design

URL params:
- `?mode=month|week|day` — defaults to `month` for back-compat.
- `?date=YYYY-MM-DD` — anchors the window (week = ISO week containing the date, day = that date).

Backend: `fetchCalendarWindow(from, to)` already returns scheduled + unscheduled for any window. NO backend changes.

**Important data note (errata):** the existing `CalendarOrderDto` has BOTH `plannedPickupAt` and `receivedAt` fields, BUT the comment + service population sets `receivedAt=null` for entries in the `scheduled` list (it's only filled for `unscheduled`). For week/day views we need **both** timestamps populated on every order so the same order can render as two markers on different days.
- Update `CalendarService` (or wherever the projection is built) to populate `receivedAt` always (even when the entry is in `scheduled`). Update the Javadoc to reflect the contract change.
- The two markers represent: (a) **received** = small acid dot anchored to received date; (b) **pickup** = magenta dot anchored to planned pickup date. Same order rendered on both dates.

**Layout:**
- Toggle: enable all three (miesiąc / tydzień / dzień). Active = filled acid, inactive = outlined, no longer disabled.
- Each tab Links to the same path with `?mode=…&date=…`.
- Week view: 7-column grid, header `pon/wt/śr/czw/pt/sob/nd`, each cell shows the date number + a list of mini chips for orders received that day (acid dot prefix) and orders to pick up that day (magenta dot prefix). Click chip → drawer.
- Day view: single-column tall card, hour breakdown not required; just list received + pickup blocks for that day.

### Polish week start

ISO week (Monday = first day). Use `Intl.DateTimeFormat`-style; no extra lib needed (date-fns is allowed if already in package.json).

### ux-2 acceptance

- `?mode=month` ≡ current behavior.
- `?mode=week&date=2026-05-12` shows Mon 11 – Sun 17 grid; the order with `receivedAt=2026-05-10` is NOT in this window; the order with `plannedPickupAt=2026-05-26` is NOT in this window; one with `receivedAt=2026-05-12` shows on Tue with acid dot.
- `?mode=day&date=2026-05-12` shows a single day card with both received and pickup orders.
- Tab toggle navigates between modes preserving `date`.
- Clicking a chip opens the drawer (same `?orderId=` pattern).

### ux-2 testing

Vitest for week/day mode resolution (date math) + visual snapshot of week grid with mocked data.

---

## Task ux-3 — Kanban sort + pin urgent

**Files:** `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx` (or the wrapper) + `apps/web/lib/kanban/types.ts` (add field) + **backend** `KanbanResponseDto.KanbanCardDto` (must add `receivedAt`) + `KanbanService` projection mapping to populate it.

**Errata discovered during planning:** `KanbanCardDto` currently only has `plannedPickupAt` and a derived `urgent` boolean — no `receivedAt`. Must add it to the record + populate from the entity.

**Goal:** In each column, sort cards by:
1. Pilne (tag === "pilne") first, in receivedAt asc order
2. Non-pilne next, in receivedAt asc order

### Design

Pure client sort applied after fetch. If receivedAt is null (e.g., WSTEPNIE_PRZYJETE), treat as far-future (sort to bottom of its group).

Visually mark pinned pilne cards with a thin magenta left border or a "📌 pilne" badge to make the sort visible. Use existing magenta token.

Add a sticky `Auto-sort` toggle to the column header showing current sort: `Pilne ↑ • Najstarsze ↑`. No backend filter needed — sort is on already-fetched data.

### ux-3 acceptance

- In each column the topmost card is the oldest pilne card.
- Below pilne, the oldest non-pilne card.
- If a column has zero pilne, sort is purely by receivedAt asc.
- Reordering happens client-side instantly when navigating between kanban renders.

### ux-3 testing

Vitest unit: pure sort function `sortKanbanCards(cards)` with mixed pilne/non-pilne + null receivedAt.

---

## Task ux-4 — Quote (wycena) + advance payment (zaliczka)

**Files:**
- Backend: new migration `V016__order_quote_and_advance.sql`. Edit `Order.java`, `OrderDto.java`, `OrderListRow.java`, `CreateOrderRequest.java`, `UpdateOrderRequest.java` (if present), `OrderService.create/update`. Maybe extend `OrderRepository` projections.
- Frontend: `apps/web/lib/orders/types.ts` (mirror), `apps/web/app/(admin)/admin/orders/new/_components/NewOrderForm.tsx`, `OrderDrawerCoreFields.tsx`.

**Goal:** Add two new monetary fields:
- `quotedPriceCents` (Wycena) — total quoted price. Independent of line-items (because items are optional).
- `advancePaidCents` (Zaliczka) — optional, defaults 0. How much customer has already paid.
- Derived: `balanceDueCents = quotedPriceCents - advancePaidCents` — display only, no DB column.

### Migration `V016__order_quote_and_advance.sql`

```sql
ALTER TABLE order_
  ADD COLUMN quoted_price_cents int NOT NULL DEFAULT 0,
  ADD COLUMN advance_paid_cents int NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_.quoted_price_cents IS 'Quoted total price in minor units (PLN cents). Independent of order_item totals — represents the workshop''s estimated final price.';
COMMENT ON COLUMN order_.advance_paid_cents IS 'Advance payment already collected from the client, in minor units. Defaults to 0. Always <= quoted_price_cents at the application layer (not constrained in DB to allow flexible workflows).';
```

NO check constraint on `advance_paid_cents <= quoted_price_cents` — too rigid for real workflows (overpayment, refunds, partial credits). Validate at the service layer with a warning, not a hard fail. For simplicity in this pass: just store whatever was sent.

### Entity (Order.java)

Add:
```java
@Column(name = "quoted_price_cents", nullable = false)
private int quotedPriceCents = 0;

@Column(name = "advance_paid_cents", nullable = false)
private int advancePaidCents = 0;
```

Plus getters/setters.

### DTOs

`OrderDto.java` add: `int quotedPriceCents, int advancePaidCents`.
`OrderListRow.java` add: `int quotedPriceCents, int advancePaidCents`.
`CreateOrderRequest.java` add: `Integer quotedPriceCents` (nullable, defaults to 0 in service), `Integer advancePaidCents` (nullable, defaults to 0).
`UpdateOrderRequest.java` (find it) add same.

### Service

`OrderService.create()`: set the two columns from request (default 0 when null).
`OrderService.update()`: support patching the two fields.

### Frontend types

```ts
export interface OrderDto { ..., quotedPriceCents: number; advancePaidCents: number; }
export interface OrderListRow { ..., quotedPriceCents: number; advancePaidCents: number; }
export interface CreateOrderRequest { ..., quotedPriceCents?: number; advancePaidCents?: number; }
```

### NewOrderForm

Add 2 fields under "Wykonawca" and above "Pozycje zlecenia":

- `Wycena (zł)` — number input (allow comma), mandatory if any items present; allow 0 (= TBD). Helper: "Łączna kwota za zlecenie".
- `Zaliczka (zł)` — number input, optional, default empty. Helper: "Pozostawiamy puste, jeśli klient nie wpłacił zaliczki".

Below the two inputs show a live preview line: `Do zapłaty przy odbiorze: <quoted - advance> zł` rendered in magenta when > 0, green when 0, admin-mute when wycena is empty.

Send `quotedPriceCents` + `advancePaidCents` in CreateOrderRequest.

### OrderDrawerCoreFields

Display both new values + "Do zapłaty" line under "Suma" (existing). Edit-in-place pattern follows the existing core-fields pattern.

### ux-4 acceptance

- Create new order with Wycena=350 zł, Zaliczka=100 zł → DB has `quoted_price_cents=35000, advance_paid_cents=10000`. Drawer shows: Wycena 350,00 zł, Zaliczka 100,00 zł, Do zapłaty 250,00 zł.
- Zaliczka left empty → `advance_paid_cents=0`. Drawer shows "Do zapłaty 350,00 zł".
- Wycena left empty → `quoted_price_cents=0`. Drawer shows "Wycena: —".
- Existing orders (created before migration) load with both = 0.

### ux-4 testing

Backend:
- `OrderServiceIntegrationTest`: create-with-quote-and-advance round-trips correctly.
- Drop / migrate idempotently (Flyway baseline test).

Frontend:
- Vitest for NewOrderForm submitting both fields.
- Vitest for "Do zapłaty" computation including negative case (zaliczka > wycena → "Nadpłata: X zł" in green or just clamp to 0 — pick simpler: clamp display to 0).

---

## Sequencing

All four tasks touch disjoint files except `lib/orders/types.ts` (ux-1 and ux-4 both add fields). Coordinate via separate diff blocks.

Dispatch order:
1. ux-1, ux-3 in parallel (smallest, pure FE)
2. ux-4 in parallel (backend + FE, biggest)
3. ux-2 in parallel (medium FE, calendar)

All can run in parallel because they touch different files; only `types.ts` is shared and the changes are additive (different blocks).

## Logging

Each dispatch writes `docs/dispatch-log/ux-<n>-<UTC>.md` with files/commands/test summary/decisions/commit SHA. Commit messages tag `[milestone:m8-fb][task:ux-<n>]`.

## Out of scope for this round

- Wykonawca column on list (separate ask).
- Saved-filter persistence (the `+ zapisz widok` chip stays disabled).
- Calendar drag-to-reschedule.
- Kanban manual reorder within column (auto-sort defines order).
