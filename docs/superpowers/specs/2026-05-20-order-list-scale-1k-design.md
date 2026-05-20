# Order list scale to 1k orders — design

> Status: brainstormed & owner-approved 2026-05-20.
> Scope: transparent DB-layer optimization. Admin UI behavior is unchanged.
> Owner directive: "go uninterrupted, test after finishing, try not braking
> anything that works now. should not be hard. those changes should mostly
> just affect DB wrapper/module, admin doesn't necessarily need to know that
> he is fetching only recent ODEBRANE elements. everything else stays the
> same. we always fetch all elements from other statuses than ODEBRANE
> and ANULOWANE."

## Problem

At ~1k total orders (≈50 active + ≈950 closed), the admin order surfaces
risk being dominated by historic noise:

- `GET /api/admin/orders` (LIST) currently has **no default status filter**.
  An empty request returns all non-deleted orders, sorted by `created_at DESC`.
  Page 1 is mostly `WYDANE` + `ANULOWANE` — useless for daily work.
- Kanban already caps per-column (`LIMIT N`) and excludes `ANULOWANE`,
  but the per-column query `WHERE status=X ORDER BY received_at DESC`
  has **no supporting index** — Postgres sorts in memory. Fine at 1k,
  bends at 10k.
- Calendar already filters `status NOT IN ('WYDANE','ANULOWANE')` —
  no change required this round.

Terminology note: the owner calls picked-up orders "ODEBRANE" colloquially.
The enum/code stays `OrderStatus.WYDANE`; "ODEBRANE" appears nowhere in
the codebase and won't be introduced.

## Goal

Make the order surfaces correct and fast at 1k and well past it (10k+),
without changing what the admin sees or how they interact with the UI.

## Non-goals

- No new UI controls. No "Pokaż zamknięte" toggle, no new tabs, no new
  routes. The admin keeps the same page.
- No frontend refactor of saved filters, drawer, deep-links.
- No materialized views, no partitioning, no cursor pagination. All
  overkill at this scale.
- No change to ANULOWANE storage. Cancelled orders stay in `order_`
  fully queryable from the DB shell. Only the admin UI never surfaces them.
- Calendar internals are not touched this round. Owner can revisit if
  the OR-clause window plan ever shows up in slow-query logs.

## Approach

Two-part change, both confined to the backend:

1. **Default-filter policy** in the LIST query (transparent to the admin).
2. **Three partial B-tree indexes** to back the new + existing access paths.

The frontend `OrdersPage` and `OrdersFilters` stay byte-identical.

## API contract change (transparent)

Endpoint: `GET /api/admin/orders`

Default behavior matrix:

| Request | Effective `WHERE` (in addition to `deleted_at IS NULL`) | Notes |
|---|---|---|
| No `status` param | `status IN (active_statuses) OR (status='WYDANE' AND picked_up_at >= now - 30d)` | New default. Admin sees no UI change. |
| `?status=ANULOWANE` | `400 Bad Request {"error":"status.anulowane.disallowed"}` | Defense in depth. Filter UI never offers it. |
| `?status=WYDANE` (explicit) | `status='WYDANE'` (no 30d cap) | Escape hatch for power-user. Owner-only. |
| `?status=...` other explicit list | `status IN (...)` (default discarded) | Unchanged from today. |
| All other params (`q`, `clientId`, `tag`, `craftsmanId`, `type`, date range, `urgent`) | Unchanged | Compose with the above as today. |

`active_statuses` is the literal set
`{WSTEPNIE_PRZYJETE, PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU}`.
That's the OrderStatus enum minus `{WYDANE, ANULOWANE}`.

The 30-day cap is a fixed constant (`WYDANE_RECENT_WINDOW_DAYS = 30`)
in the policy class — not configurable per-request.

## Components

```
OrderController.list(...)
   │
   ├── 1. Reject ANULOWANE explicit pick → 400
   │
   ├── 2. OrderListPolicy.resolve(rawStatuses)
   │        → EffectiveFilter(statuses, wydaneCutoffOrNull)
   │
   └── 3. OrderSpecifications.forList(effective, ...other filters)
            → JPA Specification
            → orderRepo.findAll(spec, pageable)
```

**New file:** `OrderListPolicy.java` (≤ 60 LOC)
- Constants: `ACTIVE_STATUSES`, `WYDANE_RECENT_WINDOW_DAYS = 30`.
- `EffectiveFilter` inner record:
  `record EffectiveFilter(List<OrderStatus> statuses, Instant wydaneCutoff)`.
  `wydaneCutoff != null` means "also include WYDANE rows newer than this".
- `resolve(List<OrderStatus> rawStatuses)`:
  - `null` or empty → `EffectiveFilter(ACTIVE_STATUSES, now - 30d)`.
  - Contains `ANULOWANE` → throws `IllegalArgumentException` (controller maps to 400).
  - Single `WYDANE` → `EffectiveFilter([WYDANE], null)`.
  - Anything else → `EffectiveFilter(rawStatuses, null)` (no implicit WYDANE).

**Modified file:** `OrderSpecifications.java`
- `forList(...)` signature gains one parameter: `Instant wydaneCutoff` (nullable).
  The `statuses` parameter remains.
- Status predicate becomes:
  - If `wydaneCutoff == null`: existing `status IN (statuses)` behavior.
  - If `wydaneCutoff != null`: `cb.or(status.in(statuses), cb.and(status.eq(WYDANE), pickedUpAt.greaterThanOrEqualTo(cutoff)))`.

**Modified file:** `OrderService.list(...)`
- Now calls `OrderListPolicy.resolve(statuses)` first; passes the result
  into `OrderSpecifications.forList`. Signature unchanged externally.

**Modified file:** `OrderController.list(...)`
- Adds the ANULOWANE-explicit guard at the top (try/catch around the
  policy call would also work; a guard is simpler).
- Logs gain `effectiveStatuses={}` and `wydaneCutoff={}` per dispatch-protocol §7.

**No frontend changes.** `OrdersFilters`, `OrdersPageClient`, `lib/orders/api-server.ts`
all stay byte-identical. The admin keeps seeing the same page; the result set
just happens to be ANULOWANE-free and bounded on WYDANE.

## Database indexes

New Flyway migration: `V034__order_list_perf_indexes.sql`.

```sql
-- Backs Kanban per-column query:
--   SELECT * FROM order_ WHERE status=? ORDER BY received_at DESC LIMIT ?
CREATE INDEX order_status_received_at_idx
  ON order_ (status, received_at DESC)
  WHERE deleted_at IS NULL;

-- Backs Kanban WYDANE column + LIST endpoint's transparent 30d cap:
--   SELECT * FROM order_ WHERE status='WYDANE' ORDER BY picked_up_at DESC NULLS LAST LIMIT ?
--   SELECT * FROM order_ WHERE status='WYDANE' AND picked_up_at >= ? ORDER BY ...
CREATE INDEX order_wydane_picked_up_at_idx
  ON order_ (picked_up_at DESC NULLS LAST)
  WHERE status = 'WYDANE' AND deleted_at IS NULL;

-- Backs LIST default sort across active statuses:
--   SELECT * FROM order_ WHERE status IN (active) ORDER BY created_at DESC ...
-- Postgres uses this even when JPA adds the deleted_at predicate inside the partial.
CREATE INDEX order_active_created_at_idx
  ON order_ (created_at DESC)
  WHERE deleted_at IS NULL
    AND status IN ('WSTEPNIE_PRZYJETE','PRZYJETE','W_REALIZACJI',
                   'CZEKA_NA_KLIENTA','GOTOWE_DO_ODBIORU');
```

Index size cost at 1k: roughly 50 KB per index, ~150 KB total. Negligible.
Index size cost at 10k: ~500 KB per index. Still negligible.

The existing `order_status_pickup_idx (status, planned_pickup_at) WHERE deleted_at IS NULL`
stays — used by trigger queries and the calendar.

The owner mentioned "hash buckets or ranged dates" — neither is needed.
Hash partitioning is for >100k cardinality. Date ranging is for time-series.
At 1k–10k, three small partial B-tree indexes is the textbook answer.

## Data flow (LIST default request)

```
GET /api/admin/orders          (no filters)
  ↓
OrderController.list           (no ANULOWANE in raw → ok)
  ↓
OrderListPolicy.resolve(null)
  ↓ returns EffectiveFilter(ACTIVE_STATUSES, now - 30d)
  ↓
OrderSpecifications.forList(... wydaneCutoff = now - 30d)
  ↓ JPA builds: deleted_at IS NULL
  ↓             AND (status IN (5 active) OR (status='WYDANE' AND picked_up_at >= cutoff))
  ↓             ORDER BY created_at DESC LIMIT 25 OFFSET 0
  ↓
Postgres planner: bitmap-or of (order_active_created_at_idx, order_wydane_picked_up_at_idx)
  ↓ → indexed sort, no seq scan
  ↓
Page<Order> → Page<OrderListRow> with batched client name lookup (unchanged)
```

## Error handling

- `?status=ANULOWANE` → `400 Bad Request`, body `{"error":"status.anulowane.disallowed"}`.
  Logged at `WARN` with `actor` + URL for visibility.
- Postgres index build during V034 migration is fast at any current size.
  Idempotent: re-runs are no-ops thanks to Flyway's history table.
- Backwards compat: any existing caller (cron, integration tests, future
  scripts) that passed an explicit status list continues to work identically.

## Testing strategy

Per the dispatch protocol, this is mechanical TDD with two surfaces to cover:
backend SQL behavior + the existing list contract should still work.

### Unit tests

`OrderListPolicyTest.java`:
1. `resolve(null)` returns ACTIVE_STATUSES + non-null cutoff.
2. `resolve([])` returns ACTIVE_STATUSES + non-null cutoff.
3. `resolve([ANULOWANE])` throws `IllegalArgumentException`.
4. `resolve([WYDANE])` returns `[WYDANE]` + null cutoff (escape hatch).
5. `resolve([PRZYJETE, W_REALIZACJI])` returns those + null cutoff
   (explicit pick discards the implicit WYDANE).
6. `resolve([PRZYJETE, ANULOWANE])` throws.

### Repository integration tests

`OrderRepositoryListIntegrationTest.java` (uses `AbstractIntegrationTest` /
the Testcontainers Postgres):
1. Seed: 5 active orders (1 per active status) + 3 WYDANE picked up
   today, yesterday, 60 days ago + 2 ANULOWANE.
2. Default list call → 5 active + 2 recent WYDANE returned. The 60-day-old
   WYDANE excluded. Both ANULOWANE excluded.
3. Explicit `status=WYDANE` list call → all 3 WYDANE returned (escape hatch).
4. Explicit `status=ANULOWANE` → throws (asserted via controller IT).
5. Verify `EXPLAIN ANALYZE` of the default query references the new
   indexes (parse plan text, assert "Index Scan" or "Bitmap Heap Scan"
   against `order_active_created_at_idx` and `order_wydane_picked_up_at_idx`).
   Soft assert — if Postgres picks a seq scan because dataset is tiny,
   force `SET enable_seqscan = off` for the assert.

### Controller integration tests

`OrderControllerIntegrationTest.java` (additions):
1. `GET /api/admin/orders` returns no ANULOWANE rows in default mode.
2. `GET /api/admin/orders?status=ANULOWANE` returns 400.
3. `GET /api/admin/orders?status=WYDANE` returns all WYDANE regardless of age.
4. `GET /api/admin/orders?status=PRZYJETE` returns only PRZYJETE (parity).

### Regression smoke

- Existing tests in `OrderControllerIT` / `OrderControllerIntegrationTest`
  must continue to pass with zero changes (the default-filter change shifts
  the default but explicit-filter callers are unaffected).
- Kanban + Calendar tests unchanged.
- Frontend vitest suite unchanged.

### Manual / Playwright pass after merge

Per owner directive: test after finishing.
- Load `/admin/orders` → confirm no ANULOWANE shown, count ≤ active + recent WYDANE.
- Apply status filter `PRZYJETE` → unchanged behavior.
- Open kanban → unchanged columns, WYDANE column still capped.
- Open calendar → unchanged.

## Migration order

1. Write `OrderListPolicy` + tests (RED → GREEN).
2. Wire policy into `OrderService.list` + `OrderSpecifications.forList`.
3. Add `OrderController` 400-guard for ANULOWANE.
4. Add controller IT for the new contract.
5. Write `V034__order_list_perf_indexes.sql`.
6. Run repo IT against fresh Postgres (containers up).
7. `mvn -pl app -am clean package` → green.
8. `docker compose build backend && docker compose up -d backend`.
9. Manual + Playwright smoke per above.

## Files changed (summary)

- New: `backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java`
- New: `backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java`
- New: `backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java`
- New: `backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql`
- Modified: `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`
  (+1 nullable param, +1 OR branch)
- Modified: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`
  (1 call-site change: policy resolution before spec build)
- Modified: `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`
  (+1 ANULOWANE guard, +2 log fields)
- Modified: `backend/app/src/test/java/com/drshoes/app/order/api/OrderControllerIntegrationTest.java`
  (+4 cases)
- Modified: `backend/app/src/main/java/com/drshoes/app/order/dto/...`
  (none — `OrderListRow` unchanged)

Estimated LOC: ~150 net additions, mostly tests.

## What this does NOT solve

- 10k-order calendar window query plan — defer; revisit when slow-query logs flag it.
- Reply/messages thread listing scale — separate domain, separate effort.
- Photo blob storage scale — out of scope (R2 + native browser cache already handle it).
- ANULOWANE archive table or partition — premature; revisit at 10k+ ANULOWANE rows.
- Dashboard chart query scale — already index-friendly (received_at + GROUP BY week/month/quarter).
