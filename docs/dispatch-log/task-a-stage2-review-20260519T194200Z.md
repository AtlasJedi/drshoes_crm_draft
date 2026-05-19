# Stage 2 Review — Task A: Urgency Rule Rewrite

**Commit:** `b9cc8e2`
**Reviewer:** Opus (independent — Stage 2)
**UTC:** 2026-05-19T19:42:00Z
**Plan:** `docs/superpowers/plans/2026-05-19-client-adjustments.md` § Task A

---

## Verdict: APPROVED-WITH-FOLLOWUP

Core implementation is correct and clean. One pre-existing semantic divergence
in CalendarController + KanbanController is surfaced as a hygiene item (not introduced
by this commit, not blocking Task A).

---

## Checklist Findings

**1. Spec match — OrderUrgency.java**
PASS. `THRESHOLD_DAYS = 4`. Guard is `if (status != OrderStatus.PRZYJETE) return false`.
`Duration.between(receivedAt, clock.instant()).toDays() >= THRESHOLD_DAYS`. Matches spec exactly.

**2. OrderSpecifications query change**
PASS. Cutoff is `4L * 86400L`. Status predicate is `cb.equal(root.get("status"), OrderStatus.PRZYJETE)`.
No leftover predicate referencing the removed `.in(...)`. Resulting Specification is valid; 3-predicate
AND (receivedAt IS NOT NULL, receivedAt <= cutoff, status = PRZYJETE) is consistent with OrderUrgency logic.

**3. Dead constant EXCLUDED**
PASS. `grep -r EXCLUDED backend/app/src/main/java` returns zero results. Constant and its `Set.of(...)`
import are fully removed.

**4. Callers of OrderUrgency.**
PASS for direct callers. Two call sites found in main source:
- `OrderDto.of()` — passes `(receivedAt, status)` → two-arg convenience overload (delegates to Clock.systemUTC). Correct.
- `OrderListRow.of()` — same pattern. Correct.

HYGIENE (pre-existing, not introduced here): `CalendarController.isUrgent(Order)` and
`KanbanController.isUrgent(Order)` are private static methods with their own logic:
`tag "pilne" present OR plannedPickupAt within 48h`. They do NOT call `OrderUrgency.isUrgent()`.
This means Kanban and Calendar views use a divergent urgency definition (tag-based + 48h pickup)
rather than the new status+4d rule. This was pre-existing before this commit and is not introduced
by Task A. However, Task A's owner directive says "pilne applies only to the new rule" (adj #2),
and Task G ("!" in calendar view) references the new rule. This divergence should be resolved — see
Hygiene section.

**5. Test coverage**
PASS. All required cases present:

| Case | Test |
|---|---|
| (a) PRZYJETE + 5d → urgent=true | `urgent_whenPrzyjeteFiveDaysAgo` (unit) + IT positive |
| (a) PRZYJETE + 4d exactly → urgent=true | `urgent_whenPrzyjeteExactlyFourDaysAgo` (unit) |
| (b) PRZYJETE + 3d → urgent=false | `notUrgent_whenPrzyjeteThreeDaysAgo` (unit) + IT freshId |
| (c) W_REALIZACJI + 30d → urgent=false | `notUrgent_whenWRealizacjiThirtyDaysAgo` (unit) + IT inProgressId |
| (d) GOTOWE_DO_ODBIORU + 30d → urgent=false | `notUrgent_whenGotoweDoOdbioru` (unit) |
| (e) null receivedAt → urgent=false | `notUrgent_whenReceivedAtNull` (unit) |

Also covers CZEKA_NA_KLIENTA, WYDANE, ANULOWANE, WSTEPNIE_PRZYJETE — all NOT urgent. Full regression coverage.
Suite: 509/0/0/0.

**6. Integration test fixture drift — old 14d threshold**
PASS. `grep -rn "14L \* 86400\|minusDays(14)" backend/` returns zero results in test sources.
The one hit of `14` in CalendarController is for `effectivePickupAt` default (+14 days), not urgency — correctly untouched.

**7. Audit-log / messaging triggers keying off urgent**
PASS. Exhaustive search of messaging and trigger packages (`backend/app/src/main/java`) for
`urgent`, `pilne` references: zero matches outside the order package. No trigger or audit-log
path keys off the urgent flag. No test updates needed there.

**8. DTO contract — shape unchanged**
PASS.
- `OrderDto` — `boolean urgent` at position 36. Unchanged.
- `OrderListRow` — `boolean urgent` at position 28. Unchanged.
- `CalendarResponseDto.CalendarOrderDto` — `boolean urgent` at position 10. Unchanged.
- `KanbanResponseDto.KanbanCardDto` — `boolean urgent` at position 7. Unchanged.
No shape change; frontend consumers are unaffected by this commit.

---

## Hygiene

**H1 — CalendarController + KanbanController use divergent urgency logic (pre-existing)**

Both controllers have a private `isUrgent(Order o)` that checks for `tag "pilne"` or
`plannedPickupAt within 48h`. They do NOT delegate to `OrderUrgency.isUrgent()`. This means:
- Calendar `!` marker (Task G) will NOT reflect the new 4-day/PRZYJETE rule unless Task G explicitly
  rewrites `CalendarController.isUrgent()` to call `OrderUrgency.isUrgent()`.
- Kanban cards' `urgent` badge also diverges.

**Recommendation:** Task G's plan should explicitly include replacing both private `isUrgent()`
methods with `OrderUrgency.isUrgent(o.getReceivedAt(), o.getStatus())`. This is not Task A's
responsibility to fix — it's a Task G pre-condition.

**H2 — THRESHOLD_DAYS is public but only used internally**

`public static final int THRESHOLD_DAYS = 4` is exported but has no callers outside
`OrderUrgency` itself. Could be package-private. Minor; not worth a fixup commit.
