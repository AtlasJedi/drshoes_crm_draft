# M11 fix batch — design spec

**Date:** 2026-05-16
**Milestone tag in commits:** `[milestone:m11]`
**Source of trigger:** owner direct feedback — 4 screenshots + verbal directive, 2026-05-16 ~19:30.

## Scope

Four independent fixes shipped as one batch. Backend + frontend + Playwright verification loop.

1. **Miejsce visible in list/kanban/calendar** — drawer shows the storage location chip, list views render "—". Fix the wiring and any backend sync gap.
2. **Order drawer redesign** — remove Wykonawca field, replace Planowany odbiór input with computed "X dni w warsztacie", add derived `urgent` flag with pink highlight and "Pilne" filter preset.
3. **Item math sweep** — adding/removing/editing items must drive Wycena, Do zapłaty, list Suma, kanban kwota, calendar amount, dashboard totals. `quotedPriceCents` becomes a denormalized mirror of `totalPriceCents` (= sum of items).
4. **Messages plain text + bubble layout** — `message.body` is canonical plain text; email gateway renders the HTML template at send time only. Admin bubble respects newlines, wraps long content, caps width.

Out of scope: Wykonawca data model removal (column stays); messaging schema changes (`bodyHtml` column NOT added); calendar-week-bounded urgency semantics (urgency is a current-state flag, not historical).

## Feature 1 — Miejsce visible in list/kanban/calendar

### Current state

- `Order` entity has both `current_storage_location_id` (UUID) and `location` (varchar 64, denormalized name).
- `OrderListRow.of(Order)` reads `o.getLocation()` — so the DTO field is populated by the entity getter.
- `OrdersTable.tsx:94` renders `{row.location ?? "—"}` plain text.
- Drawer header renders the existing location chip from `OrderDto.location` correctly.
- Owner-observed bug: DR-2026-0007 shows "szafa" in drawer header but "—" in list. Same field, different render. Likely the row was loaded *before* the location was set, or the list query path isn't reading the latest entity. Investigation step.

### Changes

**Frontend:**
- Replace the plain-text cell in `OrdersTable.tsx` with a small chip component matching the drawer header style: pink pin glyph + location name, e.g. `<LocationChip name={row.location} variant="sm" />`. When null, render nothing (no "—").
- Apply the same chip on `KanbanCard` and `CalendarCell`. Identify exact files: `apps/web/app/(admin)/admin/orders/_components/kanban/*.tsx`, `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx`.
- Extract the existing chip JSX from `OrderDrawerHeader.tsx` into a shared `LocationChip` component under `_components/_LocationChip.tsx` if not already factored. There is a `_LocationMoveChip.tsx` — confirm whether it's reusable.

**Backend:**
- Audit every writer of `current_storage_location_id` or `location`: ensure both are set together. Currently:
  - `OrderNotesService.java:66` does `o.setLocation(newLoc)` but does NOT touch `currentStorageLocationId`. Add: lookup the StorageLocation by name → set the UUID column too.
  - Order creation path — verify that if location is assigned at creation, both fields are persisted.
- Add a Spring `@PostLoad` or service-layer guard ONLY if data drift is found in practice. Don't pre-emptively over-engineer.

**Verification:** Playwright opens list, sees chip on rows with a location set; opens drawer, confirms same name shown; moves location via the move chip, confirms list reflects new name without a hard refresh (list re-fetches on close).

### Tests

- Backend unit: `OrderNotesService` test asserts `currentStorageLocationId` is set in addition to `location` after a move.
- Frontend vitest: `OrdersTable` renders `<LocationChip>` when `row.location` is set; renders nothing when null.

## Feature 2 — Drawer redesign

### Current state

- `OrderDrawerCoreFields.tsx` lines 79–99 contain `Planowany odbiór` (date input) and `Wykonawca` (select).
- `assignedCraftsmanId` lives on `Order`, returned in `OrderDto`, filtered by `?craftsmanId=` in OrderController.
- No `urgent` flag anywhere.

### Changes

**A. Remove Wykonawca from drawer.**
- Delete the `FieldRow label="Wykonawca"` block (lines 88–99) in `OrderDrawerCoreFields.tsx`.
- Remove the `users` prop and `UserStubDto` import if no other usage remains.
- Update `OrderDrawer.tsx` to stop passing `users`.
- `OrdersPage` keeps fetching `listUsersServer` ONLY if another component still needs it. Confirm; if not, drop the call to save a request.
- Backend `assignedCraftsmanId` column, DTO field, controller filter all STAY (per locked decision). Reversible.

**B. Replace Planowany odbiór input with computed days-in-shop.**
- New display:
  ```
  CZAS W WARSZTACIE
  N dni     (← grey by default, pink when urgent)
  ```
- Computation (frontend, single source — extract to a helper at `apps/web/lib/orders/dim.ts`):
  ```ts
  export function daysInShop(order: { receivedAt: string | null; status: OrderStatus; pickedUpAt: string | null }): number | null {
    if (!order.receivedAt) return null;
    if (order.status === "WYDANE" || order.status === "ANULOWANE") return null;
    if (order.status === "WSTEPNIE_PRZYJETE") return null;
    const now = Date.now();
    const recv = new Date(order.receivedAt).getTime();
    return Math.max(0, Math.floor((now - recv) / 86_400_000));
  }
  ```
- When `daysInShop` returns null, render "—".
- The Planowany odbiór **column on the list view stays** unchanged (per owner default).

**C. Derived `urgent` flag.**
- Frontend helper:
  ```ts
  export function isUrgent(order: { receivedAt: string | null; status: OrderStatus }): boolean {
    const d = daysInShop(order);
    return d !== null && d >= 14;
  }
  ```
- Backend mirror in `OrderListRow.of(...)` and `OrderDto.from(...)`: same predicate, new boolean field `urgent` on the DTOs.
- The mirror is for backend filtering (and to avoid recomputing on every row in TS). Frontend MAY use its own helper too — both produce the same value.

**D. Pink highlight on urgent rows.**
- List row: `tr` gets class `bg-magenta/10 border-l-2 border-magenta` when `urgent`. Existing `var(--magenta)` token reused.
- KanbanCard: same border + tint.
- CalendarCell: same tint, no border (cells don't have one).
- Drawer days-in-shop label uses `text-magenta` when urgent.

**E. "Pilne" filter preset.**
- New chip in `SavedFilterPresets` labelled "Pilne" with badge count (count from backend `?urgent=true` lightweight aggregate, or compute frontend from already-fetched rows; **simplest:** count from fetched page, accept the limitation).
- Backend `OrderController` accepts `?urgent=true` and adds the predicate `receivedAt IS NOT NULL AND status NOT IN ('WYDANE','ANULOWANE','WSTEPNIE_PRZYJETE') AND receivedAt <= now() - INTERVAL '14 days'`.
- Global search box (`q` param) — when input matches "pilne" or "pilne na ten tydzień" (case-insensitive, trimmed), the frontend should ALSO toggle the urgent filter for that query. Implemented in `OrdersFilters.tsx`: pre-process `q` before it leaves the form.

### Tests

- Backend unit: `isUrgent` predicate logic across statuses and receivedAt nulls.
- Backend repository: `?urgent=true` returns only matching rows; planted fixtures cover the boundary (exactly 14 days, 13 days, WYDANE older than 14 days).
- Frontend vitest: `daysInShop` and `isUrgent` helpers, plus `OrdersTable` snapshot showing pink class.

## Feature 3 — Item math sweep

### Current state

- `OrderItemService.recomputeTotal(UUID)` sums item priceCents into `Order.totalPriceCents`. Called after add/edit/remove.
- `quotedPriceCents` is a SEPARATE field on `Order`, set via `UpdateOrderRequest.quotedPriceCents`. Drawer `Wycena` writes to it.
- Drawer "Do zapłaty" = `max(0, quotedPriceCents - advancePaidCents)`.
- List `Suma` = same formula.
- Kanban / calendar / dashboard amount displays — to be audited.

### Changes

**Backend:**
- `OrderItemService.recomputeTotal` additionally sets `o.setQuotedPriceCents(total)`. `quotedPriceCents` is now a denormalized mirror of `totalPriceCents`.
- Remove the `quotedPriceCents` patch path from `OrderService.updateOrder` (silently ignore it, OR reject 400 — pick reject for clarity). Same for `CreateOrderRequest.quotedPriceCents` — items drive the value.
- `advancePaidCents` PATCH stays — that's user-managed.

**Frontend:**
- `OrderDrawerCoreFields.tsx` — "Wycena" becomes read-only:
  ```tsx
  <FieldRow label="Wycena">
    <p className="text-sm text-admin-ink font-mono">
      {(order.quotedPriceCents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
    </p>
  </FieldRow>
  ```
- The input + `plnToCents` + `patch("quotedPriceCents", ...)` block goes away.
- After every item add/edit/remove (already handled by `getOrder` refresh), the drawer re-renders with updated values.

**Sweep — verify Suma/kwota/total displays:**
- `OrdersTable.tsx:96` — `Math.max(0, row.quotedPriceCents - row.advancePaidCents)` — stays, will reflect new value.
- `KanbanCard` — find file, audit. Should use `quotedPriceCents - advancePaidCents` or `totalPriceCents`.
- `CalendarCell` — same.
- `RecentOrdersPanel` (dashboard) — same.
- Anywhere using `totalPriceCents` is fine (it's the same value now). Anywhere using a custom math is suspect.

### Tests

- Backend unit: `OrderItemServiceTest` covers add → quotedPriceCents == sum, remove → re-summed.
- Backend integration: PATCH `/orders/{id}` with `quotedPriceCents` is rejected (400) or silently ignored — pick reject and assert.
- Frontend vitest: `OrderDrawerCoreFields` shows Wycena as read-only, value tracks `order.quotedPriceCents`.

## Feature 4 — Messages plain text + bubble layout

### Current state

- `MessageBubble.tsx:46–48` renders `{m.body}` directly in a fixed-width bubble (`max-w-[78%]`), no `whitespace-pre-wrap`, no `break-words`.
- Recent commit `c3e3a2b feat(email): real SMTP outbound + designer-shipped HTML templates` introduced HTML templates. The visible bug in owner's screenshot is the entire template HTML rendered as raw text in a bubble — therefore `message.body` is being persisted as HTML.
- Inbound email path probably also stores HTML.

### Changes

**Storage model (locked):**
- `message.body` is plain text. **Always.**
- The HTML template is applied at email send time inside `EmailGateway` (or wherever the SMTP send is invoked from). Template wraps the plain-text body — no plain text is rendered into HTML and stored.
- SMS path is already plain text. No change.
- Inbound emails: strip HTML tags + collapse whitespace before persisting to `body`. Use a tiny helper (no full Jsoup dependency unless one is already present). Acceptable: `body.replaceAll("<[^>]+>", "").replaceAll("\\s+", " ").trim()` — verify with real Gmail-formatted inbound samples in the Playwright loop.

**Outbound trigger pipeline:**
- Investigate where the template body is composed pre-send. Most likely in `MessageOutboundService` or `TriggerService` → `MessageRouter`. Find the call site that builds `body` and ensure it produces plain text (no `<...>` markup).
- The HTML template lives in workshop config / a resource file. EmailGateway wraps the plain-text body in the template right before `MimeMessage` assembly. Subject line also plain text. PT: this is mostly verifying the existing pipeline is correct and the recent regression in `c3e3a2b` is reverted/fixed.

**Bubble UI:**
- `MessageBubble.tsx:46` — bubble div gets `whitespace-pre-wrap break-words` classes.
- `max-w-[78%]` → tighten to `max-w-[640px]` (still capped at 78% on narrow screens via Tailwind `max-w-[min(78%,640px)]` if supported, else dual class).
- Long URLs etc. broken by `break-words`.

**Sweep:**
- `RecentMessagesPanel.tsx` — uses `m.body` for the preview text. Plain-text store fixes it automatically; truncate at ~60 chars in preview.
- `OrderDrawerMessages.tsx` — same — uses `m.body` for the inline order timeline; verify it's not also rendering HTML.
- Client detail message thread page — same.

### Tests

- Backend integration: post a known trigger → message row body is plain text (no `<` chars unless content contained them).
- Backend integration: inbound webhook with HTML payload → `body` is stripped plain text.
- Frontend vitest: `MessageBubble` renders content with newlines preserved (`whitespace-pre-wrap`); max-width applied.
- Email regression: `c3e3a2b` test suite (email-html-regression in m11 tasks) — extend or replace to assert plain-text `body` + HTML in actual SMTP message.

## Out-of-spec but verified by Playwright sweep

The verification loop must visit and screenshot:
- Orders list, kanban, calendar (urgent highlight + miejsce chip in each)
- Order drawer (no Wykonawca, days-in-shop computed, Wycena read-only, item add/remove updates Wycena + Do zapłaty + list Suma)
- "Pilne" filter chip + "pilne na ten tydzień" search query
- Messages page (plain text in admin bubble, wrap correctly)
- Dashboard (RecentMessagesPanel preview is plain text; any totals reflect new quotedPriceCents math)
- Client detail (last 3 messages plain text; orders show miejsce)

## Execution plan summary

1. Cold dispatch one sonnet — **Backend changes**. Single commit per feature (4 commits or feature-tagged). Files touched: `OrderItemService`, `OrderNotesService` (location sync), `OrderController` (urgent filter param), `OrderListRow` + `OrderDto` (urgent field), `OrderService` (reject quotedPriceCents PATCH), inbound webhook handler (HTML strip), outbound message composer (plain-text invariant), unit + integration tests.
2. Cold dispatch one sonnet — **Frontend changes**. Files: `OrderDrawerCoreFields`, `OrdersTable`, `KanbanCard`, `CalendarCell`, `OrdersFilters` (pilne preset + q rewrite), `SavedFilterPresets` (pilne chip), `MessageBubble`, `RecentMessagesPanel`, `OrderDrawer` (drop users prop), shared `LocationChip` extraction, helper `lib/orders/dim.ts`, vitest specs.
3. Cold dispatch **Playwright verifier** sonnet — runs through the sweep checklist, screenshots before/after, reports defects in structured JSON.
4. **Designer-fix loop:** based on verifier defects, cold dispatch a fix sonnet, then re-run verifier. Repeat until verifier reports zero defects. Cap: 4 fix cycles before bringing it back to user.
5. Each cycle's commits tagged `[milestone:m11][task:fix-batch-N]` with `Refs: docs/dispatch-log/...`.

## Decisions locked

| Decision | Locked |
|---|---|
| Days-in-shop anchor | `receivedAt` |
| Pricing model | items are the only writer for `quotedPriceCents` |
| Messages storage | plain text in `body`, HTML at send only |
| Wykonawca | hide from drawer, backend column stays |
| Planowany odbiór column on list view | stays |
| "Pilne" semantics | current-state flag, not calendar-week-bound |
| Urgency threshold | 14 days, exclusive of WYDANE / ANULOWANE / WSTEPNIE_PRZYJETE |
| Pilne UI tint | `--magenta` token, low opacity background + left border |
| Bubble max width | 640px cap |

## Open risks

- **Location sync drift** — if `OrderNotesService` was the only writer that updated `location` without `currentStorageLocationId`, fixing it forward doesn't backfill historical rows. Decide during impl whether a one-time backfill SQL is needed (Flyway V-something).
- **Inbound HTML stripping fidelity** — naive regex may garble inbound replies with weird HTML. Verify with real Gmail samples in the Playwright loop.
- **Search-box magic phrase** — "pilne" / "pilne na ten tydzień" rewriting from `q` to a filter is owner-friendly but invisible. If the user searches for a literal client named "Pilne", we'd hijack it. Mitigation: only trigger when `q` is exactly "pilne" or starts with "pilne na" — not a substring match.

## Verification — definition of done

- All 6 sweep surfaces (orders list, kanban, calendar, drawer, messages, dashboard) screenshot-verified by Playwright.
- Backend test suite green.
- Frontend vitest green.
- Email HTML regression test still green (no body-stored-as-HTML regression).
- Owner can open the workshop demo and:
  - See miejsce in list view for an order with a location.
  - See "N dni w warsztacie" in drawer, pink when >= 14.
  - Add an item; list "Suma", drawer "Wycena", "Do zapłaty" all update.
  - Type "pilne" in search; only urgent orders shown.
  - Open the messages thread; bubbles wrap, content is plain text.
