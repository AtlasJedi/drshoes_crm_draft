# Milestone 1 — Order domain + drawer + audit timeline (DESIGN)

**Status:** approved 2026-05-08 (brainstorming session, this file)
**Plan:** TBD — `docs/superpowers/plans/2026-05-XX-milestone-01-orders.md` after writing-plans skill
**Source of truth (handoff):** `handoff/DATA_MODEL.md`, `handoff/API_SURFACE.md`, `handoff/DECISIONS.md`, `handoff/design/admin.jsx`

## Goal

Ship the thin slice of the Order domain that lets Misza:
1. Onboard a real customer (Client CRUD).
2. Open a new repair/custom order against that customer with one or more items.
3. Drive the order through its 6-status lifecycle in the admin drawer.
4. See a curated audit timeline of who did what to the order.

Out: photos, messages, calendar/kanban views, status triggers, tag filters, saved presets, public site, idle-timeout modal, production cookie hardening (those are M1+ / 0C).

## Locked decisions (from this brainstorming session)

| Decision | Choice |
|---|---|
| Scope | **Thin slice** — Order + OrderItem + minimal Client + audit timeline view |
| Client | **Minimal Client + picker** (first_name, last_name, phone, email, notes) |
| Status UX | **Free transitions + trigger preview placeholder** (placeholder shows "(triggery dochodzą w M2)" until M2 wires real triggers) |
| Status endpoint | **Dedicated `POST /api/admin/orders/{id}/status`** returning empty `triggerSuggestion` for now (matches handoff API surface; locks contract for M2) |
| Audit timeline | **Curated key events** with Polish strings (no raw mode in M1) |
| List capability | **Daily-driver filters** — status (multi), type (multi), assignee, q (search) + simple page/size pagination |
| Approach | **Backend-first vertical slice** — Client → Order → AuditTimeline → Frontend |
| Logic placement | **Backend-heavy** — business rules in Spring Boot, frontend thin (debug via backend logs) |

## §1 Architecture & boundaries

### Backend layout (Spring Boot, follows 0B patterns)

```
backend/app/src/main/java/com/drshoes/app/
├── client/
│   ├── domain/Client.java                       # JPA entity, soft-delete via deleted_at
│   ├── domain/ClientRepository.java             # JpaRepository
│   ├── ClientService.java                       # CRUD + search; structured key=value INFO logging
│   ├── ClientController.java                    # /api/admin/clients/*
│   └── dto/{ClientDto, CreateClientRequest, UpdateClientRequest, ClientSearchResult}
├── order/
│   ├── domain/Order.java                        # JPA entity + @Version optimistic lock
│   ├── domain/OrderItem.java                    # owned by Order (cascade)
│   ├── domain/OrderStatus.java                  # enum (6 values, see below)
│   ├── domain/OrderItemKind.java                # enum (NAPRAWA / CUSTOM_BUTY / CUSTOM_KURTKA)
│   ├── domain/OrderRepository.java              # JpaRepository + custom Specification for filters
│   ├── domain/OrderItemRepository.java
│   ├── OrderCodeSequence.java                   # generates DR-YYYY-NNNN via Postgres SEQUENCE
│   ├── OrderService.java                        # CRUD + status change + item add/edit/remove
│   ├── OrderController.java                     # /api/admin/orders/*
│   └── dto/{OrderDto, OrderListRow, CreateOrderRequest, UpdateOrderRequest,
│            ChangeStatusRequest, ChangeStatusResponse,
│            CreateOrderItemRequest, UpdateOrderItemRequest, OrderItemDto}
└── audit/
    ├── domain/AuditLog.java                     # exists since 0b-8
    ├── AuditLogAspect.java                      # exists since 0b-8
    ├── AuditTimelineService.java                # NEW — reads audit_log + maps to TimelineEvent
    ├── AuditTimelineController.java             # NEW — GET /api/admin/orders/{id}/timeline
    ├── TimelineEventCurator.java                # NEW — pure function: AuditLog → TimelineEvent | null
    └── dto/{TimelineEvent, TimelineEventKind}
```

`AuditTimelineService.timelineForOrder(orderId)`:
1. Loads `AuditLog` rows where `entity_type='Order' AND entity_id=:orderId`, plus rows where `entity_type='OrderItem' AND parent_entity_id=:orderId` (parent_entity_id is a small addition to AuditLog — see migration V005).
2. Runs each through `TimelineEventCurator.curate(log)`. Curator returns `Optional<TimelineEvent>` — null/empty for events we don't surface.
3. Sorts ascending by `created_at`, returns to controller.
4. **Authoritative server-side** — no curation logic on the frontend.

### Frontend layout (Next.js 16, follows 0b-10..12 patterns)

```
apps/web/
├── lib/
│   ├── api.ts                                   # exists, no change
│   ├── log.ts                                   # exists, no change
│   ├── clients/
│   │   ├── types.ts                             # ClientDto, CreateClientRequest, …
│   │   └── api.ts                               # listClients, searchClients, createClient, …
│   ├── orders/
│   │   ├── types.ts                             # OrderDto, OrderListRow, OrderStatus, OrderItemKind
│   │   ├── status.ts                            # statusLabelPL, statusOrder, kindLabelPL
│   │   └── api.ts                               # listOrders, getOrder, createOrder, updateOrder,
│   │                                            #   changeStatus, addItem, updateItem, removeItem
│   └── timeline/
│       ├── types.ts                             # TimelineEvent (mirrors backend DTO)
│       └── api.ts                               # getOrderTimeline
├── app/(admin)/admin/orders/
│   ├── page.tsx                                 # list page (server component, reads URL params)
│   ├── _components/
│   │   ├── OrdersFilters.tsx                    # client component, syncs to URL params
│   │   ├── OrdersTable.tsx                      # client component, row click opens drawer
│   │   ├── OrderDrawer.tsx                      # client component, Radix Dialog as side sheet
│   │   ├── OrderDrawerHeader.tsx                # status pill + code + close
│   │   ├── OrderDrawerCoreFields.tsx            # client picker, dates, assignee, description
│   │   ├── OrderDrawerItems.tsx                 # add/edit/remove order items
│   │   ├── OrderDrawerStatusChanger.tsx         # 6-button status picker + trigger preview placeholder
│   │   └── OrderDrawerTimeline.tsx              # right rail, fetches GET /timeline
│   └── new/page.tsx                             # create-new-order page (or modal — see §4)
└── components/clients/
    ├── ClientPicker.tsx                         # debounced combobox over /api/admin/clients/search
    └── ClientCreateModal.tsx                    # "+ nowy klient" inline modal from picker
```

Drawer state via URL: `?orderId=<uuid>`. Server component reads param → fetches order detail server-side → passes to client `OrderDrawer`. Closing drawer = router.replace removes param. Deep-linkable.

## §2 Data model & migrations

### `V003__clients.sql`
```sql
CREATE TABLE client (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX client_phone_idx ON client(phone) WHERE deleted_at IS NULL;
CREATE INDEX client_search_idx ON client USING gin(
  to_tsvector('simple',
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(phone,'') || ' ' || coalesce(email,'')
  )
);
```

### `V004__orders.sql`
```sql
CREATE SEQUENCE order_code_seq_2026 START 1;

CREATE TABLE order_ (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,                      -- DR-2026-0001
  client_id UUID NOT NULL REFERENCES client(id),
  status TEXT NOT NULL,                           -- enum stored as text
  description TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  planned_pickup_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  assigned_craftsman_id UUID REFERENCES user_(id),
  total_price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PLN',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX order_status_pickup_idx ON order_(status, planned_pickup_at) WHERE deleted_at IS NULL;
CREATE INDEX order_client_created_idx ON order_(client_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX order_search_idx ON order_ USING gin(
  to_tsvector('simple', coalesce(code,'') || ' ' || coalesce(description,''))
);

CREATE TABLE order_item (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                              -- NAPRAWA / CUSTOM_BUTY / CUSTOM_KURTKA
  description TEXT,
  craftsman_notes TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  work_minutes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_item_order_idx ON order_item(order_id, position);
```

### `V005__audit_parent_entity.sql`
```sql
ALTER TABLE audit_log ADD COLUMN parent_entity_id UUID;
CREATE INDEX audit_log_parent_idx ON audit_log(parent_entity_id, created_at) WHERE parent_entity_id IS NOT NULL;
```

`parent_entity_id` lets us query "all audit events related to Order X" in one shot — populated by `AuditLogAspect` for OrderItem operations (parent = its order). 0b-8 aspect needs a small extension to look up the parent for `@Audited(parentField = "orderId")` annotation. This is the only change to existing audit code.

### Notes on the data model

- **Year-scoped sequence:** `order_code_seq_2026`. New year = new migration `V00X__order_code_seq_YYYY.sql`. Predictable, race-free, gap-free. `OrderCodeSequence.next()` queries `nextval('order_code_seq_' || EXTRACT(YEAR FROM now()))`.
- **`order_` (trailing underscore)** matches `user_` from 0B — `order` is reserved in SQL.
- **`tags` jsonb deferred to M2** — no UI consumes it, no value adding the column now.
- **`@Version` optimistic lock** on Order: second writer gets `OptimisticLockException` → controller maps to 409 Conflict with payload `{ "code": "ORDER_VERSION_CONFLICT", "currentVersion": <n> }`. Frontend surfaces "Ktoś inny już zmienił to zlecenie. Odśwież stronę." and reloads.
- **Soft delete:** `Order.deleted_at` set on `DELETE /api/admin/orders/{id}`. Default list query filters `deleted_at IS NULL`. M1 has no restore UI (M2 adds the "Anulowane / Usunięte" tab).

## §3 API surface (M1 subset)

All routes under `/api/admin/*`, RBAC-gated by `@PreAuthorize` annotations using the existing `RbacService` from 0b-7.

| Method | Path | Body / Query | Returns | RBAC |
|---|---|---|---|---|
| GET | `/api/admin/clients` | `?q=&page=&size=` | `Page<ClientDto>` | OWNER, EMPLOYEE |
| GET | `/api/admin/clients/search` | `?q=` (debounced from picker) | `ClientSearchResult[]` (max 20) | OWNER, EMPLOYEE |
| POST | `/api/admin/clients` | `CreateClientRequest` | 201 `ClientDto` | OWNER, EMPLOYEE |
| GET | `/api/admin/clients/{id}` | — | `ClientDto` | OWNER, EMPLOYEE |
| PATCH | `/api/admin/clients/{id}` | `UpdateClientRequest` | `ClientDto` | OWNER, EMPLOYEE |
| DELETE | `/api/admin/clients/{id}` | — | 204 | OWNER (RbacService.canManageClients) |
| GET | `/api/admin/orders` | `?status=&type=&craftsmanId=&q=&page=&size=` (status & type are repeatable) | `Page<OrderListRow>` | OWNER, EMPLOYEE |
| POST | `/api/admin/orders` | `CreateOrderRequest` (clientId, optional initial items) | 201 `OrderDto` | OWNER, EMPLOYEE |
| GET | `/api/admin/orders/{id}` | — | `OrderDto` (with items) | OWNER, EMPLOYEE |
| PATCH | `/api/admin/orders/{id}` | `UpdateOrderRequest` (description, dates, assignee — NOT status, NOT items) | `OrderDto` | OWNER, EMPLOYEE |
| DELETE | `/api/admin/orders/{id}` | — | 204 (soft-delete) | OWNER (canDeleteOrders) |
| POST | `/api/admin/orders/{id}/status` | `ChangeStatusRequest{ targetStatus, expectedVersion }` | `ChangeStatusResponse{ order, triggerSuggestion: null }` | OWNER, EMPLOYEE |
| POST | `/api/admin/orders/{id}/items` | `CreateOrderItemRequest` | 201 `OrderItemDto` | OWNER, EMPLOYEE |
| PATCH | `/api/admin/orders/{id}/items/{itemId}` | `UpdateOrderItemRequest` | `OrderItemDto` | OWNER, EMPLOYEE |
| DELETE | `/api/admin/orders/{id}/items/{itemId}` | — | 204 | OWNER, EMPLOYEE |
| GET | `/api/admin/orders/{id}/timeline` | — | `TimelineEvent[]` | OWNER, EMPLOYEE |

### Key DTO shapes

```java
// OrderDto (full detail)
record OrderDto(
  UUID id, String code, OrderStatus status,
  ClientDto client,
  String description,
  Instant receivedAt, Instant plannedPickupAt, Instant pickedUpAt,
  UserStubDto assignedCraftsman,           // nullable
  int totalPriceCents, String currency,
  int version,                              // for optimistic-lock round-trip
  List<OrderItemDto> items,
  Instant createdAt, Instant updatedAt
) {}

// OrderListRow (lean, for list view)
record OrderListRow(
  UUID id, String code, OrderStatus status,
  String clientFullName,                    // denormalized server-side, no extra round trip
  String firstItemKindOrSummary,            // "NAPRAWA" or "3 pozycje" if multi
  Instant plannedPickupAt,
  String assignedCraftsmanFullName,         // nullable
  int totalPriceCents,
  Instant updatedAt
) {}

// ChangeStatusRequest
record ChangeStatusRequest(OrderStatus targetStatus, int expectedVersion) {}

// ChangeStatusResponse
record ChangeStatusResponse(OrderDto order, TriggerSuggestion triggerSuggestion) {}
record TriggerSuggestion() {}                // empty stub in M1; M2 fills it

// TimelineEvent
record TimelineEvent(
  UUID id,                                  // audit_log.id (for keying)
  TimelineEventKind kind,
  Instant occurredAt,
  String actorFullName,                     // resolved server-side
  Map<String, String> labels                // pre-rendered Polish strings, see §5
) {}
enum TimelineEventKind {
  ORDER_CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, PICKUP_DATE_CHANGED,
  ITEM_ADDED, ITEM_EDITED, ITEM_REMOVED,
  ORDER_SOFT_DELETED
}
```

### Error envelope (existing from 0B)

```json
{ "code": "ORDER_VERSION_CONFLICT", "message": "...", "requestId": "..." }
```

New M1 error codes: `ORDER_NOT_FOUND`, `ORDER_VERSION_CONFLICT`, `ORDER_ALREADY_DELETED`, `CLIENT_NOT_FOUND`, `CLIENT_HAS_ACTIVE_ORDERS` (on delete attempt), `ITEM_NOT_FOUND`, `INVALID_ORDER_STATUS`.

## §4 Frontend modules

### Order list page (`app/(admin)/admin/orders/page.tsx`, server component)

Reads `searchParams` (status, type, craftsmanId, q, page) → calls `listOrders` server-side → renders `<OrdersFilters>` (client) + `<OrdersTable rows={...}>` (client). Empty state in Polish: *"Brak zleceń. Kliknij '+ Nowe zlecenie' żeby zacząć."*

### Order drawer (`OrderDrawer.tsx`, client component)

Triggered when URL contains `?orderId=<uuid>`. The list page's server component fetches the detail server-side too and passes to drawer (no client-side waterfall). Drawer:
- Header: code, status pill (color-coded per `lib/orders/status.ts`), close (×) — `OrderDrawerHeader`.
- Core fields (`OrderDrawerCoreFields`): client picker (read-only after creation in M1 — change-client is M2), description, received_at (read-only), planned_pickup_at, assignee dropdown.
- Status changer (`OrderDrawerStatusChanger`): 6 buttons, current status highlighted; click target → confirm → POST status. Below: trigger preview placeholder block ("(triggery dochodzą w M2 — żaden powiadomień nie wyśle się teraz)").
- Items (`OrderDrawerItems`): list of items, "+ dodaj pozycję" button, inline edit, remove. Optimistic UI not used in M1 (refetch after each mutation — keeps it simple, debugger-friendly).
- Timeline (`OrderDrawerTimeline`): right rail, GET timeline endpoint, renders `TimelineEvent[]`, no client-side curation.

Drawer is a Radix Dialog with `side="right"` styling (Radix doesn't have native drawer; we use Dialog + custom CSS to slide from right). Locked behind `next next dialog primitives — see Radix docs at session time, not embedded here.

### Create-new-order

`app/(admin)/admin/orders/new/page.tsx` — server component, full page (not modal). Form: client picker (with "+ nowy klient" inline modal), description, received_at default `now()`, planned_pickup_at, optional initial items list. POST → redirect to `/admin/orders?orderId=<newId>` so the drawer opens.

### Filters (`OrdersFilters.tsx`, client component)

Status: multi-checkbox of 6 statuses. Type: multi-checkbox of 3 kinds. Assignee: dropdown of users (fetched from new GET `/api/admin/users` — small endpoint added to 0B users module if missing). q: text input, debounced 250ms. All sync to URL params via `useSearchParams + router.replace`.

### Client picker (`components/clients/ClientPicker.tsx`)

Combobox (Radix Combobox if available; else custom). Debounced 200ms, calls `/api/admin/clients/search?q=`. Renders `Imię Nazwisko · phone`. "+ nowy klient" option opens `ClientCreateModal`. Selected client is passed up via `onSelect(clientDto)`.

## §5 Audit timeline curation (server-side)

`TimelineEventCurator.curate(AuditLog log)` mapping:

| Audit row | TimelineEventKind | Polish string template (assembled from `labels` map) |
|---|---|---|
| `entity_type=Order operation=CREATE` | `ORDER_CREATED` | "{actor} utworzył zlecenie {code}" |
| `entity_type=Order field=status` | `STATUS_CHANGED` | "{actor} zmienił status z {fromLabel} na {toLabel}" |
| `entity_type=Order field=assignedCraftsmanId` | `ASSIGNEE_CHANGED` | "{actor} przypisał zlecenie do {newAssignee}" / "...usunął przypisanie" |
| `entity_type=Order field=plannedPickupAt` | `PICKUP_DATE_CHANGED` | "{actor} zmienił datę odbioru na {newDate}" |
| `entity_type=OrderItem operation=CREATE` | `ITEM_ADDED` | "{actor} dodał pozycję: {kindLabel}" |
| `entity_type=OrderItem operation=UPDATE field=description\|price\|kind` | `ITEM_EDITED` | "{actor} edytował pozycję: {kindLabel}" |
| `entity_type=OrderItem operation=DELETE` | `ITEM_REMOVED` | "{actor} usunął pozycję: {kindLabel}" |
| `entity_type=Order field=deletedAt operation=UPDATE (null→non-null)` | `ORDER_SOFT_DELETED` | "{actor} anulował zlecenie" |
| anything else (description tweak, totalPriceCents recompute, version bump, ...) | `null` (skipped) | — |

Frontend renders `labels` directly. Polish strings live in Java (final-static map) so the curation is fully server-side and translatable later by adding a locale switch.

**Backend logging:** `AuditTimelineService.timelineForOrder` logs INFO `op=timelineForOrder orderId=... rowsRaw=N rowsCurated=M outcome=ok`.

## §6 Test strategy

Per `superpowers:test-driven-development` — RED-GREEN-REFACTOR per task. Each backend task ships:
- 1 unit test on the service (happy path + 1-2 edge cases),
- 1 integration test on the controller (via `@SpringBootTest + Testcontainers`, hitting real Postgres) covering RBAC enforcement and at least one failure path (404 / 409 / 401).

Backend coverage targets:
- `OrderService.changeStatus` — version conflict, soft-deleted order rejected, audit row emitted.
- `OrderCodeSequence.next` — generates `DR-{currentYear}-{4-digit}`, monotonic across the same year.
- `TimelineEventCurator.curate` — covers every `TimelineEventKind` happy case + a "skip" case (description tweak returns null).
- `AuditTimelineService.timelineForOrder` — integration test seeds 3 audit rows, asserts curated output.
- `ClientService.search` — verifies tsvector ranking returns most-relevant first.

Frontend: typecheck + build pass. No frontend unit tests in M1 (backend-heavy directive).

E2E smoke at the milestone tag (parallels 0b-13): docker compose up → seed Misza → POST a client → POST an order → POST a status change → GET timeline shows ORDER_CREATED + STATUS_CHANGED. Curl-based, captured in `0b-final-style` dispatch log.

## §7 Out of scope / deferred

- **M2:** photos, messages (incl. messaging-core wiring), tag filters, saved presets, calendar view, kanban view, status triggers, change-client on existing order, restore-deleted-order UI.
- **0C ops hardening:** production cookie.secure=true, ESLint config (Next 16 fix), idle-timeout warning modal.
- **Performance:** no caching layer in M1. List query hits DB directly each time. Pagination keeps it bounded. Revisit when row counts cross ~10k.
- **Concurrency:** optimistic lock prevents lost writes; we do NOT do distributed locking, queueing, or real-time updates. Two users on the same drawer = one wins, the other gets a polite refresh prompt.

## §8 Task list outline (consumed by writing-plans)

Wave 1 — Client domain (backend):
1. `1-1` V003 clients migration + Client entity + repo + integration test
2. `1-2` ClientService (CRUD + search w/ tsvector ranking) + unit test
3. `1-3` ClientController + DTOs + integration test (incl. RBAC + soft-delete behaviour)

Wave 2 — Order domain (backend):
4. `1-4` V004 orders migration + Order/OrderItem entities + repos + integration test
5. `1-5` OrderCodeSequence service + unit test
6. `1-6` OrderService (CRUD, status change w/ optimistic lock, soft-delete) + unit tests
7. `1-7` OrderItemService (or inlined into OrderService) + unit tests
8. `1-8` OrderController + DTOs + integration test (covers RBAC, 409, 404, paged list filters)

Wave 3 — Audit timeline (backend):
9. `1-9` V005 audit_parent_entity column + AuditLogAspect parent-id population + regression test
10. `1-10` TimelineEventCurator (pure function) + unit tests covering every kind
11. `1-11` AuditTimelineService + Controller + integration test

Wave 4 — Frontend:
12. `1-12` `lib/{clients,orders,timeline}` types + api modules + log wiring
13. `1-13` ClientPicker + ClientCreateModal components
14. `1-14` Orders list page + OrdersFilters + OrdersTable
15. `1-15` Create-new-order page
16. `1-16` OrderDrawer scaffold (header + core fields + URL state)
17. `1-17` OrderDrawerStatusChanger + trigger preview placeholder
18. `1-18` OrderDrawerItems (add / edit / remove)
19. `1-19` OrderDrawerTimeline (right rail)

Wave 5 — Closure:
20. `1-20` E2E compose smoke + milestone-1 tag + CLAUDE.md status flip

Estimate: ~20 tasks. Some may collapse during planning (e.g. `1-6` and `1-7` if OrderItem stays inside `OrderService`).

## §9 Self-review

- **Placeholders:** `TBD` only in the plan-file path at the top (resolves once `writing-plans` runs). No `TODO`/"implement later" markers in the design.
- **Internal consistency:** API surface in §3 covers every entity in §1; every TimelineEventKind in §5 has a curator clause; every wave in §8 maps to §1 directories.
- **Scope:** ~20 tasks fits the milestone-1 envelope. Audit timeline is small enough to not split off as its own milestone. Confirms thin slice was the right pick.
- **Ambiguity check:**
  - "Trigger preview placeholder" — clarified: shows a fixed Polish string in M1, no logic. ✅
  - "Curated timeline" — every kind enumerated in §5 mapping table; nothing left to interpretation. ✅
  - "Optimistic lock conflict UX" — clarified: 409 with `currentVersion`, frontend prompts refresh. ✅
  - "Year sequence rotation" — new migration each January, gap-free, race-free. ✅
- **Backend-heavy compliance:** §5 keeps curation server-side; §4 calls out "no client-side curation"; §6 has zero frontend unit tests. ✅
