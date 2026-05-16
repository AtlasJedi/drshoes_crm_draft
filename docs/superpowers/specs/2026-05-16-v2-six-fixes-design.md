# V2 Six Fixes — Design

Owner: Eryk · Author: Opus 4.7 · Date: 2026-05-16

Second-round owner fix list. Six independent fixes, each dispatchable as its own
parallel package. This spec captures the design contract per fix and the rollout
order.

Decisions locked in this round (see clarifying answers `2026-05-16`):

- **Custom merge:** real schema rename (`CUSTOM_BUTY` + `CUSTOM_KURTKA` → `CUSTOM`).
- **Money buckets:** in-progress = `W_REALIZACJI` + `PRZYJETE`; finished = `WYDANE`.
- **Messages send:** bubble shows user input only; backend wraps in HTML template on send.
- **Kanban dialog:** reuse `StatusChangeTriggerDialog` verbatim. Single source of truth.
- **Calendar markers:** two markers per order (green received + red due).
- **Naming:** `Naprawa` → `Usługa` is **labels only** (enum `NAPRAWA` stays).
- **Drawer redesign:** rip-and-replace (info block + opis + status grid + history icons + photos placeholder).
- **Calendar urgent:** drop urgent magenta; red already means "due".

## Owner brief (verbatim, lightly tidied)

1. **Kanban drag is broken.** Drop on column shows popup with non-functional
   buttons; drag reverts. We want the same `PYK` / `PYK & SEND` dialog as the
   list-view status change. Same action, different invocation. Reuse — no copy.
2. **Calendar is broken.** It should display orders on the day they were taken
   in (green mark) AND the day they're due (red mark). Without a due date,
   default red marker at received+14 days. Clicking an order opens the exact
   same drawer as in the list. Month / week / day views all consistent.
3. **`Naprawa` → `Usługa` everywhere.** `Custom kurtka` + `Custom buty` collapse
   into a single `Custom`. Applies to filters, chips, donut, order items, copy.
4. **Dashboard money:** accumulated PLN on in-progress orders AND separately
   on finished orders.
5. **Messages section is broken.** One unified view, center scrolls (instead of
   making the page longer). Bubbles show plain text (no template markup).
   Sending uses our HTML email template; subject pinned to `Dr Shoes — followup`.
6. **New drawer design** (handoff zip extracted to
   `design/handoff/order-drawer-redesign/`). Functionality stays; apply the new
   layout: info compact, opis without label, status grid 3×2 paint-fill,
   history icons (5 stencil variants), clickable photo placeholders.

## Architecture / non-goals

Architecture follows existing patterns. No new infrastructure. Constraints:

- Backend stays Java 21 + Spring Boot. New migration `V025_*` covers the Custom merge.
- Frontend stays Next 16 App Router. Per-fix component boundaries match
  Granulated Code rule (Java < 120 LOC, TS < 80 LOC).
- All UI copy in Polish; structured logging on backend service operations.
- Owner directive: minimize main-session context. Each fix dispatched as a
  separate Sonnet package reading the plan from disk.

**Non-goals:**

- No new public-site work.
- No SMS provider work.
- No reply-handling semantics change beyond the EMAIL-template wrap.
- Drawer redesign does NOT extend behavior — only re-shapes existing handlers.

---

## Fix A — Kanban drag dialog

### Goal

Kanban drag-and-drop status change goes through `StatusChangeTriggerDialog`
(PYK + PYK & SEND + note + location picker). One code path for status change
across list, kanban, and drawer.

### Root cause

`useKanbanDnd.ts` mounts a custom `KanbanDragPopup.tsx` with a non-functional
`podgląd` button and a single `wyślij` button. Drag cancel reverts the optimistic
move. The list view already uses `StatusChangeTriggerDialog` — kanban diverged.

### Plan

1. **Delete `KanbanDragPopup.tsx`** entirely.
2. **`useKanbanDnd`** keeps the optimistic-move + snapshot pattern. Expose
   `pendingMove` for the dialog mount.
3. **`KanbanBoardWrapper`** loads `locations` (server prop or `listLocations()`
   call) and renders `StatusChangeTriggerDialog` when `pendingMove` is set, with
   props: `{ open: true, fromStatus, toStatus, orderId, clientName,
   triggerPreview, currentLocation, locations }`.
4. **`onConfirm(sendTriggers, note, location)`** — call `changeStatus(orderId,
   toStatus, version, sendTriggers, note)` and, when `location` is set, follow
   up with `addOrderNote(orderId, { location })`. Same pattern as
   `OrderDrawerStatusChanger.handleConfirm`.
5. **`onCancel`** reverts the optimistic move (existing behavior).

### Files

- DELETE: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanDragPopup.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/kanban/useKanbanDnd.ts`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoardWrapper.tsx`
- ADD test: `__tests__/useKanbanDnd.test.tsx` — confirm StatusChangeTriggerDialog mounts on drag end + location flow.

### Acceptance

- Drag card from `PRZYJETE` → `W_REALIZACJI` opens the same dialog as the list view.
- `PYK` calls `changeStatus(..., false)`; `PYK & SEND` calls
  `changeStatus(..., true)`; optional note + optional location picker work.
- Drag cancel via dialog close reverts the optimistic move.
- All 3 kanban tests still pass; new test confirms dialog mount + `sendTriggers` flag plumbing.

---

## Fix B — Calendar overhaul

### Goal

Each scheduled order renders TWO markers across all three calendar modes:

- **Green** at `receivedAt` (day order was taken in)
- **Red** at `effectivePickupAt = COALESCE(plannedPickupAt, receivedAt + 14 days)`

Clicking either chip opens the standard `OrderDrawer` via `?orderId=` URL.
`BezTerminuPanel` is dropped — orders without a planned pickup get an
auto-default red marker at received+14d.

### Plan

1. **Backend `CalendarController`:** compute `effectivePickupAt` and a
   `pickupAtDefaulted` boolean per order. `effectivePickupAt = plannedPickupAt
   ?? receivedAt.plus(14, ChronoUnit.DAYS)`. Drop the `unscheduled` array from
   the response — every order is now scheduled.
2. **Backend `CalendarOrderDto`:** add `effectivePickupAt: Instant`,
   `pickupAtDefaulted: boolean`. Mark `plannedPickupAt` deprecated for the
   frontend (or remove if no other consumer).
3. **Frontend `CalendarResponseDto` mirror:** mirror the new fields; drop
   `unscheduled` consumption.
4. **`CalendarMonthGrid`:** bucket each order TWICE — once per
   `localDayFromIso(receivedAt)` as a green chip, once per
   `localDayFromIso(effectivePickupAt)` as a red chip. Drop
   `colorOfStatus()` background swatches in favor of green/red dot+chip.
   Up to 3 chips per cell + `+N więcej` overflow stays.
5. **`CalendarWeekGrid` + `CalendarDayGrid`:** already use a two-marker pattern
   (acid + magenta). Switch palette to green/red.
6. **`CalendarCell`:** chip rendering simplified — green or red border, no
   status-color mode. Tooltip shows `code · clientName · received|due`.
   Optional dashed/striped red border when `pickupAtDefaulted` to signal
   "default due date".
7. **`BezTerminuPanel`:** delete file. Update `calendar/page.tsx` to drop the
   2-column grid (now grid is full-width).

### Files

- EDIT: `backend/app/src/main/java/com/drshoes/app/order/api/CalendarController.java`
- EDIT: `backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java`
- EDIT: `apps/web/lib/calendar/types.ts`
- EDIT: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarMonthGrid.tsx`
- EDIT: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarWeekGrid.tsx`
- EDIT: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarDayGrid.tsx`
- EDIT: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx`
- EDIT: `apps/web/app/(admin)/admin/orders/_components/calendar/utils.ts`  (drop colorOfStatus or repurpose)
- DELETE: `apps/web/app/(admin)/admin/orders/_components/calendar/BezTerminuPanel.tsx`
- EDIT: `apps/web/app/(admin)/admin/orders/calendar/page.tsx`
- TESTS: update `__tests__/CalendarMonthGrid.test.tsx`, `__tests__/CalendarWeekGrid.test.tsx`, add coverage for `effectivePickupAt` fallback.

### Acceptance

- Order received `2026-05-16` with `plannedPickupAt = 2026-05-25`:
  - month view shows two chips (green on 16, red on 25)
  - clicking either opens drawer for that order
- Order received `2026-05-01` with `plannedPickupAt = null`:
  - month view shows a green chip on May 1, a defaulted red chip on May 15 (received + 14d)
  - red chip has dashed/striped border to signal default
- Week + day views show same green/red logic.
- No `bez terminu` panel.

---

## Fix C — Naprawa → Usługa labels + Custom merge

### Goal

- UI label `NAPRAWA` → `"Usługa"` everywhere.
- DB schema + enum collapse `CUSTOM_BUTY` and `CUSTOM_KURTKA` into a single
  `CUSTOM` value.
- Filters, chips, donut, new-order form all show one `Custom` option.

### Plan

#### Backend (real schema migration)

1. **Migration `V025__order_item_kind_custom_merge.sql`:**
   ```sql
   -- 1. backfill existing rows
   UPDATE order_item SET kind = 'CUSTOM'
   WHERE kind IN ('CUSTOM_BUTY', 'CUSTOM_KURTKA');

   -- 2. drop old check constraint, add new one
   ALTER TABLE order_item DROP CONSTRAINT order_item_kind_check;
   ALTER TABLE order_item ADD CONSTRAINT order_item_kind_check
     CHECK (kind IN ('NAPRAWA', 'CUSTOM'));
   ```
   Note: audit_log entries that reference the old strings stay intact (history is immutable).
2. **`OrderItemKind.java`:** enum becomes `NAPRAWA, CUSTOM`.
3. **`OrderRepository.ordersPerWeek` query:** `NAPRAWA` check stays; `custom` aggregation
   replaces the OR-of-two-values with single `kind='CUSTOM'`.
4. **`DemoOrderFactory.java`:** seed `CUSTOM` instead of `CUSTOM_BUTY` / `CUSTOM_KURTKA`.
5. **`DashboardChartsController.mixByType`:** SQL returns 2 rows (NAPRAWA, CUSTOM).
6. **`TemplateContextBuilder`:** `typ_pracy` placeholder uses new labels:
   - `NAPRAWA` → `"usługa"`
   - `CUSTOM` → `"custom"`
7. **Tests:** update `OrderRepositoryIntegrationTest`, `DashboardChartsControllerIntegrationTest`, `OrderItemServiceQuotedSyncIntegrationTest`.

#### Frontend (labels + types)

1. **`apps/web/lib/orders/types.ts`:** `OrderItemKind = "NAPRAWA" | "CUSTOM"`.
2. **`apps/web/lib/orders/status.ts`:**
   ```ts
   NAPRAWA: "Usługa",
   CUSTOM:  "Custom",
   ```
3. **`MixDonut.tsx`:** two slices — `Usługa` (acid) + `Custom` (pink).
4. **`OrdersFilters.tsx`:** `ALL_KINDS = ["NAPRAWA", "CUSTOM"]`.
5. **`NewOrderForm.tsx` (item kind selector):** two options: Usługa / Custom.
6. **`OrderItemRow.tsx` / `ItemEditRow.tsx`:** kind labels updated.
7. **Public site `Services.tsx`:** copy update.
8. **Tests updated:** `Services.test.tsx`, `MixDonut.test.tsx`, `ReadyForPickupPanel.test.tsx`, `RowQuickActionsMenu.test.tsx`, e2e specs.

### Files

- ADD:    `backend/app/src/main/resources/db/migration/V025__order_item_kind_custom_merge.sql`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemKind.java`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardChartsController.java`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/demo/DemoOrderFactory.java`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContextBuilder.java`
- EDIT:   `apps/web/lib/orders/types.ts`
- EDIT:   `apps/web/lib/orders/status.ts`
- EDIT:   `apps/web/lib/dashboard/types.ts`
- EDIT:   `apps/web/app/(admin)/admin/_components/MixDonut.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderItemRow.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/ItemEditRow.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/new/_components/NewOrderForm.tsx`
- EDIT:   `apps/web/app/(public)/_components/Services.tsx`
- EDIT:   tests + e2e specs that reference `NAPRAWA` / `CUSTOM_*` / `Naprawa` / `Custom buty` / `Custom kurtka`.

### Acceptance

- Migration runs cleanly on test DB; existing `CUSTOM_BUTY` rows now read `CUSTOM`.
- All filters / chips / donut / forms render `Usługa` and `Custom`.
- API contract: `POST /admin/orders { items: [{ kind: "CUSTOM" }] }` works; `"CUSTOM_BUTY"` rejected by validation.
- Backend test suite green; frontend vitest green.

---

## Fix D — Dashboard money tiles

### Goal

Replace `Nowe rezerwacje (7d)` + `Przychód · miesiąc` with two money tiles:

- **`Pieniądze w realizacji`** — sum of `total_price_cents` where status IN (`W_REALIZACJI`, `PRZYJETE`) AND `deleted_at IS NULL`.
- **`Wydane · miesiąc`** — sum of `total_price_cents` where status = `WYDANE` AND `picked_up_at` falls within current month (Europe/Warsaw).

Top row stays 4 tiles. The two count tiles (`W realizacji`, `Gotowe do odbioru`) stay.

### Plan

1. **`OrderRepository.java`:**
   - `sumTotalPriceByStatusIn(Set<OrderStatus>)` — query: `SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.status IN :statuses`.
   - `sumTotalPriceByPickedUpBetween(Instant from, Instant to)` — query: `... WHERE o.deletedAt IS NULL AND o.status = 'WYDANE' AND o.pickedUpAt >= :from AND o.pickedUpAt < :to`.
2. **`DashboardController`:** compute new sums + format. Add fields to `DashboardKpiDto`:
   - `inProgressMoneyCents: long`, `inProgressMoneyFormatted: String`
   - `pickedUpMoneyMonthCents: long`, `pickedUpMoneyMonthFormatted: String`
3. **`apps/web/lib/dashboard/types.ts`:** mirror new fields.
4. **`KpiTilesRow.tsx`:**
   - Tile 1: W realizacji (count) — unchanged.
   - Tile 2: Gotowe do odbioru (count) — unchanged.
   - Tile 3: Pieniądze w realizacji (`inProgressMoneyFormatted`).
   - Tile 4: Wydane · `monthLabel` (`pickedUpMoneyMonthFormatted`).
5. **Tests:** new `DashboardControllerIntegrationTest` cases for the two sums (in-progress + this-month picked up).

### Files

- EDIT: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- EDIT: `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardKpiDto.java`
- EDIT: `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardController.java`
- EDIT: `apps/web/lib/dashboard/types.ts`
- EDIT: `apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx`
- TESTS: `DashboardControllerIntegrationTest` (new file or extend existing).

### Acceptance

- KPI endpoint returns the four count + money fields with PL-formatted strings.
- Top KPI row shows two count tiles + two money tiles, in that order.
- Picked-up money tile resets to `0,00 zł` on the first of each month.

---

## Fix E — Messages rebuild

### Goal

- **One unified view**, center column scrolls (fixed-height, content overflows
  vertically; page does not stretch).
- **Plain-text bubbles** — `MessageBubble.body` shows ONLY the user-typed content
  (no greeting / sign-off boilerplate).
- **Send goes through the followup HTML template** — outbound emails wrap the
  user's content inside our branded HTML wrapper. Subject pinned to
  `Dr Shoes — followup`. No subject input on the composer.

### Plan

#### Backend

1. **Migration `V026__seed_followup_template.sql`:** insert
   `message_template` row:
   ```
   name      = 'Dr Shoes - followup (EMAIL)'
   channel   = 'EMAIL'
   subject   = 'Dr Shoes — followup'
   body      = '{wiadomosc_tresc}'                         -- plain-text body
   body_html = <HTML wrapper from design/archive/email-templates-2026-05-16/templates/02-ready-for-pickup.html, content slot replaced with {wiadomosc_tresc}>
   active    = TRUE
   ```
2. **`TemplateContextBuilder`:** add optional `userMessage` overload —
   `buildContext(orderId, clientId, userMessage)` injects `wiadomosc_tresc =
   userMessage` into the placeholder map.
3. **`MessageRouter.sendNewToClient` (and `sendReply` for EMAIL channel):**
   route through the followup template instead of raw subject+body.
   - Resolve template by name `"Dr Shoes - followup (EMAIL)"`.
   - Build context with `userMessage = req.body`.
   - Render template subject + body + bodyHtml.
   - Persist `MessageEntity` with `body = req.body` (user's plain text — for
     bubble display) and `bodyHtml = rendered bodyHtml` (wrapped, for the
     gateway). Subject = rendered template subject.
   - Dispatcher sends `bodyHtml` to the gateway (existing path).
4. **SMS path unchanged** — direct body, no template wrap.

#### Frontend

1. **`MessagesShell.tsx`:** verify the grid + min-h-0 chain. Add explicit
   `min-h-0` on the main column so `flex-1 overflow-auto` inside
   `SelectedThread` produces a scrolling region rather than stretching.
2. **`SelectedThread.tsx`:** the message-list `<div>` already has
   `flex-1 overflow-auto`; verify and add `min-h-0` if missing.
3. **`MessageBubble.tsx`:** no change — it already displays `m.body` which now
   stores the plain user input.
4. **`NewMessageDialog.tsx`:** remove the subject input field entirely for EMAIL channel. Body input stays. Body label = `Treść` (unchanged).
5. **`ReplyComposer.tsx`:** remove the subject input field for EMAIL channel. Body input stays.
6. **Tests:** update `NewMessageDialog.test.tsx`, `ReplyComposer.test.tsx`, `useReplyComposerState.test.tsx` to drop subject expectations.

### Files

- ADD:    `backend/app/src/main/resources/db/migration/V026__seed_followup_template.sql`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContextBuilder.java`
- EDIT:   `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java`
- EDIT:   `apps/web/app/(admin)/admin/messages/_components/MessagesShell.tsx`
- EDIT:   `apps/web/app/(admin)/admin/messages/_components/SelectedThread.tsx`
- EDIT:   `apps/web/app/(admin)/admin/messages/_components/NewMessageDialog.tsx`
- EDIT:   `apps/web/app/(admin)/admin/messages/_components/ReplyComposer.tsx`
- EDIT:   `apps/web/app/(admin)/admin/messages/_components/useReplyComposerState.ts`
- TESTS:  vitest updates above + backend integration test for sendNewToClient using followup template.

### Acceptance

- New message → bubble shows user's plain text exactly as typed.
- Gmail inbox receives a fully branded HTML email with subject `Dr Shoes — followup`.
- 30+ message thread: center column scrolls; messages-page chrome stays fixed.
- Reply path: same wrapping; subject input gone for EMAIL.

---

## Fix F — Order drawer redesign

### Goal

Apply the handoff redesign (`design/handoff/order-drawer-redesign/`):

- **Info compact:** klient row + 4-col stats (czas / wycena / zaliczka / do zapłaty)
- **Opis:** textarea with placeholder, no separate label, acid corner tag
- **Status grid:** 3×2 paint-fill buttons with hover stripe, click opens
  `StatusChangeTriggerDialog` (same as kanban after Fix A)
- **History icons:** 5 stencil variants — `creation`, `status_change`, `note`,
  `message`, `done`
- **Photos placeholder:** clickable empty tiles, no separate upload button

Functionality preserved end-to-end. Backend handlers (changeStatus, photo
upload, note add, timeline fetch) untouched. Only the React tree changes.

### Plan

#### Components

| New / Rework | File | Purpose |
|---|---|---|
| NEW | `OrderDrawerInfoBlock.tsx` | KLIENT row + 4-col stats grid (czas / wycena / zaliczka / do zapłaty) |
| NEW | `OrderDrawerOpis.tsx` | Textarea (no label) + acid corner tag |
| NEW | `OrderDrawerStatusGrid.tsx` | 6 paint-fill buttons; click → StatusChangeTriggerDialog |
| NEW | `HistoryIcon.tsx` | 5 stencil variants (creation / status_change / note / message / done) |
| REWORK | `OrderDrawerPhotos.tsx` | Clickable empty tiles inline with thumbnails |
| REWORK | `OrderDrawerNotes.tsx` | Render via HistoryIcon |
| REWORK | `OrderDrawerTimeline.tsx` | Render via HistoryIcon (status_change uses target-status color) |
| DELETE | `OrderDrawerCoreFields.tsx` | Replaced by `OrderDrawerInfoBlock` |
| DELETE | `OrderDrawerStatusChanger.tsx` | UI replaced by `OrderDrawerStatusGrid`; dialog flow moves into the grid component |
| DELETE | `OrderDrawerStatusTimeline.tsx` | Stepper merged into header section |
| DELETE | `OrderDrawerTagsRow.tsx` | Tags moved into `OrderDrawerInfoBlock` (small chip row, optional) |
| EDIT | `OrderDrawer.tsx` | Compose the new tree |
| EDIT | `OrderDrawerHeader.tsx` | Picks up stepper from handoff |

#### Backend

1. **Timeline curator:** add a `done` event kind emitted when a status change
   transitions an order to `WYDANE`. Distinct from generic `status_change` so
   the new `done` icon (ink tile + acid check) renders.
   - `TimelineEventCurator.curate`: when `op == "ORDER_STATUS_CHANGE"` and the
     `to` arg is `WYDANE`, emit kind `DONE` instead of `STATUS_CHANGE`.
   - Add `DONE` to whatever timeline-event-kind enum / discriminator the
     curator emits.

#### CSS / Tokens

- All required CSS classes (`.status-btn.s-*`, `.hist-icon`, `.photo-add`, etc.)
  are visually defined in `design/handoff/order-drawer-redesign/index.html`.
  Port them to Tailwind utility classes or a small SCSS module
  `apps/web/app/(admin)/admin/orders/_components/OrderDrawer/drawer.module.css`.

#### Files

- ADD:    `apps/web/app/(admin)/admin/orders/_components/OrderDrawerInfoBlock.tsx`
- ADD:    `apps/web/app/(admin)/admin/orders/_components/OrderDrawerOpis.tsx`
- ADD:    `apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusGrid.tsx`
- ADD:    `apps/web/app/(admin)/admin/orders/_components/HistoryIcon.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderDrawerPhotos.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx`
- EDIT:   `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`
- DELETE: `OrderDrawerCoreFields.tsx`, `OrderDrawerStatusChanger.tsx`, `OrderDrawerStatusTimeline.tsx`, `OrderDrawerTagsRow.tsx`
- ADD:    `apps/web/app/(admin)/admin/orders/_components/OrderDrawer/drawer.module.css`  (or extend Tailwind config)
- EDIT:   `backend/.../audit/timeline/TimelineEventCurator.java` (+ enum + tests) to emit `DONE`.

### Acceptance

- Visual fidelity to `design/handoff/order-drawer-redesign/index.html`.
- Click any status grid button → `StatusChangeTriggerDialog` opens with that target.
- Photos grid empty tile triggers the same file picker used today; new thumbs join the grid.
- Timeline renders 5 different icon variants; `done` icon appears for any WYDANE entry.
- All existing drawer integration tests still pass with renamed components.

---

## Rollout order

Six packages, six atomic commits + dispatch-log entries. All target branch
`main`. Tag: `[milestone:v2-fixes][task:v2-X]`. Combined single-stage review for
fixes A / C / D / E. Two-stage review for B (calendar refactor touches 4 files
backend + 6 files frontend) and F (drawer rip-and-replace, > 500 LOC).

```
A — kanban dialog       single-stage   ~100 LOC TS
C — naming / merge      single-stage   ~migration + ~250 LOC across BE+FE
D — money tiles         single-stage   ~80 LOC BE + ~30 LOC FE
E — messages rebuild    single-stage   ~migration + ~150 LOC
B — calendar overhaul   TWO-STAGE      ~70 LOC BE + ~200 LOC FE
F — drawer redesign     TWO-STAGE      ~600 LOC FE + ~40 LOC BE
```

A / C / D / E can run in parallel as the first wave. B + F dispatched in
the second wave once the first wave has merged (B touches calendar code that A
does not; F depends on A landing first — it consumes `StatusChangeTriggerDialog`
through `OrderDrawerStatusGrid`).

### Wave 1 (parallel, single-stage)

- v2-A — kanban dialog reuse
- v2-C — naming / Custom merge
- v2-D — dashboard money tiles
- v2-E — messages rebuild

### Wave 2 (parallel, two-stage)

- v2-B — calendar overhaul (depends on nothing in wave 1; could be wave 1 but bigger surface)
- v2-F — drawer redesign (consumes StatusChangeTriggerDialog from v2-A)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `CUSTOM_BUTY` referenced in test fixtures that aren't migrated | Grep before dispatch; include the test grep result in the dispatch prompt |
| Existing audit_log rows hold old enum strings | Audit is immutable history — leave as-is; only the live enum drops the old values |
| Drawer redesign breaks Playwright selectors | Re-export `data-testid="order-drawer-*"` on the new components; rerun the demo-flow e2e before commit |
| Calendar fallback red marker conflicts with a real `plannedPickupAt = receivedAt + 14d` (collision) | Use the `pickupAtDefaulted` flag to render dashed border; otherwise solid red — visually distinct |
| Followup template HTML is large; bumps `message_template.body_html` size on every send | One-time row insert; per-message render reuses the wrapper — no row growth |
| Gmail SMTP from `putiatycki.p@gmail.com` previously configured in `2026-05-16-six-fixes.md` — verify still wired | Sanity: check `application.yaml`, `drshoes.email.provider`, and Gmail credentials in vault before v2-E lands |

---

## Open follow-ups (intentionally deferred)

- SMS path through templates (out of scope; SMS stays direct-body).
- Public-site `Services.tsx` aesthetic refresh (label change in scope; full
  copy refresh deferred).
- Replacing `OrderDrawerMessages` thread embed (kept as-is for now).
- Removing the now-redundant `BezTerminuPanel` test file (covered in v2-B).
