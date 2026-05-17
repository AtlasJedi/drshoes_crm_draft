# Plan — owner feedback fixes (2026-05-16 evening round)

Owner reviewed live app and listed 8 bugs / UX gaps. This plan splits them into
three independent dispatches that can run in parallel.

> **Anti-bloat reminder (locked 2026-05-11):** UI fixes here are combined
> single-stage. No TWO-STAGE review. No refactors outside the named files.
> Code/comments English, UI copy Polish.

---

## Dispatch A — Order drawer overhaul

Files (sole legitimate scope of dispatch A):
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerItems.tsx`
- The corresponding `__tests__/*.test.tsx` (update only the tests that break)
- **Do not touch:** `OrderDrawerHeader.tsx`, `OrderDrawerStatusChanger.tsx`,
  `OrderDrawerCoreFields.tsx`, `OrderDrawerStatusTimeline.tsx`, photos files.

### Fix 2 — drawer typography pass (HISTORIA + ZDJĘCIA + NOTATKI WEWNĘTRZNE + WIADOMOŚCI)

Sections currently render entry titles in 14–15px with light-gray meta lines.
The owner says it reads as unreadable.

- Bump entry *titles* (e.g. "Zamówienie utworzone", "Wysłano wiadomość") from
  14/15px → **16px / font-weight 600**, ink color.
- Bump entry *meta* lines (date + actor) from 12/13px → **14px**, color
  `var(--admin-mute)` but **not** ghosted (no opacity < 0.7).
- Section headers ("HISTORIA", "ZDJĘCIA", "NOTATKI WEWNĘTRZNE",
  "WIADOMOŚCI"): keep stencil-mono treatment but **15px**, ink color, full
  opacity. No light gray.
- Note rows in `OrderDrawerNotes`: body text 16px / 1.45 line-height, ink.
- Message rows in `OrderDrawerMessages`: body 15px ink, meta 13px mute.

Goal is *one consistent pass*: every reading-level text in the drawer below
the status changer reads ≥ 15px ink-colored body. No body text under 14px
remains.

### Fix 3 — "Dodaj wpis do historii" composer open by default

`OrderDrawerNoteComposer.tsx` currently renders a collapsed `<details>` (or
local `open` state) that gates the textarea behind a click on the disclosure
strip ("DODAJ WPIS DO HISTORII"). Owner wants it always expanded.

- Remove the gated/collapsed state entirely. The composer always renders
  expanded — section header on top, textarea + location selector + "dodaj
  wpis" button below.
- Section header label stays in Polish: **"Dodaj wpis do historii"**.
- Keep the existing `onSaved` callback contract intact (parent depends on
  it to bump `refreshKey`).
- If existing tests assert collapsed-by-default behavior, update them.

### Fix 4 — remove TAGI row

`OrderDrawer.tsx:96` renders `<OrderDrawerTagsRow tags={parseTags(order.tags)} />`.

- Remove that line from `OrderDrawer.tsx`.
- Remove the `parseTags` helper if it's now unused (it is) plus the now-dead
  import.
- **Leave `OrderDrawerTagsRow.tsx` and its test file in place** for now —
  the component file removal is out of scope (purely cosmetic cleanup; we
  can delete in a follow-up).

### Fix 5 — drawer refetches order on item add/remove/edit

When user adds an item via the drawer's `+ dodaj item` button, the row
appears but `WYCENA` and `DO ZAPŁATY PRZY ODBIORZE` (computed in
`OrderDrawerCoreFields`) keep the stale value. Order list refresh shows the
correct total — but the open drawer is stale.

Root cause: `OrderDrawerItems` mutates items but `order` state in the parent
`OrderDrawer` is the prop snapshot. The list-view total works because the
backend recomputed `totalPriceCents` on the entity and the list reloads on
nav. The drawer doesn't reload.

Fix:
- `OrderDrawerItems` already accepts `onOrderUpdated: (updated: OrderDto) =>
  void` per the existing contract. Verify all three of {add item, remove
  item, edit item price} call `onOrderUpdated(refreshedOrder)`.
- If any of those paths only patches `items` locally without calling
  `onOrderUpdated`, fix it: after the mutation, call `getOrder(orderId)`
  from `@/lib/orders/api` and pass the returned `OrderDto` up.
- The parent `OrderDrawer.handleOrderUpdated` already sets `order` state
  and bumps `refreshKey` — no parent change should be needed.

### Fix 8 — messages panel is fixed-height + scrollable

When a thread has many messages, `OrderDrawerMessages` currently expands
infinitely, pushing the rest of the drawer off-screen.

- Wrap the messages list in a fixed-height container, `max-height: 360px`,
  `overflow-y: auto`. The outer section heading + "wyślij wiadomość" CTA
  remain visible above. The list scrolls inside.
- Scrollbar styling: subtle, no gimmicks. Just default browser scrollbar is
  acceptable; if there's a project-wide custom scrollbar class, use it.
- New messages auto-scroll to bottom on `refreshKey` change. Use a ref +
  `useEffect` to set `scrollTop = scrollHeight` after the list re-renders.

### Tests — Dispatch A

Run `pnpm -C apps/web test` to completion. Update any test broken by your
edits (typography changes that assert specific font sizes, removed tag row,
default-open composer). Do not silence failing tests by stubbing.

### Commit — Dispatch A

One atomic commit. Conventional Commits:
`refactor(order-drawer): owner feedback round - typography + composer + items refresh + scrollable messages`
Body lists the five fix numbers (2, 3, 4, 5, 8). Tag with
`[milestone:m11][task:drawer-feedback]`. `Refs: docs/dispatch-log/m11-drawer-feedback-<UTC>.md`.

---

## Dispatch B — Orders list overhaul

Files (sole legitimate scope of dispatch B):
- `apps/web/components/admin/AdminTopbar.tsx`
- `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx`
- `apps/web/lib/orders/types.ts` (add `location: string | null` field)
- `backend/app/src/main/java/com/drshoes/app/order/dto/OrderListRow.java`
  (add `String location` field + thread through `of(...)`)
- `backend/app/src/main/java/com/drshoes/app/order/OrderService.java` if
  needed (only the call site for `OrderListRow.of(...)` — pass
  `o.getLocation()`)
- The corresponding `__tests__/*.test.tsx` and Java tests for those files.

### Fix 1 — live search filter on the topbar

Current behavior: typing into the search input does nothing until **Enter**,
then it navigates to `/admin/orders?q=...`. Owner expects the input to
filter the list live as you type. Owner also explicitly says the click
target is bad — likely the in-place re-render of the input via the URL
sync `useEffect` causes occasional focus loss.

Fix:
- Convert the input to a **debounced live filter**. 250ms debounce.
- After debounce: when on `/admin/orders` (or its kanban/calendar tabs),
  call `router.replace` to update only the `q` URL param (preserve other
  params: status, type, page, etc.). Use `URLSearchParams` to mutate.
- If the user is on any other page, keep the existing Enter → push behavior
  (still navigate to `/admin/orders?q=...`).
- The `useEffect` that re-syncs `q` from `urlQ` must NOT clobber the
  current value if the user is mid-type. Use a ref or a "lastSentQ" guard.
- Use `usePathname` to detect the page.

Search semantics (backend-side, no change needed): the existing `q` param
already matches order code + description + client first/last name. Verify
this is the case by reading `OrderService` or `OrderRepository` — you don't
have to change anything if it already does, just confirm in the commit.

### Fix 6 — orders list table columns

In `OrdersTable.tsx`:
- **Remove** `<th>` and `<td>` for: **Wydano** (`pickedUpAt` col),
  **Wykonawca**, **Utworzono** (`createdAt` col).
- The `SortableColumnHeader` references for `pickedUpAt` and `createdAt`
  must also be removed.
- **Add** `<th>Miejsce</th>` and the matching `<td>{row.location ?? "—"}</td>`
  between **Termin odbioru** and **Foto** (or wherever makes visual sense
  — but stable per-column order is mandatory; don't put it last).
- **SUMA column**: change formula from `pricePLN(row.totalPriceCents)` to
  display the **balance due**, i.e. `pricePLN(row.quotedPriceCents - row.advancePaidCents)`.
  Clamp at 0 (never display negative). When quotedPriceCents is 0 (TBD),
  keep showing `—` or `0,00 zł` (use existing rule for consistency — match
  what `OrderDrawerCoreFields` does for "do zapłaty").

### Add `location` to backend list row

`OrderListRow.java`:
- Add `String location` between `clientName` and `status` (matches the
  position of `MIEJSCE` in the UI, makes the record readable).
- Update `of(Order o, String clientName)` to pass `o.getLocation()`.

If `Order.getLocation()` does not exist, look it up via the storage
locations service the same way `OrderDto.location` is populated. Match that
pattern exactly.

Frontend `OrderListRow` interface gets `location: string | null` field.

### Tests — Dispatch B

Run both `pnpm -C apps/web test` and `mvn -pl app test
-Dsurefire.failIfNoSpecifiedTests=false -Dtest='OrderServiceTest,OrderListRepositoryTest,OrdersTable*'`.
Update tests as needed.

### Commit — Dispatch B

One atomic commit:
`refactor(orders-list): live search + column cleanup + balance-due SUMA + miejsce`
Body lists fix numbers (1, 6). Tag with `[milestone:m11][task:orders-list-feedback]`.

---

## Dispatch C — Email HTML actually arrives

This is split: **infra step (done by orchestrator)** rebuilds backend
container so V022 applies to the live DB. The **agent step** verifies the
trigger path is correct end-to-end and adds a regression test.

Already done by orchestrator before dispatch:
- Rebuild backend image: `docker compose build backend`
- Restart container: `docker compose up -d --force-recreate backend`
- Verify Flyway V022 row landed: `SELECT * FROM flyway_schema_history WHERE version='022'`
- Verify 3 templates have body_html: `SELECT name, length(body_html) FROM message_template WHERE channel='EMAIL'`

Agent's job (Dispatch C):

Files (sole legitimate scope):
- `backend/app/src/test/java/com/drshoes/app/messaging/...` — add ONE
  integration-style test (`*IntegrationTest.java`, NOT `*IT.java`) that
  verifies `MessageRouter.send` with the seeded "Gotowe do odbioru (EMAIL)"
  template produces a `MessageEntity` whose `body_html` is non-null and
  contains the marker string `<table role="presentation"` (proves designer
  HTML survived rendering).
- `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/smtp/SmtpEmailGatewayTest.java`
  — a new unit test using a Mockito-mocked `JavaMailSender` that captures
  the `MimeMessage`, opens it as a `MimeMultipart`, and asserts both
  `text/plain` AND `text/html` parts exist when `OutboundMessage.bodyHtml`
  is non-null. Critical: this is the contract the live bug exposed.
- DO NOT touch `MessageRouter` or `SmtpEmailGateway` unless those new tests
  fail and reveal a real bug. If they fail, fix the bug minimally and
  state what you changed in the dispatch log.

After test infra is in place, send a real trigger-driven email and verify
arrival:
- Change DR-2026-0006 status PRZYJETE → W_REALIZACJI → GOTOWE_DO_ODBIORU
  via `curl -X POST /api/admin/orders/{id}/status` (the test session cookie
  from `/tmp/cookies.txt` is still valid).
- Check backend logs for `op=smtp.send outcome=success` AND
  `op=template.render` lines proving `bodyHtml` was non-null at gateway entry.
- Owner will visually verify HTML rendering in inbox — not your job.

### Tests — Dispatch C

`mvn -pl app test -Dtest=MessageRouterEmailHtmlTest,SmtpEmailGatewayTest -Dsurefire.failIfNoSpecifiedTests=false`
(name the new tests sensibly).

### Commit — Dispatch C

One atomic commit:
`test(email): regression coverage for HTML body delivery through SMTP gateway`
`[milestone:m11][task:email-html-regression]`.

---

## Out of scope for ALL three dispatches

- Do NOT touch `ARCHITECTURE.md`, `CLAUDE.md`, `README.md`, the
  `handoff/` → `design/` reorganization, or any of the untracked screenshot
  PNGs / `.playwright-mcp/` files.
- Do NOT push to remote.
- Do NOT skip git hooks (`--no-verify`).

## Dispatch logs

All three dispatches write to `docs/dispatch-log/<task>-<UTC>.md`:
- `m11-drawer-feedback-<UTC>.md`
- `m11-orders-list-feedback-<UTC>.md`
- `m11-email-html-regression-<UTC>.md`

Include the standard fields (files touched, commands run, test summary,
commit SHA).
