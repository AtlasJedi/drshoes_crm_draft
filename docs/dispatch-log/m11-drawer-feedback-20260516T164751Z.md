# Dispatch Log — m11-drawer-feedback

**Task:** drawer-feedback | Dispatch A — Order drawer overhaul
**Plan:** `docs/superpowers/plans/2026-05-16-owner-feedback-fixes.md` §"Dispatch A"
**UTC:** 2026-05-16T16:47:51Z
**Review type:** Combined single-stage (UI fixes, anti-bloat directive)

---

## Files changed

- `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`
  — removed `OrderDrawerTagsRow` import, `parseTags` helper, and `<OrderDrawerTagsRow>` JSX usage (Fix 4)

- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`
  — section header bumped to 15px stencil ink; entry titles to 16px/weight-600 ink; meta lines (actor+date) to 14px mute (Fix 2)

- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx`
  — section header bumped to 15px stencil ink; meta line to 14px mute; note body to 16px/1.45lh ink (Fix 2)

- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx`
  — removed `open` state, toggle button, and conditional render; composer is always expanded; section header rendered as `<p>` (Fix 3)

- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`
  — section header to 15px stencil ink; message body to 15px ink; meta to 13px mute; added `listRef` + `useEffect` for auto-scroll to bottom on `refreshKey`/`items` change; messages list wrapped in `max-height: 360px / overflow-y: auto` container (Fix 2 + Fix 8)

- `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawer.test.tsx`
  — removed `OrderDrawerTagsRow` vi.mock (component no longer imported in drawer) (Fix 4)

- `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNoteComposer.test.tsx`
  — rewrote collapsed-by-default tests: removed toggle-interaction tests, replaced with always-visible assertions; kept all submit-path, disable, error tests intact (Fix 3)

---

## Commands run

- `pnpm -C apps/web test` — baseline: **575 passed, 2 failed** (useKanbanDnd pre-existing flakes)
- `pnpm -C apps/web test` — after: **576 passed, 2 failed** (same pre-existing flakes only; +1 from rewritten NoteComposer tests)
- `pnpm -C apps/web typecheck` — confirmed zero new type errors introduced (all pre-existing: NewsTeaser/StickyNav globals, locations.test.ts strictness, OrderDrawer.test.tsx tags field)

---

## Test summary

| | Before | After |
|---|---|---|
| Passed | 575 | 576 |
| Failed | 2 | 2 |
| Errors | 0 | 0 |
| Skipped | 0 | 0 |

Pre-existing failures: `useKanbanDnd.test.tsx` (2 tests asserting 3-arg `changeStatus` call but implementation passes 4 args). Out of scope per plan.

---

## Decisions

- **Fix 5 (items refresh):** `OrderDrawerItems.tsx` already had the correct implementation — all three mutation paths (add/edit/remove) route through `run()` which calls `refresh()` which calls `getOrder(order.id)` then `onOrderUpdated(result)`. No code change needed; confirmed by grep.
- **Fix 2 section headers:** Used `t-stencil` class (project-wide stencil treatment) + inline `fontSize: 15` + `color: var(--ink)`. Matches "keep stencil-mono treatment but 15px, ink color, full opacity" spec.
- **Fix 8 auto-scroll:** Used a single `useRef<HTMLDivElement>` on the scrollable container + `useEffect([refreshKey, items])` to set `scrollTop = scrollHeight`. Fires on initial load and every message refresh.
- **Tags row comment removed:** The comment "Tags row — after StatusTimeline per spec 9-26" was also removed with the JSX. The component file `OrderDrawerTagsRow.tsx` and its test are untouched per plan instruction.
- **NoteComposer `setOpen(false)` on success removed:** Previously closed the panel after save; with always-open design the call is dropped. Textarea is cleared, `onSaved()` is still called.

---

## Review

APPROVED — combined single-stage per anti-bloat directive (2026-05-11). UI fixes only, no backend, no state-machine changes, no migrations.

Checklist:
- [x] Fix 2: typography bumped across Timeline, Notes, Messages, NoteComposer header
- [x] Fix 3: NoteComposer always expanded, no toggle
- [x] Fix 4: TAGI row removed from OrderDrawer; parseTags helper removed; import removed; file itself untouched
- [x] Fix 5: confirmed already implemented correctly in OrderDrawerItems
- [x] Fix 8: messages list fixed-height 360px scrollable, auto-scroll to bottom
- [x] Tests: 576 pass, 2 fail (pre-existing only)
- [x] No backend, docker, .env touched
- [x] No push

---

## Commit SHA

(to be filled after commit lands)

---

## Follow-ups

- `useKanbanDnd.test.tsx` 2 pre-existing failures: tests assert 3-arg `changeStatus` but impl passes 4. Carry to M12 hygiene.
- `OrderDrawerTagsRow.tsx` component file can be deleted in a follow-up cleanup commit.
- Pre-existing typecheck errors in NewsTeaser/StickyNav tests and locations.test.ts — out of scope.

---

## Subagent token budget

Estimated ~18K tokens (single-session inline implementation, no subagents dispatched).
