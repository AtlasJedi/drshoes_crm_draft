# Milestone 7 — Clients UI + minimal Sklep/News stubs

**Status:** design — pending owner approval and Claude.ai design export
**Drafted:** 2026-05-10
**Locked scope:** ROADMAP.md (2026-05-10): Clients UI is the real surface; Sklep + Aktualności are placeholder stubs only.
**Prereqs:** Milestone 6 closed (`milestone-6` tag at `4ee68a3`).

---

## 1. Goal

Round out admin nav by adding the missing real surface (`/admin/clients`) and
filling the two placeholder slots (`/admin/sklep`, `/admin/aktualnosci`) so
the sidebar matches the design. Job-to-be-done is **lookup-first**: Misza is
on the phone with a returning customer, types name, sees their orders +
threads + RODO state, takes action.

Edit, RODO toggle, and soft-delete are secondary surfaces — light, modal-based.

Sklep + Aktualności get single-card "do implementacji w przyszłości"
placeholders. Real implementations have no calendar slot and are deferred.

## 2. Locked decisions (from brainstorming round 2026-05-10)

| # | Decision |
|---|---|
| D1 | Job-to-be-done = **lookup-first** (returning customer dossier). Edit is secondary, in a modal. |
| D2 | List page has **search box only** — typeahead via existing `/api/admin/clients/search`. Below: alphabetical paginated full list. No filter chips, no sort columns. |
| D3 | Detail page projection = **aggregate header + reuse existing list endpoints**. New `GET /api/admin/clients/{id}/summary` for header tiles (counts). Orders + threads come from `GET /api/admin/orders?clientId=…` and `GET /api/admin/messaging/threads?clientId=…` — both new query params on existing endpoints. |
| D4 | Edit surface = **single "Edytuj" modal** — full form (name, phone, email, channel, RODO toggle, notes). One PATCH on save. |
| D5 | RODO toggle = **toggle + visible badge, no side-effects.** ON sets `rodoConsentAt=now()`, OFF sets `null`. No automatic message-blocking. Audit-logged via existing aspect. |
| D6 | Sklep + Aktualności = **single placeholder card per page.** "Do implementacji w przyszłości" + 1-line note. Sidebar links work, no 404s. |
| D7 | Tabs on detail page = **sub-routes per tab.** `/admin/clients/[id]`, `/admin/clients/[id]/zlecenia`, `/admin/clients/[id]/wiadomosci`. URL-shareable. RSC pattern. |
| D8 | M5/M6 hygiene carry-forward (`AuditLogAspect` flake, `send/sendRetry` dedup) = **deferred** to a future hygiene milestone. M7 stays user-facing. |
| D9 | Out of scope: photos cross-reference tab, inline create-client, soft-delete UI button, channel/RODO filter chips, server-side sorting beyond default. |
| D10 | All UI copy in Polish. Code/comments in English (project convention). |
| D11 | No invented layouts — owner provides Claude.ai design export for list + detail before implementation begins. |

## 3. Backend contract

### 3.1 `UpdateClientRequest` extension

```java
public record UpdateClientRequest(
    String firstName,
    String lastName,
    String phone,
    String email,
    String preferredChannel,    // NEW — one of EMAIL|SMS|WHATSAPP, null = leave alone
    Boolean rodoConsent,        // NEW — true = set rodoConsentAt=now(), false = null, null = leave alone
    String notes
) {}
```

Validation in `ClientService.update`:
- `preferredChannel` (when non-null): must be one of `EMAIL`, `SMS`, `WHATSAPP`.
  Reject otherwise with `IllegalArgumentException` mapped to 400 by existing
  `ClientExceptionHandler`. Use a simple `Set<String>` constant or enum-style
  check; do not introduce a JPA enum (existing column is `varchar(16)`).
- `rodoConsent`: tri-state semantics —
  - `true` → set `client.rodoConsentAt = Instant.now()` (re-set even if already granted; this gives an audit trail of consent re-grants).
  - `false` → set `client.rodoConsentAt = null`.
  - `null` → no change to `rodoConsentAt`.
- Existing `validateContactPresent(...)` continues to apply with the same semantics.

Structured log line includes `rodoChanged=true|false` when the toggle moved.

### 3.2 `OrderController.list` — new param

Add `@RequestParam(required = false) UUID clientId` to the existing list method.
Plumbed through `OrderService.list(...)` (or whichever query class exists at the
moment of implementation) into the JPA Specification chain. When `clientId`
is present, append a `client.id = :clientId` predicate.

No change to response shape, RBAC, or pagination defaults.

Plan-time research note (writing-plans must verify):
- Confirm the exact method signature on `OrderService` and the
  Specification class name. Memory says JPA Specifications were used in M1
  (`OrderSpecifications` was the working name in 1-7). Verify in the live
  code before plan tasks are sized.

### 3.3 `ThreadController.list` — new param

Add `@RequestParam(required = false) UUID clientId`. Plumbed through whichever
query service backs `ThreadController.list` today (memory says
`ThreadQueryService`-style class introduced in M5 task 5-6). When present,
filter `message_thread.client_id = :clientId`.

No change to response shape, RBAC, pagination, or the existing
`filter`/`channel`/`q` params.

### 3.4 New endpoint — `GET /api/admin/clients/{id}/summary`

```java
public record ClientSummaryDto(
    UUID clientId,
    int orderCount,           // all-time, non-soft-deleted orders for this client
    int openOrderCount,       // orderCount minus orders in WYDANE | ANULOWANE
    Instant lastOrderAt,      // created_at of most-recent order, or null if none
    int unreadThreadCount     // non-discarded threads where unread_count > 0
) {}
```

Implemented in a new `ClientSummaryService` (single read-only transactional
method). Uses count queries against `OrderRepository` and `MessageThreadRepository`.

`MessageThreadRepository` already has
`countByClientIdAndUnreadCountGreaterThan(UUID clientId, int min)` — call
with `min=0`. **Plan-time verification:** the docstring claims this counts
"non-discarded threads" but the JPA derived method name does NOT include a
`DiscardedAtIsNull` clause. Implementor must verify behaviour and either
amend the existing method (adding `AndDiscardedAtIsNull`) or add a custom
`@Query` for the summary path. Either way, the spec contract is
"non-discarded threads where unread_count > 0".

For `orderCount`, `openOrderCount`, `lastOrderAt`: pick whichever path is
simplest at implementation time:
- 3 separate count/min queries on `OrderRepository`, OR
- 1 native aggregate query if the cost is acceptable.

Counts are computed in SQL, never in memory. Soft-deleted orders (those
with `deleted_at IS NOT NULL`) are excluded from all counts. The
"closed" set for `openOrderCount` is `WYDANE | ANULOWANE` — verify this
matches the OrderStatus enum at implementation time.

RBAC: same as other read endpoints (`ROLE_OWNER` | `ROLE_EMPLOYEE`).

Returns 404 (via existing `ClientNotFoundException` mapping) if the client
does not exist or is soft-deleted.

### 3.5 Audit

No new audit event types. The existing `@Audited` annotation on
`ClientController.update` already captures field-level changes including the
new fields. Verify in implementation that the `rodoConsentAt` change shows up
on the order-drawer audit timeline when the client is the order's client
(audit aspect path-pattern curator already handles this for client updates).

### 3.6 Migration

**None.** All fields exist in the schema. M7 only widens DTOs and adds query
params.

### 3.7 Structured logging (per dispatch protocol §7)

Every new or modified controller/service method logs at INFO with:

```
op=<name> actor=<userId|anonymous> clientId=<uuid> outcome=<ok|not-found|invalid-channel>
```

Plus topical fields where relevant (`rodoChanged`, `searchHits`, `pageNum`).

## 4. Frontend layout

```
apps/web/app/(admin)/admin/clients/
├── page.tsx                                   # SC — list
├── _components/
│   ├── ClientListSearchBox.tsx                # CC — debounced typeahead
│   ├── ClientListTable.tsx                    # SC — paginated rows
│   ├── EditClientModal.tsx                    # CC — Radix Dialog
│   ├── PlaceholderCard.tsx                    # SC — shared with stub pages
│   └── RodoBadge.tsx                          # SC — pill component
├── [id]/
│   ├── layout.tsx                             # SC — header + tab nav (shared shell)
│   ├── page.tsx                               # SC — overview tab (summary tiles + recent orders + recent threads)
│   ├── zlecenia/page.tsx                      # SC — full orders list filtered by clientId
│   ├── wiadomosci/page.tsx                    # SC — full threads list filtered by clientId
│   └── _components/
│       ├── ClientHeader.tsx                   # SC — name, contacts, RODO badge, "Edytuj" CTA
│       ├── ClientSummaryTiles.tsx             # SC — 4 tiles
│       └── ClientTabNav.tsx                   # CC — active-tab styling
apps/web/app/(admin)/admin/sklep/page.tsx      # SC — placeholder
apps/web/app/(admin)/admin/aktualnosci/page.tsx # SC — placeholder
apps/web/lib/clients.ts                        # extend
```

(SC = React Server Component. CC = Client Component.)

## 5. Frontend lib extensions (`apps/web/lib/clients.ts`)

```ts
export type ClientDto = { /* existing */ };
export type ClientSummary = {
  clientId: string;
  orderCount: number;
  openOrderCount: number;
  lastOrderAt: string | null;
  unreadThreadCount: number;
};

export async function listClients(opts: { q?: string; page?: number; size?: number }): Promise<Page<ClientDto>>;
export async function searchClients(q: string): Promise<ClientSearchResult[]>;     // existing — keep
export async function getClient(id: string): Promise<ClientDto>;
export async function getClientSummary(id: string): Promise<ClientSummary>;
export async function updateClient(id: string, body: UpdateClientRequest): Promise<ClientDto>;
```

`UpdateClientRequest` TS type mirrors backend record (preferredChannel +
rodoConsent).

Logger named `apps/web/lib/clients` per project convention.

## 6. Components

### 6.1 `ClientListSearchBox` (CC)

- Controlled input, debounced 250ms.
- On change: if `q.length === 0`, `router.push('/admin/clients')`. Else
  `router.push('/admin/clients?q=<encoded>')`.
- Uses `next/navigation`'s `useRouter` + `useSearchParams`.
- Strict-mode safe (effect cleanup).

### 6.2 `ClientListTable` (SC)

- Receives `Page<ClientDto>` from server.
- Renders rows: `lastName, firstName | phone | email | channel pill | RODO badge`.
- Each row links to `/admin/clients/<id>`.
- Pagination controls at bottom — shared component if one already exists,
  otherwise inline (matches `/admin/orders` pattern).

### 6.3 `ClientHeader` (SC)

- Displays full name (large), phone, email, channel pill, `RodoBadge`,
  "Edytuj" button (renders an island Client Component that opens
  `EditClientModal`).

### 6.4 `ClientSummaryTiles` (SC)

- 4 tiles in a row:
  - "Wszystkie zlecenia" → `orderCount`
  - "Aktywne" → `openOrderCount`
  - "Ostatnie zlecenie" → relative date of `lastOrderAt`, or "—"
  - "Nieprzeczytane wątki" → `unreadThreadCount`
- Visual style follows existing dashboard tiles (M6).

### 6.5 `ClientTabNav` (CC)

- 3 links: Przegląd / Zlecenia / Wiadomości.
- `usePathname()` to determine active tab.
- Static layout — purely styling.

### 6.6 `EditClientModal` (CC)

- Radix Dialog.
- Fields: firstName, lastName, phone, email, channel (radio: Email / SMS /
  WhatsApp), notes (textarea), RODO (Switch).
- Pre-filled from current `ClientDto`.
- Validation client-side: at least one of phone/email non-empty
  ("musi być telefon lub e-mail").
- Submit → `PATCH /api/admin/clients/{id}`. On success: close modal, call
  `router.refresh()` so server-rendered header + summary update.
- Error display: inline below the failing field for 400, toast for 500.

### 6.7 `RodoBadge` (SC)

- Props: `rodoConsentAt: string | null`.
- When non-null: green pill, text `"zgoda · " + format(rodoConsentAt, "MM.yyyy")`.
- When null: amber pill, text `"brak zgody RODO"`.

### 6.8 `PlaceholderCard` (SC)

- Props: `title: string`, `body: string`, `note?: string`.
- Centered card, design-system padding.
- Shared between Sklep + Aktualności pages.

## 7. Routes — data flow

### 7.1 `/admin/clients?q=&page=` (SC)

1. Read `q` and `page` from `searchParams`.
2. If `q` is non-empty:
   - Call `searchClients(q)` → renders top-20 typeahead results as the table
     body (no pagination).
3. Else:
   - Call `listClients({ page })` → paginated list.
4. Render `<ClientListSearchBox initialQ={q}/>` above the table.

### 7.2 `/admin/clients/[id]` (SC, overview tab)

Parallel server fetches:
- `getClient(id)`
- `getClientSummary(id)`
- `listOrders({ clientId: id, page: 0, size: 5 })`     // top 5 recent
- `listThreads({ clientId: id, page: 0, size: 3 })`    // top 3 recent

Render: `<ClientHeader/>` + `<ClientTabNav active="przeglad"/>` +
`<ClientSummaryTiles/>` + recent orders preview + recent threads preview.

If any of the 4 fetches 404 (client missing): `notFound()` → Next 16
default 404 page.

### 7.3 `/admin/clients/[id]/zlecenia` (SC)

- Read `page` from `searchParams`.
- Parallel: `getClient(id)` (for header) + `listOrders({ clientId: id, page })`.
- Render shared header + tab nav (active=zlecenia) + full orders table
  (reuses `OrdersListTable` from `/admin/orders` if exportable; otherwise a
  thin local copy).

### 7.4 `/admin/clients/[id]/wiadomosci` (SC)

- Same pattern with `listThreads({ clientId: id, page })`.

### 7.5 `/admin/sklep` and `/admin/aktualnosci` (SC)

Each renders `<PlaceholderCard title="Sklep" body="Do implementacji w
przyszłości" note="Zarządzane poza panelem; w kolejnym wydaniu pojawi się tu
pełna obsługa." />` (and equivalent for Aktualności).

## 8. Sidebar wiring

Existing sidebar already lists Klienci / Sklep / Aktualności. Verify:
- `Klienci` href → `/admin/clients`
- `Sklep` href → `/admin/sklep`
- `Aktualności` href → `/admin/aktualnosci`
- Active-state styling works for sub-routes (`/admin/clients/<id>` highlights
  Klienci).

If wiring already correct: no change. If not: 1 small edit.

## 9. Error handling

- 404 client → `notFound()` (Next builtin).
- 401 → existing global API client behaviour (redirect to login).
- 400 PATCH (validation) → modal field-level error.
- 500 → toast.
- Empty list states (no clients yet, no orders for a client, no threads) →
  inline empty-state copy. No spinners after initial load (RSC pattern).

## 10. Testing

### 10.1 Backend

| Test | Class | Scope |
|---|---|---|
| Update with new channel | `ClientServiceTest` | Sets `preferredChannel`, persists |
| Update with invalid channel | `ClientServiceTest` | Throws `IllegalArgumentException` |
| RODO grant | `ClientServiceTest` | `rodoConsent=true` sets timestamp |
| RODO revoke | `ClientServiceTest` | `rodoConsent=false` nulls timestamp |
| RODO leave-alone | `ClientServiceTest` | `rodoConsent=null` no change |
| PATCH happy path | `ClientControllerIntegrationTest` | Returns 200 with updated DTO |
| PATCH RBAC | `ClientControllerIntegrationTest` | Already-anonymous → 401 (existing) |
| Summary happy path | `ClientSummaryControllerIntegrationTest` | Returns counts |
| Summary 404 | `ClientSummaryControllerIntegrationTest` | Missing client |
| Orders by clientId | `OrderControllerIntegrationTest` | New test method |
| Threads by clientId | `ThreadControllerIntegrationTest` | New test method |
| Summary counts | `ClientSummaryServiceTest` | Unit, set up data, assert all 4 fields |

Filename convention: `*IntegrationTest.java` (NOT `*IT.java`) per dispatch
protocol lock from session 2026-05-09 part 4.

### 10.2 Frontend

| Test | File |
|---|---|
| EditClientModal happy path | `EditClientModal.test.tsx` |
| EditClientModal validation (no phone & no email) | `EditClientModal.test.tsx` |
| EditClientModal RODO toggle on/off | `EditClientModal.test.tsx` |
| ClientListSearchBox debounce + push | `ClientListSearchBox.test.tsx` |
| RodoBadge — null vs present | `RodoBadge.test.tsx` |

### 10.3 Acceptance / UAT

1. Sidebar "Klienci" → list renders, paginated, alphabetical.
2. Type "kowal" → typeahead replaces list within 300ms.
3. Click row → detail page loads with header, 4 tiles, recent orders/threads.
4. Click Zlecenia tab → URL `…/zlecenia`, full orders list filtered.
5. Click Wiadomości tab → URL `…/wiadomosci`, threads filtered.
6. Click "Edytuj" → modal pre-fills.
7. Toggle RODO off, change channel to SMS, save → modal closes, header
   reflects change.
8. Submit modal with no phone AND no email → inline validation error.
9. `/admin/sklep` and `/admin/aktualnosci` render placeholder cards with no
   console errors.
10. Suite green: backend `mvn -pl app verify`, frontend `pnpm -F web test`
    and `pnpm -F web lint`.

## 11. Granularity (preview for writing-plans)

Approximate wave breakdown for the plan:

| Wave | Tasks |
|---|---|
| W1 backend | extend UpdateClientRequest + ClientService + tests; OrderController clientId param + tests; ThreadController clientId param + tests; ClientSummaryService + Controller + tests |
| W2 frontend lib | extend `apps/web/lib/clients.ts` with new methods + types |
| W3 list page | `ClientListSearchBox`, `ClientListTable`, `/admin/clients/page.tsx` |
| W4 detail layout + overview | `layout.tsx`, `ClientHeader`, `ClientSummaryTiles`, `ClientTabNav`, overview `page.tsx` |
| W5 detail tabs | `zlecenia/page.tsx`, `wiadomosci/page.tsx`, reuse-or-port of OrdersListTable + ThreadsList |
| W6 edit modal + badge | `EditClientModal`, `RodoBadge` |
| W7 stubs + smoke | `PlaceholderCard`, `/admin/sklep`, `/admin/aktualnosci`, sidebar wiring verify, manual UAT |

Estimate: ~12-15 plan tasks. Java classes <120 LOC, TS modules <80 LOC per
dispatch protocol §6. Two-stage reviews only for `EditClientModal` (form
state + validation + a11y is enough surface for a Stage-2 a11y/UX pass) and
`ClientSummaryService` (SQL correctness). Rest combined single-stage.

## 12. Out of scope (explicit)

- Photos cross-reference tab on the client dossier.
- Inline "Dodaj klienta" CTA on the list page (creation stays in
  `ClientCreateModal` during order intake — confirmed simplest-but-working).
- Soft-delete UI button (the backend endpoint stays available; UI surface
  deferred until owner asks for it).
- Channel and RODO filter chips on list.
- Sortable list columns beyond the default (last name asc).
- Sklep / Aktualności real implementations (hard-locked deferred per
  ROADMAP.md 2026-05-10).
- M5/M6 hygiene (`AuditLogAspect` flake, `send/sendRetry` dedup) — deferred
  to a future hygiene milestone.
- Tests for stub pages beyond a smoke-render.

## 13. Awaiting from owner before plan-writing

- **Claude.ai design export** for:
  - `/admin/clients` list (header, search box, table rows, pagination, RODO
    badge styling).
  - `/admin/clients/[id]` detail (header, summary tiles, tab nav, overview
    tab content, edit-modal layout).
  - Sklep + Aktualności placeholder card style.
- A paste-ready prompt for that export is saved at
  `docs/superpowers/specs/2026-05-10-milestone-07-clients-design-prompt.md`
  and reproduced in §14 below.

## 14. Claude.ai design-export prompt (for owner to paste)

> Paste the following into the Claude.ai design tool. The export should drop
> back into the conversation as JSX/HTML files placed under
> `handoff/design/m7-clients/` so the implementation plan can reference exact
> component shapes.

```text
We need design mockups for the new "Klienci" admin section of Dr Shoes CRM,
plus two minimal placeholder pages for Sklep + Aktualności. The visual
language must match the existing admin design system already in
handoff/design/admin.jsx (tape/stamp/sticker/splatter aesthetic, Polish
copy, Inter Display + Cardo + JetBrains Mono fonts, the existing colour
palette and chip/pill/badge components from handoff/design/shared.jsx).

Surfaces required:

1. /admin/clients — LIST PAGE
   - Top bar: "Klienci" title, single search input ("Szukaj klienta po
     imieniu, nazwisku, telefonie lub e-mailu…") spanning ~60% width.
   - Table below with columns: imię i nazwisko · telefon · e-mail · kanał
     (chip — Email / SMS / WhatsApp) · zgoda RODO (badge — green
     "zgoda · 04.2026" or amber "brak zgody RODO") · ostatnie zlecenie
     (relative date, e.g. "3 dni temu" or "—").
   - Each row clickable.
   - Pagination at the bottom (matches /admin/orders style already in
     admin.jsx).
   - No "Dodaj klienta" CTA (intentional — clients are created during order
     intake, not from this page).

2. /admin/clients/[id] — DETAIL PAGE (Przegląd / overview tab)
   - Header card: large client name, phone, e-mail, channel pill, RODO
     badge, "Edytuj" button (top-right).
   - Tab nav under header: Przegląd · Zlecenia · Wiadomości (active = first).
   - Summary tiles row (4 tiles, dashboard-style from admin.jsx):
     · "Wszystkie zlecenia" — large number
     · "Aktywne" — large number
     · "Ostatnie zlecenie" — relative date or "—"
     · "Nieprzeczytane wątki" — large number
   - Below tiles: two side-by-side preview cards
     · "Ostatnie zlecenia (5)" — compact list with status pill + due date
     · "Ostatnie wątki (3)" — compact list with channel chip + last-message snippet

3. /admin/clients/[id]/zlecenia — orders sub-tab (same header + tabs;
   below: full orders list filtered to that client, reusing the orders
   table look from /admin/orders).

4. /admin/clients/[id]/wiadomosci — messages sub-tab (same header + tabs;
   below: full thread list reusing the look from /admin/messages).

5. EditClientModal — modal dialog (Radix). Fields:
   - Imię (required)
   - Nazwisko
   - Telefon (validated: phone OR email required)
   - E-mail
   - Preferowany kanał — radio group: Email / SMS / WhatsApp
   - Zgoda RODO — Switch toggle (label: "Klient wyraził zgodę RODO";
     when ON, show timestamp text "Zgoda od MM.YYYY")
   - Notatki — textarea
   - Buttons: "Zapisz" (primary), "Anuluj"
   - Inline validation: when both phone and email empty, red text under
     the e-mail field: "Musi być telefon lub e-mail"

6. /admin/sklep — placeholder card page
   - Centered card, design-system padding/typography.
   - Title: "Sklep"
   - Body: "Do implementacji w przyszłości"
   - Small note: "Zarządzane poza panelem; w kolejnym wydaniu pojawi się
     tu pełna obsługa."

7. /admin/aktualnosci — same placeholder card pattern, title "Aktualności".

Style notes:
   - Polish copy throughout.
   - Reuse existing chip / pill / sticker / stamp / splatter components.
   - No new colours, no new fonts.
   - Detail-page tab nav should mirror the visual style of any existing
     admin tab nav already shipped (M5 messages tabs are a reference).
   - Empty states are part of the design (no clients yet, no orders for a
     client, no threads).

Output: JSX files mirroring the structure of handoff/design/admin.jsx,
saved into a new folder handoff/design/m7-clients/. One file per surface
above; one shared file for the EditClientModal.
```

Once the export lands in `handoff/design/m7-clients/`, the implementation
plan can reference exact component shapes (DOM structure, class names, copy
strings) per task.
