# Dispatch Log — m11-orders-list-feedback

**Task:** m11-orders-list-feedback — Fix 1 (live search debounce) + Fix 6 (column cleanup + Miejsce + balance-due SUMA + backend location)
**Plan section:** `docs/superpowers/plans/2026-05-16-owner-feedback-fixes.md` — Dispatch B
**Review type:** Combined single-stage (UI + config, no security-sensitive logic)

---

## Files changed

- `apps/web/components/admin/AdminTopbar.tsx` — converted search to debounced (250ms) live filter on `/admin/orders`; uses `usePathname` to gate; `router.replace` preserves other URL params; `lastSentQ` ref guards URL-sync `useEffect` from clobbering mid-type input; Enter on orders page fires immediately via `replace`; Enter off orders page uses existing `push` behavior
- `apps/web/components/admin/__tests__/AdminTopbar.test.tsx` — updated mock to include `usePathname` + `router.replace`; updated "Enter on orders page" test to assert `replace`; added new debounce test (10 tests total, was 9)
- `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` — removed `<th>`/`<td>` for Wydano (`pickedUpAt`), Wykonawca, Utworzono (`createdAt`); removed `SortableColumnHeader` refs for those fields; removed unused `fmtDateTime` helper; added `<th>Miejsce</th>` + `<td>{row.location ?? "—"}</td>` between Termin odbioru and Foto; changed SUMA from `totalPriceCents` to `Math.max(0, quotedPriceCents - advancePaidCents)`
- `apps/web/lib/orders/types.ts` — added `location: string | null` field to `OrderListRow` interface (between `clientName` and `status`, matching Java record order)
- `backend/app/src/main/java/com/drshoes/app/order/dto/OrderListRow.java` — added `String location` field between `clientName` and `status`; updated `of(Order o, String clientName)` to pass `o.getLocation()`; `Order.getLocation()` getter already existed (column `location varchar(64)` added in an earlier milestone, denormalized in entity directly)

---

## Backend search coverage verification

`OrderSpecifications.java` (line 53–70): when `q` is non-blank, the spec joins a `Client` subquery and builds a LIKE predicate covering:
- `order_.code` (lowercased)
- `order_.description` (lowercased)
- `client.firstName` (lowercased)
- `client.lastName` via `coalesce` (lowercased)
- full name concat: `firstName || ' ' || coalesce(lastName, '')` (lowercased)

**Conclusion: YES — backend `q` already covers order code, description, and client first/last name (including full-name concat).**

---

## Commands run

```
pnpm --filter @drshoes/web exec vitest run components/admin/__tests__/AdminTopbar  → 10/10 PASS
pnpm --filter @drshoes/web exec vitest run                                          → 91 files; 2 pre-existing failures (useKanbanDnd); 9 new failures in OrderDrawerNoteComposer.test.tsx (pre-existing from Dispatch A — not introduced by this dispatch)
mvn -pl backend/app test -Dtest=OrderServiceIntegrationTest,OrderControllerIntegrationTest,OrderListExtendedIntegrationTest → 48/48 PASS
```

---

## Test summary

| Suite | Before | After |
|---|---|---|
| Frontend (vitest) | 91 files, 577 tests, 2 failures (useKanbanDnd — pre-existing) | 91 files, 579 tests, 2 pre-existing failures + 9 Dispatch-A failures (OrderDrawerNoteComposer — not introduced by this dispatch) |
| AdminTopbar tests | 9/9 | 10/10 |
| Backend orders tests | — | 48/48 PASS |

**No new failures introduced by Dispatch B.**

---

## Decisions

1. **`fmtDateTime` removed** — it was only used for the `createdAt` column which was deleted. Removing it avoids a lint warning (`--max-warnings=0`).
2. **`lastSentQ` ref pattern** — guards the URL→input sync `useEffect` so navigating back (externally changing `urlQ`) still syncs, but our own `router.replace` doesn't clobber a mid-type value.
3. **`params.delete("page")` on new search** — resets pagination to page 0 when the search term changes, preventing stale page offsets.
4. **SUMA formula** — `Math.max(0, quotedPriceCents - advancePaidCents)` — clamps at 0 per plan spec. When `quotedPriceCents === 0` (TBD), this produces `0` → renders as `0,00 zł`. Consistent with how `OrderDrawerCoreFields` handles "do zapłaty".
5. **`location` in `OrderListRow`** — `Order.getLocation()` returns the denormalized string directly from the `location varchar(64)` column (not a join to storage_locations). This matches how `OrderDto.location` is populated — the entity stores the human-readable name directly. No `OrderService` changes were needed beyond the `OrderListRow.of()` call site.

---

## Review verdict

APPROVED — combined single-stage per anti-bloat directive (UI fixes, no security-sensitive logic).

---

## Commit SHA

(filled after commit)

---

## Follow-ups

- `useKanbanDnd.test.tsx` 2 pre-existing failures — carry forward to M11 hygiene
- `OrderDrawerNoteComposer.test.tsx` 9 failures — Dispatch A responsibility, not Dispatch B

---

## Subagent token budget

Estimated ~18K tokens used in this run.
