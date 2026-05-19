# Dispatch Log — Task A: Urgency Rule Rewrite

**Task:** A (Adj #2 — pilne rule rewrite)
**Branch:** `client-adjustments-2026-05-19`
**Commit SHA:** b9cc8e2
**UTC timestamp:** 2026-05-19T19:09:54Z
**Executor:** Sonnet subagent (Stage 1)

---

## Files Touched

| File | Change |
|---|---|
| `backend/app/src/main/java/com/drshoes/app/order/domain/OrderUrgency.java` | Rewrote urgency rule — THRESHOLD_DAYS 14→4, removed EXCLUDED set, replaced multi-status gate with `status != PRZYJETE` guard |
| `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java` | Updated JPA predicate — cutoff 14→4 days, replaced `status.in(4 statuses)` with `cb.equal(status, PRZYJETE)` |
| `backend/app/src/test/java/com/drshoes/app/order/domain/OrderUrgencyTest.java` | Full rewrite — replaced 14d/multi-status tests with 4d/PRZYJETE tests, added regression cases for all non-PRZYJETE statuses |
| `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java` | Updated `listOrders_urgentTrue_returnsOnlyUrgent` — urgent fixture changed from W_REALIZACJI+20d → PRZYJETE+5d; added W_REALIZACJI+30d regression assertion |

---

## Key Code Excerpts

### OrderUrgency.java (after)
```java
// THRESHOLD_DAYS: 14 → 4
public static final int THRESHOLD_DAYS = 4;

// Removed: private static final Set<OrderStatus> EXCLUDED = Set.of(...)

public static boolean isUrgent(Instant receivedAt, OrderStatus status, Clock clock) {
    if (receivedAt == null) return false;
-   if (EXCLUDED.contains(status)) return false;
+   if (status != OrderStatus.PRZYJETE) return false;
    return Duration.between(receivedAt, clock.instant()).toDays() >= THRESHOLD_DAYS;
}
```

### OrderSpecifications.java lines 86–93 (after)
```java
if (Boolean.TRUE.equals(urgent)) {
-   Instant cutoff = Instant.now().minusSeconds(14L * 86400L);
+   Instant cutoff = Instant.now().minusSeconds(4L * 86400L);
    preds.add(cb.isNotNull(root.get("receivedAt")));
    preds.add(cb.lessThanOrEqualTo(root.get("receivedAt"), cutoff));
-   preds.add(root.get("status").in(
-       OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI,
-       OrderStatus.CZEKA_NA_KLIENTA, OrderStatus.GOTOWE_DO_ODBIORU));
+   preds.add(cb.equal(root.get("status"), OrderStatus.PRZYJETE));
}
```

---

## Grep — EXCLUDED constant callers

Ran: `grep -r -l "EXCLUDED\|THRESHOLD_DAYS" backend/app/src/main --include="*.java"`

Result: only `OrderUrgency.java` itself. No other callers. Constant deleted safely.

---

## Test Summary

**Command:** `mvn -pl app -am -DskipTests=false test` (from `backend/`)

| Module | Tests | Failures | Errors | Skipped |
|---|---|---|---|---|
| app (full reactor) | 509 | 0 | 0 | 0 |

Suite GREEN. No pre-existing failures detected.

---

## Acceptance Criteria Check

| Criterion | Result |
|---|---|
| PRZYJETE + receivedAt 5 days ago → urgent=true | PASS (unit test `urgent_whenPrzyjeteFiveDaysAgo`) |
| PRZYJETE + receivedAt exactly 4 days ago → urgent=true | PASS (unit test `urgent_whenPrzyjeteExactlyFourDaysAgo`) |
| PRZYJETE + receivedAt 3 days ago → urgent=false | PASS (unit test `notUrgent_whenPrzyjeteThreeDaysAgo`) |
| W_REALIZACJI + receivedAt 30 days ago → urgent=false | PASS (unit test `notUrgent_whenWRealizacjiThirtyDaysAgo` + IT assertion) |
| Integration filter returns only PRZYJETE+≥4d orders | PASS (`listOrders_urgentTrue_returnsOnlyUrgent`) |

---

## Out-of-scope items noted

- Calendar `+14d fallback` in `CalendarControllerIntegrationTest:218` is for `effectivePickupAt` default, not urgency — intentionally untouched.
- Frontend `?urgent=true` filter chip passes through unchanged (server-side rule, no FE change needed per plan).
