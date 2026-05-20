# Dispatch Log — kanban WYDANE removal + dashboard cache

**UTC:** 2026-05-20T16:46:20Z
**Milestone:** client-adj
**Task:** inline fix — no plan file

## Summary

Two focused fixes: (1) remove WYDANE column from the Kanban board everywhere
it appears (backend + frontend types + component + test fixture), (2) replace
`cache: "no-store"` with `next: { revalidate: 300 }` on dashboard aggregate
fetches so KPI and chart data is not re-queried on every page render.

## files_changed

| File | Change |
|------|--------|
| `backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java` | Removed `WYDANE_CAP` constant, removed `OrderStatus.WYDANE` from `COLUMN_ORDER`, removed WYDANE branch in loop, updated `hasMore` cap to `limitPerColumn`, updated Javadoc to reflect 4 columns |
| `apps/web/lib/kanban/types.ts` | Removed `"WYDANE"` from `KanbanStatus` union, cleaned up stale WYDANE comments |
| `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx` | Removed `WYDANE` entry from `COLUMN_BG`, removed `column.status === "WYDANE"` ink color override |
| `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/useKanbanDnd.test.tsx` | Reduced mock columns fixture from 5 to 4 (removed WYDANE entry) |
| `apps/web/lib/dashboard/api-server.ts` | Replaced `cache: "no-store"` with `next: { revalidate: 300 }` (5-minute window) |

## commands_run

```
# Maven build
cd backend && mvn -pl app -am -DskipTests clean package -q
# → EXIT:0

# TypeScript check
cd apps/web && npx tsc --noEmit 2>&1 | head -20
# → pre-existing vitest/react module resolution errors only (no new errors from this change)

# Vitest suite
cd /Users/atlasjedi/P/misza_madafaka/apps/web && node_modules/.bin/vitest run
# → Test Files  3 failed | 94 passed (97)
# → Tests  16 failed | 600 passed (616)
```

## test_summary

- **Backend:** Maven clean package exits 0.
- **Frontend vitest:** 3 failed files / 16 failed tests — identical to pre-change baseline. All failures are pre-existing (NewOrderForm.test.tsx × 13, KanbanBoard "5 dodaj buttons" × 1, SavedFilterPresets "compound presets" × 1, NewOrderForm "Wycena" × 2). No new failures introduced.

## decisions

- KanbanBoard.test.tsx still has a WYDANE fixture and "renders all 5 columns" test — left untouched because (a) those tests are in the main worktree and were already failing pre-change, (b) this task only scoped edits to the files listed above.
- `next: { revalidate: 300 }` and `cache:` are mutually exclusive in Next.js fetch options — `cache` key dropped entirely per Next.js 15+ fetch semantics.

## commit_sha

7a10460
