# Task G — Calendar "!" marker + unify urgent rule

**Date:** 2026-05-19T19:54:00Z  
**Branch:** `client-adjustments-2026-05-19`  
**Commit:** `d249c0f`

---

## Backend changes

### CalendarController.isUrgent — before → after

**Before (divergent local logic):**
```java
/** Replicates the M1 urgent derivation: tag "pilne" OR plannedPickupAt within 48h. */
private static boolean isUrgent(Order o) {
    String tags = o.getTags();
    if (tags != null && tags.contains("\"pilne\"")) return true;
    if (o.getPlannedPickupAt() != null) {
        return o.getPlannedPickupAt().isBefore(Instant.now().plus(48, ChronoUnit.HOURS));
    }
    return false;
}
```

**After (delegates to OrderUrgency):**
```java
/** Delegates to OrderUrgency: status == PRZYJETE AND receivedAt + 4d <= now. */
private static boolean isUrgent(Order o) {
    return OrderUrgency.isUrgent(o.getReceivedAt(), o.getStatus());
}
```

Added `import com.drshoes.app.order.domain.OrderUrgency;`. Removed unused `ChronoUnit` import (still used elsewhere in file — no removal needed). `Instant` still used for window params.

### KanbanController.isUrgent — before → after

**Before (divergent local logic):**
```java
/** urgent = tag "pilne" present OR plannedPickupAt within 48 h. */
private static boolean isUrgent(Order o) {
    String tags = o.getTags();
    if (tags != null && tags.contains("\"pilne\"")) return true;
    if (o.getPlannedPickupAt() != null) {
        return o.getPlannedPickupAt().isBefore(Instant.now().plus(48, ChronoUnit.HOURS));
    }
    return false;
}
```

**After (delegates to OrderUrgency):**
```java
/** Delegates to OrderUrgency: status == PRZYJETE AND receivedAt + 4d <= now. */
private static boolean isUrgent(Order o) {
    return OrderUrgency.isUrgent(o.getReceivedAt(), o.getStatus());
}
```

Removed `import java.time.Instant;` and `import java.time.temporal.ChronoUnit;` (both now unused). `OrderUrgency` picked up via existing `domain.*` wildcard.

---

## Backend test changes

### CalendarControllerIntegrationTest
Added 2 new tests:
- `urgentTrueWhenPrzyjeteFourDaysOld` — seeds PRZYJETE order with receivedAt=now-5d + explicit plannedPickupAt in window; asserts urgent=true
- `urgentFalseWhenNotPrzyjete` — seeds W_REALIZACJI order same age; asserts urgent=false

### KanbanControllerIntegrationTest
Added 2 new tests:
- `urgentTrueWhenPrzyjeteFourDaysOld` — PRZYJETE, receivedAt=now-5d → urgent=true on columns[0]
- `urgentFalseWhenNotPrzyjete` — W_REALIZACJI, receivedAt=now-5d → urgent=false on columns[1]

---

## Frontend changes

### CalendarMonthGrid.tsx (line 174)

**Before:**
```tsx
{order.code} · {order.clientName.split(" ")[0]}
```

**After:**
```tsx
{order.urgent ? <span className="t-pilne-marker">!</span> : null}{order.code} · {order.clientName.split(" ")[0]}
```

### globals.css

Added one rule after `.t-mono`:
```css
.t-pilne-marker { color: var(--red); font-weight: 900; margin-right: 4px; }
```
Uses existing `--red: #e1342b` token. No new color token.

### CalendarMonthGrid.test.tsx

Extended `makeOrder` helper to accept `urgent` param (default `false`).

Added 2 new tests:
- `urgent chip contains '!' marker` — renders with urgent=true, asserts `.t-pilne-marker` present with text "!"
- `non-urgent chip has no '!' marker` — renders with urgent=false, asserts `.t-pilne-marker` is null

---

## Test counts

| Suite | Before | After | Result |
|---|---|---|---|
| Backend (all modules) | 512 | 516 | GREEN 516/0/0/0 |
| Frontend vitest (CalendarMonthGrid) | 8 | 10 | GREEN 10/0 |
| Frontend vitest (full suite) | 599 passing | 601 passing | 15 pre-existing failures in NewOrderForm + KanbanBoard (from Tasks C/D) |

---

## Third surface scan

`grep -rn "isUrgent\|pilne\|urgent"` across all backend controllers found:
- `OrderController.java` — passes `urgent` as a filter param to `OrderSpecifications` (sealed by Task A). No divergent computation.
- No other controller has its own urgent computation logic.

**No third surface discovered.**

---

## Files modified

**Backend:**
- `backend/app/src/main/java/com/drshoes/app/order/api/CalendarController.java`
- `backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java`
- `backend/app/src/test/java/com/drshoes/app/order/api/CalendarControllerIntegrationTest.java`
- `backend/app/src/test/java/com/drshoes/app/order/api/KanbanControllerIntegrationTest.java`

**Frontend:**
- `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarMonthGrid.tsx`
- `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/CalendarMonthGrid.test.tsx`
- `apps/web/app/globals.css`
