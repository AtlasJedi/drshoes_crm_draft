# Task B — OrderItemKind v2 dispatch log

**UTC:** 2026-05-19T19:24:24Z
**Branch:** client-adjustments-2026-05-19
**Plan:** docs/superpowers/plans/2026-05-19-client-adjustments.md § Task B

---

## Summary

Replaced `OrderItemKind` enum (4 old values: USLUGA, CUSTOM, NAPRAWA, RENOWACJA) with 5 new values
in canonical dropdown order: CZYSZCZENIE (default), RENOWACJA, NAPRAWA, SZEWC, CUSTOM.
Owner approved destroying existing `order_item` rows via TRUNCATE CASCADE.

---

## Migration body (V033__order_item_kind_v2.sql)

```sql
-- V033: Owner directive (2026-05-19) — destroy existing order_item rows to simplify enum migration.
-- FKs into order_item: photo.order_item_id REFERENCES order_item(id) ON DELETE SET NULL
--   → CASCADE on TRUNCATE will null out photo.order_item_id for any existing photo rows.
-- audit_log carries entity refs as strings/jsonb — no FK, unaffected.
TRUNCATE TABLE order_item RESTART IDENTITY CASCADE;
ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;
ALTER TABLE order_item
  ADD CONSTRAINT order_item_kind_check
  CHECK (kind IN ('CZYSZCZENIE', 'RENOWACJA', 'NAPRAWA', 'SZEWC', 'CUSTOM'));
ALTER TABLE order_item ALTER COLUMN kind SET DEFAULT 'CZYSZCZENIE';
```

Note: plan body used `order_items` (with 's'); actual table name is `order_item` (singular).
Corrected in the migration.

---

## FK relationships affected by TRUNCATE CASCADE

From `\d order_item` analysis (V001__init.sql + V009__photo.sql):

| Table | Column | Constraint | Effect |
|---|---|---|---|
| `photo` | `order_item_id` | `REFERENCES order_item(id) ON DELETE SET NULL` | TRUNCATE CASCADE nulls `photo.order_item_id` for any photo rows referencing items |

No other tables FK into `order_item.id`. The `audit_log` table carries entity refs as
strings/JSONB — no FK, unaffected by TRUNCATE CASCADE.

---

## Files touched

### Backend (9 files modified + 2 new)

| File | Change |
|---|---|
| `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemKind.java` | Replaced 4 old values with 5 new in canonical order |
| `backend/app/src/main/resources/db/migration/V033__order_item_kind_v2.sql` | NEW — TRUNCATE + drop/re-add CHECK + SET DEFAULT |
| `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContextBuilder.java` | Updated `polishKindLabel` switch — all 5 arms, fail-loud exhaustive switch |
| `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` | Rewrote `countByItemKind` to count items per kind directly (all 5 kinds) |
| `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardChartsController.java` | Zero-fills all 5 kind buckets so response always has 5 entries |
| `backend/app/src/main/java/com/drshoes/app/demo/DemoOrderFactory.java` | Updated seed data to use new kind values |
| `backend/app/src/test/java/com/drshoes/app/order/domain/OrderItemKindTest.java` | NEW — pins enum values + declaration order (3 tests) |
| `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardChartsControllerIntegrationTest.java` | Updated fixtures; renamed test to `mixByTypeContainsAllFiveKinds`; asserts 5 buckets |

### Frontend (9 files modified)

| File | Change |
|---|---|
| `apps/web/lib/orders/types.ts` | `OrderItemKind` union → 5 new values in canonical order |
| `apps/web/lib/orders/status.ts` | `KIND_LABELS_PL` → 5 new Polish labels |
| `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx` | `ALL_KINDS` → 5 new values |
| `apps/web/app/(admin)/admin/orders/_components/OrderDrawerItems.tsx` | `BLANK` default kind → `CZYSZCZENIE` |
| `apps/web/app/(admin)/admin/orders/new/_components/NewOrderForm.tsx` | `makeFreshItem` default → `CZYSZCZENIE` |
| `apps/web/app/(admin)/admin/_components/MixDonut.tsx` | `KIND_COLORS` extended to 5 kinds; SZEWC uses `var(--green)` |
| `apps/web/lib/dashboard/types.ts` | `MixByTypeRowDto.kind` union → 5 new values |
| `apps/web/app/(admin)/admin/_components/__tests__/MixDonut.test.tsx` | Fixture updated; "Usługa" → "Czyszczenie" label assertion |
| `apps/web/lib/dashboard/api-server.test.ts` | Fixture updated; kind assertion → CZYSZCZENIE |

Note: `ItemEditRow.tsx` and `NewOrderItemRow.tsx` derive `KIND_OPTIONS` from
`Object.entries(KIND_LABELS_PL)` — correct automatically; no direct edits needed.

---

## USLUGA / CUSTOM_BUTY / CUSTOM_KURTKA grep results

Post-change grep confirms zero `USLUGA` references remain in source (only in migration history files V029 etc., which are immutable).
`CUSTOM_BUTY` / `CUSTOM_KURTKA` appear only in comments in V001/V025 migration history — no live code references.

---

## Test counts

| Suite | Before Task B | After Task B | Delta |
|---|---|---|---|
| Backend (`mvn test`) | 509/0/0/0 (pre-branch) | **512/0/0/0** | +3 new tests (OrderItemKindTest) |
| Frontend vitest (pre-existing failures) | 575 passed / 16 failed | **576 passed / 15 failed** | Fixed MixDonut "Usługa" label test |

Pre-existing failures (not introduced by Task B):
- `NewOrderForm.test.tsx` — 14 failures (getByLabelText/role issues, pre-existing)
- `KanbanBoard.test.tsx` — 1 failure (inaccessible role query, pre-existing)
Confirmed by stash/compare: these failures existed on HEAD before any Task B edit.

---

## Commit SHA

`8ba22ad`
