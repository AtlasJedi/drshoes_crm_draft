# Dispatch Log — fix-orderschart-enum

**Task:** Fix OrdersWeekChart hardcoded 2-bucket classification → enum-driven 5-bucket
**UTC:** 2026-05-19T21:16:00Z
**Branch:** client-adjustments-2026-05-19
**Commit:** 5e347fe

---

## Old vs New DTO shape

**Old:**
```json
{ "weekIso": "2026-W21", "repairs": 5, "custom": 3 }
```

**New:**
```json
{
  "weekIso": "2026-W21",
  "byKind": {
    "CZYSZCZENIE": 2,
    "RENOWACJA": 1,
    "NAPRAWA": 5,
    "SZEWC": 0,
    "CUSTOM": 3
  }
}
```

All 5 keys always present (zero-filled by backend). Keys ordered by enum declaration order via LinkedHashMap + OrderItemKind.values().

---

## SQL diff (week CTE — representative of all 3 period queries)

**Old (binary, hardcoded NAPRAWA check):**
```sql
SELECT
    TO_CHAR(DATE_TRUNC('week', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'IYYY-"W"IW') AS week_iso,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA'
    )) AS repairs,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA'
    )) AS custom_
FROM order_ o
WHERE o.deleted_at IS NULL
  AND o.received_at >= :windowStart
GROUP BY week_iso
ORDER BY week_iso
```

**New (DISTINCT ON primary kind — enum-agnostic):**
```sql
WITH first_kind AS (
  SELECT DISTINCT ON (oi.order_id)
    oi.order_id,
    oi.kind
  FROM order_item oi
  ORDER BY oi.order_id, oi.position ASC, oi.id ASC
)
SELECT
  TO_CHAR(DATE_TRUNC('week', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'IYYY-"W"IW') AS period_label,
  fk.kind AS primary_kind,
  COUNT(*) AS order_count
FROM order_ o
JOIN first_kind fk ON fk.order_id = o.id
WHERE o.deleted_at IS NULL
  AND o.received_at >= :windowStart
GROUP BY period_label, fk.kind
ORDER BY period_label, fk.kind
```

Same CTE pattern mirrored for month (`DATE_TRUNC('month')` + `YYYY-MM`) and quarter.

---

## Frontend before/after legend

**Before (hardcoded 2 entries):**
```tsx
<div className="flex gap-4 mt-2">
  <span ...><span bg-ink /> naprawy</span>
  <span ...><span bg-acid /> custom</span>
</div>
```

**After (driven by KIND_ORDER — 5 entries, auto-extends):**
```tsx
<div className="flex flex-wrap gap-4 mt-2">
  {KIND_ORDER.map((kind) => (
    <span key={kind} ...>
      <span style={{ background: KIND_COLORS[kind] }} />
      {KIND_LABELS_PL[kind]}
    </span>
  ))}
</div>
```

---

## Grep evidence — no business-logic residue

```
grep -rn "repairs\|custom_\b\|row\.custom\|row\.repairs" backend/app/src apps/web
```
Only hits: `.next/` build cache (stale compiled output, not source).

```
grep -rn '"NAPRAWA"\|'"'"'NAPRAWA'"'" apps/web/app/(admin)/admin/_components
```
Only hit: `OrdersWeekChart.test.tsx` line 13 — inside `makeRow` test-fixture helper (populating test data, not business logic). Acceptable per spec.

---

## Files changed

### Backend
- `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardChartsDto.java` — `OrdersPerWeekRowDto` now `(String weekIso, Map<String,Long> byKind)`
- `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` — 3 queries replaced with DISTINCT ON CTE returning `(period_label, primary_kind, order_count)`
- `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardChartsController.java` — `buildPeriodMap`/`fillPeriods` rewritten to use `OrderItemKind.values()`; `zeroFilledKindMap()` helper added; mix-donut section also uses `zeroFilledKindMap()`
- `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardChartsControllerIntegrationTest.java` — assertions migrated; added regression tests for primary-kind classification and all-5-kinds counting

### Frontend
- `apps/web/lib/orders/status.ts` — `KIND_COLORS` and `KIND_ORDER` promoted here as shared exports
- `apps/web/lib/dashboard/types.ts` — `OrdersPerWeekRowDto.byKind: Record<OrderItemKind, number>` replaces `repairs`/`custom`
- `apps/web/app/(admin)/admin/_components/MixDonut.tsx` — local `KIND_COLORS` deleted; imports from `lib/orders/status`
- `apps/web/app/(admin)/admin/_components/OrdersWeekChart.tsx` — full rewrite to iterate `KIND_ORDER`; 5-entry legend; stacked rects bottom-up per kind
- `apps/web/app/(admin)/admin/_components/__tests__/OrdersWeekChart.test.tsx` — rewritten with new DTO shape; asserts 5 legend entries; verifies no "naprawy"/"custom" hardcoded labels
- `apps/web/lib/dashboard/api-server.test.ts` — fixture updated to `byKind` shape

---

## Test counts

- Backend: **518 / 0 / 0 / 0** (GREEN)
- Frontend vitest: **601 passed, 15 failed** (15 pre-existing NewOrderForm failures unrelated to this diff)
- `OrdersWeekChart.test.tsx`: **9/9 GREEN**
- `api-server.test.ts` (dashboard): GREEN

---

## Architectural note

`KIND_COLORS` is now `Record<OrderItemKind, string>` in `lib/orders/status.ts`. TypeScript will flag a compile error if a new `OrderItemKind` value is added without a corresponding color entry — exactly the desired guard. `KIND_ORDER` is `readonly OrderItemKind[]` typed the same way.

No new color tokens introduced; reused `--acid / --blue / --orange / --green / --pink` already mapped in the design system.
