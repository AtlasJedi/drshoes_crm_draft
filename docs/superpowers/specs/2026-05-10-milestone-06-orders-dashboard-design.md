# Milestone 6 — Order processing polish + Dashboard

**Authored:** 2026-05-10 (opus/owner brainstorm).
**Predecessor:** Milestone 5 (Inbound parsing + reply UI + cross-client inbox) closed at tag `milestone-5`, suite 301/0/1/0 (one carried FK-ordering flake fixed in W0).
**Successor (parked):** Milestone 7 — Clients UI + Sklep / Aktualności minimal stubs.
**ROADMAP scope lock (2026-05-10):** Sklep + Aktualności become stubs only; M6 is "make the daily Misza-flow smooth" — Dashboard with real data, Calendar, Kanban, list polish.

## 1. Objective

Close the daily-workflow loop. M1 shipped the Orders list + drawer; M2 added messaging + triggers; M3-M5 layered photos, real providers, and the cross-client inbox. M6 turns those building blocks into the at-a-glance + at-the-board operational surface the workshop runs on:

- **Dashboard** with live KPIs, an 8-week orders-per-week stacked bar, a current-mix donut, and two top-N panels (gotowe-do-odbioru + ostatnie-wiadomości).
- **Calendar** view of orders by `planned_pickup_at`, click-to-drawer, side panel for orders without a planned date.
- **Kanban** board across the five status columns, drag-to-change-status routed through the existing M2 trigger-preview confirmation.
- **List polish:** saved filter presets, bulk status change, and a row-level quick-actions menu.
- **W0 hygiene clear:** the four pieces of debt carried out of M4 + M5 close.

By the end of M6, the workshop owner can:

1. Open `/admin` and see real numbers — count of in-progress orders, count gotowe-do-odbioru, today's intake count, this month's revenue (formatted PLN), the orders/week stacked bar, and the current type-mix donut.
2. See top-N panels of orders ready for pickup and the most recent inbound messages.
3. Switch from `/admin/orders` (Lista) to `/admin/orders/calendar` (Kalendarz) with one click on a shared view-tab strip; see the month grid populated with orders by planned pickup date; click any order to open the existing drawer; see undated orders in the side panel "Bez terminu".
4. Switch to `/admin/orders/kanban` (Kanban); see five columns; drag a card from one column to another → the existing trigger-preview dialog opens with the matching template; pick "Wyślij wiadomość" or "Tylko zmień status" → status changes + audit row + (optionally) trigger fires; on cancel/error → optimistic move reverts.
5. On the Lista, click one of three saved-filter chips ("Pilne na ten tydzień", "Gotowe do odbioru", "Zaległe") → URL params populate, table re-renders.
6. Tick checkboxes on multiple rows → a sticky bulk-action bar appears with a status dropdown + sendTriggers toggle; submit → up to 100 orders transition through the existing per-order pipeline; result modal shows succeeded/failed mix.
7. Hover any row → click the three-dot menu → quick-fire status bump / send message / add photo without opening the drawer.

## 2. Out of scope (deferred)

- **Calendar drag-to-reschedule.** Read-only month view in M6; drag-to-move-orders and drag-from-Bez-terminu deferred. Heaviest single feature in candidate scope; owner explicitly elected the lighter path.
- **Calendar week & day views.** `admin.jsx` only mocks the Month grid; Week/Day need separate design exports. Toggle buttons render visible-but-disabled with "wkrótce" tooltip in M6.
- **Inline cell edit on the orders table.** Three-dot menu + drawer are the M6 paths to a fast edit; click-into-cell-edit deferred.
- **Keyboard shortcuts** (j/k navigation, n new, / search). Not in M6.
- **History-as-tab restructure** of the OrderDrawer Timeline. Drawer Timeline already exists from M1; the BRIEF's "tab" framing is a cosmetic shuffle deferred.
- **Custom saved presets ("+ zapisz widok").** Three hard-coded presets in M6; user-defined presets parked.
- **"Najnowsze rezerwacje ze sklepu" Dashboard panel.** Sklep is M7-stub-only — no real data exists. Two lower-row panels in M6 (Gotowe-do-odbioru + Ostatnie wiadomości) instead of three.
- **Async / batched bulk-status fan-out.** Up to 100 orders run synchronously in one request. Flagged as M7 hygiene if perf bites.
- **Dashboard panel-specific endpoints.** Two existing endpoints (orders list + threads list) feed the panels; no new backend tasks for them.
- **Sklep + Aktualności surfaces.** Stubs ship in M7.

## 3. Locked decisions (from owner-led brainstorm)

| # | Decision | Why |
|---|---|---|
| 1 | **Full BRIEF Dashboard envelope** (4 KPI tiles + 2 charts + 2 lower-row panels), minus Sklep panel. | Owner picked breadth over depth; provides full at-a-glance surface in one milestone. |
| 2 | **Calendar read-only + click-to-drawer.** Drag-to-reschedule deferred. | Heaviest single piece in candidate scope; not strictly daily-flow critical given Lista + Kanban already enable status moves. |
| 3 | **Kanban full BRIEF: drag → trigger-preview confirm → status change.** Reuses M1 transition path + M2 trigger-preview dialog. | Cheapest place to add drag because both halves of the pipeline already exist; highest daily-flow value of the three views. |
| 4 | **List polish = presets + bulk + quick-actions** (not inline edit). | Inline edit was the heaviest list-polish candidate; the other three each ship cheap and cover daily-flow asks. |
| 5 | **Hybrid wave shape: backend-batch first, then per-surface frontend.** | Maximizes Sonnet parallelism on backend (matches dispatch protocol #2 + owner backend-heavy directive); paces frontend waves against design-export delivery one surface at a time. |
| 6 | **Dashboard stays at `/admin`.** No new `/admin/dashboard` route segment. | Sidebar already points there; saves route surgery. |
| 7 | **Calendar = Month-only in M6.** Toggle buttons render disabled with "wkrótce" tooltip. | `admin.jsx` only mocks Month grid; Week/Day need fresh exports. Visual parity preserved. |
| 8 | **Kanban drag flow = preview-then-commit.** Drop opens trigger-preview dialog; only on confirmation does the status endpoint fire. | Mirrors the existing drawer-driven status-change UX in M2; user always has an out before the network call. |
| 9 | **Saved presets are pure URL plumbing.** Three hard-coded chip definitions, no DB persistence. | YAGNI; the three preset query strings cover ~95% of the daily-flow asks and need zero schema. |
| 10 | **Empty/loading/error states are inline per FE wave**, not a closing sweep. | Cleaner dispatch story; each surface ships with its own skeletons. Replaced "W6 polish wave" with per-wave inclusion. |
| 11 | **Design-export-gating is explicit.** Every FE task names a `Design source:` (admin.jsx range, owner-supplied export file, or `INLINE: text-only stub`). | Hard rule per `feedback_no_layout_invention`. Plan tasks block until exports land. |
| 12 | **`pnpm lint` joins the closure bar.** | First milestone where the lint successor (W0/6-4) is wired; lints become part of the M6 verification rituals. |

## 4. Architecture & wave breakdown

| Wave | Theme | Tasks | Owner gate |
|---|---|---|---|
| **W0** | Hygiene debt clear | 6-1..6-4 | none |
| **W1** | Backend batch — 5 endpoints (parallel Sonnet) | 6-5..6-9 | none |
| **W2** | Dashboard FE | 6-10..6-12 | design export `m6-dashboard-states.html` |
| **W3** | Calendar FE | 6-13..6-16 | design export `m6-calendar-states.html` |
| **W4** | Kanban FE incl. drag | 6-17..6-20 | design export `m6-kanban-states.html` |
| **W5** | List polish FE | 6-21..6-23 | design exports `m6-bulk-action-bar.html`, `m6-row-quick-actions-menu.html` |

**Total estimate: 23 tasks** (vs M5's 21; M4's 16). Wave-by-wave dispatch; tasks within a wave parallel-dispatchable when independent.

### W0 — Hygiene
- **6-1** `AdminWebTestBase.seedUsers()` FK-ordering fix. Delete orders before clients (or `@Transactional` rollback). Targets `MessagesControllerIntegrationTest.emptyThreadReturnsEmptyList` — the carried error from M5 close.
- **6-2** `MessageRouter` 293-LOC split + `sendRetry/send` dedup (carried from M4). Extract per-channel routing into helper classes; collapse the duplicated send/retry path into one private method with a `RetryReason` enum.
- **6-3** `V013__message_thread_uniqueness.sql` migration + `@NotNull` validation on the entity field driving thread lookup (carried from M5 mid-flight). Exact column set on the unique index pinned at dispatch time after reading M5 thread-creation paths.
- **6-4** `pnpm lint` successor. Owner-flagged options: eslint-direct script wired through `lint-staged`, or `biome` adoption. Pick the simplest that lints `apps/web/` cleanly today; codify in `package.json` scripts. **Decision delegated to 6-4 author** with bias toward eslint-direct (less migration surface).

### W1 — Backend batch (5 endpoints)
All independent — parallel-dispatchable Sonnet subagents. Each writes its own controller + integration test. See Section 6 for contracts.

- **6-5** `GET /api/admin/dashboard/kpis` — 4-tile aggregations + PLN-formatted revenue.
- **6-6** `GET /api/admin/dashboard/charts` — 8-week stacked bar + mix donut data.
- **6-7** `GET /api/admin/orders/calendar?from=&to=` — windowed orders + `unscheduled[]`.
- **6-8** `GET /api/admin/orders/kanban?limitPerColumn=` — 5-column buckets in one shot.
- **6-9** `POST /api/admin/orders/bulk/status` — multi-order transition with per-order outcome[].

### W2 — Dashboard FE
- **6-10** `lib/dashboard/api-server.ts` + `types.ts` — typed fetchers for 6-5 + 6-6, plus reuse-clients for orders-list and threads-list (panel sources).
- **6-11** `KpiTilesRow` + `OrdersWeekChart` + `MixDonut` — three components in one task, each <80 LOC, three SVG charts adapted directly from `admin.jsx:86-148`.
- **6-12** `ReadyForPickupPanel` + `RecentMessagesPanel` + Dashboard page wiring + states. Wires all five components into the overwritten `/admin/page.tsx`. Loading skeletons + per-tile error fallback + empty states from the design export.

### W3 — Calendar FE
- **6-13** `lib/calendar/api-server.ts` + `types.ts` + `OrderViewTabs.tsx` shared component (Lista / Kalendarz / Kanban switcher placed once and reused). The shared tabs component refactors out of `OrdersList` if needed.
- **6-14** `CalendarMonthGrid.tsx` + `CalendarCell.tsx` — month grid + cells. Click-to-drawer via `?orderId=` URL param.
- **6-15** `BezTerminuPanel.tsx` — read-only side panel of `unscheduled[]`.
- **6-16** Calendar page wiring + states. `/admin/orders/calendar/page.tsx`, week/day toggle disabled with "wkrótce" tooltip, loading shimmer + error banner + empty grid + Bez-terminu empty.

### W4 — Kanban FE
- **6-17** `lib/kanban/api-server.ts` + `types.ts`.
- **6-18** `KanbanBoard.tsx` + `KanbanColumn.tsx` + `KanbanCard.tsx` — three components + dnd-kit `DndContext` wrapper.
- **6-19** `useKanbanDnd.ts` hook + drag→trigger-preview-confirm→status-change wiring. Extracts the M2 trigger-preview dialog from `OrderDrawerStatusChanger` so it can mount from outside the drawer (small M2 surgery flagged for inline review).
- **6-20** Kanban page wiring + states. `/admin/orders/kanban/page.tsx`, column skeleton + empty column + drag-ghost styling + error banner.

### W5 — List polish FE
- **6-21** `SavedFilterPresets.tsx` chip row + URL param plumbing. Three preset definitions hard-coded; no design export needed (chip styles already in `admin.jsx:266-272`). If backend list endpoint is missing any of `tag=`, `plannedPickupAtFrom/To=`, multi-status filter — add as inline backend slice 6-21a.
- **6-22** `useOrderRowSelection.ts` + `BulkActionBar.tsx`. Sticky-bottom bar appears with ≥1 row selected; status dropdown + sendTriggers toggle + anuluj button + result modal showing succeeded/failed mix from 6-9.
- **6-23** `RowQuickActionsMenu.tsx` — three-dot popover on the existing `…` cell with three menu items (status / message / photo); dispatches into existing M1 components (`StatusChangeConfirm`, `MessageComposerModal`, `PhotoUploader`).

### File map
**New backend (W1):**
- `backend/app/.../dashboard/api/DashboardController.java`
- `backend/app/.../dashboard/api/DashboardChartsController.java` (or merge into above if <120 LOC; decision at dispatch)
- `backend/app/.../order/api/CalendarController.java`
- `backend/app/.../order/api/KanbanController.java`
- `backend/app/.../order/api/BulkStatusController.java`
- Each with a sibling `*IntegrationTest.java` under `backend/app/src/test/java/...`

**Backend hygiene (W0):**
- `backend/app/src/test/java/.../AdminWebTestBase.java` (edit) — 6-1
- `backend/app/.../messaging/MessageRouter.java` (split into 2-3 files) — 6-2
- `backend/app/src/main/resources/db/migration/V013__message_thread_uniqueness.sql` (new) — 6-3
- `backend/app/.../messaging/domain/MessageThread.java` (edit, `@NotNull`) — 6-3

**New frontend (W2-W5):**
- `apps/web/lib/dashboard/{api-server.ts,types.ts}` — W2
- `apps/web/lib/calendar/{api-server.ts,types.ts}` — W3
- `apps/web/lib/kanban/{api-server.ts,types.ts}` — W4
- `apps/web/app/(admin)/admin/page.tsx` (overwrite) — W2
- `apps/web/app/(admin)/admin/_components/{KpiTilesRow,OrdersWeekChart,MixDonut,ReadyForPickupPanel,RecentMessagesPanel}.tsx` — W2
- `apps/web/app/(admin)/admin/orders/calendar/page.tsx` (new) — W3
- `apps/web/app/(admin)/admin/orders/_components/calendar/{CalendarMonthGrid,CalendarCell,BezTerminuPanel}.tsx` — W3
- `apps/web/app/(admin)/admin/orders/_components/{OrderViewTabs}.tsx` — W3 (shared)
- `apps/web/app/(admin)/admin/orders/kanban/page.tsx` (new) — W4
- `apps/web/app/(admin)/admin/orders/_components/kanban/{KanbanBoard,KanbanColumn,KanbanCard}.tsx` + `useKanbanDnd.ts` — W4
- `apps/web/app/(admin)/admin/orders/_components/{SavedFilterPresets,BulkActionBar,RowQuickActionsMenu}.tsx` + `useOrderRowSelection.ts` — W5
- Possibly `apps/web/components/state/{Skeleton,EmptyState,ErrorBanner}.tsx` if not already present (consolidated into one shared-primitives task at plan-write time).

## 5. Data model & migrations

**One migration this milestone:** `V013__message_thread_uniqueness.sql` (W0/6-3). Closes the M5 mid-flight gap where `message_thread` rows can duplicate per `(channel, client_id, …)`. Final column set on the unique index pinned at 6-3 dispatch after reading M5 thread-creation paths. Pairs with `@NotNull` validation on the entity field driving the lookup.

**Schema reuse** (no migrations needed):
- Calendar window groups by **`Order.planned_pickup_at`** (not `due_at` — the actual column name from M1).
- Bez-terminu panel = `WHERE planned_pickup_at IS NULL AND status NOT IN (WYDANE, CANCELLED)`.
- Dashboard "Nowe rezerwacje (today's intake)" = `WHERE received_at >= TODAY` (timezone Europe/Warsaw, via backend default zone).
- Dashboard "Przychód · ten miesiąc" = `SUM(Order.total_price_cents) WHERE received_at IN current month AND deleted_at IS NULL`. Backend formats to PLN string ("18 240 zł") to avoid currency drift in FE.
- Dashboard "W realizacji" + "Gotowe do odbioru" = count by `status` excluding soft-deleted.
- Kanban groups: same five `OrderStatus` values per BRIEF; each capped per bucket (default 50, `WYDANE` capped 10).
- All M6 surfaces filter `deleted_at IS NULL` consistently.

**Audit log impact:**
- Bulk status change writes one audit row per successful per-order transition through the existing aspect — no new audit type.
- Dashboard / Calendar / Kanban are read-only — no audit writes.

**No schema for:**
- Saved filter presets (pure URL-param plumbing).
- Bulk status change (per-order delegation through existing transition path).
- Quick actions menu (dispatches into existing M1 endpoints).

## 6. Backend API contracts

All admin-only via existing `SecurityFilterChain` on `/api/admin/**`. All return DTO records. All log INFO with correlation/actor/operation/outcome key=value fields per dispatch protocol #7.

### 6-5 · `GET /api/admin/dashboard/kpis`
```
{
  inProgressCount: number,
  readyForPickupCount: number,
  todayIntakeCount: number,        // received_at >= today (Europe/Warsaw)
  monthRevenueCents: number,       // SUM(total_price_cents) WHERE received_at IN current month AND deleted_at IS NULL
  monthRevenueFormatted: string    // backend-formatted PLN, e.g. "18 240 zł"
}
```

### 6-6 · `GET /api/admin/dashboard/charts`
```
{
  ordersPerWeek: [
    { weekIso: "2026-W11", repairs: number, custom: number }, ...   // last 8 ISO weeks ending current
  ],
  mixByType: [
    { kind: "REPAIR" | "CUSTOM_SHOES" | "CUSTOM_JACKETS", count, percent }
  ]
}
```
- Aggregation rule: order is "repair" if any item is `REPAIR`, else "custom" (donut + bar use the same projection).

### 6-7 · `GET /api/admin/orders/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
```
{
  scheduled: [
    { id, code, clientName, status, plannedPickupAt: ISO, itemSummary, urgent }
  ],
  unscheduled: [
    { id, code, clientName, status, receivedAt: ISO, itemSummary }
  ]
}
```
- Both query params required, range ≤ 92 days (400 above).
- `urgent` reuses existing M1 derived flag (tag `pilne` OR planned-pickup-at within 48h — exactly as `OrderDto` already exposes).
- `unscheduled[]` capped 50 by `received_at DESC`.
- Both arrays exclude `deleted_at` non-null and `status IN (WYDANE, CANCELLED)`.

### 6-8 · `GET /api/admin/orders/kanban?limitPerColumn=50`
```
{
  columns: [
    { status: "PRZYJETE",          total, cards: KanbanCardDto[], hasMore },
    { status: "W_REALIZACJI",      total, cards, hasMore },
    { status: "CZEKA_NA_KLIENTA",  total, cards, hasMore },
    { status: "GOTOWE_DO_ODBIORU", total, cards, hasMore },
    { status: "WYDANE",            total, cards, hasMore }   // tighter cap (10), ordered by picked_up_at DESC
  ]
}
KanbanCardDto = { id, code, clientName, itemSummary, plannedPickupAt: ISO|null, urgent }
```
- One round-trip for the whole board.
- `total` is the unfiltered count for the column header badge.
- `limitPerColumn` validation: 1-200, default 50; `WYDANE` always capped 10.
- Soft-deleted excluded throughout.

### 6-9 · `POST /api/admin/orders/bulk/status`
```
Request:
  { orderIds: UUID[], newStatus: OrderStatus, reason?: string, sendTriggers: boolean }
Response (always 200 unless request itself is malformed):
  {
    succeeded: [{ orderId, code, fromStatus, toStatus }],
    failed:    [{ orderId, code, fromStatus, error: "ILLEGAL_TRANSITION" | "NOT_FOUND" | "VERSION_CONFLICT" | "UNKNOWN" }]
  }
```
- Per-order delegation to existing `OrderStatusService.transition(...)`.
- `sendTriggers=true` runs the post-transition trigger pipeline (matching the drawer's status-change behavior); `false` skips trigger fan-out.
- Limit 100 IDs per request (413 above).
- Audit row written through existing aspect on each per-order success only.

### Conventions cross-checked
- Controllers under `.api` package per locked M1 errata.
- `@AuthenticationPrincipal` resolves `AdminPrincipal` via `authentication().getPrincipal()` per M5 part 3 lock.
- DTOs are records.
- Each new controller <120 LOC per dispatch protocol #6.
- Each gets a `*IntegrationTest.java` (NOT `*IT.java` — M3 convention lock; runs under Surefire so it actually executes).

## 7. Frontend module layout

(See Section 4/wave-breakdown above for the full file inventory; this section keys the design-export and component contracts.)

### Design-export contract

Each FE task includes a `Design source:` field on its dispatch log entry, with one of three values:

| Tag | Meaning |
|---|---|
| `admin.jsx:NNN-MMM` | Layout already exists in `handoff/design/admin.jsx`. Subagent verifies against that range, no fresh export needed. |
| `handoff/design/m6-<surface>-<state>.html` | Owner-supplied export from the Claude.ai design tool. |
| `INLINE: text-only stub` | Trivial states with no visual decisions (e.g. "Brak danych" centered text). |

**Workflow per FE wave:**
1. Before dispatching the wave, list every `[DESIGN-EXPORT-NEEDED]` task in that wave.
2. For each, write the Claude.ai prompt and post it in the chat.
3. Owner runs it on Claude.ai, saves the export to `handoff/design/m6-<surface>-<state>.html`, and reports filename(s).
4. Dispatch the wave's frontend tasks with `Design source:` pointing at the file.
5. Push back if any export is ambiguous BEFORE dispatching, not during the subagent's run.

### Layouts already in `admin.jsx` (no fresh export needed)

- Dashboard 4-tile row (`admin.jsx:86-91`)
- Orders/week stacked bar (`admin.jsx:108-127`)
- Mix donut (`admin.jsx:136-148`)
- Gotowe-do-odbioru list panel (`admin.jsx:154-174`)
- Ostatnie-wiadomości panel (`admin.jsx:176-200`)
- Calendar month grid (`admin.jsx:540-575`)
- Calendar cell (`admin.jsx:553-572`)
- Bez-terminu side panel (`admin.jsx:578-613`)
- Calendar view-tabs strip (`admin.jsx:511-520`)
- Kanban column header (`admin.jsx:679-685`)
- Kanban card (`admin.jsx:686-704`)
- Saved-preset chip row (`admin.jsx:266-272`)
- Filter chip styles (`admin.jsx:276-285`)

### New design exports needed (5 files)

1. **`m6-dashboard-states.html`** (W2) — tile / chart / panel skeletons + per-section empty + per-section error.
2. **`m6-calendar-states.html`** (W3) — cell shimmer + grid empty + error banner + Bez-terminu empty.
3. **`m6-kanban-states.html`** (W4) — column skeleton + empty column + drag-ghost styling + error banner.
4. **`m6-bulk-action-bar.html`** (W5) — sticky-bottom bar (selection count, status dropdown, sendTriggers toggle, anuluj) + post-bulk result modal.
5. **`m6-row-quick-actions-menu.html`** (W5) — three-dot popover with three menu items + dividers.

### Kanban drag flow (locked)

1. User drags a card from Column A → Column B.
2. On drop, FE optimistically moves the card; **does NOT call the status endpoint yet**.
3. Existing M2 trigger-preview confirm dialog opens, pre-loaded with the trigger template for transition `A→B` (extracted from `OrderDrawerStatusChanger` so it can mount from outside the drawer — surgery flagged for 6-19).
4. User picks "Wyślij wiadomość", "Tylko zmień status", or "Anuluj":
   - Wyślij/Tylko-zmień → `PATCH /orders/{id}/status` with `sendTriggers={true|false}`.
   - Anuluj → revert optimistic move.
5. On endpoint failure → revert optimistic move + Polish toast ("Nie udało się zmienić statusu — spróbuj jeszcze raz").
6. On endpoint success but trigger send failure → status change committed, toast "Wiadomość nie została wysłana" (M2 semantics; status not rolled back).

### Saved-preset chip definitions (locked)

| Chip | URL params |
|---|---|
| Pilne na ten tydzień | `?tag=pilne&plannedPickupAtFrom=<today>&plannedPickupAtTo=<today+7d>` |
| Gotowe do odbioru | `?status=GOTOWE_DO_ODBIORU` |
| Zaległe | `?plannedPickupAtTo=<yesterday>&status=W_REALIZACJI,GOTOWE_DO_ODBIORU` |

The chip row never persists user state in M6 — clicking just sets URL params. The "+ zapisz widok" dashed chip from `admin.jsx:271` renders disabled with a "wkrótce" tooltip.

### Calendar week/day toggle (locked)

The toggle buttons render visible-but-disabled with a "wkrótce" tooltip in M6. Clicking does nothing. Visual parity with `admin.jsx:521-529` preserved; behavior deferred until owner exports Week and Day grid layouts.

## 8. Error handling, edge cases, validation

### Backend
- **Auth** — handled by existing `SecurityFilterChain` (401/403); no per-endpoint code.
- **Validation errors** — Spring's `MethodArgumentNotValidException` → 400 via existing `GlobalExceptionHandler`.
- **Bulk-status partial failure** — never fails the whole request. 200 with `succeeded[]` + `failed[]`. Only HTTP 4xx if request itself is malformed (empty `orderIds[]`, >100 IDs, invalid enum).
- **Aggregation edge cases** — empty month returns revenue `0` + formatted `"0,00 zł"`. Zero orders this week → bar zero-height. Division-by-zero in mix-percent guarded.

### Frontend
- **ServerComponent fetch failure** — page-level `ErrorBanner` with refresh link. Dashboard tiles fetch independently — one failed tile/panel does not blank the whole dashboard.
- **Drawer-by-orderId failure** — reuses M1 inline "nie znaleziono" pattern on Calendar + Kanban surfaces.
- **Kanban optimistic drag** — revert on cancel, on endpoint 4xx/5xx, or on user dismiss of confirm dialog. Polish toast on failure paths.
- **Bulk action bar partial success** — result modal shows per-order failure rows with reason; selection cleared only on full success.

### Edge cases — explicit decisions
- **Soft-deleted orders** never appear in any M6 surface (`deleted_at IS NULL` everywhere).
- **Orders without items** in Kanban/Calendar — `itemSummary` empty string → FE renders `—`.
- **`WYDANE` orders** — appear in Kanban (5th column, capped 10), do NOT appear on Calendar (filtered out in both `scheduled[]` and `unscheduled[]`).
- **Bulk + sendTriggers=true** — runs synchronously for ≤100 orders. Acceptable in M6; flagged as M7 hygiene if perf bites.
- **Saved-preset URL params** — quick-check at 6-21 dispatch that backend list accepts `tag=`, `plannedPickupAtFrom/To=`, multi-status. If missing, inline backend slice as 6-21a (per the established M5 "5-17a" precedent).

## 9. Testing strategy

### Backend
- One `*IntegrationTest.java` per W1 endpoint (NOT `*IT.java` — M3 convention lock).
- W0 hygiene tests:
  - 6-1: Sanity test on `AdminWebTestBase` seed/teardown under inheritance.
  - 6-2: Unit tests for each helper class extracted from `MessageRouter`; both `send` and `sendRetry` paths exercised through the deduplicated entry point.
  - 6-3: `MessageThreadRepositoryUniquenessIntegrationTest` — duplicate-insert fails, legitimate inserts pass.
  - 6-4: `pnpm lint` runs clean on the current tree (CI-visible, not Maven).

| Endpoint | Test class | Cases |
|---|---|---|
| 6-5 KPIs | `DashboardKpiControllerIntegrationTest` | happy + zero state + auth-denied + revenue PLN format + soft-deleted excluded |
| 6-6 Charts | `DashboardChartsControllerIntegrationTest` | 8-week mix + zero weeks + projection rule + percent guard |
| 6-7 Calendar | `CalendarControllerIntegrationTest` | range happy + range >92d (400) + invalid range + unscheduled-only + status filter + soft-deleted excluded |
| 6-8 Kanban | `KanbanControllerIntegrationTest` | full board + empty board + `limitPerColumn` + `hasMore` + WYDANE tighter cap + soft-deleted excluded |
| 6-9 Bulk | `BulkStatusControllerIntegrationTest` | all-success + mixed mix + 0 ids (400) + 101 ids (413) + sendTriggers=false skips fan-out + audit per success |

### Frontend
- vitest for hooks (`useKanbanDnd`, `useOrderRowSelection`).
- Component tests thin — most M6 components are presentational. One test per component verifying it renders the design-export's text content + key data attrs.
- No Playwright in M6 (continues M3+ pattern).
- Empty/loading/error rendering tests — one snapshot or text-presence test per state per surface.

### Suite trajectory
- **Current:** 301 passed / 0 failed / 1 error / 0 skipped.
- **After W0 (6-1):** 301 / 0 / **0** / 0 — flake fixed.
- **After W1:** ~325 / 0 / 0 / 0 (~24 added across 5 endpoints).
- **After W2-W5:** ~340 / 0 / 0 / 0 (vitest tests not in `mvn verify` count).

## 10. Closure bar (M6)

Same shape as M5 + lint:

- `mvn -B verify` passes 0/0/0 on backend.
- `pnpm typecheck` clean.
- `pnpm build` clean.
- `pnpm lint` clean (NEW in M6 — wired via 6-4).
- One smoke pass through the new admin shell:
  - `/admin` Dashboard renders real numbers (4 tiles + 2 charts + 2 panels).
  - `/admin/orders` Lista loads, presets work, bulk works, quick-actions work.
  - `/admin/orders/calendar` renders Month grid + Bez-terminu.
  - `/admin/orders/kanban` renders 5 columns; drag → trigger-confirm → status changes.
- `milestone-6` tag annotated locally (consistent with M0a/0b/1/2/3/4/5 precedent — NOT pushed automatically).

## 11. Hygiene debt parked for M7

- Async / batched bulk-status fan-out if synchronous run gets slow at >50-order calls.
- Calendar drag-to-reschedule (heaviest deferred item from M6 candidate scope).
- Calendar Week & Day grid views.
- Inline cell edit on the orders table.
- Keyboard shortcuts.
- Custom user-defined saved presets ("+ zapisz widok").
- "Najnowsze rezerwacje ze sklepu" Dashboard panel — gated on M7+ Sklep real implementation.
- Order history-as-tab restructure of the OrderDrawer Timeline.

## 12. Plan author handoff

- Plan path: `docs/superpowers/plans/2026-05-10-milestone-06-orders-dashboard.md` (to be authored by `superpowers:writing-plans` after spec approval).
- ROADMAP.md gets M6 added to "In flight" with the plan path.
- `docs/dispatch-log/tasks.json` flips `active_milestone: "6"` and gets 6-1..6-23 populated when the plan lands.
- Resume prompt for next session, post-plan: "M6 plan landed. HEAD <sha>. Start with 6-1 cold per dispatch protocol — thin prompt, on-disk plan, dispatch log."
