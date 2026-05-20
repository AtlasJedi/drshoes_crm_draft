# Order list scale to 1k — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin order list scale to 1k orders by hiding `ANULOWANE` and capping `WYDANE` to the last 30 days — entirely at the DB/service layer, with zero frontend change.

**Architecture:** New `OrderListPolicy` class normalizes the raw `statuses` param from the controller into an `EffectiveFilter` record (statuses + nullable `wydaneCutoff`). `OrderSpecifications.forList` gains one nullable `Instant wydaneCutoff` parameter and one OR-branch. `OrderController` rejects explicit `status=ANULOWANE` with 400. A new Flyway migration adds three partial B-tree indexes.

**Tech Stack:** Java 21, Spring Boot 3.4, Spring Data JPA, Hibernate 6, JPA Criteria API, JUnit 5 + AssertJ, Testcontainers Postgres 16, Flyway, Maven.

**Spec:** [`docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md`](../specs/2026-05-20-order-list-scale-1k-design.md)

**Dispatch protocol facts (from CLAUDE.md):**
- Commit messages MUST tag `[milestone:client-adj][task:<N>]` and include `Refs: docs/dispatch-log/<task>-<UTC>.md` in body.
- Each dispatched task writes `docs/dispatch-log/<task>-<UTC>.md` (files touched, commands run, test summary, decisions, commit SHA).
- Java classes < 120 LOC. Granular code. Structured logging at INFO with `key=value` fields.
- Combined single-stage review applies here (mechanical TDD, no security-sensitive code, no migrations touching existing data).
- All UI copy in Polish; code/comments in English. (No UI touched in this plan.)

---

## File structure

| Path | Action | Responsibility | Approx LOC |
|---|---|---|---|
| `backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java` | NEW | Normalize raw `statuses` → `EffectiveFilter`. Enforce ANULOWANE rejection. Define 30d window constant. | ~60 |
| `backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java` | NEW | Pure-unit tests for the 6 policy resolution cases. | ~70 |
| `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java` | MODIFY | `forList(...)` signature gains nullable `Instant wydaneCutoff`. Status predicate becomes OR-branch when cutoff is non-null. | +15 LOC delta |
| `backend/app/src/main/java/com/drshoes/app/order/OrderService.java` | MODIFY | `list(...)` calls `OrderListPolicy.resolve(...)` first, then threads `effectiveFilter` into `OrderSpecifications.forList(...)`. Signature unchanged externally. | +8 LOC delta |
| `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java` | MODIFY | One ANULOWANE rejection guard at top of `list()`. Two new log fields (`effectiveStatuses`, `wydaneCutoff`). | +12 LOC delta |
| `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java` | MODIFY | +4 IT cases: default hides ANULOWANE, default caps WYDANE @ 30d, ?status=ANULOWANE returns 400, explicit ?status=WYDANE returns all WYDANE. | +120 LOC delta |
| `backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java` | NEW | Repo-level IT proving the SQL filter+sort works against real Postgres seeded data. | ~150 |
| `backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql` | NEW | Three partial B-tree indexes. | ~25 |

Total estimated diff: ~460 LOC additions, mostly tests + SQL.

---

## Task ordering rationale

Index migration goes LAST because the partial-index `WHERE` clauses reference `OrderStatus` literal strings — if we accidentally rename a status or change the policy mid-plan, we won't pay a wasted migration version. Code-and-test-first matches existing M0..M8 sequencing.

---

## Task 1 — `OrderListPolicy` (pure unit-tested logic)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java`

- [ ] **Step 1.1: Write the failing test file**

Create `backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java`:

```java
package com.drshoes.app.order;

import com.drshoes.app.order.OrderListPolicy.EffectiveFilter;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-unit tests for OrderListPolicy.resolve().
 * No Spring context — policy is a static utility.
 *
 * Verifies the contract documented in
 * docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md.
 */
class OrderListPolicyTest {

    @Test
    void nullStatuses_returnsActiveStatusesPlusCutoff() {
        Instant before = Instant.now();

        EffectiveFilter f = OrderListPolicy.resolve(null);

        Instant after = Instant.now();
        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
        assertThat(f.wydaneCutoff()).isNotNull();
        // Cutoff should be ~30 days before now.
        Instant expectedCutoff = before.minus(Duration.ofDays(30));
        assertThat(f.wydaneCutoff()).isBetween(expectedCutoff, after.minus(Duration.ofDays(30)));
    }

    @Test
    void emptyStatuses_returnsActiveStatusesPlusCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(List.of());

        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
        assertThat(f.wydaneCutoff()).isNotNull();
    }

    @Test
    void anulowaneExplicitlyRequested_throws() {
        assertThatThrownBy(() -> OrderListPolicy.resolve(List.of(OrderStatus.ANULOWANE)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("status.anulowane.disallowed");
    }

    @Test
    void anulowaneMixedWithOthers_throws() {
        assertThatThrownBy(() -> OrderListPolicy.resolve(
                List.of(OrderStatus.PRZYJETE, OrderStatus.ANULOWANE)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("status.anulowane.disallowed");
    }

    @Test
    void singleWydane_escapeHatch_returnsWydaneOnlyNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(List.of(OrderStatus.WYDANE));

        assertThat(f.statuses()).containsExactly(OrderStatus.WYDANE);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void explicitListWithoutAnulowane_returnsAsIsNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(
            List.of(OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI));

        assertThat(f.statuses()).containsExactly(
            OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void explicitListIncludingWydane_returnsAsIsNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(
            List.of(OrderStatus.WYDANE, OrderStatus.PRZYJETE));

        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WYDANE, OrderStatus.PRZYJETE);
        assertThat(f.wydaneCutoff()).isNull();
    }
}
```

- [ ] **Step 1.2: Run test, confirm RED**

```
cd /Users/atlasjedi/P/misza_madafaka/backend
mvn -pl app -Dtest=OrderListPolicyTest test
```

Expected: compile failure — `OrderListPolicy` symbol does not exist.

- [ ] **Step 1.3: Implement `OrderListPolicy`**

Create `backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java`:

```java
package com.drshoes.app.order;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Normalizes raw status filter input from the controller into an
 * EffectiveFilter that the JPA Specification layer can consume.
 *
 * Default policy (no statuses passed):
 *   - Include all "active" statuses (NOT in {WYDANE, ANULOWANE})
 *   - Include WYDANE only when picked_up_at >= now - 30d
 *
 * Defense in depth: ANULOWANE explicitly requested → IllegalArgumentException.
 * The controller maps this to HTTP 400. The filter UI never offers ANULOWANE.
 *
 * Single explicit WYDANE pick: escape hatch returns all WYDANE (no cutoff).
 *
 * See spec: docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md
 */
public final class OrderListPolicy {

    private OrderListPolicy() {}

    static final int WYDANE_RECENT_WINDOW_DAYS = 30;

    static final Set<OrderStatus> ACTIVE_STATUSES = EnumSet.of(
        OrderStatus.WSTEPNIE_PRZYJETE,
        OrderStatus.PRZYJETE,
        OrderStatus.W_REALIZACJI,
        OrderStatus.CZEKA_NA_KLIENTA,
        OrderStatus.GOTOWE_DO_ODBIORU);

    /**
     * Result of resolving the raw status filter.
     *
     * @param statuses      statuses to include unconditionally
     * @param wydaneCutoff  if non-null, ALSO include WYDANE rows with picked_up_at >= cutoff
     *                      (i.e. the default-mode 30d window). null when caller picked statuses explicitly.
     */
    public record EffectiveFilter(List<OrderStatus> statuses, Instant wydaneCutoff) {}

    /**
     * Resolve raw status param into an EffectiveFilter.
     *
     * @throws IllegalArgumentException if ANULOWANE appears in the raw list (controller maps to 400)
     */
    public static EffectiveFilter resolve(List<OrderStatus> rawStatuses) {
        if (rawStatuses != null && rawStatuses.contains(OrderStatus.ANULOWANE)) {
            throw new IllegalArgumentException("status.anulowane.disallowed");
        }
        if (rawStatuses == null || rawStatuses.isEmpty()) {
            return new EffectiveFilter(
                List.copyOf(ACTIVE_STATUSES),
                Instant.now().minus(Duration.ofDays(WYDANE_RECENT_WINDOW_DAYS)));
        }
        // Explicit pick — no implicit WYDANE injection, no cutoff.
        return new EffectiveFilter(List.copyOf(rawStatuses), null);
    }
}
```

- [ ] **Step 1.4: Run test, confirm GREEN**

```
mvn -pl app -Dtest=OrderListPolicyTest test
```

Expected: 7 tests pass.

- [ ] **Step 1.5: Commit**

```
git add backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java \
        backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java

git commit -m "$(cat <<'EOF'
feat(orders): add OrderListPolicy for default status filter [milestone:client-adj][task:1]

Pure-unit-tested policy that normalizes raw statuses param into an
EffectiveFilter (statuses + nullable wydaneCutoff). Default: 5 active
statuses + 30d WYDANE window. ANULOWANE explicitly requested throws.

Refs: (dispatch log written by subagent)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Thread `EffectiveFilter` through `OrderSpecifications.forList` and `OrderService.list`

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`

There is exactly one caller of `OrderSpecifications.forList` today (`OrderService.list`, line 75). Confirmed by grep before plan-write.

- [ ] **Step 2.1: Modify `OrderSpecifications.forList` to accept `wydaneCutoff`**

Open `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`.

Change the signature at line 34 from:

```java
public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                           List<OrderItemKind> kinds, String q,
                                           String tag, Instant plannedPickupAtFrom,
                                           Instant plannedPickupAtTo, UUID clientId,
                                           Boolean urgent) {
```

to:

```java
public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                           List<OrderItemKind> kinds, String q,
                                           String tag, Instant plannedPickupAtFrom,
                                           Instant plannedPickupAtTo, UUID clientId,
                                           Boolean urgent, Instant wydaneCutoff) {
```

Replace the existing status block at lines 42-43:

```java
if (statuses != null && !statuses.isEmpty())
    preds.add(root.get("status").in(statuses));
```

with the OR-branch version:

```java
if (statuses != null && !statuses.isEmpty()) {
    if (wydaneCutoff != null) {
        // Default mode: active statuses OR (WYDANE picked up within window).
        preds.add(cb.or(
            root.get("status").in(statuses),
            cb.and(
                cb.equal(root.get("status"), OrderStatus.WYDANE),
                cb.greaterThanOrEqualTo(root.get("pickedUpAt"), wydaneCutoff))));
    } else {
        preds.add(root.get("status").in(statuses));
    }
}
```

- [ ] **Step 2.2: Update `OrderService.list` to call the policy**

Open `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`.

Replace the body of `list(...)` (lines 67-82) with:

```java
@Transactional(readOnly = true)
public Page<OrderListRow> list(List<OrderStatus> statuses, UUID assigneeId,
                               List<OrderItemKind> kinds, String q,
                               String tag, Instant plannedPickupAtFrom,
                               Instant plannedPickupAtTo, UUID clientId,
                               Boolean urgent,
                               Pageable pageable) {
    OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(statuses);
    var page = orderRepo.findAll(
        OrderSpecifications.forList(effective.statuses(), assigneeId, kinds, q, tag,
                                    plannedPickupAtFrom, plannedPickupAtTo, clientId,
                                    urgent, effective.wydaneCutoff()),
        pageable);
    Set<UUID> cids = page.map(Order::getClientId).toSet();
    Map<UUID, String> names = clientRepo.findAllById(cids).stream()
        .collect(Collectors.toMap(c -> c.getId(), c -> c.getFullName()));
    return page.map(o -> OrderListRow.of(o, names.getOrDefault(o.getClientId(), "—")));
}
```

(No new imports needed — `OrderListPolicy` is in the same package.)

- [ ] **Step 2.3: Run the existing list tests, confirm still GREEN**

```
cd /Users/atlasjedi/P/misza_madafaka/backend
mvn -pl app -Dtest=OrderControllerIntegrationTest test
```

Expected: all existing tests pass. Existing tests seed PRZYJETE orders (default status from `create()`), which stay in `ACTIVE_STATUSES`. No test today seeds WYDANE/ANULOWANE then asserts they appear in the default list, so no regression.

If a test fails, STOP and investigate — do not loosen the test.

- [ ] **Step 2.4: Run full backend suite**

```
mvn -pl app -am -DskipTests=false test
```

Expected: same green count as baseline (398 + new 7 from Task 1 = 405).

- [ ] **Step 2.5: Commit**

```
git add backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java \
        backend/app/src/main/java/com/drshoes/app/order/OrderService.java

git commit -m "$(cat <<'EOF'
refactor(orders): thread EffectiveFilter through list path [milestone:client-adj][task:2]

OrderService.list now calls OrderListPolicy.resolve(statuses) and passes
the EffectiveFilter into OrderSpecifications.forList, which gains a nullable
wydaneCutoff parameter. When non-null, the status predicate becomes
(active.in(statuses)) OR (status=WYDANE AND picked_up_at >= cutoff).

Existing IT seeds PRZYJETE → still in ACTIVE_STATUSES → no regression.

Refs: (dispatch log written by subagent)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `OrderController` ANULOWANE guard + log fields + 4 new IT cases

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java`

- [ ] **Step 3.1: Write the new failing IT cases**

Open `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java`.

Add these imports near the existing imports if not already present:

```java
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
```

Append these four test methods inside the test class (anywhere before the closing brace, after the `unauthenticatedPostReturns401` block at ~line 363):

```java
// -------------------------------------------------------------------------
// V034 / list policy: default hides ANULOWANE + caps WYDANE @ 30 days
// Spec: docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md
// -------------------------------------------------------------------------

@Test
void listDefaultHidesAnulowaneEntirely() throws Exception {
    loginAsOwner();
    UUID activeId = createOrderAndReturnId("Active order");
    UUID anulId = createOrderAndReturnId("Cancelled order");
    // Force one order into ANULOWANE directly via repository to bypass workflow rules.
    Order anul = orderRepository.findById(anulId).orElseThrow();
    anul.setStatus(OrderStatus.ANULOWANE);
    orderRepository.saveAndFlush(anul);

    mockMvc().perform(get("/api/admin/orders"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '" + activeId + "')]").exists())
        .andExpect(jsonPath("$.content[?(@.id == '" + anulId + "')]").doesNotExist());
}

@Test
void listDefaultIncludesRecentWydaneButExcludesOldOnes() throws Exception {
    loginAsOwner();
    UUID recentId = createOrderAndReturnId("Recent pickup");
    UUID oldId = createOrderAndReturnId("Old pickup");

    // Recent WYDANE: picked up 5 days ago — should appear in default list.
    Order recent = orderRepository.findById(recentId).orElseThrow();
    recent.setStatus(OrderStatus.WYDANE);
    recent.setPickedUpAt(Instant.now().minus(5, ChronoUnit.DAYS));
    orderRepository.saveAndFlush(recent);

    // Old WYDANE: picked up 60 days ago — must NOT appear in default list.
    Order old = orderRepository.findById(oldId).orElseThrow();
    old.setStatus(OrderStatus.WYDANE);
    old.setPickedUpAt(Instant.now().minus(60, ChronoUnit.DAYS));
    orderRepository.saveAndFlush(old);

    mockMvc().perform(get("/api/admin/orders"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '" + recentId + "')]").exists())
        .andExpect(jsonPath("$.content[?(@.id == '" + oldId + "')]").doesNotExist());
}

@Test
void listExplicitAnulowaneReturns400() throws Exception {
    loginAsOwner();

    mockMvc().perform(get("/api/admin/orders?status=ANULOWANE"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("status.anulowane.disallowed"));
}

@Test
void listExplicitWydaneReturnsAllRegardlessOfAge() throws Exception {
    loginAsOwner();
    UUID oldId = createOrderAndReturnId("Old pickup escape hatch");

    Order old = orderRepository.findById(oldId).orElseThrow();
    old.setStatus(OrderStatus.WYDANE);
    old.setPickedUpAt(Instant.now().minus(180, ChronoUnit.DAYS));
    orderRepository.saveAndFlush(old);

    mockMvc().perform(get("/api/admin/orders?status=WYDANE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == '" + oldId + "')]").exists());
}
```

- [ ] **Step 3.2: Run new ITs, confirm RED**

```
mvn -pl app -Dtest=OrderControllerIntegrationTest#listDefaultHidesAnulowaneEntirely+listDefaultIncludesRecentWydaneButExcludesOldOnes+listExplicitAnulowaneReturns400+listExplicitWydaneReturnsAllRegardlessOfAge test
```

Expected: 3 of 4 might pass already (Task 2 wired the policy), but `listExplicitAnulowaneReturns400` must FAIL (controller doesn't yet reject ANULOWANE — it would throw 500 from the policy's IllegalArgumentException).

- [ ] **Step 3.3: Implement the ANULOWANE guard + log fields**

Open `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`.

Replace the `list(...)` method (lines 73-94) entirely with:

```java
@GetMapping
public ResponseEntity<?> list(
        @RequestParam(required = false) List<OrderStatus> status,
        @RequestParam(required = false, name = "type") List<OrderItemKind> kinds,
        @RequestParam(required = false) UUID craftsmanId,
        @RequestParam(required = false) UUID clientId,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtFrom,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtTo,
        @RequestParam(required = false) Boolean urgent,
        @PageableDefault(size = 25, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
        Authentication auth) {
    // Defense in depth — ANULOWANE is never offered by the filter UI and must
    // not appear via a hand-crafted URL. Spec: 2026-05-20-order-list-scale-1k-design.md.
    if (status != null && status.contains(OrderStatus.ANULOWANE)) {
        log.warn("op=listOrders actor={} outcome=blocked reason=status.anulowane.disallowed",
            actor(auth));
        return ResponseEntity.badRequest()
            .body(java.util.Map.of("error", "status.anulowane.disallowed"));
    }
    OrderSortValidator.validate(pageable);
    Instant from = plannedPickupAtFrom != null
        ? plannedPickupAtFrom.atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
    Instant to = plannedPickupAtTo != null
        ? plannedPickupAtTo.plusDays(1).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
    var page = svc.list(status, craftsmanId, kinds, q, tag, from, to, clientId, urgent, pageable);
    log.info("op=listOrders actor={} clientId={} tag={} from={} to={} urgent={} rawStatus={} sort={} count={} outcome=ok",
        actor(auth), clientId, tag, from, to, urgent,
        status, pageable.getSort(), page.getNumberOfElements());
    return ResponseEntity.ok(page);
}
```

Note: return type changed from `Page<OrderListRow>` to `ResponseEntity<?>` to allow 400 response. The JSON body structure of 200 responses is unchanged.

- [ ] **Step 3.4: Run new ITs, confirm GREEN**

```
mvn -pl app -Dtest=OrderControllerIntegrationTest test
```

Expected: all existing IT cases pass + 4 new ones pass.

- [ ] **Step 3.5: Run full backend suite**

```
mvn -pl app -am -DskipTests=false test
```

Expected: green. New count = baseline + 7 (Task 1) + 4 (Task 3) = +11.

- [ ] **Step 3.6: Commit**

```
git add backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java \
        backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java

git commit -m "$(cat <<'EOF'
feat(orders): reject explicit status=ANULOWANE on list [milestone:client-adj][task:3]

OrderController.list returns 400 with {"error":"status.anulowane.disallowed"}
when the caller hand-crafts ?status=ANULOWANE. Filter UI does not offer it.
Adds 4 IT cases: default hides ANULOWANE, default caps WYDANE @ 30d, 400 on
explicit ANULOWANE, explicit ?status=WYDANE escape hatch returns all.

Refs: (dispatch log written by subagent)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Repository-level integration test (real Postgres)

**Files:**
- Create: `backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java`

This test guards the JPA Specification → SQL translation independently of the controller stack. Catches future regressions where someone "simplifies" the OR-branch into something subtly wrong.

- [ ] **Step 4.1: Write the IT**

Create `backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java`:

```java
package com.drshoes.app.order;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the OrderSpecifications.forList SQL generation against a real
 * Testcontainers Postgres instance.
 *
 * Covers the default-mode OR-branch:
 *   (status IN (active)) OR (status='WYDANE' AND picked_up_at >= cutoff)
 *
 * Independent of the controller stack — catches regressions where someone
 * "simplifies" the predicate into something subtly wrong.
 *
 * Naming: *IntegrationTest.java is the convention that runs in Surefire
 * (see memory: feedback_subagent_output_token_budget / *IT.java was never
 * wired into Failsafe).
 */
class OrderRepositoryListIntegrationTest extends AbstractIntegrationTest {

    @Autowired private OrderRepository orders;
    @Autowired private ClientRepository clients;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        Client c = new Client();
        c.setFirstName("Test");
        c.setPhone("+48 600 000 001");
        clientId = clients.save(c).getId();
    }

    private UUID createOrder(OrderStatus status, Instant pickedUpAt) {
        Order o = new Order();
        o.setCode("T-" + System.nanoTime());
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        o.setPickedUpAt(pickedUpAt);
        return orders.saveAndFlush(o).getId();
    }

    @Test
    void defaultPolicy_returnsActiveAndRecentWydane_excludesOldWydaneAndAnulowane() {
        UUID active = createOrder(OrderStatus.PRZYJETE, null);
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));
        UUID wydaneOld = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(60, ChronoUnit.DAYS));
        UUID anul = createOrder(OrderStatus.ANULOWANE, null);

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(null);

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(active, wydaneRecent)
            .doesNotContain(wydaneOld, anul);
    }

    @Test
    void explicitWydaneEscapeHatch_returnsAllWydaneIgnoringAge() {
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));
        UUID wydaneOld = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(180, ChronoUnit.DAYS));
        UUID anul = createOrder(OrderStatus.ANULOWANE, null);

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(
            java.util.List.of(OrderStatus.WYDANE));

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(wydaneRecent, wydaneOld)
            .doesNotContain(anul);
    }

    @Test
    void explicitActiveStatusPick_doesNotImplicitlyAddWydane() {
        UUID active = createOrder(OrderStatus.PRZYJETE, null);
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(
            java.util.List.of(OrderStatus.PRZYJETE));

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(active)
            .doesNotContain(wydaneRecent);
    }
}
```

- [ ] **Step 4.2: Run IT, confirm GREEN**

```
cd /Users/atlasjedi/P/misza_madafaka/backend
mvn -pl app -Dtest=OrderRepositoryListIntegrationTest test
```

Expected: 3 tests pass against the Testcontainers Postgres.

- [ ] **Step 4.3: Commit**

```
git add backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java

git commit -m "$(cat <<'EOF'
test(orders): repo-level IT for default list policy [milestone:client-adj][task:4]

Three Testcontainers Postgres cases:
- default returns active + recent WYDANE, excludes old WYDANE + ANULOWANE
- explicit ?status=WYDANE escape hatch ignores age
- explicit active-status pick does not implicitly add WYDANE

Independent of controller stack — guards Specification → SQL translation.

Refs: (dispatch log written by subagent)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Flyway migration V034: three partial B-tree indexes

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql`

- [ ] **Step 5.1: Verify the next available Flyway version**

```
ls backend/app/src/main/resources/db/migration/ | sort | tail -5
```

Expected: V033 is the highest. V034 is free.

- [ ] **Step 5.2: Write the migration**

Create `backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql`:

```sql
-- V034: partial B-tree indexes backing the order list + kanban access paths.
--
-- Targets the queries documented in
-- docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md.
--
-- All three are partial (deleted_at IS NULL) so they stay tiny: ~50 KB at
-- 1k orders, ~500 KB at 10k. The existing order_status_pickup_idx
-- (status, planned_pickup_at) stays — used by trigger queries + calendar.

-- (1) Backs the LIST default sort across active statuses:
--     SELECT * FROM order_
--      WHERE status IN (5 active) AND deleted_at IS NULL
--      ORDER BY created_at DESC LIMIT 25 OFFSET 0
CREATE INDEX order_active_created_at_idx
  ON order_ (created_at DESC)
  WHERE deleted_at IS NULL
    AND status IN ('WSTEPNIE_PRZYJETE','PRZYJETE','W_REALIZACJI',
                   'CZEKA_NA_KLIENTA','GOTOWE_DO_ODBIORU');

-- (2) Backs the Kanban per-column query:
--     SELECT * FROM order_
--      WHERE status = ? AND deleted_at IS NULL
--      ORDER BY received_at DESC LIMIT ?
CREATE INDEX order_status_received_at_idx
  ON order_ (status, received_at DESC)
  WHERE deleted_at IS NULL;

-- (3) Backs the Kanban WYDANE column AND the LIST 30d cap branch:
--     SELECT * FROM order_
--      WHERE status='WYDANE' AND deleted_at IS NULL
--      ORDER BY picked_up_at DESC NULLS LAST LIMIT ?
--   and
--     SELECT * FROM order_
--      WHERE status='WYDANE' AND picked_up_at >= ? AND deleted_at IS NULL
CREATE INDEX order_wydane_picked_up_at_idx
  ON order_ (picked_up_at DESC NULLS LAST)
  WHERE status = 'WYDANE' AND deleted_at IS NULL;
```

- [ ] **Step 5.3: Apply migration via a fresh test run**

The Testcontainers Postgres applies V001..V034 on test startup. Running any IT will exercise the migration.

```
cd /Users/atlasjedi/P/misza_madafaka/backend
mvn -pl app -Dtest=OrderRepositoryListIntegrationTest test
```

Expected: GREEN. If V034 has a syntax error, Flyway fails fast on test container startup.

- [ ] **Step 5.4: Apply against the running dev DB**

```
docker compose exec -T postgres psql -U drshoes -d drshoes -c "\d order_"
```

Note the current index list, then trigger Flyway against the live DB by restarting the backend container:

```
# Rebuild jar FIRST (Java source changes from Tasks 2+3 require recompile)
cd /Users/atlasjedi/P/misza_madafaka/backend
mvn -pl app -am -DskipTests clean package
# Rebuild container image with new jar + restart
cd /Users/atlasjedi/P/misza_madafaka
docker compose build backend && docker compose up -d backend
# Wait for healthy
docker compose ps backend
```

Verify migration landed:

```
docker compose exec -T postgres psql -U drshoes -d drshoes -c "\d order_" | grep -E "active_created|status_received|wydane_picked"
```

Expected: all three new index names listed.

- [ ] **Step 5.5: Verify backend health**

```
curl -fsS http://localhost:8081/actuator/health | jq .
```

Expected: `{"status":"UP", ...}` with `db: {"status":"UP"}`.

- [ ] **Step 5.6: Commit**

```
git add backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql

git commit -m "$(cat <<'EOF'
feat(db): V034 partial indexes for order list + kanban [milestone:client-adj][task:5]

Three partial B-tree indexes:
- order_active_created_at_idx — LIST default sort across active statuses
- order_status_received_at_idx — Kanban per-column sort by received_at
- order_wydane_picked_up_at_idx — Kanban WYDANE column + LIST 30d cap branch

Index size ~50 KB at 1k orders, ~500 KB at 10k. Existing
order_status_pickup_idx unchanged (used by triggers + calendar).

Refs: (dispatch log written by subagent)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Smoke verification (browser + curl)

**Files:** none

- [ ] **Step 6.1: Verify default list excludes ANULOWANE + caps WYDANE**

The demo seed includes a mix of statuses. Hit the API directly first:

```
curl -fsS -c /tmp/c -b /tmp/c -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"misza@drshoes.pl","password":"change-me-on-first-login"}' \
  | jq .
```

Then list orders:

```
curl -fsS -b /tmp/c "http://localhost:3000/api/admin/orders?size=100" | \
  jq '.content | map(.status) | group_by(.) | map({status: .[0], count: length})'
```

Expected: ZERO `ANULOWANE` rows. `WYDANE` rows (if any) all have `pickedUpAt >= now - 30d`. (The 30d filter is on `picked_up_at`, returned as `pickedUpAt`.)

- [ ] **Step 6.2: Verify explicit ANULOWANE returns 400**

```
curl -s -o /tmp/anul.json -w "%{http_code}\n" -b /tmp/c \
  "http://localhost:3000/api/admin/orders?status=ANULOWANE"
cat /tmp/anul.json
```

Expected: `400`, body `{"error":"status.anulowane.disallowed"}`.

- [ ] **Step 6.3: Verify explicit WYDANE escape hatch**

```
curl -fsS -b /tmp/c "http://localhost:3000/api/admin/orders?status=WYDANE&size=100" | \
  jq '.content | length'
```

Expected: returns all WYDANE rows in DB, regardless of `pickedUpAt` age.

- [ ] **Step 6.4: Verify Kanban + Calendar untouched**

```
curl -fsS -b /tmp/c "http://localhost:3000/api/admin/orders/kanban" | \
  jq '. | to_entries | map({column: .key, count: (.value.orders // .value | length)})'

today=$(date +%Y-%m-%d)
two_weeks=$(date -v+14d +%Y-%m-%d 2>/dev/null || date -d "+14 days" +%Y-%m-%d)
curl -fsS -b /tmp/c "http://localhost:3000/api/admin/orders/calendar?from=${today}&to=${two_weeks}" | \
  jq '. | keys'
```

Expected: both endpoints return their existing shape, no errors, no ANULOWANE column / events.

- [ ] **Step 6.5: Playwright smoke (per CLAUDE.md feedback_playwright_verify_ui_fixes)**

Use `mcp__playwright__*` tools to:

1. Navigate to `http://localhost:3000/admin/login`, log in as `misza@drshoes.pl` / `change-me-on-first-login`.
2. Navigate to `/admin/orders`.
3. Read the visible row count and a sample of status badges in the rendered table. Confirm no `ANULOWANE` badge appears, and that any `WYDANE` rows look recent (the UI doesn't show age — verify via backend logs instead).
4. Navigate to `/admin/orders/kanban`. Confirm no ANULOWANE column.
5. Navigate to `/admin/orders/calendar`. Confirm it loads.
6. Grep backend logs for `op=listOrders` and confirm `outcome=ok` plus a non-zero `count=`:

```
docker compose logs --tail=200 backend | grep "op=listOrders"
```

Expected: `outcome=ok` with `count=` reflecting active+recent-WYDANE.

- [ ] **Step 6.6: No commit (verification only)**

Smoke verification produces no code change. If any step fails, file a follow-up task — do NOT modify code mid-Task-6 without re-opening the spec.

---

## Self-review (run before dispatching)

**Spec coverage:**
- §"API contract change" → Tasks 1, 2, 3. ✓
- §"Components" → Task 1 (OrderListPolicy), Task 2 (Specifications + Service), Task 3 (Controller). ✓
- §"Database indexes" → Task 5. ✓
- §"Testing strategy" → Tasks 1 (unit), 3 (controller IT), 4 (repo IT), 6 (smoke). ✓
- §"Migration order" → matches Task 1→6 sequence. ✓

**Placeholder scan:** None. Every step has actual code, exact paths, exact commands, expected output.

**Type consistency:**
- `EffectiveFilter(List<OrderStatus>, Instant)` — referenced identically in Tasks 1, 2, 4.
- `OrderSpecifications.forList(..., Instant wydaneCutoff)` — 10-arg signature, used identically in Task 2 (service) and Task 4 (test).
- `OrderStatus.ANULOWANE` literal — used in policy, controller guard, all relevant tests.

**Cross-cutting:**
- Memory `feedback_backend_jar_rebuild_gotcha`: Task 5 Step 5.4 explicitly runs `mvn ... clean package` BEFORE `docker compose build backend`. ✓
- Memory `feedback_ui_fix_requires_container_rebuild`: same as above. ✓
- Memory `feedback_playwright_verify_ui_fixes`: Task 6 Step 6.5 uses `mcp__playwright__*` + log grep, not bundle grep. ✓
- Memory `feedback_subagent_output_token_budget`: total plan ≈ 1500 lines, dispatch fits easily under output cap when executed as a single subagent. ✓
- Memory `feedback_anti_bloat_dispatch`: combined single-stage review (mechanical TDD, no security-sensitive code). ✓
