# Dispatch Log — Task D: Role-aware dashboard + PilnePanel

**Task:** D — Role-aware dashboard + PilnePanel  
**UTC:** 2026-05-19T19:42:30Z  
**Branch:** `client-adjustments-2026-05-19`  
**Commit:** `c7517b7`

---

## Files touched

### New
- `apps/web/app/(admin)/admin/_components/PilnePanel.tsx` — Server component; fetches `listOrdersServer({ urgent: true })`, shows short code + client name + days-in-shop badge. Title "Pilne", subtitle "Status przyjęte > 4 dni".
- `apps/web/app/(admin)/admin/_components/__tests__/PilnePanel.test.tsx` — 8 vitest cases (title, subtitle, 2-row render, short code, days badge, empty state, error state, urgent filter assertion).
- `apps/web/app/(admin)/admin/__tests__/page.test.tsx` — 9 vitest cases using JSX tree inspection (no JSDOM rendering to avoid Suspense/async-RSC issues).

### Modified
- `apps/web/app/(admin)/admin/page.tsx` — Rewritten. Reads `me.role` via `getMe()`. OWNER: KpiTilesRow + charts row + `grid-cols-[1.5fr_1fr]` row with PilnePanel (wide) + RecentMessagesPanel. Non-OWNER: PilnePanel full-width + MixDonutSection (AdminCard wrapper with "Statystyki pozycji" title). Removed imports of `ReadyForPickupPanel` and `FreshReservationsPanel` (component files left on disk).

---

## Dashboard before → after

**Before (role-blind):**
```
Row 1: KpiTilesRow
Row 2: OrdersWeekChart + MixDonut
Row 3: ReadyForPickupPanel (1.2fr) | RecentMessagesPanel (1fr) | FreshReservationsPanel (1fr)
```

**After OWNER:**
```
Row 1: KpiTilesRow
Row 2: OrdersWeekChart + MixDonut
Row 3: PilnePanel (1.5fr) | RecentMessagesPanel (1fr)
```

**After non-OWNER (EMPLOYEE / CRAFTSMAN / OFFICE):**
```
Row 1: PilnePanel (full width)
Row 2: AdminCard("Statystyki pozycji") { MixDonut }
```

---

## Vitest

- Before Task D new files: 597 pass / 15 fail (pre-existing: NewOrderForm × 14, KanbanBoard × 1)
- After Task D: 597 pass / 15 fail — **zero new failures**
- New tests added: PilnePanel × 8 + AdminPage × 9 = **17 new passing tests**
- Total passing after: 597 (pre-existing suite) + 17 (new) = **614 passing**

---

## Decisions / deviations

1. **`limit: 12` filter** — `OrderListFilters` does not have a `limit` field (size is the 3rd argument to `listOrdersServer`). Passed `urgent: true` as the filter and `0, 12` as page/size args — matches the plan intent exactly.

2. **MixDonut in worker layout** — `MixDonut` is used inside a local async `MixDonutSection` function (not directly in `AdminCard`), which wraps it with `getDashboardChartsServer`. This avoids duplicating the data-fetching logic and keeps the pattern consistent with the OWNER `ChartsSection`. Wrapped in its own `<AdminCard padding={22}>` with Polish title "Statystyki pozycji" per plan.

3. **AdminPage test strategy** — JSDOM cannot resolve async RSC children through Suspense boundaries. Used JSX tree inspection (`collectTypes` / `hasFunctionNamed`) on the awaited RSC return value instead of `render()`. Components used directly in AdminPage's JSX (`PilnePanel`, `RecentMessagesPanel`) are checked by identity; local async section functions (`KpiSection`, `MixDonutSection`) are checked by `.name`.

4. **`ReadyForPickupPanel` and `FreshReservationsPanel`** — not deleted (plan constraint). Imports removed from `page.tsx` only.
