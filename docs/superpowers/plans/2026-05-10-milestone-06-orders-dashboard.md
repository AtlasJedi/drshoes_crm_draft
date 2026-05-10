# Milestone 6 — Order processing polish + Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily Misza-flow smooth. Ship live Dashboard (4 KPI tiles + 2 charts + 2 panels), Calendar (read-only Month grid + Bez-terminu side panel), Kanban (5 columns + drag-to-status with M2 trigger-confirm), list polish (saved presets + bulk + quick actions), and clear M4/M5 hygiene debt.

**Architecture:** New `dashboard` package and `order/api` controller batch (`CalendarController`, `KanbanController`, `BulkStatusController`) on backend; new admin frontend routes `/admin/orders/calendar` and `/admin/orders/kanban` with shared `OrderViewTabs` + per-surface lib slice (`lib/dashboard/`, `lib/calendar/`, `lib/kanban/`). Hybrid wave shape: backend batch first (W1, parallel-dispatchable), then per-surface frontend waves (W2 Dashboard → W3 Calendar → W4 Kanban → W5 List polish), each gated on owner-supplied design exports for new states. W0 first clears the four hygiene debts carried out of M4+M5 close.

**Tech Stack:** Java 21 + Spring Boot 3.4 (multi-module Maven), Spring Security session-based, Postgres 16, Flyway. Frontend: Next.js 16 App Router, TS strict, Tailwind, Radix, `@dnd-kit/core` (NEW dep for Kanban drag).

---

## ERRATA — pre-execution clarifications (read before any task)

### 1. Hard rules (MUST read before writing any code)

- **IT class naming:** ALL integration test classes MUST be named `*IntegrationTest.java`. Classes named `*IT.java` are silently skipped by Maven Failsafe and will NEVER execute. This bit M3 and M4 hard. There are no exceptions.
- **Controller package convention:** ALL controllers MUST live in a `.api.` package (e.g. `com.drshoes.app.dashboard.api`, `com.drshoes.app.order.api`). The `AuditLogAspect` path-pattern curator requires this. A controller outside `.api.` will not fire audit events.
- **IT base classes (TWO — pick the right one):** `AbstractIntegrationTest` (in `com.drshoes.app`) is the deeper base — boots the full Spring context with `@SpringBootTest(webEnvironment = RANDOM_PORT)` and spins a shared Postgres 16 Testcontainers instance. `AdminWebTestBase extends AbstractIntegrationTest` adds admin-user / client / order / thread seeding for tests that need an authenticated admin session. Tests that only need raw Spring + DB (e.g. repository / migration ITs) extend `AbstractIntegrationTest` directly. Tests that exercise authenticated controller flows extend `AdminWebTestBase`. ALL test classes are named `*IntegrationTest.java` (NOT `*IT.java` — Failsafe skips that pattern).
- **AdminWebTestBase FK ordering — DO NOT inherit until 6-1 ships.** The `seedUsers()` teardown deletes clients before orders, hitting an FK constraint when a parent class has seeded orders. M5 carried this as the suite's one error. Task 6-1 is the very first task in M6 because every subsequent IT that touches Order + Client must run on a fixed base.
- **No `Co-Authored-By:` lines** in any commit message. This project does not use that trailer.
- **LOC caps:** Java classes < 120 LOC; flag and split at ≥ 120. TypeScript modules < 80 LOC; flag and split at ≥ 80. JSX-density components are explicitly exempt — components routinely land 130–170 LOC when state has been hook-extracted (M5 precedent: 5-17 / 5-18 / 5-19 / 5-20 ranged 129–171 LOC).
- **Real entity field names:**
  - `Order` columns: `code VARCHAR(20) UNIQUE NOT NULL`, `status` (OrderStatus enum stored as String), `received_at`, `planned_pickup_at` (NOT `due_at`), `picked_up_at`, `total_price_cents`, `deleted_at`, `tags jsonb`.
  - `OrderItem` columns: `position`, `kind` (OrderItemKind), `description`, `price_cents`, `craftsman_notes`. NO `unit_price_cents` — just `price_cents`.
  - `OrderStatus` enum values (Java): `PRZYJETE`, `W_REALIZACJI`, `CZEKA_NA_KLIENTA`, `GOTOWE_DO_ODBIORU`, `WYDANE`, `ANULOWANE`. The five Kanban columns map to the first five.
  - `OrderItemKind` enum values (Java AND TS — values are POLISH): `NAPRAWA`, `CUSTOM_BUTY`, `CUSTOM_KURTKA`. NOT the BRIEF's English placeholders (no `REPAIR` / `CUSTOM_SHOES` / `CUSTOM_JACKETS`). Frontend TS unions, fixtures, mappers, and labels MUST use the Polish names verbatim because they round-trip through the JSON wire as the enum's `.name()`.
  - `Client` setters: `setFirstName`, `setLastName`. There is NO `setFullName`; `getFullName()` exists as a derived getter (M5 lock).
  - All M6 read endpoints filter `deleted_at IS NULL`.
- **`OrderDto` derived fields:** `urgent` is set by existing M1 logic (tag `pilne` OR planned_pickup_at within 48h). Reuse `OrderMapper.toDto`'s urgent calc — don't re-derive in the new endpoints.
- **Authentication principal:** controllers requiring the actor use `@AuthenticationPrincipal` resolving `AdminPrincipal`; pull via `authentication().getPrincipal()` on the test side (NOT `user()` — that gave M5 / 5-9 a 401 surprise). M6 read endpoints don't need the principal; the bulk endpoint (6-9) does.
- **`@Audited` annotation:** for the bulk endpoint, audit rows fire through the existing `AuditLogAspect` on the per-order `OrderService.changeStatus(...)` call (NOT a hypothetical `OrderStatusService.transition` — the actual class+method is `OrderService.changeStatus`). Do NOT add `@Audited` on the bulk controller method itself — that would double-audit.
- **DTO records:** all DTOs are Java records (e.g. `public record DashboardKpiDto(...)`). Frontend TS interfaces match the record fields 1:1.
- **Currency formatting:** all PLN strings come from the backend. Frontend never formats currency; consume the formatted string directly. Avoids drift between summing logic and display.
- **Design-export gating:** every frontend task ships with a `Design source:` line in its dispatch log entry (`admin.jsx:NNN-MMM`, an owner-supplied `m6-*.html` filename, or `INLINE: text-only stub`). Subagents do NOT invent layout. If the dispatch prompt names a design export filename that doesn't exist on disk, STOP and ask the orchestrator before proceeding.

### 2. Anticipated errata (pre-populated from spec §5 / §6 / §8)

- **`V013__message_thread_uniqueness.sql` column set** — Section 5 of the spec defers the exact unique-index column set to dispatch time. Read M5 thread-creation paths (`MessageThreadService.findOrCreate*` methods, see `backend/app/.../messaging/service/MessageThreadService.java`) to determine what `(channel, client_id|raw_sender)` tuple actually drives the lookup. The migration is owned by 6-3; do not write speculative `CREATE UNIQUE INDEX` SQL until paths are read. The `@NotNull` validation goes on whichever entity field is the lookup driver.
- **MessageRouter LOC after split** — pre-M6 the file is **272 LOC** (M5 additions changed the count from the M4-close 293 figure that was originally cited). Three copies of the channel-switch recipient lookup dominate the duplication; `MessageEntity` construction is also duplicated 5×. Task 6-2 extracts `MessageRecipientResolver` (`@Component`) + a private `buildOutbound(...)` helper, dropping `MessageRouter` to ≤ 130 LOC. `ClientRepository` injection drops from `MessageRouter` after extraction. M5 already did the gateway-dispatcher extraction; 6-2 is purely about routing-vs-retry concerns. Implementers: confirm post-split LOC and note class structure in Findings.
- **`pnpm lint` is already wired** — verified at plan-write time: `apps/web/eslint.config.mjs` exists and `apps/web/package.json` carries a working `lint` script invoking ESLint directly (no dependency on the removed `next lint`). Task 6-4 is a **verification-only pass** — run `pnpm -C apps/web lint`, fix any blocking warnings on the current tree, and codify `pnpm lint` in the M6 closure bar. No migration needed. Implementers: confirm clean exit and note any warnings cleaned in Findings.
- **Calendar `from` / `to` timezone semantics** — `Order.planned_pickup_at` is `TIMESTAMPTZ`. `from` and `to` in the API are `LocalDate`. Use `Europe/Warsaw` to convert local-date boundaries to UTC instants before querying. Acceptable shortcut: `LocalDate.atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant()` for `from`; `to.plusDays(1).atStartOfDay(...)` for `to` (exclusive upper). Implementers: confirm zone is set globally (verify in `Application.java` or equivalent) and note in Findings.
- **dnd-kit not yet a dep — confirmed at plan-write.** Neither `@dnd-kit/core` nor `@dnd-kit/sortable` is in `apps/web/package.json`. Task 6-18 installs both via `pnpm add @dnd-kit/core @dnd-kit/sortable` before importing. SSR considerations: dnd-kit needs `"use client"` on the `KanbanBoard` wrapper (`DndContext` consumer); the `kanban/page.tsx` itself stays a Server Component and renders the client-side board. **`StatusChangeConfirm` UX upgrade in 6-19** — task 6-19 promotes the existing single-button `StatusChangeConfirm` (one `onConfirm()`) to a two-button dialog (`onConfirm(sendTriggers: boolean)`). This is a deliberate UX change matching the BRIEF's "Wyślij wiadomość do klienta?" prompt, NOT a regression. `OrderDrawerStatusChanger.tsx` has no existing test file, so the extraction is safe without a regression-test baseline to protect — confirmed at plan-write time. **`KanbanCardDto` may need a `version` field** — task 6-20 documents the option to add `version: number` to the W1 `KanbanCardDto` record + frontend type as an inline backend precondition slice if the optimistic-lock path needs it for drag-confirm flows. Implementers: pin decision in Findings.
- **Kanban trigger-preview dialog extraction** — the M2 trigger-preview dialog currently lives inside `OrderDrawerStatusChanger`. Task 6-19 extracts it into a standalone component `apps/web/app/(admin)/admin/orders/_components/StatusChangeTriggerDialog.tsx` (or similar). The drawer's `StatusChanger` then imports and uses it; the new Kanban drop handler does too. The extraction is mechanical — props are the same — but the existing `OrderDrawerStatusChanger` test file may need import updates. Implementers: confirm test count after extraction and note in Findings.
- **Saved-preset URL params on backend list endpoint** — task 6-21 depends on `GET /api/admin/orders` accepting `tag=`, `plannedPickupAtFrom=`, `plannedPickupAtTo=`, multi-value `status=` (comma-separated). Quick check at 6-21 dispatch: read the existing `OrderController` query handler. If any are missing, add as inline backend slice 6-21a (new commit, no separate task ID; precedent: M5 5-17a / 5-20a). Implementers: note exact param shape and any 6-21a slice in Findings.
- **Bulk-status `sendTriggers` semantics** — `sendTriggers=true` calls the existing trigger-fan-out path post-transition (matches drawer behavior). `false` skips it. The per-order trigger pipeline runs inside `OrderService.changeStatus(...)`. Task 6-9 threads the boolean through the existing `ChangeStatusRequest` record (Jackson default `true`) so `OrderService.changeStatus(...)` keeps its signature unchanged and existing callers remain unaffected. Implementers: confirm `ChangeStatusRequest` field default behavior and note in Findings.
- **Shared FE state primitives** — components `Skeleton`, `EmptyState`, `ErrorBanner` may not yet exist under `apps/web/components/state/`. The first FE task that needs one creates it; later tasks reuse. Task 6-12 (W2 closing) is the natural inventory point — if any of the three are still missing at that point, fold creation into 6-12.

### 3. Findings (filled by implementers)

_None yet — implementers add discoveries here as tasks ship._

---
## Wave 0 — Hygiene debt clear

### Task 6-1: AdminWebTestBase FK ordering fix

**Files:**
- Modify: `backend/app/src/test/java/com/drshoes/app/AdminWebTestBase.java`
- Create: `backend/app/src/test/java/com/drshoes/app/AdminWebTestBaseFkOrderingIntegrationTest.java`

**Review:** combined single-stage.

---

**Background:** `AdminWebTestBase.seedUsers()` (`@BeforeEach`) calls `clients.deleteAll()` without first deleting rows in dependent tables. When another test class extends `AdminWebTestBase` and seeds orders referencing those clients (e.g., `MessagesControllerIntegrationTest.seedOrder()`), the teardown-then-re-seed cycle on the next test leaves the `order_` rows in place — then `clients.deleteAll()` in `seedUsers()` hits the `order_.client_id → client(id)` FK constraint. This manifested as the one carried `ERROR` in the M5 close suite: `MessagesControllerIntegrationTest.emptyThreadReturnsEmptyList`.

The fix: inject `OrderRepository` and `MessageThreadRepository` into `AdminWebTestBase` and delete in FK-correct order in both `seedUsers()` and `cleanupUsers()`:

```
message_thread (client_id FK) → before clients
order_ (client_id FK)         → before clients
audit_log (actor_id FK)       → before users
client                        → before users
user_                         → last
```

---

- [ ] **Step 1: Write the failing regression test**

Create `backend/app/src/test/java/com/drshoes/app/AdminWebTestBaseFkOrderingIntegrationTest.java`:

```java
package com.drshoes.app;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression test for AdminWebTestBase FK ordering fix (task 6-1).
 *
 * Proves that seedUsers() / cleanupUsers() survive when orders + threads
 * referencing the base-class clients exist at teardown time.
 *
 * Before the fix this test throws DataIntegrityViolationException in @BeforeEach
 * of the second iteration (JUnit reruns are simulated by the two @Test methods
 * both seeding and relying on a clean base re-seed between them).
 */
class AdminWebTestBaseFkOrderingIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private MessageThreadRepository threadRepository;

    private UUID extraClientId;
    private UUID extraOrderId;
    private UUID extraThreadId;

    @BeforeEach
    void seedOrderAndThread() {
        // Seed a client + order + thread on top of the base-class users.
        var client = new Client();
        client.setFirstName("FK");
        client.setLastName("OrderingTest");
        client.setPhone("+48 600 000 099");
        extraClientId = clientRepository.save(client).getId();

        var order = new Order();
        order.setCode("FK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(extraClientId);
        order.setStatus(OrderStatus.PRZYJETE);
        extraOrderId = orderRepository.save(order).getId();

        var thread = new MessageThreadEntity();
        thread.setClientId(extraClientId);
        thread.setChannel("EMAIL");
        thread.setUnreadCount(0);
        extraThreadId = threadRepository.save(thread).getId();
    }

    @AfterEach
    void cleanupOrderAndThread() {
        // Do NOT delete order or thread here — intentionally leave them
        // so that AdminWebTestBase.cleanupUsers() must handle them.
        // Before the fix, the second test's @BeforeEach seedUsers() would
        // throw DataIntegrityViolationException trying clients.deleteAll().
    }

    @Test
    void firstTestLeavesOrderAndThreadForBaseCleanup() {
        assertThat(orderRepository.findById(extraOrderId)).isPresent();
        assertThat(threadRepository.findById(extraThreadId)).isPresent();
    }

    @Test
    void secondTestAlsoRunsWithoutFkViolation() {
        // If AdminWebTestBase.seedUsers() FK-ordering fix is not in place,
        // this test never reaches this line — the @BeforeEach seedUsers() of
        // the base class will have thrown DataIntegrityViolationException.
        assertThat(clientRepository.findById(extraClientId)).isPresent();
    }
}
```

- [ ] **Step 2: Run test to verify it fails (before fix)**

```bash
mvn -pl backend/app -B test -Dtest=AdminWebTestBaseFkOrderingIntegrationTest
```

Expected: one of the two tests throws `DataIntegrityViolationException` (or the second `@BeforeEach` does), confirming the FK constraint violation is reproducible.

- [ ] **Step 3: Apply the fix to AdminWebTestBase**

In `backend/app/src/test/java/com/drshoes/app/AdminWebTestBase.java`, add the two repository fields and update the delete order in `seedUsers()` and `cleanupUsers()`. Replace the class body as follows:

```java
package com.drshoes.app;

import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

/**
 * Base class for admin controller integration tests.
 *
 * Provides a session-aware MockMvc wrapper that injects Spring Security principal
 * via SecurityMockMvcRequestPostProcessors.user(), so no HTTP login round-trip
 * is needed. The DB still has real OWNER + EMPLOYEE rows for FK integrity.
 *
 * Teardown order (FK-correct):
 *   audit_log (actor_id → user_) → message_thread (client_id → client)
 *   → order_ (client_id → client) → client → user_
 *
 * Subclasses that seed their own dependent rows (e.g. messages, photos)
 * MUST delete them in their own @AfterEach BEFORE this base teardown runs.
 * JUnit 5 guarantees subclass @AfterEach runs before superclass @AfterEach.
 *
 * Usage:
 *   loginAsOwner();
 *   mockMvc().perform(get("/api/admin/clients")).andExpect(status().isOk());
 *
 * State-changing calls MUST add .with(csrf()) from SecurityMockMvcRequestPostProcessors.
 */
@AutoConfigureMockMvc
public abstract class AdminWebTestBase extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder enc;
    @Autowired private ClientRepository clients;
    @Autowired private AuditLogRepository auditLogs;
    @Autowired private OrderRepository orders;
    @Autowired private MessageThreadRepository threads;

    /** Current principal injector; null = anonymous. */
    private RequestPostProcessor principalProcessor;

    @BeforeEach
    void seedUsers() {
        // Delete in FK-correct order before re-seeding.
        // Subclass @AfterEach runs before this @BeforeEach on re-entry, but other
        // test classes sharing the same Testcontainers context may leave rows behind.
        auditLogs.deleteAll();
        threads.deleteAll();
        orders.deleteAll();
        clients.deleteAll();
        users.deleteAll();
        principalProcessor = null;

        var owner = new User();
        owner.setEmail("owner@test.pl");
        owner.setPasswordHash(enc.encode("pass"));
        owner.setFullName("Owner Test");
        owner.setRole(UserRole.OWNER);

        var emp = new User();
        emp.setEmail("emp@test.pl");
        emp.setPasswordHash(enc.encode("pass"));
        emp.setFullName("Employee Test");
        emp.setRole(UserRole.EMPLOYEE);

        users.saveAll(List.of(owner, emp));
    }

    @AfterEach
    void cleanupUsers() {
        // Delete in FK-correct order.
        // Subclass @AfterEach deletes its own rows first (JUnit 5 guarantees this).
        auditLogs.deleteAll();
        threads.deleteAll();
        orders.deleteAll();
        clients.deleteAll();
        users.deleteAll();
        principalProcessor = null;
    }

    /**
     * Injects an {@link AdminPrincipal}-backed authentication into MockMvc requests
     * so that {@code @AuthenticationPrincipal AdminPrincipal actor} resolves correctly
     * in controllers. Returns the seeded owner's UUID for assertion use in tests.
     */
    protected UUID loginAsOwner() {
        User owner = users.findByEmailIgnoreCase("owner@test.pl").orElseThrow(
            () -> new IllegalStateException("Owner not seeded"));
        var principal = new AdminPrincipal(owner.getId(), owner.getEmail(), "OWNER");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        principalProcessor = SecurityMockMvcRequestPostProcessors.authentication(auth);
        return owner.getId();
    }

    protected UUID loginAsEmployee() {
        User emp = users.findByEmailIgnoreCase("emp@test.pl").orElseThrow(
            () -> new IllegalStateException("Employee not seeded"));
        var principal = new AdminPrincipal(emp.getId(), emp.getEmail(), "EMPLOYEE");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_EMPLOYEE")));
        principalProcessor = SecurityMockMvcRequestPostProcessors.authentication(auth);
        return emp.getId();
    }

    /**
     * Returns a wrapper that transparently injects the current principal (if any)
     * into every perform() call. Unauthenticated requests have no processor.
     */
    protected SessionAwareMockMvc mockMvc() {
        return new SessionAwareMockMvc(mvc, principalProcessor);
    }

    /**
     * Creates a minimal Client via the repository and returns its id.
     */
    protected UUID createClientAndReturnId() {
        var c = new Client();
        c.setFirstName("Test");
        c.setLastName("Client");
        c.setPhone("+48 600 000 001");
        return clients.save(c).getId();
    }

    // ---------------------------------------------------------------------- inner class

    /**
     * Thin MockMvc wrapper that transparently injects the current principal post-processor
     * into every perform() call, so tests don't need to manually add .with(user(...)).
     */
    public static class SessionAwareMockMvc {

        private final MockMvc delegate;
        private final RequestPostProcessor principalProcessor;

        SessionAwareMockMvc(MockMvc delegate, RequestPostProcessor principalProcessor) {
            this.delegate = delegate;
            this.principalProcessor = principalProcessor;
        }

        public org.springframework.test.web.servlet.ResultActions perform(
                MockHttpServletRequestBuilder builder) throws Exception {
            if (principalProcessor != null) {
                builder.with(principalProcessor);
            }
            return delegate.perform(builder);
        }
    }
}
```

- [ ] **Step 4: Run the regression test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=AdminWebTestBaseFkOrderingIntegrationTest
```

Expected: both test methods PASS (2/0/0/0).

- [ ] **Step 5: Run full suite to verify the M5 carried error is gone**

```bash
mvn -pl backend/app -B verify
```

Expected: 303/0/0/0 (was 301/0/1/0 at M5 close — adds 2 new tests, clears the 1 carried error).

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/test/java/com/drshoes/app/AdminWebTestBase.java \
        backend/app/src/test/java/com/drshoes/app/AdminWebTestBaseFkOrderingIntegrationTest.java
git commit -m "$(cat <<'EOF'
fix(test): AdminWebTestBase FK-correct teardown order [milestone:6][task:6-1]

Injects OrderRepository + MessageThreadRepository into the base test class
and deletes dependent rows (threads, orders) before clients in both
seedUsers() and cleanupUsers(). Fixes the carried
MessagesControllerIntegrationTest.emptyThreadReturnsEmptyList ERROR from M5
close (suite was 301/0/1/0; now 303/0/0/0).

Refs: docs/dispatch-log/6-1-<UTC>.md
EOF
)"
```

---

### Task 6-2: MessageRouter split + sendRetry/send dedup

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRecipientResolver.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRecipientResolverTest.java`

**Review:** combined single-stage. (Mechanical refactor — no new behaviour.)

---

**Background:** `MessageRouter` is 272 LOC with three copies of the channel-switch recipient lookup:

```java
String recipient = switch (ch) {
    case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
    case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
    default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
};
```

This appears in `send(...)` (private), `sendRetry(...)`, and `sendReply(...)`/`sendNewToClient(...)`. The dedup target: extract this logic into `MessageRecipientResolver` (a `@Component`), then have `MessageRouter` call it. Post-split `MessageRouter` must be ≤ 130 LOC.

The channel switch is also in `sendRetry` with `Channel.valueOf(orig.getChannel())` and the switch; `send(...)` also does it with `Channel.valueOf(channel)`. Extract the resolver:

```
MessageRecipientResolver.resolve(UUID clientId, String channel) → String (nullable)
```

`MessageRouter` drops all three switch blocks and its `ClientRepository` field (the resolver handles it).

---

- [ ] **Step 1: Write the unit test for MessageRecipientResolver**

Create `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRecipientResolverTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageRecipientResolverTest {

    @Mock private ClientRepository clients;

    private MessageRecipientResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new MessageRecipientResolver(clients);
    }

    @Test
    void emailChannelReturnsClientEmail() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Nowak");
        client.setEmail("anna@example.com");
        client.setPhone("+48600000001");
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isEqualTo("anna@example.com");
    }

    @Test
    void smsChannelReturnsClientPhone() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Kowalski");
        client.setEmail("jan@example.com");
        client.setPhone("+48600000002");
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "SMS");

        assertThat(recipient).isEqualTo("+48600000002");
    }

    @Test
    void unknownChannelThrowsIllegalArgument() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("X");
        client.setLastName("Y");
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        assertThatThrownBy(() -> resolver.resolve(clientId, "WHATSAPP"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("WHATSAPP");
    }

    @Test
    void missingClientReturnsNull() {
        UUID clientId = UUID.randomUUID();
        when(clients.findById(clientId)).thenReturn(Optional.empty());

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isNull();
    }

    @Test
    void clientWithNullEmailReturnsNull() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("X");
        client.setLastName("Y");
        // email is null
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isNull();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails (class doesn't exist yet)**

```bash
mvn -pl backend/app -B test -Dtest=MessageRecipientResolverTest
```

Expected: FAIL — compilation error (class not found).

- [ ] **Step 3: Create MessageRecipientResolver**

Create `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRecipientResolver.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.lib.messaging.Channel;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Resolves the send-to address for a known client + channel.
 *
 * Returns null when the client has no address for the requested channel
 * (e.g. email is blank). Callers must guard against null before dispatch.
 * Throws {@link IllegalArgumentException} for unsupported channels.
 */
@Component
public class MessageRecipientResolver {

    private final ClientRepository clients;

    public MessageRecipientResolver(ClientRepository clients) {
        this.clients = clients;
    }

    /**
     * @param clientId the client whose address to look up
     * @param channel  "EMAIL" | "SMS" (case-sensitive, must match Channel enum)
     * @return the resolved address, or null if the client has none
     * @throws IllegalArgumentException if channel is not EMAIL or SMS
     */
    public String resolve(UUID clientId, String channel) {
        Channel ch = Channel.valueOf(channel);
        return switch (ch) {
            case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
            case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
            default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
        };
    }
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=MessageRecipientResolverTest
```

Expected: PASS (5/0/0/0).

- [ ] **Step 5: Refactor MessageRouter to use MessageRecipientResolver**

Replace `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java` with the deduplicated version:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageDirection;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Single outbound send pipeline. Four public entry points:
 *   - sendManual         — operator-initiated from MessagesController / MessageComposerModal
 *   - sendForTrigger     — called by TriggerEngine after status-change post-commit hook
 *   - sendRetry          — called by MessageRetryService; bypasses template re-render
 *   - sendReply          — operator reply on an existing thread (no template)
 *   - sendNewToClient    — cross-thread first-contact compose (no template)
 *
 * Recipient resolution is delegated to {@link MessageRecipientResolver}.
 * Gateway dispatch is delegated to {@link MessageGatewayDispatcher}.
 * Logging contract: exactly ONE INFO log per public call with outcome=SENT|FAILED.
 */
@Service
public class MessageRouter {

    private static final Logger log = LoggerFactory.getLogger(MessageRouter.class);

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;
    private final MessageThreadService threadService;
    private final TemplateRenderer renderer;
    private final TemplateContextBuilder contextBuilder;
    private final MessageRecipientResolver recipientResolver;
    private final MessageGatewayDispatcher dispatcher;

    public MessageRouter(
            MessageRepository messages,
            MessageTemplateRepository templates,
            MessageThreadService threadService,
            TemplateRenderer renderer,
            TemplateContextBuilder contextBuilder,
            MessageRecipientResolver recipientResolver,
            MessageGatewayDispatcher dispatcher) {
        this.messages = messages;
        this.templates = templates;
        this.threadService = threadService;
        this.renderer = renderer;
        this.contextBuilder = contextBuilder;
        this.recipientResolver = recipientResolver;
        this.dispatcher = dispatcher;
    }

    @Transactional
    @Audited(parent = "#orderId")
    public UUID sendManual(UUID orderId, UUID clientId, UUID templateId, String channel, UUID actorId) {
        return send(orderId, clientId, templateId, null, channel, actorId);
    }

    @Transactional
    @Audited(parent = "#orderId")
    public UUID sendForTrigger(UUID orderId, UUID clientId, UUID templateId, UUID triggerId, String channel) {
        return send(orderId, clientId, templateId, triggerId, channel, null);
    }

    /**
     * Retry entry point. Bypasses template lookup — uses stored body/subject from the original
     * message. No @Audited here; MessageRetryService#retry handles the audit row.
     */
    @Transactional
    public UUID sendRetry(MessageEntity orig, UUID actorId) {
        var thread = threadService.findOrCreateForClient(orig.getClientId());
        String recipient = recipientResolver.resolve(orig.getClientId(), orig.getChannel());

        var msg = buildOutbound(thread.getId(), orig.getOrderId(), orig.getClientId(),
                orig.getChannel(), orig.getTemplateId(), null,
                orig.getSubject(), orig.getBody(), actorId);
        var persisted = dispatcher.dispatch(msg, recipient, orig.getSubject(), orig.getBody());

        log.info("op=message.sendRetry outcome={} orderId={} newMessageId={} channel={}",
                persisted.getDeliveryStatus(), orig.getOrderId(), persisted.getId(), orig.getChannel());
        return persisted.getId();
    }

    /**
     * Reply send entry point — operator freeform message on an existing thread.
     * Body/subject provided directly; no template.
     */
    @Transactional
    public UUID sendReply(UUID threadId, UUID clientId, String channel, String subject,
                          String body, UUID orderId, AdminPrincipal actor) {
        String recipient = recipientResolver.resolve(clientId, channel);
        UUID actorId = actor == null ? null : actor.userId();

        var msg = buildOutbound(threadId, orderId, clientId, channel,
                null, null, subject, body, actorId);
        var persisted = dispatcher.dispatch(msg, recipient, subject, body);

        log.info("op=message.sendReply outcome={} threadId={} messageId={} channel={} actor={}",
                persisted.getDeliveryStatus(), threadId, persisted.getId(), channel,
                actor == null ? "system" : actor.email());
        return persisted.getId();
    }

    /**
     * Cross-thread "Nowa wiadomość" compose — first-contact with a client on a given channel.
     * Find-or-create thread; body/subject provided directly.
     */
    @Transactional
    public UUID sendNewToClient(UUID clientId, String channel, String subject,
                                String body, AdminPrincipal actor) {
        String recipient = recipientResolver.resolve(clientId, channel);
        var thread = threadService.findOrCreateForClient(clientId, channel);
        UUID actorId = actor == null ? null : actor.userId();

        var msg = buildOutbound(thread.getId(), null, clientId, channel,
                null, null, subject, body, actorId);
        var persisted = dispatcher.dispatch(msg, recipient, subject, body);

        log.info("op=message.sendNewToClient outcome={} clientId={} channel={} threadId={} messageId={} actor={}",
                persisted.getDeliveryStatus(), clientId, channel, thread.getId(), persisted.getId(),
                actor == null ? "system" : actor.email());
        return persisted.getId();
    }

    // ---- private ----

    private UUID send(UUID orderId, UUID clientId, UUID templateId, UUID triggerId,
                      String channel, UUID actorId) {
        var template = templates.findById(templateId).orElseThrow(
                () -> new IllegalArgumentException("Template not found: " + templateId));
        var ctx = contextBuilder.buildContext(orderId, clientId);

        String renderedSubject = template.getSubject() == null
                ? null : renderer.render(template.getSubject(), ctx);
        String renderedBody = renderer.render(template.getBody(), ctx);

        var thread = threadService.findOrCreateForClient(clientId);
        String recipient = recipientResolver.resolve(clientId, channel);

        if (recipient == null || recipient.isBlank()) {
            log.warn("op=message.send outcome=FAILED orderId={} channel={} cause=null_or_blank_recipient",
                    orderId, channel);
        }

        var msg = buildOutbound(thread.getId(), orderId, clientId, channel,
                templateId, triggerId, renderedSubject, renderedBody, actorId);
        var persisted = dispatcher.dispatch(msg, recipient, renderedSubject, renderedBody);

        log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
                persisted.getDeliveryStatus(), orderId, persisted.getId(), channel, triggerId);
        return persisted.getId();
    }

    private MessageEntity buildOutbound(UUID threadId, UUID orderId, UUID clientId,
                                        String channel, UUID templateId, UUID triggerId,
                                        String subject, String body, UUID actorId) {
        var msg = MessageEntity.newMessage();
        msg.setThreadId(threadId);
        msg.setOrderId(orderId);
        msg.setClientId(clientId);
        msg.setDirection(MessageDirection.OUTBOUND.name());
        msg.setChannel(channel);
        msg.setTemplateId(templateId);
        msg.setTriggerId(triggerId);
        msg.setSubject(subject);
        msg.setBody(body);
        msg.setDeliveryStatus(DeliveryStatus.QUEUED.name());
        msg.setSentBy(actorId);
        return messages.saveAndFlush(msg);
    }
}
```

- [ ] **Step 6: Verify LOC cap**

```bash
wc -l backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java
```

Expected: ≤ 130 lines.

- [ ] **Step 7: Run existing MessageRouter integration test**

```bash
mvn -pl backend/app -B test -Dtest=MessageRouterIntegrationTest
```

Expected: PASS (3/0/0/0 — same three tests as before).

- [ ] **Step 8: Run full suite**

```bash
mvn -pl backend/app -B verify
```

Expected: ≥ 308/0/0/0 (baseline from 6-1 + 5 new from this task).

- [ ] **Step 9: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java \
        backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRecipientResolver.java \
        backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRecipientResolverTest.java
git commit -m "$(cat <<'EOF'
refactor(messaging): extract MessageRecipientResolver + dedup send paths [milestone:6][task:6-2]

Extracts the 3x-duplicated channel-switch recipient lookup from MessageRouter
into a new MessageRecipientResolver component. MessageRouter drops its
ClientRepository field; all send/retry/reply/newToClient paths call
recipientResolver.resolve(clientId, channel). Also extracts buildOutbound()
private helper to deduplicate MessageEntity construction across five methods.

MessageRouter: 272 LOC → ≤ 130 LOC. No behaviour change.
MessageRecipientResolver: 5 unit tests, all green.

Refs: docs/dispatch-log/6-2-<UTC>.md
EOF
)"
```

---

### Task 6-3: V013 message_thread uniqueness migration + @NotNull validation

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V013__message_thread_uniqueness.sql`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageThreadEntity.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadUniquenessIntegrationTest.java`

**Review:** combined single-stage.

---

**Background:** `MessageThreadService` has two `findOrCreate` paths:

1. `findOrCreateForClient(UUID clientId, String channel)` — queries `WHERE client_id = ? AND channel = ?` (via `findFirstByClientIdAndChannelOrderByCreatedAtAsc`). Uniqueness columns: `(channel, client_id)`.
2. `findOrCreateForRawSender(String rawSender, String channel)` — queries `WHERE raw_sender = ? AND channel = ?` (via `findFirstByRawSenderAndChannelOrderByCreatedAtAsc`). Uniqueness columns: `(channel, raw_sender)`.

V012 added a `message_thread_unmatched_idx` non-unique index on `(channel, raw_sender) WHERE client_id IS NULL`. V013 adds two **unique** partial indexes covering each path, and adds `discarded_at IS NULL` to the partial predicate so discarded threads don't block re-creation.

Additionally, `channel` is `NOT NULL DEFAULT 'EMAIL'` in V012 but `@Column(nullable=false)` is not yet annotated on the JPA entity field. Add `@NotNull` (jakarta) to `MessageThreadEntity.channel`.

---

- [ ] **Step 1: Write the uniqueness integration test**

Create `backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadUniquenessIntegrationTest.java`:

```java
package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies V013 unique partial indexes on message_thread.
 *
 * Covers:
 *   - duplicate (channel, client_id) insert fails when client not discarded
 *   - duplicate (channel, raw_sender) insert fails when thread not discarded
 *   - discarded thread (discarded_at IS NOT NULL) does NOT block re-creation
 *   - different channel creates a separate thread without uniqueness conflict
 */
class MessageThreadUniquenessIntegrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void insertClient() {
        clientId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
            "VALUES (?::uuid, 'Test', 'Unique', ?, '+48000000099', 'EMAIL')",
            clientId.toString(), "uniq-" + clientId + "@test.pl");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid OR raw_sender LIKE 'uniq-%'",
                clientId.toString());
        jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId.toString());
    }

    // -----------------------------------------------------------------------
    // Matched-thread uniqueness (client_id, channel)
    // -----------------------------------------------------------------------

    @Test
    void duplicateMatchedThreadFails() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t1.toString(), clientId.toString());

        UUID t2 = UUID.randomUUID();
        assertThatThrownBy(() ->
            jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                    t2.toString(), clientId.toString()))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void matchedThreadOnDifferentChannelSucceeds() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t1.toString(), clientId.toString());

        UUID t2 = UUID.randomUUID();
        // SMS is a different channel — must not conflict with the EMAIL thread
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'SMS')",
                t2.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE client_id = ?::uuid", Integer.class, clientId.toString());
        assertThat(count).isEqualTo(2);
    }

    @Test
    void discardedMatchedThreadDoesNotBlockRecreation() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel, discarded_at) " +
                "VALUES (?::uuid, ?::uuid, 'EMAIL', now())", t1.toString(), clientId.toString());

        // t1 is discarded → partial index predicate (discarded_at IS NULL) excludes it
        UUID t2 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t2.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE client_id = ?::uuid", Integer.class, clientId.toString());
        assertThat(count).isEqualTo(2);
    }

    // -----------------------------------------------------------------------
    // Unmatched-thread uniqueness (raw_sender, channel)
    // -----------------------------------------------------------------------

    @Test
    void duplicateUnmatchedThreadFails() {
        String sender = "uniq-sender@external.com";
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                t1.toString(), sender);

        UUID t2 = UUID.randomUUID();
        assertThatThrownBy(() ->
            jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                    t2.toString(), sender))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void discardedUnmatchedThreadDoesNotBlockRecreation() {
        String sender = "uniq-discarded@external.com";
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel, discarded_at) " +
                "VALUES (?::uuid, ?, 'EMAIL', now())", t1.toString(), sender);

        UUID t2 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                t2.toString(), sender);

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE raw_sender = ?", Integer.class, sender);
        assertThat(count).isEqualTo(2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails (indexes not yet created)**

```bash
mvn -pl backend/app -B test -Dtest=MessageThreadUniquenessIntegrationTest
```

Expected: `duplicateMatchedThreadFails` and `duplicateUnmatchedThreadFails` FAIL (inserts succeed instead of throwing) — confirming the uniqueness gap exists.

- [ ] **Step 3: Write V013 migration**

Create `backend/app/src/main/resources/db/migration/V013__message_thread_uniqueness.sql`:

```sql
-- V013: unique partial indexes on message_thread to close the M5 mid-flight gap.
-- Prevents duplicate (channel, client_id) matched threads and
-- duplicate (channel, raw_sender) unmatched threads per active (non-discarded) state.
-- Discarded threads (discarded_at IS NOT NULL) are excluded from both indexes
-- so operators can re-create a thread after discarding an earlier one.
--
-- NOTE: before creating the unique indexes, deduplicate any existing rows that
-- would violate the constraint (retaining the oldest row by created_at).
-- In dev/test the DB is always clean; in production this removes true duplicates.

-- Deduplicate matched threads: keep oldest per (channel, client_id) where not discarded
DELETE FROM message_thread
WHERE id NOT IN (
    SELECT DISTINCT ON (channel, client_id) id
    FROM message_thread
    WHERE client_id IS NOT NULL AND discarded_at IS NULL
    ORDER BY channel, client_id, created_at ASC
)
AND client_id IS NOT NULL AND discarded_at IS NULL;

-- Deduplicate unmatched threads: keep oldest per (channel, raw_sender) where not discarded
DELETE FROM message_thread
WHERE id NOT IN (
    SELECT DISTINCT ON (channel, raw_sender) id
    FROM message_thread
    WHERE raw_sender IS NOT NULL AND discarded_at IS NULL
    ORDER BY channel, raw_sender, created_at ASC
)
AND raw_sender IS NOT NULL AND discarded_at IS NULL;

-- Unique partial index for matched threads (known client, not discarded)
CREATE UNIQUE INDEX message_thread_unique_matched
    ON message_thread (channel, client_id)
    WHERE client_id IS NOT NULL AND discarded_at IS NULL;

-- Unique partial index for unmatched threads (unknown sender, not discarded)
CREATE UNIQUE INDEX message_thread_unique_unmatched
    ON message_thread (channel, raw_sender)
    WHERE raw_sender IS NOT NULL AND discarded_at IS NULL;
```

- [ ] **Step 4: Add @NotNull to MessageThreadEntity.channel**

In `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageThreadEntity.java`, update the `channel` field annotation:

Change:
```java
    /** EMAIL / SMS / WHATSAPP — per-channel threading. Added V012. */
    @Column(nullable = false, length = 16)
    private String channel = "EMAIL";
```

To:
```java
    /** EMAIL / SMS / WHATSAPP — per-channel threading. Added V012. */
    @Column(nullable = false, length = 16)
    @jakarta.validation.constraints.NotNull
    private String channel = "EMAIL";
```

- [ ] **Step 5: Run the uniqueness IT to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=MessageThreadUniquenessIntegrationTest
```

Expected: PASS (6/0/0/0).

- [ ] **Step 6: Run full suite**

```bash
mvn -pl backend/app -B verify
```

Expected: ≥ 314/0/0/0 (baseline from 6-2 + 6 new).

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V013__message_thread_uniqueness.sql \
        backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageThreadEntity.java \
        backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadUniquenessIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(db): V013 — message_thread unique partial indexes + @NotNull on channel [milestone:6][task:6-3]

Closes M5 mid-flight gap where duplicate (channel, client_id) or
(channel, raw_sender) message_thread rows could be created concurrently.

Adds:
  message_thread_unique_matched ON (channel, client_id)
    WHERE client_id IS NOT NULL AND discarded_at IS NULL
  message_thread_unique_unmatched ON (channel, raw_sender)
    WHERE raw_sender IS NOT NULL AND discarded_at IS NULL

Deduplication DELETE before index creation ensures idempotent apply on
any environment. Discarded threads excluded from both indexes so operators
can re-create after discard. @NotNull added to MessageThreadEntity.channel
to align JPA mapping with DB constraint.

Refs: docs/dispatch-log/6-3-<UTC>.md
EOF
)"
```

---

### Task 6-4: pnpm lint verification + fix blocking warnings

**Files:**
- Modify: `apps/web/eslint.config.mjs` (if any rule adjustments are needed)
- Modify: `apps/web/package.json` (if script needs adjustment)
- Modify: any `.tsx` / `.ts` files in `apps/web/` that produce blocking warnings

**Review:** combined single-stage.

---

**Background:** `apps/web/package.json` already has `"lint": "eslint . --max-warnings=0"` and `apps/web/eslint.config.mjs` already uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` (flat-config format). This is the correct approach for Next 16 (which removed the bundled `next lint` wrapper).

Task 6-4 is NOT a migration — it is a verification-and-fix pass: run `pnpm lint` from the workspace root or `pnpm --filter @drshoes/web lint` from the monorepo root; if it exits 0 the task is done; if it exits non-zero, fix each warning category until it exits 0, then commit. Any rule that is silenced with a comment (`// eslint-disable`) must be documented in `eslint.config.mjs` instead as a file-level override with a rationale comment.

---

- [ ] **Step 1: Run lint and capture output**

```bash
cd apps/web && pnpm lint 2>&1 | tee /tmp/lint-output.txt; echo "EXIT: $?"
```

Expected outcome A: `EXIT: 0` — lint is already clean. Proceed to Step 5 (no changes needed).
Expected outcome B: `EXIT: 1` — warnings or errors present. Continue to Step 2.

- [ ] **Step 2: Categorize all reported warnings**

Read `/tmp/lint-output.txt`. Group issues by rule name (e.g. `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps`, `@next/next/no-img-element`). Determine for each:
- **Fix in source** — the correct path for logic bugs, missing deps, true unused vars.
- **Suppress in config** — the correct path for intentional patterns that the rule cannot distinguish (e.g. `@next/next/no-img-element` for the two photo components already suppressed in `eslint.config.mjs`).

Do NOT use inline `// eslint-disable-next-line` comments. All suppressions go in `eslint.config.mjs` with a rationale comment.

- [ ] **Step 3: Apply fixes**

For each **fix-in-source** issue: edit the offending `.ts` / `.tsx` file. Common patterns:
- Unused import: delete the import line.
- Missing `useEffect` dependency: add the missing dep or extract the value with `useCallback`/`useMemo`.
- Prefer `const`: replace `let` with `const` where the variable is never reassigned.
- Explicit `any`: add the actual type; if the type is genuinely unknown use `unknown` and narrow.

For each **suppress-in-config** issue: add a new object to the `eslint.config.mjs` array:

```js
  {
    // <rationale: one sentence explaining why this pattern is intentional>
    files: ["path/to/file.tsx"],
    rules: {
      "rule-name": "off",
    },
  },
```

- [ ] **Step 4: Run lint again to verify EXIT 0**

```bash
cd apps/web && pnpm lint
```

Expected: EXIT 0 with no warnings output.

- [ ] **Step 5: Run typecheck to ensure no regressions**

```bash
cd apps/web && pnpm typecheck
```

Expected: EXIT 0.

- [ ] **Step 6: Commit**

If Step 1 produced EXIT 0 (no changes needed), commit only the verification evidence:

```bash
# If no file changes:
git commit --allow-empty -m "$(cat <<'EOF'
chore(lint): verify pnpm lint exits 0 — no fixes needed [milestone:6][task:6-4]

eslint.config.mjs with eslint-config-next flat-config was already wired.
pnpm lint exits 0 on current apps/web tree.

Refs: docs/dispatch-log/6-4-<UTC>.md
EOF
)"
```

If Step 1 produced EXIT 1 (fixes applied), stage and commit all changed files:

```bash
git add apps/web/eslint.config.mjs
# add any source files fixed:
# git add apps/web/app/(admin)/admin/...
git commit -m "$(cat <<'EOF'
fix(lint): resolve all pnpm lint warnings to reach --max-warnings=0 [milestone:6][task:6-4]

<summary of what was fixed — fill in after Step 3 is complete>
Rule suppressions in eslint.config.mjs have rationale comments.
pnpm lint now exits 0 on current apps/web tree.

Refs: docs/dispatch-log/6-4-<UTC>.md
EOF
)"
```

---

**Wave 0 acceptance gate (all four tasks must be green before dispatching Wave 1):**

- `mvn -pl backend/app -B verify` exits 0, test count ≥ 314, errors = 0.
- `pnpm --filter @drshoes/web lint` exits 0.
- `MessagesControllerIntegrationTest.emptyThreadReturnsEmptyList` no longer appears in the error column.
- `MessageRouter.java` ≤ 130 LOC.
- `V013__message_thread_uniqueness.sql` present in `backend/app/src/main/resources/db/migration/`.
## Wave 1 — Backend batch (5 endpoints)

All five tasks are independent and parallel-dispatchable. Each writes its own controller +
integration test. Endpoint contracts are locked in spec §6 — do NOT redesign them.

---

### Task 6-5: GET /api/admin/dashboard/kpis

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardKpiDto.java`
- Create: `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardKpiControllerIntegrationTest.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Add aggregation methods to OrderRepository**

Read `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` before editing.
Append the following methods:

```java
import java.time.Instant;

// Count non-deleted orders in a given status.
@Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status AND o.deletedAt IS NULL")
long countByStatusNotDeleted(@Param("status") OrderStatus status);

// Count non-deleted orders whose received_at falls within [from, to).
@Query("SELECT COUNT(o) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
long countReceivedBetween(@Param("from") Instant from, @Param("to") Instant to);

// Sum total_price_cents for non-deleted orders whose received_at falls within [from, to).
@Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
long sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);
```

Also add `import com.drshoes.app.order.domain.OrderStatus;` to the repository if it is not already present.

---

- [ ] **Step 2: Create DashboardKpiDto record**

Create `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardKpiDto.java`:

```java
package com.drshoes.app.dashboard.dto;

public record DashboardKpiDto(
    long inProgressCount,
    long readyForPickupCount,
    long todayIntakeCount,
    long monthRevenueCents,
    String monthRevenueFormatted
) {}
```

---

- [ ] **Step 3: Write the failing integration test**

Create `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardKpiControllerIntegrationTest.java`:

```java
package com.drshoes.app.dashboard.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardKpiControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("KPI");
        c.setLastName("TestClient");
        c.setPhone("+48 600 000 077");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanupOrders() {
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — seeded counts
    // ----------------------------------------------------------

    @Test
    void happyPathReturnsCorrectCounts() throws Exception {
        loginAsOwner();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        ZonedDateTime todayMidnight = ZonedDateTime.now(warsaw).toLocalDate().atStartOfDay(warsaw);
        Instant todayStart = todayMidnight.toInstant();
        Instant monthStart = todayMidnight.withDayOfMonth(1).toInstant();

        // 2 in-progress
        seedOrder("W-001", OrderStatus.W_REALIZACJI, todayStart, 1000);
        seedOrder("W-002", OrderStatus.W_REALIZACJI, monthStart, 2000);
        // 1 gotowe-do-odbioru
        seedOrder("W-003", OrderStatus.GOTOWE_DO_ODBIORU, monthStart, 5000);
        // 1 received today (for todayIntakeCount)
        seedOrder("W-004", OrderStatus.PRZYJETE, todayStart, 0);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(2))
            .andExpect(jsonPath("$.readyForPickupCount").value(1))
            .andExpect(jsonPath("$.todayIntakeCount").value(2)) // W-001 + W-004 received today
            .andExpect(jsonPath("$.monthRevenueCents").value(8000))
            .andExpect(jsonPath("$.monthRevenueFormatted").isString());
    }

    // ----------------------------------------------------------
    // Empty database — all zeros
    // ----------------------------------------------------------

    @Test
    void emptyDatabaseReturnsAllZeros() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(0))
            .andExpect(jsonPath("$.readyForPickupCount").value(0))
            .andExpect(jsonPath("$.todayIntakeCount").value(0))
            .andExpect(jsonPath("$.monthRevenueCents").value(0))
            .andExpect(jsonPath("$.monthRevenueFormatted").value("0,00 zł"));
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Revenue PLN format — non-zero amount
    // ----------------------------------------------------------

    @Test
    void revenuePlnFormatIsCorrect() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant monthStart = ZonedDateTime.now(warsaw).toLocalDate().withDayOfMonth(1)
            .atStartOfDay(warsaw).toInstant();

        // 18_240_00 cents = 18240 PLN
        seedOrder("W-010", OrderStatus.GOTOWE_DO_ODBIORU, monthStart, 1824000);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.monthRevenueCents").value(1824000))
            .andExpect(jsonPath("$.monthRevenueFormatted").value("18 240,00 zł"));
    }

    // ----------------------------------------------------------
    // Soft-deleted orders excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedOrdersExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant monthStart = ZonedDateTime.now(warsaw).toLocalDate().withDayOfMonth(1)
            .atStartOfDay(warsaw).toInstant();

        Order deleted = buildOrder("W-020", OrderStatus.W_REALIZACJI, monthStart, 9900);
        deleted.setDeletedAt(Instant.now());
        orderRepo.save(deleted);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(0))
            .andExpect(jsonPath("$.monthRevenueCents").value(0));
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private void seedOrder(String code, OrderStatus status, Instant receivedAt, int priceCents) {
        orderRepo.save(buildOrder(code, status, receivedAt, priceCents));
    }

    private Order buildOrder(String code, OrderStatus status, Instant receivedAt, int priceCents) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(receivedAt);
        o.setTotalPriceCents(priceCents);
        return o;
    }
}
```

---

- [ ] **Step 4: Run the test to verify it fails (controller doesn't exist yet)**

```bash
mvn -pl backend/app -B test -Dtest=DashboardKpiControllerIntegrationTest
```

Expected: FAIL — Spring context starts but `GET /api/admin/dashboard/kpis` returns 404, or
`NoSuchBeanDefinitionException` if the controller class is absent entirely.

---

- [ ] **Step 5: Create DashboardController**

Create `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardController.java`:

```java
package com.drshoes.app.dashboard.api;

import com.drshoes.app.dashboard.dto.DashboardKpiDto;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * Read-only dashboard aggregation endpoints.
 *
 * Structured logging: op={} actor={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardController {

    private static final Logger log = LoggerFactory.getLogger(DashboardController.class);
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final Locale PL = Locale.forLanguageTag("pl-PL");

    private final OrderRepository orderRepo;

    public DashboardController(OrderRepository orderRepo) {
        this.orderRepo = orderRepo;
    }

    @GetMapping("/kpis")
    public DashboardKpiDto kpis() {
        ZonedDateTime now = ZonedDateTime.now(WARSAW);
        Instant todayStart = now.toLocalDate().atStartOfDay(WARSAW).toInstant();
        Instant tomorrowStart = now.toLocalDate().plusDays(1).atStartOfDay(WARSAW).toInstant();
        Instant monthStart = now.toLocalDate().withDayOfMonth(1).atStartOfDay(WARSAW).toInstant();
        Instant monthEnd = now.toLocalDate().plusMonths(1).withDayOfMonth(1).atStartOfDay(WARSAW).toInstant();

        long inProgress      = orderRepo.countByStatusNotDeleted(OrderStatus.W_REALIZACJI);
        long readyForPickup  = orderRepo.countByStatusNotDeleted(OrderStatus.GOTOWE_DO_ODBIORU);
        long todayIntake     = orderRepo.countReceivedBetween(todayStart, tomorrowStart);
        long monthRevenue    = orderRepo.sumRevenueBetween(monthStart, monthEnd);
        String formatted     = formatPln(monthRevenue);

        log.info("op=dashboardKpis inProgress={} readyForPickup={} todayIntake={} monthRevenue={} outcome=ok",
            inProgress, readyForPickup, todayIntake, monthRevenue);

        return new DashboardKpiDto(inProgress, readyForPickup, todayIntake, monthRevenue, formatted);
    }

    private static String formatPln(long cents) {
        NumberFormat nf = NumberFormat.getCurrencyInstance(PL);
        // getCurrencyInstance gives e.g. "18 240,00 zł" with PL locale.
        // Divide by 100 to convert cents → PLN.
        double pln = cents / 100.0;
        return nf.format(pln);
    }
}
```

---

- [ ] **Step 6: Run the test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=DashboardKpiControllerIntegrationTest
```

Expected: PASS — 5 tests run, 0 failures, 0 errors.

---

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/dashboard \
  backend/app/src/test/java/com/drshoes/app/dashboard \
  backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java
git commit -m "$(cat <<'EOF'
feat(dashboard): KPI aggregation endpoint — 4 tiles + PLN-formatted revenue [milestone:6][task:6-5]

GET /api/admin/dashboard/kpis returns inProgressCount, readyForPickupCount,
todayIntakeCount (Europe/Warsaw boundary), monthRevenueCents and
monthRevenueFormatted (pl-PL NumberFormat). Soft-deleted orders excluded
throughout. Three new @Query methods on OrderRepository.

Refs: docs/dispatch-log/6-5-<UTC>.md
EOF
)"
```

---

### Task 6-6: GET /api/admin/dashboard/charts

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardChartsController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardChartsDto.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardChartsControllerIntegrationTest.java`

**Note on LOC:** If merging 6-6's controller into `DashboardController` keeps the class ≤ 120 LOC,
the executor MAY do so and skip creating `DashboardChartsController.java`. Add a `@GetMapping("/charts")`
method to `DashboardController` instead and drop the separate file. Document the decision in the
dispatch log Findings field. If the combined class exceeds 120 LOC, create the separate controller.

**Review:** combined single-stage.

---

- [ ] **Step 1: Add ISO-week and mix aggregation queries to OrderRepository**

Read `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` first.
Append:

```java
/**
 * Returns order counts per ISO week for the last N weeks ending with (and including) weekStart.
 * weekStart is the Monday of the most-recent week (UTC midnight).
 * Returns rows: [week_iso TEXT, repairs BIGINT, custom_ BIGINT].
 * An order is "repair" if ANY of its items has kind='NAPRAWA'; else "custom".
 * Weeks with no orders are NOT returned — caller must zero-fill the 8-slot window.
 */
@Query(value = """
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
    """, nativeQuery = true)
List<Object[]> countPerIsoWeek(@Param("windowStart") Instant windowStart);

/**
 * Returns per-kind order counts for the mix donut.
 * An order's kind is determined by its first NAPRAWA item (→ NAPRAWA bucket),
 * else the kind of its first item overall; orders with no items go to a synthetic "NONE" bucket.
 * Simpler rule consistent with spec §6-6: NAPRAWA bucket = orders with ANY NAPRAWA item;
 * remaining orders are split by first non-NAPRAWA item kind (CUSTOM_BUTY, CUSTOM_KURTKA).
 * Returns rows: [kind TEXT, cnt BIGINT].
 */
@Query(value = """
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA')
                 THEN 'NAPRAWA'
            WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'CUSTOM_BUTY')
                 THEN 'CUSTOM_BUTY'
            WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'CUSTOM_KURTKA')
                 THEN 'CUSTOM_KURTKA'
            ELSE 'NONE'
        END AS kind,
        COUNT(*) AS cnt
    FROM order_ o
    WHERE o.deleted_at IS NULL
    GROUP BY kind
    """, nativeQuery = true)
List<Object[]> countByItemKind();
```

---

- [ ] **Step 2: Create DTO records**

Create `backend/app/src/main/java/com/drshoes/app/dashboard/dto/DashboardChartsDto.java`:

```java
package com.drshoes.app.dashboard.dto;

import java.util.List;

public record DashboardChartsDto(
    List<OrdersPerWeekRowDto> ordersPerWeek,
    List<MixByTypeRowDto> mixByType
) {
    public record OrdersPerWeekRowDto(String weekIso, long repairs, long custom) {}
    public record MixByTypeRowDto(String kind, long count, double percent) {}
}
```

---

- [ ] **Step 3: Write the failing integration test**

Create `backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardChartsControllerIntegrationTest.java`:

```java
package com.drshoes.app.dashboard.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardChartsControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Charts");
        c.setLastName("Client");
        c.setPhone("+48 600 000 088");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — seeded orders appear in the right week buckets
    // ----------------------------------------------------------

    @Test
    void ordersPerWeekContainsCurrentWeek() throws Exception {
        loginAsOwner();
        Instant now = Instant.now();
        UUID orderId = seedOrder("C-001", OrderStatus.PRZYJETE, now);
        seedItem(orderId, OrderItemKind.NAPRAWA);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.ordersPerWeek", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[0].weekIso").isString())
            .andExpect(jsonPath("$.ordersPerWeek[0].repairs").value(greaterThanOrEqualTo(1)));
    }

    // ----------------------------------------------------------
    // Empty weeks — response still has ordersPerWeek array (may be empty)
    // ----------------------------------------------------------

    @Test
    void emptyDatabaseReturnsEmptyArrays() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.mixByType").isArray());
    }

    // ----------------------------------------------------------
    // Aggregation rule: order with any NAPRAWA item → repairs bucket
    // ----------------------------------------------------------

    @Test
    void orderWithNaprawaItemCountsAsRepair() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-002", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.NAPRAWA);

        // Also add a CUSTOM_BUTY item to the same order — should still be repair
        seedItem(orderId, OrderItemKind.CUSTOM_BUTY);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'NAPRAWA')].count",
                hasItem(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Mix percent — zero total guard (no NaN / division-by-zero)
    // ----------------------------------------------------------

    @Test
    void mixByTypePercentSumsToHundredOrIsEmpty() throws Exception {
        loginAsOwner();
        UUID id1 = seedOrder("C-003", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id1, OrderItemKind.CUSTOM_BUTY);
        UUID id2 = seedOrder("C-004", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id2, OrderItemKind.CUSTOM_KURTKA);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType").isArray())
            // No NaN values in the percent field
            .andExpect(jsonPath("$.mixByType[*].percent",
                everyItem(allOf(greaterThanOrEqualTo(0.0), lessThanOrEqualTo(100.0)))));
    }

    // ----------------------------------------------------------
    // Soft-deleted orders excluded from mix
    // ----------------------------------------------------------

    @Test
    void softDeletedOrdersExcluded() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-005", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.NAPRAWA);

        // soft-delete it
        Order o = orderRepo.findById(orderId).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            // NAPRAWA bucket should NOT contain our deleted order
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'NAPRAWA')].count",
                not(hasItem(greaterThanOrEqualTo(1)))));
    }

    // ----------------------------------------------------------
    // 401 for unauthenticated
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, Instant receivedAt) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(receivedAt);
        return orderRepo.save(o).getId();
    }

    private void seedItem(UUID orderId, OrderItemKind kind) {
        var item = new OrderItem();
        item.setOrderId(orderId);
        item.setKind(kind);
        item.setDescription("test item");
        item.setPosition(0);
        itemRepo.save(item);
    }
}
```

---

- [ ] **Step 4: Run the test to verify it fails**

```bash
mvn -pl backend/app -B test -Dtest=DashboardChartsControllerIntegrationTest
```

Expected: FAIL — 404 on the charts endpoint.

---

- [ ] **Step 5: Create DashboardChartsController**

Create `backend/app/src/main/java/com/drshoes/app/dashboard/api/DashboardChartsController.java`
(or add `@GetMapping("/charts")` to `DashboardController` if combined LOC stays ≤ 120 — executor
decides; document in Findings):

```java
package com.drshoes.app.dashboard.api;

import com.drshoes.app.dashboard.dto.DashboardChartsDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.MixByTypeRowDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.OrdersPerWeekRowDto;
import com.drshoes.app.order.domain.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.util.*;

/**
 * Dashboard chart aggregations: 8-week stacked bar + mix donut.
 *
 * Structured logging: op={} outcome=ok|error
 */
@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardChartsController {

    private static final Logger log = LoggerFactory.getLogger(DashboardChartsController.class);
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;

    public DashboardChartsController(OrderRepository orderRepo) {
        this.orderRepo = orderRepo;
    }

    @GetMapping("/charts")
    public DashboardChartsDto charts() {
        // Window: Monday of (current week - 7) at Warsaw midnight, so last 8 ISO weeks including current.
        ZonedDateTime nowWarsaw = ZonedDateTime.now(WARSAW);
        ZonedDateTime windowStart = nowWarsaw.with(IsoFields.WEEK_OF_WEEK_BASED_YEAR,
                nowWarsaw.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR))
            .minusWeeks(7)
            .toLocalDate().with(java.time.DayOfWeek.MONDAY)
            .atStartOfDay(WARSAW);
        Instant windowStartInstant = windowStart.toInstant();

        // Build ISO-week labels for the 8-slot window (zero-fill gaps).
        List<String> weekLabels = buildWeekLabels(windowStart, 8);

        List<Object[]> rawWeeks = orderRepo.countPerIsoWeek(windowStartInstant);
        Map<String, long[]> weekMap = new LinkedHashMap<>();
        for (Object[] row : rawWeeks) {
            String week = (String) row[0];
            long repairs = ((Number) row[1]).longValue();
            long custom  = ((Number) row[2]).longValue();
            weekMap.put(week, new long[]{repairs, custom});
        }

        List<OrdersPerWeekRowDto> ordersPerWeek = new ArrayList<>();
        for (String label : weekLabels) {
            long[] counts = weekMap.getOrDefault(label, new long[]{0L, 0L});
            ordersPerWeek.add(new OrdersPerWeekRowDto(label, counts[0], counts[1]));
        }

        // Mix donut
        List<Object[]> rawMix = orderRepo.countByItemKind();
        long total = rawMix.stream().mapToLong(r -> ((Number) r[1]).longValue()).sum();
        List<MixByTypeRowDto> mixByType = new ArrayList<>();
        for (Object[] row : rawMix) {
            String kind = (String) row[0];
            long count  = ((Number) row[1]).longValue();
            double pct  = (total == 0) ? 0.0 : Math.round((count * 1000.0 / total)) / 10.0;
            mixByType.add(new MixByTypeRowDto(kind, count, pct));
        }

        log.info("op=dashboardCharts weeksReturned={} mixBuckets={} outcome=ok",
            ordersPerWeek.size(), mixByType.size());
        return new DashboardChartsDto(ordersPerWeek, mixByType);
    }

    private static List<String> buildWeekLabels(ZonedDateTime firstMonday, int count) {
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ZonedDateTime week = firstMonday.plusWeeks(i);
            int isoYear = week.get(IsoFields.WEEK_BASED_YEAR);
            int isoWeek = week.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            labels.add(String.format("%04d-W%02d", isoYear, isoWeek));
        }
        return labels;
    }
}
```

---

- [ ] **Step 6: Run the test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=DashboardChartsControllerIntegrationTest
```

Expected: PASS — 6 tests run, 0 failures.

---

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/dashboard \
  backend/app/src/test/java/com/drshoes/app/dashboard/api/DashboardChartsControllerIntegrationTest.java \
  backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java
git commit -m "$(cat <<'EOF'
feat(dashboard): charts endpoint — 8-week stacked bar + mix donut [milestone:6][task:6-6]

GET /api/admin/dashboard/charts returns ordersPerWeek (last 8 ISO weeks, zero-filled)
and mixByType (per-kind percent with zero-total guard). Aggregation rule: order is
"repair" if any item has kind NAPRAWA. Two new native @Query methods on OrderRepository.

Refs: docs/dispatch-log/6-6-<UTC>.md
EOF
)"
```

---

### Task 6-7: GET /api/admin/orders/calendar

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/CalendarController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/api/CalendarControllerIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Add calendar query methods to OrderRepository**

Read `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` first. Append:

```java
/**
 * Scheduled orders in the [fromInstant, toInstant) window — non-deleted, active statuses only.
 * Active = NOT IN (WYDANE, ANULOWANE). planned_pickup_at must be non-null.
 */
@Query(value = """
    SELECT * FROM order_
    WHERE deleted_at IS NULL
      AND planned_pickup_at IS NOT NULL
      AND planned_pickup_at >= :fromInstant
      AND planned_pickup_at < :toInstant
      AND status NOT IN ('WYDANE', 'ANULOWANE')
    ORDER BY planned_pickup_at ASC
    """, nativeQuery = true)
List<Order> findScheduledInWindow(@Param("fromInstant") Instant fromInstant,
                                  @Param("toInstant") Instant toInstant);

/**
 * Unscheduled orders: no planned_pickup_at, non-deleted, active statuses.
 * Capped at 50 by received_at DESC.
 */
@Query(value = """
    SELECT * FROM order_
    WHERE deleted_at IS NULL
      AND planned_pickup_at IS NULL
      AND status NOT IN ('WYDANE', 'ANULOWANE')
    ORDER BY received_at DESC
    LIMIT 50
    """, nativeQuery = true)
List<Order> findUnscheduled();
```

---

- [ ] **Step 2: Create CalendarResponseDto records**

Create `backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java`:

```java
package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CalendarResponseDto(
    List<CalendarOrderDto> scheduled,
    List<CalendarOrderDto> unscheduled
) {
    /**
     * Unified DTO for both scheduled and unscheduled calendar entries.
     * plannedPickupAt is non-null for scheduled; receivedAt is non-null for unscheduled.
     * urgent follows the same derivation as OrderMapper.toDto (tag "pilne" OR within 48h of plannedPickupAt).
     */
    public record CalendarOrderDto(
        UUID id,
        String code,
        String clientName,
        OrderStatus status,
        Instant plannedPickupAt,  // null for unscheduled entries
        Instant receivedAt,        // null for scheduled entries
        String itemSummary,
        boolean urgent
    ) {}
}
```

---

- [ ] **Step 3: Write the failing integration test**

Create `backend/app/src/test/java/com/drshoes/app/order/api/CalendarControllerIntegrationTest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CalendarControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;
    private String today;
    private String nextWeek;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Kal");
        c.setLastName("TestClient");
        c.setPhone("+48 600 000 055");
        clientId = clientRepo.save(c).getId();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        today    = ZonedDateTime.now(warsaw).toLocalDate().toString();
        nextWeek = ZonedDateTime.now(warsaw).toLocalDate().plusDays(7).toString();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — scheduled order appears in window
    // ----------------------------------------------------------

    @Test
    void scheduledOrderAppearsInWindow() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        seedOrder("K-001", OrderStatus.PRZYJETE, tomorrow, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled").isArray())
            .andExpect(jsonPath("$.scheduled", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.scheduled[0].code").value("K-001"))
            .andExpect(jsonPath("$.scheduled[0].plannedPickupAt").isString())
            .andExpect(jsonPath("$.scheduled[0].clientName").value("Kal TestClient"));
    }

    // ----------------------------------------------------------
    // Range > 92 days → 400
    // ----------------------------------------------------------

    @Test
    void rangeOver92DaysReturns400() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        String farFuture = ZonedDateTime.now(warsaw).toLocalDate().plusDays(100).toString();

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + farFuture))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // from > to → 400
    // ----------------------------------------------------------

    @Test
    void fromAfterToReturns400() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/orders/calendar?from=" + nextWeek + "&to=" + today))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // Unscheduled orders appear in unscheduled array
    // ----------------------------------------------------------

    @Test
    void unscheduledOrderAppearsInUnscheduledArray() throws Exception {
        loginAsOwner();
        // no plannedPickupAt
        seedOrder("K-002", OrderStatus.W_REALIZACJI, null, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unscheduled").isArray())
            .andExpect(jsonPath("$.unscheduled[?(@.code=='K-002')]").exists());
    }

    // ----------------------------------------------------------
    // WYDANE / ANULOWANE orders excluded from both arrays
    // ----------------------------------------------------------

    @Test
    void wydaneAndAnulowaneExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        seedOrder("K-003", OrderStatus.WYDANE, tomorrow, null);
        seedOrder("K-004", OrderStatus.ANULOWANE, null, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-003')]").doesNotExist())
            .andExpect(jsonPath("$.unscheduled[?(@.code=='K-004')]").doesNotExist());
    }

    // ----------------------------------------------------------
    // Soft-deleted excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        UUID id = seedOrder("K-005", OrderStatus.PRZYJETE, tomorrow, null);
        Order o = orderRepo.findById(id).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-005')]").doesNotExist());
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, Instant plannedPickupAt,
                           Instant receivedAt) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setPlannedPickupAt(plannedPickupAt);
        o.setReceivedAt(receivedAt != null ? receivedAt : Instant.now());
        return orderRepo.save(o).getId();
    }
}
```

---

- [ ] **Step 4: Run the test to verify it fails**

```bash
mvn -pl backend/app -B test -Dtest=CalendarControllerIntegrationTest
```

Expected: FAIL — 404 on the calendar endpoint.

---

- [ ] **Step 5: Create CalendarController**

Create `backend/app/src/main/java/com/drshoes/app/order/api/CalendarController.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.dto.CalendarResponseDto;
import com.drshoes.app.order.dto.CalendarResponseDto.CalendarOrderDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calendar view endpoint: orders windowed by planned_pickup_at + unscheduled list.
 *
 * Structured logging: op=calendarQuery from={} to={} scheduledCount={} unscheduledCount={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/orders")
public class CalendarController {

    private static final Logger log = LoggerFactory.getLogger(CalendarController.class);
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;

    public CalendarController(OrderRepository orderRepo,
                              OrderItemRepository itemRepo,
                              ClientRepository clientRepo) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.clientRepo = clientRepo;
    }

    @GetMapping("/calendar")
    public CalendarResponseDto calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must not be after to");
        }
        long days = ChronoUnit.DAYS.between(from, to);
        if (days > 92) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Calendar range must not exceed 92 days");
        }

        Instant fromInstant = from.atStartOfDay(WARSAW).toInstant();
        Instant toInstant   = to.plusDays(1).atStartOfDay(WARSAW).toInstant();

        List<Order> scheduled   = orderRepo.findScheduledInWindow(fromInstant, toInstant);
        List<Order> unscheduled = orderRepo.findUnscheduled();

        // Pre-fetch client names in one batch
        Set<UUID> clientIds = new HashSet<>();
        scheduled.forEach(o -> clientIds.add(o.getClientId()));
        unscheduled.forEach(o -> clientIds.add(o.getClientId()));
        Map<UUID, String> clientNames = clientRepo.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));

        // Pre-fetch first items in one batch (for itemSummary)
        Set<UUID> orderIds = new HashSet<>();
        scheduled.forEach(o -> orderIds.add(o.getId()));
        unscheduled.forEach(o -> orderIds.add(o.getId()));
        Map<UUID, String> summaries = buildSummaries(orderIds);

        List<CalendarOrderDto> scheduledDtos = scheduled.stream()
            .map(o -> toDto(o, clientNames, summaries, true))
            .toList();
        List<CalendarOrderDto> unscheduledDtos = unscheduled.stream()
            .map(o -> toDto(o, clientNames, summaries, false))
            .toList();

        log.info("op=calendarQuery from={} to={} scheduledCount={} unscheduledCount={} outcome=ok",
            from, to, scheduledDtos.size(), unscheduledDtos.size());

        return new CalendarResponseDto(scheduledDtos, unscheduledDtos);
    }

    private CalendarOrderDto toDto(Order o, Map<UUID, String> clientNames,
                                   Map<UUID, String> summaries, boolean includePickup) {
        String clientName = clientNames.getOrDefault(o.getClientId(), "");
        String summary    = summaries.getOrDefault(o.getId(), "");
        boolean urgent    = isUrgent(o);
        return new CalendarOrderDto(
            o.getId(), o.getCode(), clientName, o.getStatus(),
            includePickup ? o.getPlannedPickupAt() : null,
            includePickup ? null : o.getReceivedAt(),
            summary, urgent);
    }

    /** Replicates the M1 urgent derivation: tag "pilne" OR plannedPickupAt within 48h. */
    private static boolean isUrgent(Order o) {
        String tags = o.getTags();
        if (tags != null && tags.contains("\"pilne\"")) return true;
        if (o.getPlannedPickupAt() != null) {
            return o.getPlannedPickupAt().isBefore(Instant.now().plus(48, ChronoUnit.HOURS));
        }
        return false;
    }

    private Map<UUID, String> buildSummaries(Set<UUID> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        Map<UUID, String> map = new HashMap<>();
        for (UUID oid : orderIds) {
            List<OrderItem> items = itemRepo.findAllByOrderIdOrderByPosition(oid);
            if (items.isEmpty()) {
                map.put(oid, "");
            } else {
                String desc = items.get(0).getDescription();
                map.put(oid, desc != null && desc.length() > 40 ? desc.substring(0, 40) : desc != null ? desc : "");
            }
        }
        return map;
    }
}
```

---

- [ ] **Step 6: Run the test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=CalendarControllerIntegrationTest
```

Expected: PASS — 7 tests run, 0 failures.

---

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/order/api/CalendarController.java \
  backend/app/src/main/java/com/drshoes/app/order/dto/CalendarResponseDto.java \
  backend/app/src/test/java/com/drshoes/app/order/api/CalendarControllerIntegrationTest.java \
  backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java
git commit -m "$(cat <<'EOF'
feat(calendar): calendar window endpoint — scheduled + unscheduled orders [milestone:6][task:6-7]

GET /api/admin/orders/calendar?from=&to= returns scheduled orders (by planned_pickup_at)
and unscheduled orders (no planned date, capped 50). Range >92 days or from>to → 400.
Europe/Warsaw boundary conversion. WYDANE/ANULOWANE excluded. Urgent flag reuses M1
tag-or-48h derivation. itemSummary from first item description (truncated at 40 chars).

Refs: docs/dispatch-log/6-7-<UTC>.md
EOF
)"
```

---

### Task 6-8: GET /api/admin/orders/kanban

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/KanbanResponseDto.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/api/KanbanControllerIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Add paged-by-status query methods to OrderRepository**

Read `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` first. Append:

```java
/**
 * Count non-deleted orders for a given status — used for the column total badge.
 */
@Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status AND o.deletedAt IS NULL")
long countByStatus(@Param("status") OrderStatus status);

/**
 * Paged orders for a Kanban column ordered by received_at DESC.
 * Uses native LIMIT/OFFSET so the result is a plain List (not Page<>) to avoid count overhead.
 */
@Query(value = """
    SELECT * FROM order_
    WHERE status = :status AND deleted_at IS NULL
    ORDER BY received_at DESC
    LIMIT :lim
    """, nativeQuery = true)
List<Order> findTopByStatusOrderByReceivedAtDesc(@Param("status") String status,
                                                 @Param("lim") int lim);

/**
 * WYDANE column: paged by picked_up_at DESC, tighter cap (always 10 max).
 */
@Query(value = """
    SELECT * FROM order_
    WHERE status = 'WYDANE' AND deleted_at IS NULL
    ORDER BY picked_up_at DESC NULLS LAST
    LIMIT :lim
    """, nativeQuery = true)
List<Order> findTopWydaneOrderByPickedUpAtDesc(@Param("lim") int lim);
```

Note: `countByStatusNotDeleted` added for task 6-5 already handles the count query — reuse it.
Check if it exists before adding `countByStatus` to avoid duplication. If 6-5 already added
`countByStatusNotDeleted(@Param("status") OrderStatus status)`, alias it or use the same method
from the KanbanController — they are equivalent.

---

- [ ] **Step 2: Create KanbanResponseDto records**

Create `backend/app/src/main/java/com/drshoes/app/order/dto/KanbanResponseDto.java`:

```java
package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record KanbanResponseDto(List<KanbanColumnDto> columns) {

    public record KanbanColumnDto(
        OrderStatus status,
        long total,
        List<KanbanCardDto> cards,
        boolean hasMore
    ) {}

    public record KanbanCardDto(
        UUID id,
        String code,
        String clientName,
        String itemSummary,
        Instant plannedPickupAt,
        boolean urgent
    ) {}
}
```

---

- [ ] **Step 3: Write the failing integration test**

Create `backend/app/src/test/java/com/drshoes/app/order/api/KanbanControllerIntegrationTest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class KanbanControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Kanban");
        c.setLastName("Client");
        c.setPhone("+48 600 000 066");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Full board — 5 columns present
    // ----------------------------------------------------------

    @Test
    void fullBoardReturnsFiveColumns() throws Exception {
        loginAsOwner();
        seedOrder("KB-001", OrderStatus.PRZYJETE);
        seedOrder("KB-002", OrderStatus.W_REALIZACJI);
        seedOrder("KB-003", OrderStatus.CZEKA_NA_KLIENTA);
        seedOrder("KB-004", OrderStatus.GOTOWE_DO_ODBIORU);
        seedOrder("KB-005", OrderStatus.WYDANE);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns").isArray())
            .andExpect(jsonPath("$.columns", hasSize(5)))
            .andExpect(jsonPath("$.columns[0].status").value("PRZYJETE"))
            .andExpect(jsonPath("$.columns[4].status").value("WYDANE"));
    }

    // ----------------------------------------------------------
    // Empty board — all columns present with zero counts
    // ----------------------------------------------------------

    @Test
    void emptyBoardStillReturnsFiveColumns() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns", hasSize(5)))
            .andExpect(jsonPath("$.columns[0].total").value(0))
            .andExpect(jsonPath("$.columns[0].cards").isEmpty());
    }

    // ----------------------------------------------------------
    // limitPerColumn enforced — hasMore=true when over cap
    // ----------------------------------------------------------

    @Test
    void hasMoreTrueWhenOverCap() throws Exception {
        loginAsOwner();
        for (int i = 0; i < 3; i++) {
            seedOrder("KB-10" + i, OrderStatus.PRZYJETE);
        }

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].total").value(3))
            .andExpect(jsonPath("$.columns[0].cards", hasSize(2)))
            .andExpect(jsonPath("$.columns[0].hasMore").value(true));
    }

    // ----------------------------------------------------------
    // WYDANE always capped at 10 even when limitPerColumn is higher
    // ----------------------------------------------------------

    @Test
    void wydaneCappedAt10RegardlessOfLimit() throws Exception {
        loginAsOwner();
        for (int i = 0; i < 12; i++) {
            seedOrder("KB-W" + i, OrderStatus.WYDANE);
        }

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=50"))
            .andExpect(status().isOk())
            // WYDANE is last column
            .andExpect(jsonPath("$.columns[4].cards", hasSize(10)))
            .andExpect(jsonPath("$.columns[4].total").value(12))
            .andExpect(jsonPath("$.columns[4].hasMore").value(true));
    }

    // ----------------------------------------------------------
    // Soft-deleted excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedExcluded() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("KB-DEL", OrderStatus.PRZYJETE);
        Order o = orderRepo.findById(id).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].total").value(0));
    }

    // ----------------------------------------------------------
    // Invalid limitPerColumn → 400
    // ----------------------------------------------------------

    @Test
    void invalidLimitPerColumnReturns400() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=300"))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now());
        return orderRepo.save(o).getId();
    }
}
```

---

- [ ] **Step 4: Run the test to verify it fails**

```bash
mvn -pl backend/app -B test -Dtest=KanbanControllerIntegrationTest
```

Expected: FAIL — 404 on the kanban endpoint, or compilation failure if DTOs missing.

---

- [ ] **Step 5: Create KanbanController**

Create `backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import com.drshoes.app.order.dto.KanbanResponseDto;
import com.drshoes.app.order.dto.KanbanResponseDto.KanbanCardDto;
import com.drshoes.app.order.dto.KanbanResponseDto.KanbanColumnDto;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Kanban board endpoint — returns all 5 active columns in one round-trip.
 *
 * Structured logging: op=kanbanBoard limitPerColumn={} outcome=ok
 */
@Validated
@RestController
@RequestMapping("/api/admin/orders")
public class KanbanController {

    private static final Logger log = LoggerFactory.getLogger(KanbanController.class);
    private static final int WYDANE_CAP = 10;
    private static final List<OrderStatus> COLUMN_ORDER = List.of(
        OrderStatus.PRZYJETE,
        OrderStatus.W_REALIZACJI,
        OrderStatus.CZEKA_NA_KLIENTA,
        OrderStatus.GOTOWE_DO_ODBIORU,
        OrderStatus.WYDANE
    );

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;

    public KanbanController(OrderRepository orderRepo,
                            OrderItemRepository itemRepo,
                            ClientRepository clientRepo) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.clientRepo = clientRepo;
    }

    @GetMapping("/kanban")
    public KanbanResponseDto kanban(
            @RequestParam(defaultValue = "50")
            @Min(value = 1, message = "limitPerColumn must be between 1 and 200")
            @Max(value = 200, message = "limitPerColumn must be between 1 and 200")
            int limitPerColumn) {

        List<KanbanColumnDto> columns = new ArrayList<>();

        // Collect all card IDs to batch-fetch client names and item summaries.
        Map<UUID, Order> allOrders = new LinkedHashMap<>();

        // First pass: fetch counts + paged cards for each column.
        Map<OrderStatus, List<Order>> columnOrders = new LinkedHashMap<>();
        Map<OrderStatus, Long> columnTotals = new LinkedHashMap<>();

        for (OrderStatus status : COLUMN_ORDER) {
            long total = orderRepo.countByStatusNotDeleted(status);
            columnTotals.put(status, total);

            List<Order> cards;
            if (status == OrderStatus.WYDANE) {
                cards = orderRepo.findTopWydaneOrderByPickedUpAtDesc(WYDANE_CAP);
            } else {
                cards = orderRepo.findTopByStatusOrderByReceivedAtDesc(status.name(), limitPerColumn);
            }
            columnOrders.put(status, cards);
            cards.forEach(o -> allOrders.put(o.getId(), o));
        }

        // Batch fetch client names
        Set<UUID> clientIds = allOrders.values().stream()
            .map(Order::getClientId).collect(Collectors.toSet());
        Map<UUID, String> clientNames = clientRepo.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));

        // Batch fetch item summaries
        Map<UUID, String> summaries = buildSummaries(allOrders.keySet());

        // Build column DTOs
        for (OrderStatus status : COLUMN_ORDER) {
            long total  = columnTotals.get(status);
            int cap     = (status == OrderStatus.WYDANE) ? WYDANE_CAP : limitPerColumn;
            List<Order> orders = columnOrders.get(status);
            boolean hasMore = total > cap;

            List<KanbanCardDto> cards = orders.stream().map(o -> new KanbanCardDto(
                o.getId(), o.getCode(),
                clientNames.getOrDefault(o.getClientId(), ""),
                summaries.getOrDefault(o.getId(), ""),
                o.getPlannedPickupAt(),
                isUrgent(o)
            )).toList();

            columns.add(new KanbanColumnDto(status, total, cards, hasMore));
        }

        log.info("op=kanbanBoard limitPerColumn={} outcome=ok", limitPerColumn);
        return new KanbanResponseDto(columns);
    }

    private static boolean isUrgent(Order o) {
        String tags = o.getTags();
        if (tags != null && tags.contains("\"pilne\"")) return true;
        if (o.getPlannedPickupAt() != null) {
            return o.getPlannedPickupAt().isBefore(Instant.now().plus(48, ChronoUnit.HOURS));
        }
        return false;
    }

    private Map<UUID, String> buildSummaries(Set<UUID> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        Map<UUID, String> map = new HashMap<>();
        for (UUID oid : orderIds) {
            List<OrderItem> items = itemRepo.findAllByOrderIdOrderByPosition(oid);
            if (items.isEmpty()) {
                map.put(oid, "");
            } else {
                String desc = items.get(0).getDescription();
                map.put(oid, desc != null && desc.length() > 40 ? desc.substring(0, 40) : desc != null ? desc : "");
            }
        }
        return map;
    }
}
```

---

- [ ] **Step 6: Run the test to verify it passes**

```bash
mvn -pl backend/app -B test -Dtest=KanbanControllerIntegrationTest
```

Expected: PASS — 7 tests run, 0 failures.

---

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java \
  backend/app/src/main/java/com/drshoes/app/order/dto/KanbanResponseDto.java \
  backend/app/src/test/java/com/drshoes/app/order/api/KanbanControllerIntegrationTest.java \
  backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java
git commit -m "$(cat <<'EOF'
feat(kanban): single-shot 5-column kanban board endpoint [milestone:6][task:6-8]

GET /api/admin/orders/kanban?limitPerColumn=N returns all 5 active status columns
in one round-trip. WYDANE always capped at 10 ordered by picked_up_at DESC; other
columns capped by limitPerColumn (1–200, 400 if out of range). total per column is
the unfiltered badge count; hasMore=true when total>cap. Soft-deleted excluded.

Refs: docs/dispatch-log/6-8-<UTC>.md
EOF
)"
```

---

### Task 6-9: POST /api/admin/orders/bulk/status

**Review: TWO-STAGE.**
Stage 1: implementation + tests land.
Stage 2: code review focused on (a) correctness of per-order delegation and error classification,
(b) `sendTriggers` boolean threading through `OrderService.changeStatus`, (c) audit semantics
(exactly one audit row per successful per-order transition, none for failures), and (d) the
caller-side update in `OrderController` passing `sendTriggers=true` with no behavior change.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/BulkStatusController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusRequestDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusResponseDto.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java` — thread `sendTriggers` boolean into `changeStatus`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusRequest.java` — add `sendTriggers` field (default `true`)
- Modify: `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java` — update `changeStatus` call site to pass `sendTriggers=true` for backward compat
- Create: `backend/app/src/test/java/com/drshoes/app/order/api/BulkStatusControllerIntegrationTest.java`

---

- [ ] **Step 1: Read existing ChangeStatusRequest and OrderService**

Read both files before modifying:
- `backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusRequest.java`
- `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`

Confirm `ChangeStatusRequest` fields, and confirm the `changeStatus(UUID, ChangeStatusRequest)` signature and whether `TriggerEngine.onStatusChange` is called there or delegated further.

---

- [ ] **Step 2: Read ChangeStatusRequest**

Read `backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusRequest.java`. Based on the
existing `OrderController.changeStatus` and `OrderService.changeStatus` code, the request has at
minimum `targetStatus` and `expectedVersion`. Add `sendTriggers` with default `true`:

```java
package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(
    @NotNull OrderStatus targetStatus,
    int expectedVersion,
    boolean sendTriggers    // default true — existing single-order callers always send triggers
) {
    // Compact constructor to apply the default
    public ChangeStatusRequest {
        // sendTriggers defaults to true when deserialized with Jackson
        // (boolean fields default to false in JSON — use withSendTriggersDefaultTrue below
        //  or add @JsonProperty(defaultValue = "true") on the field if needed).
    }
}
```

**Note to executor:** If `ChangeStatusRequest` is already a record with `targetStatus` + `expectedVersion`
only, patch it by adding the `sendTriggers` field. If it is a class, add a `getSendTriggers()` /
`boolean sendTriggers` field. Check the exact current definition and do a minimal diff. The default
for `sendTriggers` must be `true` so existing callers that pass `{"targetStatus":..., "expectedVersion":...}`
without the new field still fire triggers. In Jackson, boolean fields default to `false` when absent —
add `@JsonProperty(defaultValue = "true")` or use a `@JsonCreator`-style overload to enforce `true`
as the default for missing field. Document chosen approach in Findings.

---

- [ ] **Step 3: Modify OrderService.changeStatus to accept sendTriggers**

Edit `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`. Change the method signature from:

```java
public ChangeStatusResponse changeStatus(UUID id, ChangeStatusRequest req)
```

to keep the same signature but read `req.sendTriggers()` to gate the trigger call:

```java
@Transactional
public ChangeStatusResponse changeStatus(UUID id, ChangeStatusRequest req) {
    Order o = orderRepo.findById(id)
        .filter(x -> x.getDeletedAt() == null)
        .orElseThrow(() -> new OrderNotFoundException(id));
    if (o.getVersion() != req.expectedVersion())
        throw new OrderVersionConflictException(id, o.getVersion());
    OrderStatus old = o.getStatus();
    o.setStatus(req.targetStatus());
    if (req.targetStatus() == OrderStatus.PRZYJETE && o.getReceivedAt() == null)
        o.setReceivedAt(Instant.now());
    if (req.targetStatus() == OrderStatus.WYDANE && o.getPickedUpAt() == null)
        o.setPickedUpAt(Instant.now());
    Order saved = orderRepo.save(o);
    log.info("op=changeOrderStatus orderId={} fromStatus={} toStatus={} sendTriggers={} outcome=ok",
        id, old, req.targetStatus(), req.sendTriggers());
    if (req.sendTriggers()) {
        triggerEngine.onStatusChange(saved.getId(), old.name(), req.targetStatus().name());
    }
    return new ChangeStatusResponse(toDto(saved), new TriggerSuggestion());
}
```

No other changes to `OrderService`. The single-order `OrderController` already passes a `ChangeStatusRequest`
that will now default `sendTriggers=true`.

---

- [ ] **Step 4: Create BulkStatusRequestDto and BulkStatusResponseDto**

Create `backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusRequestDto.java`:

```java
package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BulkStatusRequestDto(
    @NotEmpty @Size(max = 100) List<@NotNull UUID> orderIds,
    @NotNull OrderStatus newStatus,
    String reason,
    boolean sendTriggers
) {}
```

Create `backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusResponseDto.java`:

```java
package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.util.List;
import java.util.UUID;

public record BulkStatusResponseDto(
    List<SucceededItem> succeeded,
    List<FailedItem> failed
) {
    public record SucceededItem(UUID orderId, String code, OrderStatus fromStatus, OrderStatus toStatus) {}
    public record FailedItem(UUID orderId, String code, OrderStatus fromStatus, String error) {}
}
```

---

- [ ] **Step 5: Write the failing integration test**

Create `backend/app/src/test/java/com/drshoes/app/order/api/BulkStatusControllerIntegrationTest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BulkStatusControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;
    @Autowired private AuditLogRepository auditLogRepo;
    @Autowired private ObjectMapper objectMapper;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Bulk");
        c.setLastName("Client");
        c.setPhone("+48 600 000 099");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // All-success: 3 orders all transition cleanly
    // ----------------------------------------------------------

    @Test
    void allSuccessReturns200WithSucceededArray() throws Exception {
        loginAsOwner();
        UUID id1 = seedOrder("BK-001", OrderStatus.PRZYJETE, 0);
        UUID id2 = seedOrder("BK-002", OrderStatus.PRZYJETE, 0);
        UUID id3 = seedOrder("BK-003", OrderStatus.PRZYJETE, 0);

        String body = objectMapper.writeValueAsString(java.util.Map.of(
            "orderIds", List.of(id1, id2, id3),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(3)))
            .andExpect(jsonPath("$.failed").isEmpty());
    }

    // ----------------------------------------------------------
    // Mixed: 1 NOT_FOUND + 1 ILLEGAL_TRANSITION + 1 success
    // ----------------------------------------------------------

    @Test
    void mixedResultsReturn200WithBothArrays() throws Exception {
        loginAsOwner();
        UUID validId  = seedOrder("BK-010", OrderStatus.PRZYJETE, 0);
        UUID missingId = UUID.randomUUID(); // does not exist

        // Seed one order at WYDANE — can't transition to W_REALIZACJI (illegal)
        UUID illegalId = seedOrder("BK-011", OrderStatus.WYDANE, 0);

        String body = objectMapper.writeValueAsString(java.util.Map.of(
            "orderIds", List.of(validId, missingId, illegalId),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)))
            .andExpect(jsonPath("$.failed", hasSize(2)))
            .andExpect(jsonPath("$.failed[?(@.error=='NOT_FOUND')]").exists())
            .andExpect(jsonPath("$.failed[?(@.error=='ILLEGAL_TRANSITION')]").exists());
    }

    // ----------------------------------------------------------
    // Empty orderIds[] → 400
    // ----------------------------------------------------------

    @Test
    void emptyOrderIdsReturns400() throws Exception {
        loginAsOwner();
        String body = """
            {"orderIds":[],"newStatus":"W_REALIZACJI","sendTriggers":false}""";

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // 101 IDs → 413
    // ----------------------------------------------------------

    @Test
    void over100IdsReturns413() throws Exception {
        loginAsOwner();
        List<UUID> ids = Stream.generate(UUID::randomUUID).limit(101).toList();
        String body = objectMapper.writeValueAsString(java.util.Map.of(
            "orderIds", ids,
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isPayloadTooLarge());
    }

    // ----------------------------------------------------------
    // Invalid newStatus enum → 400
    // ----------------------------------------------------------

    @Test
    void invalidStatusEnumReturns400() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("BK-020", OrderStatus.PRZYJETE, 0);
        String body = """
            {"orderIds":["%s"],"newStatus":"NOT_A_STATUS","sendTriggers":false}"""
            .formatted(id);

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // sendTriggers=false: no trigger fires (verify no trigger-related audit rows added
    // beyond the status-change audit row itself)
    // ----------------------------------------------------------

    @Test
    void sendTriggersFalseSkipsTriggerFanOut() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("BK-030", OrderStatus.PRZYJETE, 0);
        long auditBefore = auditLogRepo.count();

        String body = objectMapper.writeValueAsString(java.util.Map.of(
            "orderIds", List.of(id),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)));

        // Only the status-change audit row should have been written; no trigger message rows.
        long auditAfter = auditLogRepo.count();
        // Exactly 1 audit row for the status change (written through AuditLogAspect on transition).
        assertThat(auditAfter - auditBefore)
            .as("sendTriggers=false must not produce trigger-dispatch audit rows")
            .isEqualTo(1);
    }

    // ----------------------------------------------------------
    // Audit row written per success only (failed orders produce no audit rows)
    // ----------------------------------------------------------

    @Test
    void auditRowWrittenOnlyForSuccessfulTransitions() throws Exception {
        loginAsOwner();
        UUID validId   = seedOrder("BK-040", OrderStatus.PRZYJETE, 0);
        UUID missingId = UUID.randomUUID();
        long auditBefore = auditLogRepo.count();

        String body = objectMapper.writeValueAsString(java.util.Map.of(
            "orderIds", List.of(validId, missingId),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)))
            .andExpect(jsonPath("$.failed", hasSize(1)));

        long auditAfter = auditLogRepo.count();
        assertThat(auditAfter - auditBefore)
            .as("Exactly 1 audit row for 1 successful transition; 0 for the NOT_FOUND failure")
            .isEqualTo(1);
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        String body = """
            {"orderIds":["%s"],"newStatus":"W_REALIZACJI","sendTriggers":false}"""
            .formatted(UUID.randomUUID());

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, int version) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now());
        return orderRepo.save(o).getId();
    }
}
```

---

- [ ] **Step 6: Run the test to verify it fails (Stage 1 RED)**

```bash
mvn -pl backend/app -B test -Dtest=BulkStatusControllerIntegrationTest
```

Expected: FAIL — 404 on the bulk endpoint.

---

- [ ] **Step 7: Create BulkStatusController**

Create `backend/app/src/main/java/com/drshoes/app/order/api/BulkStatusController.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.OrderVersionConflictException;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.*;
import com.drshoes.app.order.dto.BulkStatusResponseDto.FailedItem;
import com.drshoes.app.order.dto.BulkStatusResponseDto.SucceededItem;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * Bulk status change endpoint. Processes up to 100 orders synchronously.
 * Always returns 200 with succeeded[]/failed[] unless the request itself is malformed.
 * Audit rows fire through the existing AuditLogAspect on each successful per-order transition
 * — do NOT add @Audited on this controller method (would double-audit).
 *
 * Structured logging: op=bulkStatusChange actor={} count={} succeeded={} failed={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/orders")
public class BulkStatusController {

    private static final Logger log = LoggerFactory.getLogger(BulkStatusController.class);
    private static final int MAX_IDS = 100;

    private final OrderService orderService;
    private final OrderRepository orderRepo;

    public BulkStatusController(OrderService orderService, OrderRepository orderRepo) {
        this.orderService = orderService;
        this.orderRepo = orderRepo;
    }

    @PostMapping("/bulk/status")
    public BulkStatusResponseDto bulkStatus(@Valid @RequestBody BulkStatusRequestDto req,
                                            Authentication auth) {
        if (req.orderIds().size() > MAX_IDS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                "Bulk status accepts at most 100 order IDs per request");
        }

        List<SucceededItem> succeeded = new ArrayList<>();
        List<FailedItem> failed = new ArrayList<>();

        for (UUID orderId : req.orderIds()) {
            // Resolve current state before attempting transition (needed for fromStatus in response).
            Optional<com.drshoes.app.order.domain.Order> maybeOrder =
                orderRepo.findById(orderId).filter(o -> o.getDeletedAt() == null);

            if (maybeOrder.isEmpty()) {
                failed.add(new FailedItem(orderId, null, null, "NOT_FOUND"));
                continue;
            }

            com.drshoes.app.order.domain.Order order = maybeOrder.get();
            OrderStatus fromStatus = order.getStatus();

            try {
                ChangeStatusRequest singleReq = new ChangeStatusRequest(
                    req.newStatus(),
                    order.getVersion(),
                    req.sendTriggers()
                );
                ChangeStatusResponse resp = orderService.changeStatus(orderId, singleReq);
                succeeded.add(new SucceededItem(orderId, resp.order().code(), fromStatus, req.newStatus()));
            } catch (com.drshoes.app.order.OrderVersionConflictException e) {
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "VERSION_CONFLICT"));
            } catch (IllegalStateException e) {
                // Illegal transition thrown by status guard (if present) or OrderService
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "ILLEGAL_TRANSITION"));
            } catch (Exception e) {
                log.warn("op=bulkStatusChange orderId={} error={} outcome=unknown-failure",
                    orderId, e.getMessage());
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "UNKNOWN"));
            }
        }

        log.info("op=bulkStatusChange actor={} count={} succeeded={} failed={} outcome=ok",
            auth != null ? auth.getName() : "anonymous",
            req.orderIds().size(), succeeded.size(), failed.size());

        return new BulkStatusResponseDto(succeeded, failed);
    }
}
```

**Note on illegal-transition detection:** The current `OrderService.changeStatus` does NOT enforce
a state machine — it allows free transitions (per M1 locked decision: "free status transitions").
If no `IllegalStateException` is thrown for WYDANE→W_REALIZACJI in the current code, the mixed-result
test case for `ILLEGAL_TRANSITION` will pass with `UNKNOWN` (or even succeed). The test seeds an order
at `WYDANE` and attempts `W_REALIZACJI`; if the service allows it, the transition will succeed and
the test assertion `$.failed[?(@.error=='ILLEGAL_TRANSITION')]` will fail.

**Resolution:** Read `OrderService.changeStatus` at dispatch time (Step 1). If no guard exists, the
"illegal transition" error bucket maps to `UNKNOWN` for now (free-transition semantics). Adjust the
test assertion accordingly: if free transitions are confirmed, change the test to verify that
WYDANE→W_REALIZACJI goes to `succeeded` (not `failed`), and test the `NOT_FOUND` + `VERSION_CONFLICT`
error codes instead. Document in Findings. The error classifier code skeleton above already has an
`ILLEGAL_TRANSITION` path for when a state machine guard is added later.

---

- [ ] **Step 8: Run the test to verify it passes (Stage 1 GREEN)**

```bash
mvn -pl backend/app -B test -Dtest=BulkStatusControllerIntegrationTest
```

Expected: PASS — 8 tests run, 0 failures. If the ILLEGAL_TRANSITION test fails due to free-transition
semantics (see Step 7 note), adjust that one test case per the resolution above and re-run.

---

- [ ] **Step 9: Full suite — GREEN**

```bash
mvn -pl backend/app -B test
```

Expected: ≥ 325 tests, 0 failures, 0 errors, 0 skipped.

---

- [ ] **Step 10: Commit (Stage 1)**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/order/api/BulkStatusController.java \
  backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusRequestDto.java \
  backend/app/src/main/java/com/drshoes/app/order/dto/BulkStatusResponseDto.java \
  backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusRequest.java \
  backend/app/src/main/java/com/drshoes/app/order/OrderService.java \
  backend/app/src/test/java/com/drshoes/app/order/api/BulkStatusControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(order): bulk status change endpoint — per-order delegation + sendTriggers toggle [milestone:6][task:6-9]

POST /api/admin/orders/bulk/status accepts up to 100 order IDs; processes each through
the existing OrderService.changeStatus pipeline; returns succeeded[]/failed[] (always 200
unless malformed). sendTriggers=false skips TriggerEngine.onStatusChange per order.
ChangeStatusRequest gains sendTriggers field (default true — no behaviour change for
existing single-order callers). Audit rows fire per success through existing AuditLogAspect.

Refs: docs/dispatch-log/6-9-<UTC>.md
EOF
)"
```

---

- [ ] **Step 11: Stage 2 review**

Dispatch a review-only subagent (or pause for orchestrator review) targeting:

1. **Per-order delegation correctness** — confirm `ChangeStatusRequest` is built with `order.getVersion()` (not a hardcoded value), that `orderId` in the loop matches the repo lookup, and that the `succeeded` entry uses the post-transition `code` from the response DTO.
2. **Trigger toggle** — confirm `req.sendTriggers()` is correctly threaded into `ChangeStatusRequest`, that `OrderService.changeStatus` conditionally calls `triggerEngine.onStatusChange(...)` only when `sendTriggers=true`, and that existing single-order callers (via `ChangeStatusRequest` deserialisation default `true`) are unaffected.
3. **Audit semantics** — confirm `@Audited` is NOT on `BulkStatusController.bulkStatus`; confirm the per-order audit row fires exactly once per successful `OrderService.changeStatus` call through the existing aspect; confirm failed transitions produce no audit rows.
4. **413 path** — confirm the `MAX_IDS > 100` guard fires BEFORE the loop, not inside it.
5. **Error classification** — confirm exception types caught are correct; flag if WYDANE free-transition produces `succeeded` where the test expects `ILLEGAL_TRANSITION` and advise adjusting the test (not adding a state machine guard — that is out of M6 scope).

If Stage 2 issues found, address inline (no new task ID needed for 2-line fixups per dispatch protocol rule 5) and recommit with:

```bash
git commit -m "$(cat <<'EOF'
fix(order): 6-9 Stage 2 review fixup — <short description> [milestone:6][task:6-9]

Refs: docs/dispatch-log/6-9-<UTC>.md
EOF
)"
```
## Wave 2 — Dashboard frontend

> **Design-export gate:** Tasks 6-10 and 6-11 may be dispatched immediately.
> Task 6-12 is **BLOCKED** until `handoff/design/m6-dashboard-states.html` exists
> on disk. Before dispatching 6-12, verify the file is present; stop and ask the
> orchestrator if it is missing.

---

### Task 6-10: `lib/dashboard/api-server.ts` + `types.ts`

**Files:**
- Create: `apps/web/lib/dashboard/types.ts`
- Create: `apps/web/lib/dashboard/api-server.ts`
- Create: `apps/web/lib/dashboard/api-server.test.ts`

**Design source:** N/A (pure TS lib, no UI).

**Review:** combined single-stage.

---

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/dashboard/api-server.test.ts`:

```ts
/**
 * Unit tests for lib/dashboard/api-server.ts.
 * Uses vi.stubGlobal to inject a fake `fetch`; does NOT hit the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- helpers -----------------------------------------------------------

function makeResp(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// --- stubs -------------------------------------------------------------

// next/headers cookies() stub — must resolve before importing the module under test
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "dr_session", value: "test-token" }],
    }),
}));

// INTERNAL_API_BASE
const originalEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => {
  process.env["INTERNAL_API_BASE"] = "http://backend-test:8080";
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = originalEnv;
  vi.restoreAllMocks();
});

// --- tests -------------------------------------------------------------

describe("getDashboardKpisServer", () => {
  it("returns parsed DashboardKpiDto on 200", async () => {
    const payload = {
      inProgressCount: 14,
      readyForPickupCount: 6,
      todayIntakeCount: 3,
      monthRevenueCents: 1824000,
      monthRevenueFormatted: "18 240 zł",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));

    const { getDashboardKpisServer } = await import("./api-server");
    const result = await getDashboardKpisServer();

    expect(result.inProgressCount).toBe(14);
    expect(result.monthRevenueFormatted).toBe("18 240 zł");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend-test:8080/api/admin/dashboard/kpis",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws on 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 403)));
    const { getDashboardKpisServer } = await import("./api-server");
    await expect(getDashboardKpisServer()).rejects.toThrow("dashboard/kpis failed: 403");
  });

  it("throws on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 500)));
    const { getDashboardKpisServer } = await import("./api-server");
    await expect(getDashboardKpisServer()).rejects.toThrow("dashboard/kpis failed: 500");
  });
});

describe("getDashboardChartsServer", () => {
  it("returns parsed DashboardChartsDto on 200", async () => {
    const payload = {
      ordersPerWeek: [
        { weekIso: "2026-W10", repairs: 12, custom: 8 },
        { weekIso: "2026-W11", repairs: 14, custom: 6 },
      ],
      mixByType: [
        { kind: "NAPRAWA", count: 19, percent: 45 },
        { kind: "CUSTOM_BUTY", count: 14, percent: 33 },
        { kind: "CUSTOM_KURTKA", count: 9, percent: 22 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));

    const { getDashboardChartsServer } = await import("./api-server");
    const result = await getDashboardChartsServer();

    expect(result.ordersPerWeek).toHaveLength(2);
    expect(result.ordersPerWeek[0].weekIso).toBe("2026-W10");
    expect(result.mixByType[0].kind).toBe("NAPRAWA");
  });

  it("throws on 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 401)));
    const { getDashboardChartsServer } = await import("./api-server");
    await expect(getDashboardChartsServer()).rejects.toThrow("dashboard/charts failed: 401");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -C apps/web test lib/dashboard/api-server.test.ts
```

Expected: FAIL — `Cannot find module './api-server'`.

- [ ] **Step 3: Define the types**

Create `apps/web/lib/dashboard/types.ts`:

```ts
/**
 * TypeScript mirrors of backend dashboard DTO records.
 * Source of truth: DashboardKpiDto.java + DashboardChartsDto.java (W1, task 6-5 + 6-6).
 */

/** GET /api/admin/dashboard/kpis — mirrors DashboardKpiDto.java */
export interface DashboardKpiDto {
  inProgressCount: number;
  readyForPickupCount: number;
  todayIntakeCount: number;
  /** Raw cents — present for potential future client-side formatting. */
  monthRevenueCents: number;
  /** Backend-formatted PLN string, e.g. "18 240 zł". Never format on the FE. */
  monthRevenueFormatted: string;
}

/** One row in the orders-per-week stacked bar. Mirrors OrdersPerWeekRowDto.java */
export interface OrdersPerWeekRowDto {
  /** ISO week string, e.g. "2026-W11". */
  weekIso: string;
  repairs: number;
  custom: number;
}

/** One slice in the mix donut. Mirrors MixByTypeRowDto.java */
export interface MixByTypeRowDto {
  kind: "NAPRAWA" | "CUSTOM_BUTY" | "CUSTOM_KURTKA";
  count: number;
  /** Integer percentage 0-100, backend-computed. */
  percent: number;
}

/** GET /api/admin/dashboard/charts — mirrors DashboardChartsDto.java */
export interface DashboardChartsDto {
  /** Last 8 ISO weeks ending current, ascending. Length 0-8. */
  ordersPerWeek: OrdersPerWeekRowDto[];
  mixByType: MixByTypeRowDto[];
}
```

- [ ] **Step 4: Implement the fetchers**

Create `apps/web/lib/dashboard/api-server.ts`:

```ts
/**
 * Server-only: typed fetchers for Dashboard KPI and Chart endpoints.
 * Mirrors the pattern in lib/orders/api-server.ts and lib/messaging/api-server.ts.
 * Uses INTERNAL_API_BASE; forwards the request session cookie.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { DashboardKpiDto, DashboardChartsDto } from "./types";

const log = createLogger("dashboard.api-server");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

function base(): string {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}

async function serverGet<T>(path: string, label: string): Promise<T> {
  const resp = await fetch(`${base()}${path}`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.error(`op=${label} outcome=error`, { status: resp.status });
    throw new Error(`${label} failed: ${resp.status}`);
  }
  return (await resp.json()) as T;
}

export async function getDashboardKpisServer(): Promise<DashboardKpiDto> {
  log.info("op=getDashboardKpisServer");
  return serverGet<DashboardKpiDto>("/api/admin/dashboard/kpis", "dashboard/kpis");
}

export async function getDashboardChartsServer(): Promise<DashboardChartsDto> {
  log.info("op=getDashboardChartsServer");
  return serverGet<DashboardChartsDto>("/api/admin/dashboard/charts", "dashboard/charts");
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm -C apps/web test lib/dashboard/api-server.test.ts
```

Expected: PASS — 5 tests passing, 0 failing.

- [ ] **Step 6: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/dashboard
git commit -m "$(cat <<'EOF'
feat(dashboard): server-side fetchers + TS types for KPI + chart endpoints

[milestone:6][task:6-10]

DashboardKpiDto, DashboardChartsDto, OrdersPerWeekRowDto, MixByTypeRowDto.
getDashboardKpisServer + getDashboardChartsServer follow the lib/messaging/api-server
pattern: cookies() forwarded, no-store cache, structured error logging.
5 vitest cases (happy path + 4xx/5xx throws) passing.

Refs: docs/dispatch-log/6-10-<UTC>.md
EOF
)"
```

**Acceptance:**
- `apps/web/lib/dashboard/types.ts` defines four interfaces matching 6-5/6-6 DTO records.
- `apps/web/lib/dashboard/api-server.ts` ≤ 45 LOC; exports `getDashboardKpisServer` and `getDashboardChartsServer`.
- 5 vitest cases GREEN.
- `pnpm typecheck` clean.

---

### Task 6-11: `KpiTilesRow` + `OrdersWeekChart` + `MixDonut`

**Files:**
- Create: `apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx`
- Create: `apps/web/app/(admin)/admin/_components/OrdersWeekChart.tsx`
- Create: `apps/web/app/(admin)/admin/_components/MixDonut.tsx`
- Create: `apps/web/app/(admin)/admin/_components/__tests__/KpiTilesRow.test.tsx`
- Create: `apps/web/app/(admin)/admin/_components/__tests__/OrdersWeekChart.test.tsx`
- Create: `apps/web/app/(admin)/admin/_components/__tests__/MixDonut.test.tsx`

**Design source:** `admin.jsx:86-148` — tile grid + stacked bar SVG + donut SVG already exist in the design file. No fresh export needed for the layout; skeletons/empty/error states ship with 6-12.

**Review:** combined single-stage.

---

- [ ] **Step 1: Write the failing component tests**

Create `apps/web/app/(admin)/admin/_components/__tests__/KpiTilesRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KpiTilesRow } from "../KpiTilesRow";
import type { DashboardKpiDto } from "@/lib/dashboard/types";

const kpis: DashboardKpiDto = {
  inProgressCount: 14,
  readyForPickupCount: 6,
  todayIntakeCount: 9,
  monthRevenueCents: 1824000,
  monthRevenueFormatted: "18 240 zł",
};

describe("KpiTilesRow", () => {
  it("renders all four tile labels", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("W realizacji")).toBeInTheDocument();
    expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
    expect(screen.getByText("Nowe rezerwacje (7d)")).toBeInTheDocument();
    expect(screen.getByText(/Przychód/)).toBeInTheDocument();
  });

  it("renders numeric values", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("18 240 zł")).toBeInTheDocument();
  });

  it("has data-testid attributes for each tile", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-ready")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-intake")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-revenue")).toBeInTheDocument();
  });
});
```

Create `apps/web/app/(admin)/admin/_components/__tests__/OrdersWeekChart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrdersWeekChart } from "../OrdersWeekChart";
import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";

const rows: OrdersPerWeekRowDto[] = [
  { weekIso: "2026-W10", repairs: 12, custom: 8 },
  { weekIso: "2026-W11", repairs: 14, custom: 6 },
  { weekIso: "2026-W12", repairs: 9, custom: 11 },
  { weekIso: "2026-W13", repairs: 16, custom: 10 },
  { weekIso: "2026-W14", repairs: 11, custom: 14 },
  { weekIso: "2026-W15", repairs: 18, custom: 9 },
  { weekIso: "2026-W16", repairs: 22, custom: 12 },
  { weekIso: "2026-W17", repairs: 19, custom: 16 },
];

describe("OrdersWeekChart", () => {
  it("renders chart heading", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
  });

  it("renders legend labels", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("naprawy")).toBeInTheDocument();
    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<OrdersWeekChart rows={rows} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a bar for each row", () => {
    const { container } = render(<OrdersWeekChart rows={rows} />);
    // Each week produces 2 <rect> elements (repairs + custom)
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(rows.length * 2);
  });

  it("handles empty rows gracefully", () => {
    render(<OrdersWeekChart rows={[]} />);
    expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
  });
});
```

Create `apps/web/app/(admin)/admin/_components/__tests__/MixDonut.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MixDonut } from "../MixDonut";
import type { MixByTypeRowDto } from "@/lib/dashboard/types";

const mix: MixByTypeRowDto[] = [
  { kind: "NAPRAWA", count: 19, percent: 45 },
  { kind: "CUSTOM_BUTY", count: 14, percent: 33 },
  { kind: "CUSTOM_KURTKA", count: 9, percent: 22 },
];

describe("MixDonut", () => {
  it("renders heading", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
  });

  it("renders legend labels in Polish", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Naprawy")).toBeInTheDocument();
    expect(screen.getByText("Custom buty")).toBeInTheDocument();
    expect(screen.getByText("Custom kurtki")).toBeInTheDocument();
  });

  it("renders total active count in SVG center", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<MixDonut mix={mix} totalActive={42} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders zero state without crashing", () => {
    render(<MixDonut mix={[]} totalActive={0} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__"
```

Expected: FAIL — cannot find modules `../KpiTilesRow`, `../OrdersWeekChart`, `../MixDonut`.

- [ ] **Step 3: Implement `KpiTilesRow`**

Create `apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx`:

```tsx
/**
 * Four KPI stat tiles — top row of the Dashboard.
 * Layout: admin.jsx:86-91. Pure server component (no client state).
 * ~60 LOC.
 */
import type { DashboardKpiDto } from "@/lib/dashboard/types";

interface TileProps {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  testId: string;
}

function StatTile({ label, value, sub, accent, testId }: TileProps) {
  return (
    <div
      data-testid={testId}
      className="admin-card p-5 flex flex-col gap-2"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="t-mono text-[11px] uppercase text-admin-mute leading-none">
        {label}
      </div>
      <div className="font-display text-[2.25rem] leading-none">{value}</div>
      <div className="t-mono text-[11px] text-admin-mute">{sub}</div>
    </div>
  );
}

interface Props {
  kpis: DashboardKpiDto;
}

export function KpiTilesRow({ kpis }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[18px]">
      <StatTile
        testId="kpi-tile-in-progress"
        label="W realizacji"
        value={kpis.inProgressCount}
        sub="zlecenia aktywne"
        accent="var(--acid)"
      />
      <StatTile
        testId="kpi-tile-ready"
        label="Gotowe do odbioru"
        value={kpis.readyForPickupCount}
        sub="czekają na klienta"
        accent="var(--pink)"
      />
      <StatTile
        testId="kpi-tile-intake"
        label="Nowe rezerwacje (7d)"
        value={kpis.todayIntakeCount}
        sub="ostatnie 7 dni"
        accent="var(--blue)"
      />
      <StatTile
        testId="kpi-tile-revenue"
        label={`Przychód · ${new Date().toLocaleString("pl-PL", { month: "long" })}`}
        value={kpis.monthRevenueFormatted}
        sub="ten miesiąc"
        accent="var(--acid)"
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement `OrdersWeekChart`**

Create `apps/web/app/(admin)/admin/_components/OrdersWeekChart.tsx`:

```tsx
/**
 * Stacked bar chart — orders per week for last 8 ISO weeks.
 * SVG adapted directly from admin.jsx:108-127.
 * Pure server component.
 * ~75 LOC.
 */
import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";

interface Props {
  rows: OrdersPerWeekRowDto[];
}

const VIEW_H = 220;
const BAR_BOTTOM = 190;
const SCALE = 7; // pixels per unit

export function OrdersWeekChart({ rows }: Props) {
  return (
    <div className="admin-card p-[22px]">
      <div className="flex justify-between items-start mb-[18px]">
        <div>
          <div className="t-display text-[22px]">Zlecenia / tydzień</div>
          <div className="t-mono text-[11px] text-admin-mute">ostatnie 8 tygodni</div>
        </div>
      </div>

      <svg viewBox={`0 0 720 ${VIEW_H}`} style={{ width: "100%", height: VIEW_H }}>
        <g stroke="rgba(0,0,0,0.08)">
          <line x1="0" y1="40" x2="720" y2="40" />
          <line x1="0" y1="90" x2="720" y2="90" />
          <line x1="0" y1="140" x2="720" y2="140" />
          <line x1="0" y1="190" x2="720" y2="190" />
        </g>
        {rows.map((row, i) => {
          const x = 30 + i * 86;
          const repairTop = BAR_BOTTOM - row.repairs * SCALE;
          const customTop = repairTop - row.custom * SCALE;
          const label = row.weekIso.replace(/^\d{4}-/, ""); // "W11"
          return (
            <g key={row.weekIso}>
              <rect x={x} y={repairTop} width="40" height={BAR_BOTTOM - repairTop} fill="var(--ink)" />
              <rect x={x} y={customTop} width="40" height={repairTop - customTop} fill="var(--acid)" stroke="var(--ink)" />
              <text x={x + 20} y="210" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(0,0,0,0.5)">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex gap-4 mt-2">
        <span className="t-mono text-[11px] inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 bg-[var(--ink)]" /> naprawy
        </span>
        <span className="t-mono text-[11px] inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 bg-[var(--acid)] border border-[var(--ink)]" /> custom
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `MixDonut`**

Create `apps/web/app/(admin)/admin/_components/MixDonut.tsx`:

```tsx
/**
 * Donut chart — current order type mix.
 * SVG adapted directly from admin.jsx:136-148.
 * Pure server component.
 * ~80 LOC.
 */
import type { MixByTypeRowDto } from "@/lib/dashboard/types";

const KIND_LABELS: Record<string, string> = {
  NAPRAWA: "Naprawy",
  CUSTOM_BUTY: "Custom buty",
  CUSTOM_KURTKA: "Custom kurtki",
};

const KIND_COLORS: Record<string, string> = {
  NAPRAWA: "var(--acid)",
  CUSTOM_BUTY: "var(--pink)",
  CUSTOM_KURTKA: "var(--blue)",
};

// Donut geometry: r=78, cx=cy=100, circumference≈490
const CIRC = 490;
const R = 78;
const CX = 100;
const CY = 100;
const STROKE_W = 34;

interface Props {
  mix: MixByTypeRowDto[];
  totalActive: number;
}

export function MixDonut({ mix, totalActive }: Props) {
  // Build cumulative rotation offsets for each arc
  let rotationDeg = -90;
  const arcs = mix.map((row) => {
    const dashLen = (row.percent / 100) * CIRC;
    const arc = { row, dashLen, rotation: rotationDeg };
    rotationDeg += (row.percent / 100) * 360;
    return arc;
  });

  return (
    <div className="admin-card p-[22px]">
      <div className="t-display text-[22px] mb-[14px]">Mix zleceń</div>
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: 180 }}>
        {/* track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--paper-2)" strokeWidth={STROKE_W} />
        {arcs.map(({ row, dashLen, rotation }) => (
          <circle
            key={row.kind}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={KIND_COLORS[row.kind] ?? "var(--ink)"}
            strokeWidth={STROKE_W}
            strokeDasharray={`${dashLen} ${CIRC}`}
            transform={`rotate(${rotation} ${CX} ${CY})`}
          />
        ))}
        <text x={CX} y={98} textAnchor="middle" fontFamily="Anton" fontSize="34" fill="var(--ink)">
          {totalActive}
        </text>
        <text x={CX} y={118} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(0,0,0,0.55)">
          aktywne
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 mt-1.5">
        {mix.map((row) => (
          <div key={row.kind} className="flex items-center gap-2 t-mono text-[11px]">
            <span
              className="inline-block w-2.5 h-2.5 shrink-0"
              style={{ background: KIND_COLORS[row.kind] }}
            />
            <span className="flex-1">{KIND_LABELS[row.kind] ?? row.kind}</span>
            <span className="text-admin-mute">{row.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__"
```

Expected: PASS — 14 tests across 3 files, 0 failing.

- [ ] **Step 7: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(admin)/admin/_components"
git commit -m "$(cat <<'EOF'
feat(dashboard): KpiTilesRow + OrdersWeekChart + MixDonut components

[milestone:6][task:6-11]

Three presentational server components adapted from admin.jsx:86-148.
KpiTilesRow: 4-tile grid with data-testid attrs per tile.
OrdersWeekChart: SVG stacked bar (repairs=ink, custom=acid), 8-week window.
MixDonut: SVG donut with arc-per-kind rotation, totalActive center label.
14 vitest cases green (render, prop wiring, SVG presence, zero-state).
pnpm typecheck clean.

Refs: docs/dispatch-log/6-11-<UTC>.md
EOF
)"
```

**Acceptance:**
- `KpiTilesRow` renders 4 tiles; each tile has `data-testid="kpi-tile-{in-progress|ready|intake|revenue}"`.
- `OrdersWeekChart` renders one SVG with `rows.length * 2` `<rect>` elements; renders legends "naprawy" + "custom".
- `MixDonut` renders one SVG; `totalActive` displayed in center; legend labels in Polish.
- 14 vitest cases GREEN.
- No `"use client"` directive on any of the three files.
- `pnpm typecheck` clean.

---

### Task 6-12: `ReadyForPickupPanel` + `RecentMessagesPanel` + Dashboard page wiring + states

> **BLOCK if `handoff/design/m6-dashboard-states.html` is missing — ask orchestrator before proceeding.**

**Files:**
- Possibly create: `apps/web/components/state/Skeleton.tsx` (≤ 80 LOC) — **READ `apps/web/components/` first; create only if missing.**
- Possibly create: `apps/web/components/state/EmptyState.tsx` (≤ 80 LOC) — same rule.
- Possibly create: `apps/web/components/state/ErrorBanner.tsx` (≤ 80 LOC) — same rule.
- Create: `apps/web/app/(admin)/admin/_components/ReadyForPickupPanel.tsx`
- Create: `apps/web/app/(admin)/admin/_components/RecentMessagesPanel.tsx`
- Create: `apps/web/app/(admin)/admin/_components/__tests__/ReadyForPickupPanel.test.tsx`
- Create: `apps/web/app/(admin)/admin/_components/__tests__/RecentMessagesPanel.test.tsx`
- OVERWRITE: `apps/web/app/(admin)/admin/page.tsx`

**Design source:**
- Panel layouts: `admin.jsx:154-174` (Gotowe do odbioru) + `admin.jsx:176-200` (Ostatnie wiadomości).
- Skeletons / empty states / error banners: `handoff/design/m6-dashboard-states.html` (owner-supplied — MUST exist on disk before dispatch).

**Review:** combined single-stage.

---

- [ ] **Step 1: Inventory shared state primitives**

Before writing any component, check whether these files already exist:

```bash
ls apps/web/components/state/ 2>/dev/null || echo "state dir missing"
```

For each missing file among `Skeleton.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx`, create it in Step 2 below. If all three already exist, skip Step 2.

- [ ] **Step 2: Create missing state primitives**

> Create only what is confirmed absent in Step 1. Read `handoff/design/m6-dashboard-states.html` for the exact skeleton/empty/error visual treatment before writing these components.

`apps/web/components/state/Skeleton.tsx` (create if absent):

```tsx
/**
 * Generic shimmer skeleton placeholder.
 * Design source: handoff/design/m6-dashboard-states.html
 * ~28 LOC.
 */
interface Props {
  className?: string;
  /** Tailwind height class, e.g. "h-6". Defaults to "h-4". */
  height?: string;
  /** Number of stacked rows. Defaults to 1. */
  rows?: number;
}

export function Skeleton({ className = "", height = "h-4", rows = 1 }: Props) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${height} w-full rounded bg-admin-line animate-pulse`}
        />
      ))}
    </div>
  );
}
```

`apps/web/components/state/EmptyState.tsx` (create if absent):

```tsx
/**
 * Inline empty state — centered text + optional sub-label.
 * Design source: handoff/design/m6-dashboard-states.html
 * ~30 LOC.
 */
interface Props {
  message: string;
  sub?: string;
  className?: string;
}

export function EmptyState({ message, sub, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 py-8 ${className}`}>
      <span className="t-mono text-[13px] text-admin-mute">{message}</span>
      {sub && (
        <span className="t-mono text-[11px] text-admin-mute opacity-70">{sub}</span>
      )}
    </div>
  );
}
```

`apps/web/components/state/ErrorBanner.tsx` (create if absent):

```tsx
/**
 * Inline error banner with optional refresh link.
 * Design source: handoff/design/m6-dashboard-states.html
 * ~35 LOC.
 */
"use client";

interface Props {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  message = "Wystąpił błąd podczas ładowania danych.",
  onRetry,
  className = "",
}: Props) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-md border border-red-200 bg-red-50 text-red-800 ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="flex-1 text-[13px]">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="t-mono text-[12px] underline underline-offset-2">
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write failing panel tests**

Create `apps/web/app/(admin)/admin/_components/__tests__/ReadyForPickupPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the server-side orders list fetcher
vi.mock("@/lib/orders/api-server", () => ({
  listOrdersServer: vi.fn(),
}));

import { listOrdersServer } from "@/lib/orders/api-server";
import { ReadyForPickupPanel } from "../ReadyForPickupPanel";
import type { OrderListRow } from "@/lib/orders/types";

const mockListOrders = listOrdersServer as ReturnType<typeof vi.fn>;

const ROWS: OrderListRow[] = [
  {
    id: "ord-1",
    code: "DR-0042",
    clientId: "cli-1",
    status: "GOTOWE_DO_ODBIORU",
    totalPriceCents: 15000,
    currency: "PLN",
    description: "Naprawa podeszwy",
    plannedPickupAt: null,
    version: 1,
    updatedAt: "2026-05-10T10:00:00Z",
  },
];

describe("ReadyForPickupPanel", () => {
  it("renders heading", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await ReadyForPickupPanel({}));
    expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
  });

  it("renders order code and description", async () => {
    mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await ReadyForPickupPanel({}));
    expect(screen.getByText("DR-0042")).toBeInTheDocument();
    expect(screen.getByText("Naprawa podeszwy")).toBeInTheDocument();
  });

  it("renders empty state when no orders", async () => {
    mockListOrders.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 4 });
    render(await ReadyForPickupPanel({}));
    expect(screen.getByText("Nic gotowego")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockListOrders.mockRejectedValueOnce(new Error("network error"));
    render(await ReadyForPickupPanel({}));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

Create `apps/web/app/(admin)/admin/_components/__tests__/RecentMessagesPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/messaging/api-server", () => ({
  listThreadsServer: vi.fn(),
}));

import { listThreadsServer } from "@/lib/messaging/api-server";
import { RecentMessagesPanel } from "../RecentMessagesPanel";
import type { MessageThreadDto } from "@/lib/messaging/types";

const mockListThreads = listThreadsServer as ReturnType<typeof vi.fn>;

const THREADS: MessageThreadDto[] = [
  {
    id: "thr-1",
    clientId: "cli-1",
    rawSender: null,
    channel: "WHATSAPP",
    subject: null,
    lastMessageAt: "2026-05-10T09:46:00Z",
    unreadCount: 1,
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-10T09:46:00Z",
    lastMessagePreview: "Hej, kiedy mogę odebrać moje 1460?",
    unmatched: false,
    clientName: "Magdalena K.",
    clientEmail: null,
    clientPhone: null,
    discardedAt: null,
  },
];

describe("RecentMessagesPanel", () => {
  it("renders heading", async () => {
    mockListThreads.mockResolvedValueOnce({ content: THREADS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await RecentMessagesPanel({}));
    expect(screen.getByText("Ostatnie wiadomości")).toBeInTheDocument();
  });

  it("renders client name and message preview", async () => {
    mockListThreads.mockResolvedValueOnce({ content: THREADS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    render(await RecentMessagesPanel({}));
    expect(screen.getByText("Magdalena K.")).toBeInTheDocument();
    expect(screen.getByText("Hej, kiedy mogę odebrać moje 1460?")).toBeInTheDocument();
  });

  it("renders unread badge for unread threads", async () => {
    mockListThreads.mockResolvedValueOnce({ content: THREADS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
    const { container } = render(await RecentMessagesPanel({}));
    expect(container.querySelector("[data-testid='unread-dot']")).not.toBeNull();
  });

  it("renders empty state when no threads", async () => {
    mockListThreads.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 4 });
    render(await RecentMessagesPanel({}));
    expect(screen.getByText("Brak nowych wiadomości")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockListThreads.mockRejectedValueOnce(new Error("network error"));
    render(await RecentMessagesPanel({}));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__/ReadyForPickupPanel"
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__/RecentMessagesPanel"
```

Expected: FAIL — modules `../ReadyForPickupPanel` and `../RecentMessagesPanel` not found.
Also confirm `listThreadsServer` is NOT yet exported from `@/lib/messaging/api-server`.
If missing, note it and add in Step 5.

- [ ] **Step 5: Add `listThreadsServer` to messaging api-server (if absent)**

Check `apps/web/lib/messaging/api-server.ts`. If `listThreadsServer` is not exported,
add the following at the end of the file:

```ts
export async function listThreadsServer(
  page = 0,
  size = 4,
): Promise<import("@/lib/clients/types").Page<import("./types").MessageThreadDto>> {
  log.info("op=listThreadsServer", { page, size });
  return serverGet<import("@/lib/clients/types").Page<import("./types").MessageThreadDto>>(
    `/api/admin/messages/threads?page=${page}&size=${size}`,
    "listThreadsServer",
  );
}
```

Also verify that `apps/web/lib/clients/types.ts` exports a `Page<T>` generic. If not, check
`apps/web/lib/orders/types.ts` for the re-export (`export type { Page }`) and use the same source.

- [ ] **Step 6: Implement `ReadyForPickupPanel`**

Create `apps/web/app/(admin)/admin/_components/ReadyForPickupPanel.tsx`:

```tsx
/**
 * Dashboard lower-left panel: top-4 orders with status GOTOWE_DO_ODBIORU.
 * Layout: admin.jsx:154-174.
 * Skeletons/empty/error: handoff/design/m6-dashboard-states.html.
 * Server component with inline try/catch error isolation.
 * ~90 LOC.
 */
import Link from "next/link";
import { listOrdersServer } from "@/lib/orders/api-server";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorBanner } from "@/components/state/ErrorBanner";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

export async function ReadyForPickupPanel(_props: Props) {
  let orders;
  let fetchError = false;

  try {
    const page = await listOrdersServer({ status: "GOTOWE_DO_ODBIORU" }, 0, 4);
    orders = page.content;
  } catch {
    fetchError = true;
  }

  return (
    <div className="admin-card p-[22px]">
      <div className="flex justify-between items-center mb-[14px]">
        <div className="t-display text-[22px]">Gotowe do odbioru</div>
        {!fetchError && orders && orders.length > 0 && (
          <span className="t-mono text-[11px] bg-[var(--pink)] text-[var(--ink)] px-2 py-0.5">
            {orders.length} czeka
          </span>
        )}
      </div>

      {fetchError && (
        <ErrorBanner message="Nie udało się załadować zleceń." />
      )}

      {!fetchError && orders?.length === 0 && (
        <EmptyState message="Nic gotowego" sub="Brak zleceń gotowych do odbioru" />
      )}

      {!fetchError && orders && orders.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 p-2.5 border border-[var(--line)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="t-mono text-[11px] text-admin-mute">{o.code}</span>
                </div>
                <div className="t-mono text-[11px] text-admin-mute mt-0.5 truncate">
                  {o.description ?? "—"}
                </div>
              </div>
              <Link
                href={`/admin/orders?orderId=${o.id}`}
                className="btn-clean text-[11px] px-2 py-1"
              >
                otwórz
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Implement `RecentMessagesPanel`**

Create `apps/web/app/(admin)/admin/_components/RecentMessagesPanel.tsx`:

```tsx
/**
 * Dashboard lower-middle panel: top-4 most recent message threads.
 * Layout: admin.jsx:176-200.
 * Skeletons/empty/error: handoff/design/m6-dashboard-states.html.
 * Server component with inline try/catch error isolation.
 * ~90 LOC.
 */
import Link from "next/link";
import { listThreadsServer } from "@/lib/messaging/api-server";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorBanner } from "@/components/state/ErrorBanner";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

export async function RecentMessagesPanel(_props: Props) {
  let threads;
  let fetchError = false;

  try {
    const page = await listThreadsServer(0, 4);
    threads = page.content;
  } catch {
    fetchError = true;
  }

  return (
    <div className="admin-card p-[22px]">
      <div className="t-display text-[22px] mb-[14px]">Ostatnie wiadomości</div>

      {fetchError && (
        <ErrorBanner message="Nie udało się załadować wiadomości." />
      )}

      {!fetchError && threads?.length === 0 && (
        <EmptyState message="Brak nowych wiadomości" />
      )}

      {!fetchError && threads && threads.length > 0 && (
        <div className="flex flex-col gap-3">
          {threads.map((t) => {
            const initials = t.clientName ? t.clientName[0] : "?";
            return (
              <Link
                key={t.id}
                href={`/admin/messages?thread=${t.id}`}
                className="flex gap-2.5 items-start hover:bg-[var(--paper-2)] transition-colors rounded-sm"
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--paper-2)] border-[1.5px] border-[var(--ink)] flex items-center justify-center text-[11px] font-mono font-bold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold">{t.clientName ?? t.rawSender ?? "—"}</span>
                    <span className="t-mono text-[10px] text-admin-mute shrink-0 ml-2">
                      {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <div className="text-[12px] text-admin-mute truncate">{t.lastMessagePreview ?? ""}</div>
                  <div className="t-mono text-[10px] text-admin-mute mt-0.5">{t.channel}</div>
                </div>
                {t.unreadCount > 0 && (
                  <span
                    data-testid="unread-dot"
                    className="shrink-0 w-2 h-2 rounded-full bg-[var(--pink)] mt-3"
                    aria-label="nieprzeczytane"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run panel tests to verify they pass**

```bash
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__/ReadyForPickupPanel"
pnpm -C apps/web test "app/\(admin\)/admin/_components/__tests__/RecentMessagesPanel"
```

Expected: PASS — 4 + 5 = 9 tests, 0 failing.

- [ ] **Step 9: Overwrite the Dashboard page**

Overwrite `apps/web/app/(admin)/admin/page.tsx`:

```tsx
/**
 * /admin — live Dashboard page.
 * Wires five components: KpiTilesRow + OrdersWeekChart + MixDonut (upper row)
 * + ReadyForPickupPanel + RecentMessagesPanel (lower row).
 * Each data section is independently try/catch isolated in its component;
 * one failing tile/panel does not blank the whole dashboard.
 * Server component — Suspense boundaries provide loading skeletons.
 * Skeleton design source: handoff/design/m6-dashboard-states.html.
 * ~60 LOC.
 */
import { Suspense } from "react";
import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
import { KpiTilesRow } from "./_components/KpiTilesRow";
import { OrdersWeekChart } from "./_components/OrdersWeekChart";
import { MixDonut } from "./_components/MixDonut";
import { ReadyForPickupPanel } from "./_components/ReadyForPickupPanel";
import { RecentMessagesPanel } from "./_components/RecentMessagesPanel";
import { Skeleton } from "@/components/state/Skeleton";
import { ErrorBanner } from "@/components/state/ErrorBanner";

async function KpiSection() {
  let kpis;
  try {
    kpis = await getDashboardKpisServer();
  } catch {
    return <ErrorBanner message="Nie udało się załadować KPI." />;
  }
  return <KpiTilesRow kpis={kpis} />;
}

async function ChartsSection() {
  let charts;
  try {
    charts = await getDashboardChartsServer();
  } catch {
    return <ErrorBanner message="Nie udało się załadować wykresów." />;
  }
  const total = charts.mixByType.reduce((s, r) => s + r.count, 0);
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-5">
      <OrdersWeekChart rows={charts.ordersPerWeek} />
      <MixDonut mix={charts.mixByType} totalActive={total} />
    </div>
  );
}

export default async function AdminPage() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <Suspense fallback={<Skeleton height="h-24" />}>
        <KpiSection />
      </Suspense>

      <Suspense fallback={<Skeleton height="h-52" />}>
        <ChartsSection />
      </Suspense>

      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        <Suspense fallback={<Skeleton height="h-48" rows={3} />}>
          <ReadyForPickupPanel />
        </Suspense>
        <Suspense fallback={<Skeleton height="h-48" rows={4} />}>
          <RecentMessagesPanel />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Full test run**

```bash
pnpm -C apps/web test
```

Expected: all previously passing tests still pass; new panel tests pass; 0 failing.

- [ ] **Step 11: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: clean.

- [ ] **Step 12: Build check**

```bash
pnpm -C apps/web build
```

Expected: clean build, no TS or module resolution errors.

- [ ] **Step 13: Commit**

Collect all files modified or created in this task:

```bash
git add \
  apps/web/components/state \
  "apps/web/app/(admin)/admin/_components/ReadyForPickupPanel.tsx" \
  "apps/web/app/(admin)/admin/_components/RecentMessagesPanel.tsx" \
  "apps/web/app/(admin)/admin/_components/__tests__/ReadyForPickupPanel.test.tsx" \
  "apps/web/app/(admin)/admin/_components/__tests__/RecentMessagesPanel.test.tsx" \
  "apps/web/app/(admin)/admin/page.tsx" \
  apps/web/lib/messaging/api-server.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): ReadyForPickupPanel + RecentMessagesPanel + full page wiring

[milestone:6][task:6-12]

Shared state primitives: Skeleton, EmptyState, ErrorBanner under
apps/web/components/state/ (created if absent).
ReadyForPickupPanel: top-4 GOTOWE_DO_ODBIORU orders from existing list
endpoint; empty state "Nic gotowego"; inline error isolation.
RecentMessagesPanel: top-4 threads from messaging api-server (added
listThreadsServer if absent); unread dot; empty state "Brak nowych wiadomości".
Dashboard page.tsx overwritten: 5-component wiring with Suspense + per-section
ErrorBanner fallback; one failing section does not blank the whole dashboard.
9 vitest cases green. pnpm typecheck + build clean.

Refs: docs/dispatch-log/6-12-<UTC>.md
EOF
)"
```

**Acceptance:**
- `apps/web/components/state/{Skeleton,EmptyState,ErrorBanner}.tsx` exist (created or pre-existing).
- `ReadyForPickupPanel` fetches `?status=GOTOWE_DO_ODBIORU&size=4`; renders up to 4 order rows; renders `EmptyState` "Nic gotowego" when list empty; renders `ErrorBanner` on fetch failure.
- `RecentMessagesPanel` fetches `?size=4` from thread list endpoint; renders up to 4 thread rows with unread dot when `unreadCount > 0`; renders `EmptyState` "Brak nowych wiadomości" when empty; renders `ErrorBanner` on fetch failure.
- Dashboard `page.tsx` wires all 5 components; each wrapped in `Suspense`; page-level error does not cascade across sections.
- 9 panel vitest cases GREEN (4 ReadyForPickup + 5 RecentMessages).
- `pnpm typecheck` clean. `pnpm build` clean.
## Wave 3 — Calendar frontend

> **Gate:** Wave 3 is blocked until `handoff/design/m6-calendar-states.html` exists on disk. Verify before dispatching 6-16.
>
> Month grid layout + Bez-terminu panel + view-tabs strip are already in `admin.jsx`; only loading/empty/error states require the export. Tasks 6-13, 6-14, 6-15 do NOT need the export and can be dispatched immediately after Wave 2 closes.

---

### Task 6-13: `lib/calendar/types.ts` + `lib/calendar/api-server.ts` + `OrderViewTabs`

**Files:**
- Create: `apps/web/lib/calendar/types.ts`
- Create: `apps/web/lib/calendar/api-server.ts`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderViewTabs.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx`
- Create: `apps/web/lib/calendar/api-server.test.ts`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderViewTabs.test.tsx`

**Design source:** `admin.jsx:511-520` for `OrderViewTabs`; no UI for `api-server`.

**Review:** combined single-stage.

---

- [ ] **Step 1: Write failing tests for the API fetcher**

Create `apps/web/lib/calendar/api-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers before importing the module under test
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [{ name: "SESSION", value: "test-session" }],
  }),
}));

// Stub fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env["INTERNAL_API_BASE"] = "http://test-backend:8080";

// Import after mocks are wired
const { fetchCalendarWindow } = await import("./api-server");

describe("fetchCalendarWindow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("builds the correct URL with from and to params", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scheduled: [], unscheduled: [] }),
    });

    await fetchCalendarWindow("2026-05-01", "2026-05-31");

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("from=2026-05-01");
    expect(calledUrl).toContain("to=2026-05-31");
    expect(calledUrl).toContain("/api/admin/orders/calendar");
  });

  it("forwards session cookie in request headers", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scheduled: [], unscheduled: [] }),
    });

    await fetchCalendarWindow("2026-05-01", "2026-05-31");

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>)["cookie"]).toContain("SESSION=test-session");
  });

  it("returns CalendarResponseDto on 200", async () => {
    const payload = {
      scheduled: [
        {
          id: "uuid-1",
          code: "DR-001",
          clientName: "Bartek W.",
          status: "GOTOWE_DO_ODBIORU",
          plannedPickupAt: "2026-05-15T12:00:00Z",
          itemSummary: "DM 1460",
          urgent: false,
        },
      ],
      unscheduled: [],
    };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => payload });

    const result = await fetchCalendarWindow("2026-05-01", "2026-05-31");

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0].code).toBe("DR-001");
    expect(result.unscheduled).toHaveLength(0);
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(fetchCalendarWindow("2026-05-01", "2026-05-31")).rejects.toThrow("calendar fetch failed: 400");
  });

  it("throws RangeError when date range exceeds 92 days", async () => {
    // 2026-05-01 → 2026-08-02 is 93 days
    await expect(fetchCalendarWindow("2026-05-01", "2026-08-02")).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws RangeError when from is after to", async () => {
    await expect(fetchCalendarWindow("2026-05-31", "2026-05-01")).rejects.toThrow(RangeError);
  });
});
```

Run: `pnpm --filter web test lib/calendar/api-server.test.ts` → expect 6 failures (module missing).

---

- [ ] **Step 2: Create `apps/web/lib/calendar/types.ts`**

```ts
/**
 * TypeScript mirrors of CalendarResponseDto / CalendarOrderDto (backend 6-7).
 * Source: backend/app/.../order/dto/CalendarResponseDto.java (records).
 */

import type { OrderStatus } from "@/lib/orders/types";

/** One scheduled order returned by GET /api/admin/orders/calendar?from=&to= */
export interface CalendarOrderDto {
  id: string;
  code: string;
  clientName: string;
  status: OrderStatus;
  plannedPickupAt: string; // ISO-8601
  itemSummary: string;
  urgent: boolean;
}

/** One unscheduled order (planned_pickup_at IS NULL) returned in the side panel. */
export interface UnscheduledOrderDto {
  id: string;
  code: string;
  clientName: string;
  status: OrderStatus;
  receivedAt: string; // ISO-8601
  itemSummary: string;
}

/** Top-level response from GET /api/admin/orders/calendar */
export interface CalendarResponseDto {
  scheduled: CalendarOrderDto[];
  unscheduled: UnscheduledOrderDto[];
}

/** Query params shape for the calendar endpoint. */
export interface CalendarQuery {
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  from: string;
  /** YYYY-MM-DD — local (Europe/Warsaw). */
  to: string;
}
```

---

- [ ] **Step 3: Create `apps/web/lib/calendar/api-server.ts`**

```ts
/**
 * Server-only: typed fetcher for GET /api/admin/orders/calendar?from=&to=
 * Range validation (≤ 92 days) runs client-side before the network call.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { CalendarResponseDto } from "./types";

const log = createLogger("calendar-api-server");

/** Max allowed date-range in days (backend enforces 400 above). */
const MAX_RANGE_DAYS = 92;

/** Parse a YYYY-MM-DD string into a UTC midnight Date (no tz shift — backend handles tz). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/**
 * Fetches the calendar window for `from`..`to` (inclusive, YYYY-MM-DD local dates).
 * Throws `RangeError` if `from > to` or range > 92 days.
 * Throws `Error` if the backend responds with a non-2xx status.
 */
export async function fetchCalendarWindow(
  from: string,
  to: string,
): Promise<CalendarResponseDto> {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);

  if (fromDate > toDate) {
    throw new RangeError(`calendar: from (${from}) is after to (${to})`);
  }

  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new RangeError(`calendar: range ${diffDays} days exceeds max ${MAX_RANGE_DAYS}`);
  }

  const base = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  const qs = new URLSearchParams({ from, to }).toString();

  log.info("op=fetchCalendarWindow", { from, to, diffDays });

  const resp = await fetch(`${base}/api/admin/orders/calendar?${qs}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!resp.ok) {
    log.warn("op=fetchCalendarWindow outcome=error", { status: resp.status, from, to });
    throw new Error(`calendar fetch failed: ${resp.status}`);
  }

  return (await resp.json()) as CalendarResponseDto;
}
```

Run tests again: range/from-after-to/throws tests should now pass. Cookie + URL tests pass if mocks are correct.

---

- [ ] **Step 4: Write failing tests for `OrderViewTabs`**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderViewTabs.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderViewTabs } from "../OrderViewTabs";

// next/link renders an <a> in tests with this mock
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("OrderViewTabs", () => {
  it("renders three tabs: Lista, Kalendarz, Kanban", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Lista")).toBeInTheDocument();
    expect(screen.getByText("Kalendarz")).toBeInTheDocument();
    expect(screen.getByText("Kanban")).toBeInTheDocument();
  });

  it("highlights the active tab with inverted ink/paper colors", () => {
    render(<OrderViewTabs active="calendar" />);
    const calTab = screen.getByText("Kalendarz").closest("a")!;
    // Active tab carries data-active or bg-ink class; check aria or data attribute
    expect(calTab).toHaveAttribute("aria-current", "page");
  });

  it("non-active tabs do not carry aria-current", () => {
    render(<OrderViewTabs active="list" />);
    const calTab = screen.getByText("Kalendarz").closest("a")!;
    expect(calTab).not.toHaveAttribute("aria-current");
  });

  it("Lista tab points to /admin/orders", () => {
    render(<OrderViewTabs active="kanban" />);
    expect(screen.getByText("Lista").closest("a")).toHaveAttribute("href", "/admin/orders");
  });

  it("Kalendarz tab points to /admin/orders/calendar", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Kalendarz").closest("a")).toHaveAttribute("href", "/admin/orders/calendar");
  });

  it("Kanban tab points to /admin/orders/kanban", () => {
    render(<OrderViewTabs active="list" />);
    expect(screen.getByText("Kanban").closest("a")).toHaveAttribute("href", "/admin/orders/kanban");
  });
});
```

Run: `pnpm --filter web test OrderViewTabs.test.tsx` → RED (component missing).

---

- [ ] **Step 5: Create `apps/web/app/(admin)/admin/orders/_components/OrderViewTabs.tsx`**

```tsx
/**
 * Shared view-switcher for the three Orders surfaces (List / Calendar / Kanban).
 * Adapts the tab strip from admin.jsx:511-520.
 * Pure navigation — uses Next.js <Link>; no client-side state.
 */
import Link from "next/link";

export type OrderView = "list" | "calendar" | "kanban";

const TABS: { view: OrderView; label: string; href: string }[] = [
  { view: "list",     label: "Lista",     href: "/admin/orders" },
  { view: "calendar", label: "Kalendarz", href: "/admin/orders/calendar" },
  { view: "kanban",   label: "Kanban",    href: "/admin/orders/kanban" },
];

interface OrderViewTabsProps {
  active: OrderView;
}

export function OrderViewTabs({ active }: OrderViewTabsProps) {
  return (
    <div
      className="inline-flex border-2 border-ink bg-white shadow-[2px_2px_0_var(--ink)]"
      role="tablist"
      aria-label="Widok zleceń"
    >
      {TABS.map(({ view, label, href }, idx) => {
        const isActive = view === active;
        const isLast = idx === TABS.length - 1;
        return (
          <Link
            key={view}
            href={href}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            className={[
              "px-4 py-2 font-stencil text-xs tracking-widest uppercase font-bold",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive
                ? "bg-ink text-paper"
                : "bg-transparent text-ink hover:bg-ink/5",
              !isLast ? "border-r border-ink" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
```

Run tests: expect GREEN (6/6).

---

- [ ] **Step 6: Modify `apps/web/app/(admin)/admin/orders/page.tsx`**

Read the file first. Then add `<OrderViewTabs active="list" />` above `<OrdersFilters>` in the header area. The existing header row has `h1` (Zlecenia) and a Link (`+ Nowe zlecenie`); insert the tabs between the header row and the filters:

```tsx
// After the existing imports, add:
import { OrderViewTabs } from "./_components/OrderViewTabs";

// In JSX, before <OrdersFilters>:
      <div className="mb-4">
        <OrderViewTabs active="list" />
      </div>
```

The full diff keeps all existing imports and logic intact — only inserts the two lines above.

---

- [ ] **Step 7: Run full test suite**

```bash
pnpm --filter web test
```

Expected: all previous tests green + 6 new `api-server.test.ts` + 6 new `OrderViewTabs.test.tsx` passing.

---

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/calendar \
        apps/web/app/\(admin\)/admin/orders/_components/OrderViewTabs.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/__tests__/OrderViewTabs.test.tsx \
        apps/web/app/\(admin\)/admin/orders/page.tsx
git commit -m "$(cat <<'EOF'
feat(calendar): lib/calendar types + api-server + shared OrderViewTabs [milestone:6][task:6-13]

Adds CalendarResponseDto / CalendarOrderDto / UnscheduledOrderDto TS mirrors.
Adds fetchCalendarWindow server fetcher with ≤92-day range guard and cookie forwarding.
Adds OrderViewTabs shared Lista/Kalendarz/Kanban nav strip (admin.jsx:511-520).
Mounts OrderViewTabs on /admin/orders/page.tsx header.

Refs: docs/dispatch-log/6-13-<UTC>.md
EOF
)"
```

---

### Task 6-14: `CalendarMonthGrid.tsx` + `CalendarCell.tsx`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarMonthGrid.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/CalendarMonthGrid.test.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/CalendarCell.test.tsx`

**Design source:** `admin.jsx:540-575` for grid + cell layout. `admin.jsx:503` for `colorOf` status palette.

**Review:** combined single-stage.

---

- [ ] **Step 1: Write failing tests for `CalendarCell`**

Create `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/CalendarCell.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarCell } from "../CalendarCell";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeOrder(id: string, status: CalendarOrderDto["status"] = "PRZYJETE"): CalendarOrderDto {
  return {
    id,
    code: `DR-00${id}`,
    clientName: "Bartek W.",
    status,
    plannedPickupAt: "2026-05-15T10:00:00Z",
    itemSummary: "DM 1460",
    urgent: false,
  };
}

describe("CalendarCell", () => {
  it("renders the day number", () => {
    render(<CalendarCell day={7} isToday={false} orders={[]} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows 'dziś' tape when isToday=true", () => {
    render(<CalendarCell day={7} isToday={true} orders={[]} />);
    expect(screen.getByText("dziś")).toBeInTheDocument();
  });

  it("does not show 'dziś' tape when isToday=false", () => {
    render(<CalendarCell day={8} isToday={false} orders={[]} />);
    expect(screen.queryByText("dziś")).not.toBeInTheDocument();
  });

  it("renders up to 3 orders", () => {
    const orders = [makeOrder("1"), makeOrder("2"), makeOrder("3"), makeOrder("4")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    expect(screen.getByText(/DR-001/)).toBeInTheDocument();
    expect(screen.getByText(/DR-002/)).toBeInTheDocument();
    expect(screen.getByText(/DR-003/)).toBeInTheDocument();
    expect(screen.queryByText(/DR-004/)).not.toBeInTheDocument();
  });

  it("shows overflow indicator when more than 3 orders", () => {
    const orders = [makeOrder("1"), makeOrder("2"), makeOrder("3"), makeOrder("4"), makeOrder("5")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    expect(screen.getByText(/\+ 2 więcej/)).toBeInTheDocument();
  });

  it("clicking an order pill pushes ?orderId= to URL", () => {
    const orders = [makeOrder("42")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    fireEvent.click(screen.getByText(/DR-0042/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("orderId=42"));
  });

  it("today cell has a distinct background class", () => {
    const { container } = render(<CalendarCell day={7} isToday={true} orders={[]} />);
    // The root div should carry a today-highlight class or data attribute
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/today|acid/);
  });
});
```

Run: `pnpm --filter web test CalendarCell.test.tsx` → RED.

---

- [ ] **Step 2: Write failing tests for `CalendarMonthGrid`**

Create `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/CalendarMonthGrid.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { CalendarOrderDto } from "@/lib/calendar/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeOrder(id: string, dayOfMonth: number): CalendarOrderDto {
  return {
    id,
    code: `DR-00${id}`,
    clientName: "Test Client",
    status: "W_REALIZACJI",
    plannedPickupAt: `2026-05-${String(dayOfMonth).padStart(2, "0")}T12:00:00Z`,
    itemSummary: "Test item",
    urgent: false,
  };
}

// 2026-05-01 is a Friday; ISO week Mon=0, so offset = 4 (Mon,Tue,Wed,Thu = 4 leading empties).
const MAY_2026 = new Date(2026, 4, 1); // month is 0-indexed

describe("CalendarMonthGrid", () => {
  it("renders 7 day-of-week headers", () => {
    render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    expect(screen.getByText("Pon")).toBeInTheDocument();
    expect(screen.getByText("Nd")).toBeInTheDocument();
  });

  it("renders a cell for every day of the month", () => {
    render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    // Day 1 and day 31 should both appear
    expect(screen.getByTestId("cell-1")).toBeInTheDocument();
    expect(screen.getByTestId("cell-31")).toBeInTheDocument();
  });

  it("renders leading empty cells for the month start offset", () => {
    const { container } = render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    const emptyCells = container.querySelectorAll("[data-empty='true']");
    // May 2026 starts on Friday → 4 leading empties (Mon offset)
    expect(emptyCells.length).toBe(4);
  });

  it("places an order in the correct day cell", () => {
    const orders = [makeOrder("7", 7)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell7 = screen.getByTestId("cell-7");
    expect(cell7).toHaveTextContent("DR-007");
  });

  it("highlights today's cell", () => {
    // Render with a date where today is within the month
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    render(<CalendarMonthGrid date={thisMonth} scheduled={[]} />);
    const todayCell = screen.queryByText("dziś");
    // todayCell exists only if today is within this month
    if (now.getMonth() === thisMonth.getMonth()) {
      expect(todayCell).toBeInTheDocument();
    }
  });
});
```

Run: `pnpm --filter web test CalendarMonthGrid.test.tsx` → RED.

---

- [ ] **Step 3: Create `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx`**

```tsx
/**
 * Individual calendar cell for a single day of the month.
 * Renders up to 3 order pills + "+N więcej" overflow indicator.
 * Click on a pill pushes ?orderId= into the URL to open the drawer.
 * Design: admin.jsx:553-572. Color palette: admin.jsx:503.
 */
"use client";

import { useRouter } from "next/navigation";
import type { CalendarOrderDto } from "@/lib/calendar/types";
import { colorOfStatus } from "./utils";

interface CalendarCellProps {
  day: number;
  isToday: boolean;
  orders: CalendarOrderDto[];
}

export function CalendarCell({ day, isToday, orders }: CalendarCellProps) {
  const router = useRouter();
  const visible = orders.slice(0, 3);
  const overflow = orders.length - 3;

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("orderId", orderId);
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  return (
    <div
      data-testid={`cell-${day}`}
      className={[
        "border-r border-b border-admin-line p-1.5 min-h-0 relative",
        isToday ? "bg-acid/20 today" : "bg-transparent",
      ].join(" ")}
    >
      <div className="flex justify-between items-center">
        <span
          className={[
            "font-mono text-[11px]",
            isToday ? "font-bold text-ink" : "font-medium text-ink/60",
          ].join(" ")}
        >
          {day}
        </span>
        {isToday && (
          <span className="font-stencil text-[9px] px-2 py-px bg-acid border border-ink tracking-wider uppercase">
            dziś
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5 mt-1">
        {visible.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => openDrawer(order.id)}
            title={`${order.code} · ${order.clientName}`}
            className="text-left px-1.5 py-px font-mono text-[10px] font-semibold border-l-2 border-ink overflow-hidden text-ellipsis whitespace-nowrap w-full"
            style={{
              background: colorOfStatus(order.status),
              color: order.status === "WYDANE" ? "rgba(0,0,0,0.6)" : "var(--paper)",
            }}
          >
            {order.code} · {order.clientName.split(" ")[0]}
          </button>
        ))}
        {overflow > 0 && (
          <span className="font-mono text-[10px] text-ink/50">
            + {overflow} więcej
          </span>
        )}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 4: Create `apps/web/app/(admin)/admin/orders/_components/calendar/utils.ts`**

```ts
/**
 * Status → background color mapping for calendar pills.
 * Mirrors admin.jsx:503 colorOf function, using CSS custom properties.
 */
import type { OrderStatus } from "@/lib/orders/types";

export function colorOfStatus(status: OrderStatus): string {
  switch (status) {
    case "GOTOWE_DO_ODBIORU":
      return "var(--green)";
    case "W_REALIZACJI":
      return "var(--orange)";
    case "PRZYJETE":
    case "WSTEPNIE_PRZYJETE":
      return "var(--blue)";
    case "CZEKA_NA_KLIENTA":
      return "#a17a00";
    case "WYDANE":
      return "rgba(0,0,0,0.35)";
    case "ANULOWANE":
    default:
      return "var(--red)";
  }
}
```

---

- [ ] **Step 5: Create `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarMonthGrid.tsx`**

```tsx
/**
 * Full month grid — 7-column layout with leading empty cells for month start offset.
 * Takes a Date (first day of the month) and the full scheduled[] array.
 * Distributes orders into day buckets by local day-of-month derived from plannedPickupAt ISO string.
 * Design: admin.jsx:540-575.
 */
"use client";

import { CalendarCell } from "./CalendarCell";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const DAY_HEADERS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;

interface CalendarMonthGridProps {
  /** First day of the month to render. */
  date: Date;
  scheduled: CalendarOrderDto[];
}

/** ISO day of week: Mon=1 … Sun=7 → convert to 0-based Mon offset. */
function monthStartOffset(firstDay: Date): number {
  const dow = firstDay.getDay(); // Sun=0, Mon=1 … Sat=6
  return dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Extract the local day-of-month (1-31) from an ISO timestamp without a full Date parse.
 *  ISO string is always "YYYY-MM-DDTHH:…" — slice chars 8-9. */
function localDayFromIso(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

export function CalendarMonthGrid({ date, scheduled }: CalendarMonthGridProps) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const totalDays = daysInMonth(date);
  const offset = monthStartOffset(date);

  // Group orders by day-of-month
  const byDay = new Map<number, CalendarOrderDto[]>();
  for (const order of scheduled) {
    const d = localDayFromIso(order.plannedPickupAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(order);
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b-2 border-ink bg-paper-2">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="font-stencil text-[11px] tracking-widest text-ink px-3 py-2.5 border-r border-admin-line"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid grid-cols-7 grid-rows-[repeat(6,minmax(0,1fr))] flex-1">
        {/* Leading empty cells */}
        {Array.from({ length: offset }).map((_, i) => (
          <div
            key={`empty-${i}`}
            data-empty="true"
            className="border-r border-b border-admin-line bg-black/[0.02]"
          />
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
          <CalendarCell
            key={day}
            day={day}
            isToday={day === todayDay}
            orders={byDay.get(day) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 6: Run tests GREEN**

```bash
pnpm --filter web test CalendarCell.test.tsx CalendarMonthGrid.test.tsx
```

Expected: all 12 tests passing.

---

- [ ] **Step 7: Full suite**

```bash
pnpm --filter web test
```

Expected: all previous + 12 new tests passing, 0 failures.

---

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/calendar/
git commit -m "$(cat <<'EOF'
feat(calendar): CalendarMonthGrid + CalendarCell + colorOfStatus util [milestone:6][task:6-14]

Month grid distributes scheduled[] into day buckets by plannedPickupAt day-of-month.
Leading empty cells computed from Monday-based ISO weekday offset.
CalendarCell: up to 3 pills + overflow indicator + click-to-?orderId= drawer.
colorOfStatus mirrors admin.jsx:503 palette via CSS custom props.

Refs: docs/dispatch-log/6-14-<UTC>.md
EOF
)"
```

---

### Task 6-15: `BezTerminuPanel.tsx`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/BezTerminuPanel.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/BezTerminuPanel.test.tsx`

**Design source:** `admin.jsx:578-613`.

**Review:** combined single-stage.

---

- [ ] **Step 1: Write failing tests**

Create `apps/web/app/(admin)/admin/orders/_components/calendar/__tests__/BezTerminuPanel.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BezTerminuPanel } from "../BezTerminuPanel";
import type { UnscheduledOrderDto } from "@/lib/calendar/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeUnscheduled(id: string): UnscheduledOrderDto {
  return {
    id,
    code: `DR-0${id}`,
    clientName: "Maciek N.",
    status: "PRZYJETE",
    receivedAt: "2026-05-01T09:00:00Z",
    itemSummary: "Custom AF1",
  };
}

describe("BezTerminuPanel", () => {
  it("renders panel title 'Bez terminu'", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Bez terminu")).toBeInTheDocument();
  });

  it("shows count badge with the number of unscheduled orders", () => {
    const orders = [makeUnscheduled("1"), makeUnscheduled("2"), makeUnscheduled("3")];
    render(<BezTerminuPanel unscheduled={orders} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders empty state when no unscheduled orders", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Brak zleceń bez terminu")).toBeInTheDocument();
  });

  it("renders each unscheduled order row", () => {
    const orders = [makeUnscheduled("7"), makeUnscheduled("8")];
    render(<BezTerminuPanel unscheduled={orders} />);
    expect(screen.getByText("Maciek N.")).toBeInTheDocument();
    expect(screen.getAllByText("Maciek N.")).toHaveLength(2);
    expect(screen.getAllByText(/Custom AF1/)).toHaveLength(2);
  });

  it("clicking an order row pushes ?orderId= to URL", () => {
    const orders = [makeUnscheduled("42")];
    render(<BezTerminuPanel unscheduled={orders} />);
    // Click the row button
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent?.includes("Maciek N."))!);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("orderId=42"));
  });

  it("renders the 'przeciągnij' disabled hint", () => {
    render(<BezTerminuPanel unscheduled={[makeUnscheduled("1")]} />);
    expect(screen.getByText(/przeciągnij na dzień by zaplanować/)).toBeInTheDocument();
  });

  it("renders the legend section", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Legenda")).toBeInTheDocument();
  });

  it("legend contains entries for each main status", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    // Spot-check a few Polish status labels
    expect(screen.getByText(/Przyjęte/i)).toBeInTheDocument();
    expect(screen.getByText(/W realizacji/i)).toBeInTheDocument();
    expect(screen.getByText(/Gotowe do odbioru/i)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test BezTerminuPanel.test.tsx` → RED.

---

- [ ] **Step 2: Create `apps/web/app/(admin)/admin/orders/_components/calendar/BezTerminuPanel.tsx`**

```tsx
/**
 * Read-only side panel for orders with no planned_pickup_at (unscheduled[]).
 * Each row opens the drawer via ?orderId=. Drag deferred — hint renders disabled.
 * Legend sourced from admin.jsx:602-613.
 * Design: admin.jsx:578-613.
 */
"use client";

import { useRouter } from "next/navigation";
import type { UnscheduledOrderDto } from "@/lib/calendar/types";
import type { OrderStatus } from "@/lib/orders/types";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import { colorOfStatus } from "./utils";

interface BezTerminuPanelProps {
  unscheduled: UnscheduledOrderDto[];
}

// Statuses shown in the legend (matches STATUS_INFO keys from admin.jsx)
const LEGEND_STATUSES: OrderStatus[] = [
  "PRZYJETE",
  "W_REALIZACJI",
  "CZEKA_NA_KLIENTA",
  "GOTOWE_DO_ODBIORU",
  "WYDANE",
  "ANULOWANE",
];

export function BezTerminuPanel({ unscheduled }: BezTerminuPanelProps) {
  const router = useRouter();

  function openDrawer(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("orderId", orderId);
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  return (
    <div className="admin-card flex flex-col p-4 overflow-auto gap-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-2.5">
        <span className="font-display text-[18px] text-ink">Bez terminu</span>
        <span className="chip font-mono text-xs">{unscheduled.length}</span>
      </div>

      {/* Drag hint — disabled (drag deferred to a future milestone) */}
      <p className="font-mono text-[10px] text-ink/50 mb-3 tracking-wide">
        przeciągnij na dzień by zaplanować
      </p>

      {/* Order rows */}
      {unscheduled.length === 0 ? (
        <p className="font-mono text-sm text-ink/50 py-4 text-center">
          Brak zleceń bez terminu
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {unscheduled.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => openDrawer(order.id)}
              className="text-left p-2.5 border-[1.5px] border-ink bg-white shadow-[2px_2px_0_var(--ink)] hover:bg-ink/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {/* Drag icon placeholder — non-interactive, deferred */}
                <span className="text-ink/40 select-none text-base leading-none" aria-hidden>
                  ⠿
                </span>
                <span className="text-[13px] font-semibold text-ink">{order.clientName}</span>
              </div>
              <div className="font-mono text-[11px] text-ink/60 mt-0.5 ml-6 truncate">
                {order.itemSummary}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-dashed border-admin-line">
        <div className="font-stencil text-[11px] tracking-widest mb-2">Legenda</div>
        <div className="flex flex-col gap-1.5">
          {LEGEND_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="inline-block w-3.5 h-2 border border-ink flex-shrink-0"
                style={{ background: colorOfStatus(s) }}
              />
              <span className="font-mono text-[11px] text-ink">
                {STATUS_LABELS_PL[s]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

- [ ] **Step 3: Run tests GREEN**

```bash
pnpm --filter web test BezTerminuPanel.test.tsx
```

Expected: 8/8 passing.

---

- [ ] **Step 4: Full suite**

```bash
pnpm --filter web test
```

Expected: all previous + 8 new passing, 0 failures.

---

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/calendar/BezTerminuPanel.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/calendar/__tests__/BezTerminuPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(calendar): BezTerminuPanel — unscheduled side panel + legend [milestone:6][task:6-15]

Read-only list of unscheduled[] orders with count badge, drag-deferred hint,
click-to-?orderId= drawer integration, and status legend (admin.jsx:578-613).
Empty state: "Brak zleceń bez terminu".

Refs: docs/dispatch-log/6-15-<UTC>.md
EOF
)"
```

---

### Task 6-16: Calendar page wiring + states

> **BLOCK if `handoff/design/m6-calendar-states.html` is missing.** Do NOT proceed with skeleton/empty/error state rendering until the design export exists on disk. Verify at task start: `test -f handoff/design/m6-calendar-states.html || echo BLOCKED`.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/calendar/page.tsx`
- Create: `apps/web/app/(admin)/admin/orders/calendar/__tests__/page.test.tsx`
- Possibly create: `apps/web/components/state/Skeleton.tsx`, `apps/web/components/state/EmptyState.tsx`, `apps/web/components/state/ErrorBanner.tsx` (read `apps/web/components/state/` first; create only what's missing)

**Design source:** layout from `admin.jsx:481-617`; states from `handoff/design/m6-calendar-states.html`. **BLOCK if export missing.**

**Review:** combined single-stage.

---

- [ ] **Step 0: Verify design export and shared state primitives**

```bash
# Block check
test -f handoff/design/m6-calendar-states.html || (echo "BLOCKED: m6-calendar-states.html missing — stop and ask orchestrator" && exit 1)

# Check which state primitives exist
ls apps/web/components/state/ 2>/dev/null || echo "directory missing"
```

If the export is missing, stop immediately and report to the orchestrator. Do not proceed or invent layout.

If `apps/web/components/state/` is missing or any of `Skeleton.tsx` / `EmptyState.tsx` / `ErrorBanner.tsx` are absent, create them below before the page.

---

- [ ] **Step 1: Create missing shared state primitives (if needed)**

Create `apps/web/components/state/Skeleton.tsx` if missing:

```tsx
/**
 * Generic shimmer skeleton block.
 * Width/height via className prop (Tailwind utilities).
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-admin-line ${className}`}
    />
  );
}
```

Create `apps/web/components/state/EmptyState.tsx` if missing:

```tsx
/**
 * Empty-state placeholder with optional call-to-action.
 */
interface EmptyStateProps {
  message: string;
  detail?: string;
}

export function EmptyState({ message, detail }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <p className="font-display text-xl text-ink/50">{message}</p>
      {detail && <p className="font-mono text-sm text-ink/40">{detail}</p>}
    </div>
  );
}
```

Create `apps/web/components/state/ErrorBanner.tsx` if missing:

```tsx
/**
 * Inline error banner for failed data fetches.
 */
interface ErrorBannerProps {
  message?: string;
}

export function ErrorBanner({ message = "Nie udało się załadować danych. Odśwież stronę." }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-3 border-2 border-red-600 bg-red-50 font-mono text-sm text-red-700"
    >
      <span aria-hidden className="text-base">⚠</span>
      {message}
    </div>
  );
}
```

---

- [ ] **Step 2: Write failing tests for the calendar page**

Create `apps/web/app/(admin)/admin/orders/calendar/__tests__/page.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the server fetcher
vi.mock("@/lib/calendar/api-server", () => ({
  fetchCalendarWindow: vi.fn(),
}));

// Mock child components to keep unit test fast
vi.mock("../../_components/OrderViewTabs", () => ({
  OrderViewTabs: ({ active }: { active: string }) => <div data-testid="view-tabs" data-active={active} />,
}));
vi.mock("../../_components/calendar/CalendarMonthGrid", () => ({
  CalendarMonthGrid: ({ scheduled }: { scheduled: unknown[] }) => (
    <div data-testid="month-grid" data-count={scheduled.length} />
  ),
}));
vi.mock("../../_components/calendar/BezTerminuPanel", () => ({
  BezTerminuPanel: ({ unscheduled }: { unscheduled: unknown[] }) => (
    <div data-testid="bez-terminu" data-count={unscheduled.length} />
  ),
}));
vi.mock("../../_components/OrderDrawer", () => ({
  OrderDrawer: ({ initialOrder }: { initialOrder: { id: string } }) => (
    <div data-testid="order-drawer" data-order-id={initialOrder.id} />
  ),
}));

import { fetchCalendarWindow } from "@/lib/calendar/api-server";
// Next.js Server Components can't be imported directly in Vitest;
// test the exported default as an async function.
import CalendarPage from "../page";

const mockFetch = fetchCalendarWindow as ReturnType<typeof vi.fn>;

describe("CalendarPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders OrderViewTabs with active='calendar'", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("view-tabs")).toHaveAttribute("data-active", "calendar");
  });

  it("renders the month grid with scheduled orders", async () => {
    mockFetch.mockResolvedValueOnce({
      scheduled: [{ id: "1", code: "DR-001", clientName: "A", status: "PRZYJETE", plannedPickupAt: "2026-05-05T10:00:00Z", itemSummary: "x", urgent: false }],
      unscheduled: [],
    });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("month-grid")).toHaveAttribute("data-count", "1");
  });

  it("renders BezTerminuPanel with unscheduled orders", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [{ id: "2", code: "DR-002", clientName: "B", status: "PRZYJETE", receivedAt: "2026-05-01T09:00:00Z", itemSummary: "y" }] });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByTestId("bez-terminu")).toHaveAttribute("data-count", "1");
  });

  it("renders error banner when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("opens drawer when ?orderId= is set", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    // Simulate drawer order pre-fetched — page reads ?orderId from searchParams.
    // The page should mount <OrderDrawer> when orderId is present in searchParams.
    // Here we mock the drawer rendered; deeper test of fetch is in api-server tests.
    const jsx = await CalendarPage({
      searchParams: Promise.resolve({ orderId: "drawer-order-id", date: "2026-05-01" }),
    });
    render(jsx as React.ReactElement);
    // Drawer should render if page fetches the order; we stub that path.
    // If page only passes orderId to drawer and drawer handles its own fetch,
    // just assert drawer is mounted.
    const drawer = screen.queryByTestId("order-drawer");
    // Presence depends on whether the page server-fetches or delegates — adjust assertion
    // to match the actual implementation (server-fetch is preferred for consistency with
    // the existing orders list page pattern).
    expect(drawer).not.toBeNull();
  });

  it("renders week/day toggle buttons as disabled with wkrótce tooltip", async () => {
    mockFetch.mockResolvedValueOnce({ scheduled: [], unscheduled: [] });
    const jsx = await CalendarPage({ searchParams: Promise.resolve({}) });
    render(jsx as React.ReactElement);
    const tydzienBtn = screen.getByRole("button", { name: /tydzień/i });
    const dzienBtn = screen.getByRole("button", { name: /dzień/i });
    expect(tydzienBtn).toBeDisabled();
    expect(dzienBtn).toBeDisabled();
    expect(tydzienBtn).toHaveAttribute("title", "wkrótce");
    expect(dzienBtn).toHaveAttribute("title", "wkrótce");
  });
});
```

Run: `pnpm --filter web test page.test.tsx` (in calendar dir) → RED.

---

- [ ] **Step 3: Create `apps/web/app/(admin)/admin/orders/calendar/page.tsx`**

```tsx
/**
 * /admin/orders/calendar — Month-only read-only calendar view.
 * Server Component: fetches calendar window for the requested month, then renders:
 *   - OrderViewTabs (active="calendar")
 *   - month/week/day toggle (week + day disabled, "wkrótce" tooltip)
 *   - prev/next month navigation (updates ?date= URL param)
 *   - CalendarMonthGrid
 *   - BezTerminuPanel
 *   - OrderDrawer overlay if ?orderId= set
 *
 * Design: layout admin.jsx:481-617; states from handoff/design/m6-calendar-states.html.
 *
 * URL params:
 *   date=YYYY-MM-01  → month to display (defaults to current month)
 *   orderId=<uuid>   → opens drawer overlay (existing M1 pattern)
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import { fetchCalendarWindow } from "@/lib/calendar/api-server";
import { getOrderServer } from "@/lib/orders/api-server";
import type { OrderDto } from "@/lib/orders/types";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { CalendarMonthGrid } from "../_components/calendar/CalendarMonthGrid";
import { BezTerminuPanel } from "../_components/calendar/BezTerminuPanel";
import { OrderDrawer } from "../_components/OrderDrawer";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { EmptyState } from "@/components/state/EmptyState";
import type { CalendarResponseDto } from "@/lib/calendar/types";

const log = createLogger("calendar-page");

interface SearchParams {
  date?: string;
  orderId?: string;
}

/** Format a Date as YYYY-MM-DD for URL params and API calls. */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Display month label in Polish, e.g. "Maj 2026". */
const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
] as const;

function monthLabel(date: Date): string {
  return `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
}

/** Build the YYYY-MM-01 string for prev/next month navigation. */
function adjacentMonthParam(base: Date, delta: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  return toLocalDate(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Resolve the month to display
  let monthDate: Date;
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) {
    const [y, m] = sp.date.split("-").map(Number);
    monthDate = new Date(y!, m! - 1, 1);
  } else {
    const now = new Date();
    monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // from = first day of month, to = last day of month
  const from = toLocalDate(monthDate);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const to = toLocalDate(lastDay);

  let calendarData: CalendarResponseDto | null = null;
  let fetchError = false;
  let drawerOrder: OrderDto | null = null;

  const orderId = sp.orderId;

  try {
    const fetches: [Promise<CalendarResponseDto>, ...Array<Promise<OrderDto>>] = [
      fetchCalendarWindow(from, to),
    ];
    if (orderId) fetches.push(getOrderServer(orderId));
    const results = await Promise.all(fetches);
    calendarData = results[0] as CalendarResponseDto;
    drawerOrder = orderId ? (results[1] as OrderDto) : null;
  } catch (err) {
    log.error("op=fetchCalendar outcome=error", { message: String(err), from, to });
    fetchError = true;
  }

  const prevParam = adjacentMonthParam(monthDate, -1);
  const nextParam = adjacentMonthParam(monthDate, 1);

  const scheduled = calendarData?.scheduled ?? [];
  const unscheduled = calendarData?.unscheduled ?? [];
  const isEmpty = !fetchError && calendarData !== null && scheduled.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: view tabs + view-mode toggle + month navigation */}
      <div className="px-6 pt-4 pb-0 flex justify-between items-center">
        <OrderViewTabs active="calendar" />

        <div className="flex gap-4 items-center">
          {/* Month / Week / Day toggle — Week + Day disabled in M6 */}
          <div className="inline-flex border-[1.5px] border-ink bg-white">
            {(["miesiąc", "tydzień", "dzień"] as const).map((v) => {
              const isActive = v === "miesiąc";
              const isDisabled = v !== "miesiąc";
              return (
                <button
                  key={v}
                  type="button"
                  disabled={isDisabled}
                  title={isDisabled ? "wkrótce" : undefined}
                  className={[
                    "px-3 py-1.5 font-mono text-[11px] font-bold tracking-wide uppercase",
                    "border-r border-admin-line last:border-r-0",
                    isActive ? "bg-acid text-ink" : "bg-transparent text-ink",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/admin/orders/calendar?date=${prevParam}`}
              className="btn-clean p-1.5 hover:bg-ink/5 rounded"
              aria-label="Poprzedni miesiąc"
            >
              ←
            </Link>
            <span className="font-display text-2xl text-ink">{monthLabel(monthDate)}</span>
            <Link
              href={`/admin/orders/calendar?date=${nextParam}`}
              className="btn-clean p-1.5 hover:bg-ink/5 rounded"
              aria-label="Następny miesiąc"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="px-6 pt-4">
          <ErrorBanner message="Nie udało się załadować kalendarza. Odśwież stronę." />
        </div>
      )}

      {/* Main grid area: month grid + side panel */}
      {!fetchError && (
        <div className="flex-1 px-6 pt-4 pb-6 grid grid-cols-[1fr_280px] gap-5 overflow-hidden">
          <div className="admin-card overflow-hidden flex flex-col p-0">
            {isEmpty ? (
              <EmptyState
                message="Brak zleceń"
                detail="W tym miesiącu nie zaplanowano żadnych odbiorów."
              />
            ) : (
              <CalendarMonthGrid date={monthDate} scheduled={scheduled} />
            )}
          </div>

          <BezTerminuPanel unscheduled={unscheduled} />
        </div>
      )}

      {/* Drawer overlay */}
      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} users={[]} />}
    </div>
  );
}
```

> **Implementation note on `users` prop:** The `OrderDrawer` currently receives `users` (UserStubDto[]) from the list page. For the calendar page, pass an empty array `[]` at first; the drawer fetches what it needs client-side when editing is triggered, so this is safe for the read-path (clicking to view). If the drawer requires users for edit operations, add a `listUsersServer()` call in the parallel fetch block (same pattern as `orders/page.tsx`).

---

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test apps/web/app/\(admin\)/admin/orders/calendar/__tests__/page.test.tsx
```

Expected: 6/6 passing. If the test for `orderId` drawer fails because the page does a server-fetch of the order (which the mock doesn't stub), add a mock for `getOrderServer` in the test file:

```ts
vi.mock("@/lib/orders/api-server", () => ({
  getOrderServer: vi.fn().mockResolvedValue({
    id: "drawer-order-id", code: "DR-999", clientId: "c1",
    status: "PRZYJETE", source: "ADMIN",
    receivedAt: null, plannedPickupAt: null, pickedUpAt: null,
    assignedCraftsmanId: null, currentStorageLocationId: null,
    tags: null, totalPriceCents: 0, currency: "PLN",
    description: null, cancelledReason: null, version: 1,
    createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-01T00:00:00Z",
    items: [],
  }),
  listUsersServer: vi.fn().mockResolvedValue([]),
}));
```

---

- [ ] **Step 5: Full suite**

```bash
pnpm --filter web test
```

Expected: all previous + 6 new calendar page tests + any new state-primitive tests passing, 0 failures.

---

- [ ] **Step 6: Smoke check — verify route is reachable**

If the dev server is running:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/orders/calendar
```

Expected: 200 (or 302 redirect to login if unauthenticated — both mean the route is wired). Do not proceed if 404.

---

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/calendar/ \
        apps/web/components/state/
git commit -m "$(cat <<'EOF'
feat(calendar): calendar page wiring — month grid + Bez-terminu + states [milestone:6][task:6-16]

/admin/orders/calendar Server Component: resolves ?date= param → fetchCalendarWindow,
renders CalendarMonthGrid + BezTerminuPanel in a 2-column layout.
Week/Day toggle buttons disabled with "wkrótce" tooltip (M6 scope lock).
Prev/next month nav via Link ?date= params.
States: ErrorBanner on fetch failure, EmptyState when scheduled[]=[],
Bez-terminu empty handled in BezTerminuPanel.
?orderId= opens OrderDrawer overlay (M1 pattern reuse).
Shared state primitives (Skeleton/EmptyState/ErrorBanner) created if absent.

Refs: docs/dispatch-log/6-16-<UTC>.md
EOF
)"
```

---
## Wave 4 — Kanban frontend

**Gate:** `handoff/design/m6-kanban-states.html` must exist before dispatching 6-19 or 6-20.
6-17 and 6-18 may run immediately; 6-19 and 6-20 are BLOCKED until the design export lands.

Execution order: 6-17 → 6-18 → 6-19 → 6-20. Each task depends on the prior.

---

### Task 6-17: `lib/kanban/types.ts` + `api-server.ts`

**Files:**
- Create: `apps/web/lib/kanban/types.ts` (~40 LOC)
- Create: `apps/web/lib/kanban/api-server.ts` (~60 LOC)
- Create: `apps/web/lib/kanban/api-server.test.ts` (vitest, ~60 LOC)

**Design source:** N/A — pure TS lib. No layout decisions.

**Review:** combined single-stage.

---

- [ ] **Step 1: Read `apps/web/lib/messaging/api-server.ts`**

Confirm `cookieHeader()` and `base()` helpers and the `serverGet<T>` pattern before
writing the kanban counterpart. Do NOT copy-paste the entire module — mirror the exact
structure then adapt.

---

- [ ] **Step 2: Create `apps/web/lib/kanban/types.ts`**

```typescript
/**
 * TypeScript mirror of KanbanResponseDto / KanbanColumnDto / KanbanCardDto.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/order/api/KanbanController.java
 *
 * Five canonical Kanban statuses — matches OrderStatus values used for grouping.
 * ANULOWANE is excluded from Kanban per spec §6-8.
 */

import type { OrderStatus } from "@/lib/orders/types";

/** Kanban statuses that appear as columns. */
export type KanbanStatus = Extract<
  OrderStatus,
  "PRZYJETE" | "W_REALIZACJI" | "CZEKA_NA_KLIENTA" | "GOTOWE_DO_ODBIORU" | "WYDANE"
>;

/** One card within a column. Mirrors KanbanCardDto.java (record). */
export interface KanbanCardDto {
  /** UUID */
  id: string;
  /** e.g. "DR-1042" */
  code: string;
  /** Full name from Client.getFullName() */
  clientName: string;
  /** Concatenated item descriptions, may be empty string */
  itemSummary: string;
  /** ISO-8601 or null when no planned pickup date */
  plannedPickupAt: string | null;
  /** true when tagged "pilne" OR plannedPickupAt within 48 h */
  urgent: boolean;
}

/** One column in the board response. Mirrors KanbanColumnDto.java (record). */
export interface KanbanColumnDto {
  /** Column identifier — one of the five KanbanStatus values */
  status: KanbanStatus;
  /** Unfiltered count for the column header badge */
  total: number;
  /** Cards up to limitPerColumn (WYDANE: max 10 regardless of param) */
  cards: KanbanCardDto[];
  /** true when total > cards.length */
  hasMore: boolean;
}

/** Top-level board response. Mirrors KanbanResponseDto.java (record). */
export interface KanbanResponseDto {
  columns: KanbanColumnDto[];
}

/** Request params for GET /api/admin/orders/kanban */
export interface KanbanFetchParams {
  limitPerColumn?: number;
}
```

---

- [ ] **Step 3: Create `apps/web/lib/kanban/api-server.ts`**

```typescript
/**
 * Server-only: typed fetcher for GET /api/admin/orders/kanban.
 * Uses INTERNAL_API_BASE → no CORS; must only be imported in Server Components.
 * Pattern: mirrors lib/messaging/api-server.ts.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { KanbanResponseDto, KanbanFetchParams } from "./types";

const log = createLogger("kanban.api-server");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

function base(): string {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}

async function serverGet<T>(path: string, label: string): Promise<T> {
  const resp = await fetch(`${base()}${path}`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn(`op=${label} outcome=error`, { status: resp.status });
    throw new Error(`${label} failed: ${resp.status}`);
  }
  return (await resp.json()) as T;
}

/**
 * Fetch the full Kanban board in one round-trip.
 * @param params.limitPerColumn - default 50; WYDANE is always capped at 10 backend-side.
 */
export async function getKanbanBoardServer(
  params: KanbanFetchParams = {},
): Promise<KanbanResponseDto> {
  const qs = params.limitPerColumn
    ? `?limitPerColumn=${params.limitPerColumn}`
    : "";
  log.info("op=getKanbanBoardServer", { limitPerColumn: params.limitPerColumn ?? 50 });
  return serverGet<KanbanResponseDto>(
    `/api/admin/orders/kanban${qs}`,
    "getKanbanBoardServer",
  );
}
```

---

- [ ] **Step 4: Create `apps/web/lib/kanban/api-server.test.ts`**

```typescript
/**
 * Unit tests for lib/kanban/api-server.ts.
 * Uses vitest + global fetch mock. Isolates network calls — no real backend.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/headers must be mocked in vitest because it requires the Next runtime
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [{ name: "SESSION", value: "test-session" }],
  }),
}));

// Preserve original fetch
const originalFetch = globalThis.fetch;

function makeBoardResponse() {
  return {
    columns: [
      {
        status: "PRZYJETE",
        total: 2,
        cards: [
          {
            id: "uuid-1",
            code: "DR-1001",
            clientName: "Jan Kowalski",
            itemSummary: "Vibram, DM 1460",
            plannedPickupAt: "2026-05-15T10:00:00Z",
            urgent: false,
          },
        ],
        hasMore: true,
      },
    ],
  };
}

describe("getKanbanBoardServer", () => {
  beforeEach(() => {
    // Reset INTERNAL_API_BASE
    process.env["INTERNAL_API_BASE"] = "http://localhost:8080";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls the correct URL with default limitPerColumn", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeBoardResponse(),
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const { getKanbanBoardServer } = await import("./api-server");
    const result = await getKanbanBoardServer();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/orders/kanban",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].status).toBe("PRZYJETE");
  });

  it("appends limitPerColumn query param when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeBoardResponse(),
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const { getKanbanBoardServer } = await import("./api-server");
    await getKanbanBoardServer({ limitPerColumn: 10 });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/orders/kanban?limitPerColumn=10",
      expect.anything(),
    );
  });

  it("throws when backend returns non-OK status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const { getKanbanBoardServer } = await import("./api-server");
    await expect(getKanbanBoardServer()).rejects.toThrow(
      "getKanbanBoardServer failed: 503",
    );
  });

  it("forwards the session cookie", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeBoardResponse(),
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const { getKanbanBoardServer } = await import("./api-server");
    await getKanbanBoardServer();

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((callArgs[1].headers as Record<string, string>)["cookie"]).toContain(
      "SESSION=test-session",
    );
  });
});
```

---

- [ ] **Step 5: Run vitest — confirm GREEN**

```bash
cd apps/web && npx vitest run lib/kanban/api-server.test.ts
```

Expected: 4 tests passed. If vitest is not configured, check `apps/web/package.json` for the test script; add a `vitest.config.ts` if missing, mirroring any existing config in the monorepo.

---

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/kanban/types.ts \
        apps/web/lib/kanban/api-server.ts \
        apps/web/lib/kanban/api-server.test.ts
git commit -m "$(cat <<'EOF'
feat(web): kanban lib — types + server fetcher [milestone:6][task:6-17]

KanbanResponseDto / KanbanColumnDto / KanbanCardDto TS interfaces.
Server-side fetcher getKanbanBoardServer() with cookie forwarding.
4 vitest unit tests (URL, limitPerColumn param, error path, cookie header).

Refs: docs/dispatch-log/6-17-<UTC>.md
EOF
)"
```

**Acceptance:**
- `apps/web/lib/kanban/types.ts` and `api-server.ts` exist.
- 4 vitest tests GREEN.
- `pnpm typecheck` clean.

---

### Task 6-18: `KanbanBoard` + `KanbanColumn` + `KanbanCard` (static, no drag)

**Files:**
- Modify: `apps/web/package.json` (add `@dnd-kit/core` and `@dnd-kit/sortable`)
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx` (~110 LOC)
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx` (~80 LOC)
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanCard.tsx` (~80 LOC)
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanBoard.test.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanColumn.test.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanCard.test.tsx`

**Design source:** `admin.jsx:660-714` for board layout, column header, and card markup. Drag-ghost styling deferred to 6-19 (requires design export `m6-kanban-states.html`).

**Review:** combined single-stage.

---

- [ ] **Step 1: Install dnd-kit**

```bash
cd apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable
```

Confirm `apps/web/package.json` now lists `@dnd-kit/core` and `@dnd-kit/sortable` in `dependencies`.

---

- [ ] **Step 2: Create `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanCard.tsx`**

Adapted from `admin.jsx:686-704`. Click pushes `?orderId=<id>` to open the drawer (same
pattern as Calendar). `cursor-grab` via Tailwind. The `useSortable` hook from `@dnd-kit/sortable`
is set up here so 6-19 only needs to wire the `attributes` / `listeners` — no file rewrite.

```typescript
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createLogger } from "@/lib/log";
import type { KanbanCardDto } from "@/lib/kanban/types";

const log = createLogger("kanban.card");

interface Props {
  card: KanbanCardDto;
}

/** Format ISO date string as "DD.MM" Polish short date, or "—" if null. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function KanbanCard({ card }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function openDrawer() {
    log.info("op=openDrawer", { cardId: card.id, code: card.code });
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderId", card.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={openDrawer}
      data-card-id={card.id}
      className="admin-card p-2.5 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-ink/50">{card.code}</span>
        {card.urgent && (
          <span className="px-1.5 py-0 bg-pink text-paper text-[9px] font-mono font-bold tracking-widest uppercase">
            pilne
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-1.5">
        <div
          className="w-10 h-10 border border-ink/30 flex-shrink-0 bg-paper-2"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="font-semibold text-xs truncate">{card.clientName}</div>
          <div className="font-mono text-[10px] text-ink/60 mt-0.5 truncate">
            {card.itemSummary || "—"}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-dashed border-line">
        <span className="font-mono text-[10px] text-ink/55">
          {shortDate(card.plannedPickupAt)}
        </span>
        <span
          className="w-5 h-5 rounded-full bg-paper-2 border border-ink/50 text-[9px] font-mono font-bold flex items-center justify-center"
          aria-hidden="true"
        >
          T
        </span>
      </div>
    </div>
  );
}
```

---

- [ ] **Step 3: Create `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx`**

Adapted from `admin.jsx:679-685`. Column header uses inline style for the color token
(CSS variable) because Tailwind can't generate arbitrary `bg-[var(--X)]` tokens
without a safelist — `style` is acceptable here.

```typescript
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./KanbanCard";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { KanbanColumnDto } from "@/lib/kanban/types";

/** CSS variable per column status — matches admin.jsx:625-631 */
const COLUMN_BG: Record<string, string> = {
  PRZYJETE:          "var(--blue)",
  W_REALIZACJI:      "var(--orange)",
  CZEKA_NA_KLIENTA:  "#c89c00",
  GOTOWE_DO_ODBIORU: "var(--green)",
  WYDANE:            "rgba(0,0,0,0.35)",
};

interface Props {
  column: KanbanColumnDto;
}

export function KanbanColumn({ column }: Props) {
  const bg = COLUMN_BG[column.status] ?? "var(--ink)";

  // Make the body droppable so cards can be dropped into an empty column
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        style={{ background: bg }}
        className="px-3 py-2.5 border-2 border-ink flex items-center justify-between"
      >
        <span
          className="font-stencil text-[12px] tracking-[.1em] uppercase text-paper"
          style={{ color: column.status === "WYDANE" ? "var(--ink)" : "var(--paper)" }}
        >
          {STATUS_LABELS_PL[column.status]}
        </span>
        <span className="font-mono text-[11px] font-bold bg-white/85 text-ink px-1.5 py-0 rounded-full">
          {column.total}
        </span>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] border-2 border-t-0 border-ink bg-black/[.03] p-2 flex flex-col gap-2 transition-colors ${
          isOver ? "bg-black/10" : ""
        }`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <p className="text-xs text-ink/40 text-center py-4 select-none">
            brak zleceń w tym statusie
          </p>
        )}

        {column.hasMore && (
          <p className="text-[10px] font-mono text-ink/40 text-center py-1 select-none">
            +{column.total - column.cards.length} więcej
          </p>
        )}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 4: Create `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx`**

`DndContext` wrapper is here. `onDragEnd` is a no-op prop for now; 6-19 wires the real hook.

```typescript
"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnDto } from "@/lib/kanban/types";

interface Props {
  columns: KanbanColumnDto[];
  /**
   * Called when a drag completes between two different columns.
   * Wired by 6-19; 6-18 leaves the default no-op in place.
   */
  onDragEnd?: (cardId: string, fromStatus: string, toStatus: string) => void;
}

export function KanbanBoard({ columns, onDragEnd }: Props) {
  // PointerSensor with 8 px activationConstraint avoids triggering drag on click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    // Find source column from card list
    const fromColumn = columns.find((col) =>
      col.cards.some((c) => c.id === String(active.id)),
    );
    const toStatus = String(over.id);

    if (!fromColumn) return;
    if (fromColumn.status === toStatus) return; // same column — no-op

    onDragEnd?.(String(active.id), fromColumn.status, toStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="flex-1 overflow-auto p-6 grid gap-4"
        style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
      >
        {columns.map((col) => (
          <KanbanColumn key={col.status} column={col} />
        ))}
      </div>
    </DndContext>
  );
}
```

---

- [ ] **Step 5: Create test files**

**`apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanCard.test.tsx`:**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanCard } from "../KanbanCard";
import type { KanbanCardDto } from "@/lib/kanban/types";

// Stub dnd-kit to avoid JSDOM drag complexity
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin/orders/kanban",
  useSearchParams: () => new URLSearchParams(),
}));

const card: KanbanCardDto = {
  id: "uuid-card-1",
  code: "DR-1042",
  clientName: "Magdalena K.",
  itemSummary: "DM 1460 — Vibram",
  plannedPickupAt: "2026-05-08T10:00:00Z",
  urgent: true,
};

describe("KanbanCard", () => {
  it("renders code and client name", () => {
    render(<KanbanCard card={card} />);
    expect(screen.getByText("DR-1042")).toBeTruthy();
    expect(screen.getByText("Magdalena K.")).toBeTruthy();
  });

  it("renders urgent badge when urgent=true", () => {
    render(<KanbanCard card={card} />);
    expect(screen.getByText("pilne")).toBeTruthy();
  });

  it("does not render urgent badge when urgent=false", () => {
    render(<KanbanCard card={{ ...card, urgent: false }} />);
    expect(screen.queryByText("pilne")).toBeNull();
  });

  it("renders — for null plannedPickupAt", () => {
    render(<KanbanCard card={{ ...card, plannedPickupAt: null }} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders — for empty itemSummary", () => {
    render(<KanbanCard card={{ ...card, itemSummary: "" }} />);
    // The body section renders "—" for empty summary
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("pushes ?orderId=<id> on click", () => {
    render(<KanbanCard card={card} />);
    fireEvent.click(screen.getByText("DR-1042").closest("[data-card-id]")!);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("orderId=uuid-card-1"),
    );
  });
});
```

**`apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanColumn.test.tsx`:**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanColumn } from "../KanbanColumn";
import type { KanbanColumnDto } from "@/lib/kanban/types";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  }),
  verticalListSortingStrategy: "verticalListSortingStrategy",
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/orders/kanban",
  useSearchParams: () => new URLSearchParams(),
}));

const col: KanbanColumnDto = {
  status: "PRZYJETE",
  total: 3,
  cards: [
    {
      id: "u1", code: "DR-1001", clientName: "Jan K.",
      itemSummary: "Vibram", plannedPickupAt: null, urgent: false,
    },
  ],
  hasMore: true,
};

describe("KanbanColumn", () => {
  it("renders column status label", () => {
    render(<KanbanColumn column={col} />);
    // STATUS_LABELS_PL["PRZYJETE"] = "Przyjęte"
    expect(screen.getByText(/przyjęte/i)).toBeTruthy();
  });

  it("renders total count badge", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders hasMore text when more cards exist", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText(/więcej/)).toBeTruthy();
  });

  it("renders empty state when no cards", () => {
    render(<KanbanColumn column={{ ...col, cards: [], total: 0, hasMore: false }} />);
    expect(screen.getByText("brak zleceń w tym statusie")).toBeTruthy();
  });

  it("renders card children", () => {
    render(<KanbanColumn column={col} />);
    expect(screen.getByText("DR-1001")).toBeTruthy();
  });
});
```

**`apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanBoard.test.tsx`:**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "../KanbanBoard";
import type { KanbanColumnDto } from "@/lib/kanban/types";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  }),
  verticalListSortingStrategy: "verticalListSortingStrategy",
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/orders/kanban",
  useSearchParams: () => new URLSearchParams(),
}));

const STATUSES = [
  "PRZYJETE", "W_REALIZACJI", "CZEKA_NA_KLIENTA", "GOTOWE_DO_ODBIORU", "WYDANE",
] as const;

const cols: KanbanColumnDto[] = STATUSES.map((s) => ({
  status: s,
  total: 1,
  cards: [
    {
      id: `id-${s}`, code: `DR-${s}`, clientName: `Klient ${s}`,
      itemSummary: "item", plannedPickupAt: null, urgent: false,
    },
  ],
  hasMore: false,
}));

describe("KanbanBoard", () => {
  it("renders all 5 columns", () => {
    render(<KanbanBoard columns={cols} />);
    expect(screen.getByText(/przyjęte/i)).toBeTruthy();
    expect(screen.getByText(/w realizacji/i)).toBeTruthy();
    expect(screen.getByText(/gotowe do odbioru/i)).toBeTruthy();
    expect(screen.getByText(/wydane/i)).toBeTruthy();
  });

  it("renders empty columns with empty-state text", () => {
    const emptyCols: KanbanColumnDto[] = STATUSES.map((s) => ({
      status: s, total: 0, cards: [], hasMore: false,
    }));
    render(<KanbanBoard columns={emptyCols} />);
    const empties = screen.getAllByText("brak zleceń w tym statusie");
    expect(empties).toHaveLength(5);
  });
});
```

---

- [ ] **Step 6: Run vitest — confirm GREEN**

```bash
cd apps/web && npx vitest run app/\(admin\)/admin/orders/_components/kanban/__tests__/
```

Expected: all component tests GREEN (KanbanCard 6 cases, KanbanColumn 5 cases, KanbanBoard 2 cases = 13 total).

---

- [ ] **Step 7: `pnpm typecheck` clean**

```bash
cd apps/web && pnpm typecheck
```

Fix any type errors before committing.

---

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json \
        apps/web/app/\(admin\)/admin/orders/_components/kanban/KanbanBoard.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/kanban/KanbanColumn.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/kanban/KanbanCard.tsx \
        "apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanBoard.test.tsx" \
        "apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanColumn.test.tsx" \
        "apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanCard.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): KanbanBoard + KanbanColumn + KanbanCard static components [milestone:6][task:6-18]

Installs @dnd-kit/core + @dnd-kit/sortable (not previously a dep).
KanbanBoard: DndContext wrapper, PointerSensor 8px activation, handleDragEnd stub.
KanbanColumn: useDroppable + SortableContext + empty-state text.
KanbanCard: useSortable + click-to-drawer (?orderId= push), urgent badge, shortDate.
13 vitest tests GREEN across three test files.

Refs: docs/dispatch-log/6-18-<UTC>.md
EOF
)"
```

**Acceptance:**
- `@dnd-kit/core` and `@dnd-kit/sortable` in `apps/web/package.json` dependencies.
- 3 component files exist, no drag behavior yet.
- 13 vitest tests GREEN.
- `pnpm typecheck` clean.

---

### Task 6-19: `useKanbanDnd` hook + `StatusChangeTriggerDialog` extraction + drag flow

**BLOCKED until `handoff/design/m6-kanban-states.html` exists.** Confirm file presence
before dispatching. If file is missing: STOP and ask the orchestrator. Do NOT invent
drag-ghost styling.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/StatusChangeTriggerDialog.tsx` (~110 LOC)
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx` (uses extracted dialog)
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/useKanbanDnd.ts` (~100 LOC)
- Modify: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx` (wire hook into `DndContext`)
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/StatusChangeTriggerDialog.test.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/useKanbanDnd.test.tsx`

**Design source:**
- Board layout: `admin.jsx:660-714` (already covered in 6-18).
- Drag-ghost / over-column styling: `handoff/design/m6-kanban-states.html`. BLOCK if absent.

**Review:** TWO-STAGE.

Stage 1 — implementation:
- Sub-action A: extract dialog.
- Sub-action B: implement hook.
- Sub-action C: wire board.
- All tests GREEN.

Stage 2 — review focus:
- Drag flow correctness (optimistic → dialog → confirm/cancel → revert logic).
- Optimistic semantics (state shape, revert path).
- Drawer regression (OrderDrawerStatusChanger still works after extraction).

---

- [ ] **Step 1: Read design export**

Read `handoff/design/m6-kanban-states.html`. Identify:
1. Drag-ghost card markup / opacity / border style.
2. "Over column" highlight style.
3. Error toast markup.
4. Note findings before writing any styling code.

---

- [ ] **Step 2: Read `OrderDrawerStatusChanger.tsx` and `StatusChangeConfirm.tsx`**

Re-read both at dispatch time to confirm current state. Note the `StatusChangeConfirm` prop types, `previewFor()` signature, and `getTriggers()` import path. Confirm no `OrderDrawerStatusChanger.test.tsx` exists before extracting.

---

- [ ] **Step 3 (Sub-action A): Create `StatusChangeTriggerDialog.tsx`**

Stateless extraction — no network calls, no local state. `onConfirm(sendTriggers: boolean)` upgrades from the existing single-button to the two-button pattern (spec §7 step 4): "Wyślij wiadomość" (true) / "Tylko zmień status" (false).

```typescript
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";
import type { TriggerPreview } from "./StatusChangeConfirm";

export type { TriggerPreview };

const log = createLogger("status-trigger-dialog");

interface Props {
  open: boolean;
  fromStatus: OrderStatus;
  toStatus: OrderStatus | null;
  /** orderId for logging context only */
  orderId: string;
  clientName?: string;
  triggerPreview: TriggerPreview;
  /** Called with true → send triggers; false → status-only */
  onConfirm: (sendTriggers: boolean) => void;
  onCancel: () => void;
}

function channelLabel(ch: string): string {
  switch (ch) {
    case "EMAIL":     return "e-mail";
    case "SMS":       return "SMS";
    case "WHATSAPP":  return "WhatsApp";
    default:          return ch.toLowerCase();
  }
}

export function StatusChangeTriggerDialog({
  open,
  fromStatus,
  toStatus,
  orderId,
  clientName,
  triggerPreview,
  onConfirm,
  onCancel,
}: Props) {
  const hasTrigger = triggerPreview.kind === "match";

  function handleSend() {
    log.info("op=confirmWithTrigger", { orderId, from: fromStatus, to: toStatus });
    onConfirm(true);
  }

  function handleStatusOnly() {
    log.info("op=confirmStatusOnly", { orderId, from: fromStatus, to: toStatus });
    onConfirm(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper border-2 border-ink shadow-[5px_5px_0_var(--pink),5px_5px_0_1.5px_var(--ink)] w-full max-w-sm p-5 space-y-4">
          <Dialog.Title className="font-stencil text-sm tracking-widest uppercase text-pink">
            Zmiana statusu
          </Dialog.Title>

          <p className="text-sm text-ink">
            {clientName && <strong>{clientName} — </strong>}
            <span>
              {STATUS_LABELS_PL[fromStatus]}
              {" → "}
              <strong>{toStatus ? STATUS_LABELS_PL[toStatus] : ""}</strong>
            </span>
          </p>

          {/* Trigger preview */}
          <div>
            <p className="text-xs font-medium text-admin-mute mb-1">Co się stanie:</p>
            {triggerPreview.kind === "match" && (
              <div className="text-sm space-y-0.5">
                <p>
                  Szablon{" "}
                  <strong>{triggerPreview.templateName}</strong>{" "}
                  zostanie wysłany kanałem{" "}
                  {triggerPreview.channels.map(channelLabel).join(", ")}.
                </p>
                {triggerPreview.delayMinutes > 0 && (
                  <p className="text-xs text-admin-mute">
                    Opóźnienie: {triggerPreview.delayMinutes} min.
                  </p>
                )}
                {triggerPreview.requiresManualConfirmation && (
                  <p className="text-xs text-amber-600">
                    Wymagane ręczne potwierdzenie wysyłki.
                  </p>
                )}
              </div>
            )}
            {triggerPreview.kind === "disabled" && (
              <p className="text-sm text-admin-mute">
                Wyzwalacz <em>{triggerPreview.triggerName}</em> jest wyłączony.
              </p>
            )}
            {triggerPreview.kind === "none" && (
              <p className="text-sm text-admin-mute">
                Brak skonfigurowanego wyzwalacza dla tego przejścia.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {hasTrigger && (
              <button
                onClick={handleSend}
                className="w-full px-4 py-2 text-sm font-medium bg-ink text-paper border-2 border-ink hover:bg-ink/90 transition-colors"
              >
                Wyślij wiadomość
              </button>
            )}
            <button
              onClick={handleStatusOnly}
              className="w-full px-4 py-2 text-sm font-medium bg-paper text-ink border-2 border-ink hover:bg-paper-2 transition-colors"
            >
              Tylko zmień status
            </button>
            <button
              onClick={onCancel}
              className="text-sm text-admin-mute hover:text-ink text-center py-1"
            >
              Anuluj
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

- [ ] **Step 4 (Sub-action A continued): Update `OrderDrawerStatusChanger.tsx`**

Replace `<StatusChangeConfirm>` with `<StatusChangeTriggerDialog>`. Read `lib/orders/types.ts` first. If `sendTriggers` is absent from `ChangeStatusRequest`, add `sendTriggers?: boolean` and thread it through `changeStatus()`. If M2's single-order endpoint doesn't accept it, add as backend-ignored (the bulk endpoint 6-9 uses it).

Minimal diff to `OrderDrawerStatusChanger.tsx`:

```typescript
// Replace:
import { StatusChangeConfirm } from "./StatusChangeConfirm";
import type { TriggerPreview } from "./StatusChangeConfirm";
// With:
import { StatusChangeTriggerDialog } from "./StatusChangeTriggerDialog";
import type { TriggerPreview } from "./StatusChangeTriggerDialog";

// Replace the <StatusChangeConfirm> block:
<StatusChangeTriggerDialog
  open={target !== null}
  fromStatus={order.status}
  toStatus={target}
  orderId={order.id}
  triggerPreview={triggerPreview}
  onConfirm={(_sendTriggers) => { void handleConfirm(); }}
  onCancel={() => setTarget(null)}
/>
```

The `_sendTriggers` value is intentionally ignored for the drawer path in M6 (the
drawer's flow already ran trigger fan-out implicitly; wiring it fully is M7 scope).
Prefix with `_` to silence the TypeScript unused-variable lint.

---

- [ ] **Step 5 (Sub-action B): Create `apps/web/app/(admin)/admin/orders/_components/kanban/useKanbanDnd.ts`**

The hook owns the board's mutable column state (a copy of the server-fetched columns),
the optimistic-move logic, the dialog open/close state, and the PATCH call.

```typescript
"use client";

import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { changeStatus } from "@/lib/orders/api";
import { getTriggers } from "@/lib/messaging/api";
import { previewForStatus } from "@/lib/orders/triggerPreview";
import type { KanbanColumnDto, KanbanStatus } from "@/lib/kanban/types";
import type { TriggerPreview } from "../StatusChangeTriggerDialog";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("kanban.dnd");

export interface PendingMove {
  cardId: string;
  fromStatus: KanbanStatus;
  toStatus: KanbanStatus;
  orderVersion: number;
  triggerPreview: TriggerPreview;
  clientName: string;
}

export interface UseKanbanDndResult {
  columns: KanbanColumnDto[];
  pendingMove: PendingMove | null;
  onDragEnd: (cardId: string, fromStatus: string, toStatus: string) => void;
  onConfirm: (sendTriggers: boolean) => Promise<void>;
  onCancel: () => void;
  errorToast: string | null;
  dismissToast: () => void;
}

export function useKanbanDnd(
  initialColumns: KanbanColumnDto[],
  triggers: TriggerDto[],
  orderVersionMap: Map<string, number>,
): UseKanbanDndResult {
  const [columns, setColumns] = useState<KanbanColumnDto[]>(initialColumns);
  const [snapshot, setSnapshot] = useState<KanbanColumnDto[] | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  function applyOptimisticMove(
    cols: KanbanColumnDto[],
    cardId: string,
    fromStatus: KanbanStatus,
    toStatus: KanbanStatus,
  ): KanbanColumnDto[] {
    return cols.map((col) => {
      if (col.status === fromStatus) {
        return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
      }
      if (col.status === toStatus) {
        const fromCol = cols.find((c) => c.status === fromStatus);
        const card = fromCol?.cards.find((c) => c.id === cardId);
        if (!card) return col;
        return { ...col, cards: [card, ...col.cards] };
      }
      return col;
    });
  }

  const onDragEnd = useCallback(
    (cardId: string, fromStatusRaw: string, toStatusRaw: string) => {
      const fromStatus = fromStatusRaw as KanbanStatus;
      const toStatus   = toStatusRaw   as KanbanStatus;

      if (fromStatus === toStatus) {
        log.debug("op=dragEnd outcome=sameColumn", { cardId });
        return;
      }

      log.info("op=dragEnd outcome=crossColumn", { cardId, fromStatus, toStatus });

      const before = columns;
      setSnapshot(before);
      const next = applyOptimisticMove(before, cardId, fromStatus, toStatus);
      setColumns(next);

      const fromCol = before.find((c) => c.status === fromStatus);
      const card    = fromCol?.cards.find((c) => c.id === cardId);
      const version = orderVersionMap.get(cardId) ?? 0;
      const preview = previewForStatus(toStatus, triggers);

      setPendingMove({
        cardId,
        fromStatus,
        toStatus,
        orderVersion: version,
        triggerPreview: preview,
        clientName: card?.clientName ?? "",
      });
    },
    [columns, triggers, orderVersionMap],
  );

  const onConfirm = useCallback(
    async (sendTriggers: boolean) => {
      if (!pendingMove) return;
      const { cardId, toStatus, orderVersion } = pendingMove;
      log.info("op=confirmMove", { cardId, toStatus, sendTriggers });
      setPendingMove(null);
      setSnapshot(null);

      try {
        await changeStatus(cardId, toStatus, orderVersion);
        log.info("op=confirmMove outcome=ok", { cardId, toStatus });
      } catch (err: unknown) {
        log.error("op=confirmMove outcome=error", { cardId, toStatus, err });
        setColumns((prev) => snapshot ?? prev);
        setErrorToast("Nie udało się zmienić statusu — spróbuj jeszcze raz");
      }
    },
    [pendingMove, snapshot],
  );

  const onCancel = useCallback(() => {
    log.info("op=cancelMove", { cardId: pendingMove?.cardId });
    if (snapshot) setColumns(snapshot);
    setSnapshot(null);
    setPendingMove(null);
  }, [pendingMove, snapshot]);

  const dismissToast = useCallback(() => setErrorToast(null), []);

  return { columns, pendingMove, onDragEnd, onConfirm, onCancel, errorToast, dismissToast };
}
```

Note: `previewForStatus` is a shared helper extracted from `OrderDrawerStatusChanger`'s
local `previewFor()`. Create `apps/web/lib/orders/triggerPreview.ts`:

```typescript
import type { TriggerDto } from "@/lib/messaging/types";
import type { TriggerPreview } from "@/app/(admin)/admin/orders/_components/StatusChangeTriggerDialog";

export function previewForStatus(
  targetStatus: string,
  triggers: TriggerDto[],
): TriggerPreview {
  const matched = triggers.find((t) => {
    if (t.event !== "STATUS_CHANGE") return false;
    try {
      const params = JSON.parse(t.eventParams) as { toStatus?: string };
      return params.toStatus === targetStatus;
    } catch {
      return false;
    }
  });
  if (!matched) return { kind: "none" };
  if (!matched.enabled) return { kind: "disabled", triggerName: matched.name };
  let channels: string[] = [];
  try {
    channels = JSON.parse(matched.channels) as string[];
  } catch {
    // leave empty
  }
  return {
    kind: "match",
    templateName: matched.templateName,
    channels,
    delayMinutes: matched.delayMinutes,
    requiresManualConfirmation: matched.requiresManualConfirmation,
  };
}
```

Also update `OrderDrawerStatusChanger.tsx` to import `previewForStatus` from
`@/lib/orders/triggerPreview` and delete the local `previewFor` function.

---

- [ ] **Step 6 (Sub-action C): Wire `useKanbanDnd` into `KanbanBoard.tsx`**

Update `KanbanBoard.tsx` props to accept the full hook result. Read `handoff/design/m6-kanban-states.html` for exact `DragOverlay` ghost styling before writing it — do NOT invent styling.

Updated `KanbanBoard.tsx`:

```typescript
"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { StatusChangeTriggerDialog } from "../StatusChangeTriggerDialog";
import type { KanbanColumnDto } from "@/lib/kanban/types";
import type { PendingMove } from "./useKanbanDnd";

interface Props {
  columns: KanbanColumnDto[];
  onDragEnd: (cardId: string, fromStatus: string, toStatus: string) => void;
  pendingMove: PendingMove | null;
  onConfirm: (sendTriggers: boolean) => Promise<void>;
  onCancel: () => void;
}

export function KanbanBoard({
  columns,
  onDragEnd,
  pendingMove,
  onConfirm,
  onCancel,
}: Props) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;
    const fromColumn = columns.find((col) =>
      col.cards.some((c) => c.id === String(active.id)),
    );
    if (!fromColumn) return;
    if (fromColumn.status === String(over.id)) return;
    onDragEnd(String(active.id), fromColumn.status, String(over.id));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex-1 overflow-auto p-6 grid gap-4"
          style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
        >
          {columns.map((col) => (
            <KanbanColumn key={col.status} column={col} />
          ))}
        </div>

        {/* DragOverlay renders the ghost card while dragging.
            Styling from handoff/design/m6-kanban-states.html — fill in exactly. */}
        <DragOverlay>
          {activeCard && (
            <div
              className="opacity-90 rotate-1 shadow-lg"
              /* TODO: apply exact ghost styling from m6-kanban-states.html */
            >
              <KanbanCard card={activeCard} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pendingMove && (
        <StatusChangeTriggerDialog
          open={pendingMove !== null}
          fromStatus={pendingMove.fromStatus}
          toStatus={pendingMove.toStatus}
          orderId={pendingMove.cardId}
          clientName={pendingMove.clientName}
          triggerPreview={pendingMove.triggerPreview}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  );
}
```

Replace `/* TODO: apply exact ghost styling */` with real classes from the design export. Do NOT commit the TODO.

---

- [ ] **Step 7: Create `StatusChangeTriggerDialog.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChangeTriggerDialog } from "../StatusChangeTriggerDialog";
import type { TriggerPreview } from "../StatusChangeTriggerDialog";

const noopPreview: TriggerPreview = { kind: "none" };
const matchPreview: TriggerPreview = {
  kind: "match",
  templateName: "Gotowe — SMS",
  channels: ["SMS"],
  delayMinutes: 0,
  requiresManualConfirmation: false,
};

describe("StatusChangeTriggerDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <StatusChangeTriggerDialog
        open={false}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders from/to status labels when open", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/w realizacji/i)).toBeTruthy();
  });

  it("shows 'Wyślij wiadomość' button when trigger matches", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="W_REALIZACJI"
        toStatus="GOTOWE_DO_ODBIORU"
        orderId="uuid-1"
        triggerPreview={matchPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Wyślij wiadomość")).toBeTruthy();
  });

  it("always shows 'Tylko zmień status' button", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Tylko zmień status")).toBeTruthy();
  });

  it("calls onConfirm(true) when Wyślij is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="W_REALIZACJI"
        toStatus="GOTOWE_DO_ODBIORU"
        orderId="uuid-1"
        triggerPreview={matchPreview}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Wyślij wiadomość"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("calls onConfirm(false) when Tylko-zmień is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Tylko zmień status"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("calls onCancel when Anuluj is clicked", () => {
    const onCancel = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Anuluj"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders clientName when provided", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        clientName="Magdalena K."
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/magdalena k\./i)).toBeTruthy();
  });
});
```

---

- [ ] **Step 8: Create `useKanbanDnd.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKanbanDnd } from "../useKanbanDnd";
import type { KanbanColumnDto } from "@/lib/kanban/types";
import type { TriggerDto } from "@/lib/messaging/types";

vi.mock("@/lib/orders/api", () => ({
  changeStatus: vi.fn(),
}));
vi.mock("@/lib/messaging/api", () => ({
  getTriggers: vi.fn().mockResolvedValue([]),
}));

import { changeStatus } from "@/lib/orders/api";

const card1 = {
  id: "card-a", code: "DR-1001", clientName: "Jan K.",
  itemSummary: "item", plannedPickupAt: null, urgent: false,
};
const card2 = {
  id: "card-b", code: "DR-1002", clientName: "Ala K.",
  itemSummary: "item2", plannedPickupAt: null, urgent: false,
};

function makeColumns(): KanbanColumnDto[] {
  return [
    { status: "PRZYJETE",          total: 1, cards: [card1], hasMore: false },
    { status: "W_REALIZACJI",      total: 1, cards: [card2], hasMore: false },
    { status: "CZEKA_NA_KLIENTA",  total: 0, cards: [],      hasMore: false },
    { status: "GOTOWE_DO_ODBIORU", total: 0, cards: [],      hasMore: false },
    { status: "WYDANE",            total: 0, cards: [],      hasMore: false },
  ];
}

const triggers: TriggerDto[] = [];
const versionMap = new Map<string, number>([["card-a", 3], ["card-b", 1]]);

describe("useKanbanDnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drop on same column is a no-op — no optimistic move, no dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "PRZYJETE");
    });
    expect(result.current.pendingMove).toBeNull();
    // card-a stays in PRZYJETE
    expect(result.current.columns[0].cards).toHaveLength(1);
  });

  it("drop on different column triggers optimistic move + opens dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    expect(result.current.columns[0].cards).toHaveLength(0);
    expect(result.current.columns[1].cards).toHaveLength(2);
    expect(result.current.pendingMove).not.toBeNull();
    expect(result.current.pendingMove?.cardId).toBe("card-a");
    expect(result.current.pendingMove?.toStatus).toBe("W_REALIZACJI");
  });

  it("onCancel reverts optimistic move and closes dialog", () => {
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    act(() => {
      result.current.onCancel();
    });
    expect(result.current.pendingMove).toBeNull();
    expect(result.current.columns[0].cards).toHaveLength(1); // card-a restored
    expect(result.current.columns[1].cards).toHaveLength(1); // card-b only
  });

  it("onConfirm calls changeStatus with correct args and commits on 2xx", async () => {
    vi.mocked(changeStatus).mockResolvedValueOnce({
      order: { id: "card-a", status: "W_REALIZACJI", version: 4 } as never,
      triggerSuggestion: null,
    });
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(true);
    });
    expect(changeStatus).toHaveBeenCalledWith("card-a", "W_REALIZACJI", 3);
    expect(result.current.pendingMove).toBeNull();
    expect(result.current.errorToast).toBeNull();
    expect(result.current.columns[0].cards).toHaveLength(0);
  });

  it("onConfirm with sendTriggers=false still calls changeStatus", async () => {
    vi.mocked(changeStatus).mockResolvedValueOnce({
      order: { id: "card-a", status: "W_REALIZACJI", version: 4 } as never,
      triggerSuggestion: null,
    });
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(false);
    });
    expect(changeStatus).toHaveBeenCalledWith("card-a", "W_REALIZACJI", 3);
  });

  it("onConfirm reverts move and sets error toast on 4xx failure", async () => {
    vi.mocked(changeStatus).mockRejectedValueOnce(new Error("HTTP 409"));
    const { result } = renderHook(() =>
      useKanbanDnd(makeColumns(), triggers, versionMap),
    );
    act(() => {
      result.current.onDragEnd("card-a", "PRZYJETE", "W_REALIZACJI");
    });
    await act(async () => {
      await result.current.onConfirm(true);
    });
    expect(result.current.columns[0].cards).toHaveLength(1);
    expect(result.current.errorToast).toBe(
      "Nie udało się zmienić statusu — spróbuj jeszcze raz",
    );
  });
});
```

---

- [ ] **Step 9: Run all new tests**

```bash
cd apps/web && npx vitest run \
  "app/(admin)/admin/orders/_components/__tests__/StatusChangeTriggerDialog.test.tsx" \
  "app/(admin)/admin/orders/_components/kanban/__tests__/useKanbanDnd.test.tsx"
```

Expected: 7 + 6 = 13 tests GREEN.

Also run the full drawer/status-changer area to confirm extraction regression-free:

```bash
cd apps/web && npx vitest run "app/(admin)/admin/orders/"
```

---

- [ ] **Step 10: `pnpm typecheck` clean**

```bash
cd apps/web && pnpm typecheck
```

Fix all type errors before proceeding to Stage 2 review.

---

- [ ] **Step 11: Stage 1 — request spec review**

Open a review request for Stage 1 covering:
1. `StatusChangeTriggerDialog.tsx` — props API + dialog UX.
2. `useKanbanDnd.ts` — optimistic state shape, revert semantics, `sendTriggers` threading.
3. Updated `OrderDrawerStatusChanger.tsx` diff.
4. All test results.

Wait for Stage 2 sign-off before committing.

---

- [ ] **Step 12: Address Stage 2 review feedback**

Fix all Stage 2 findings. Do NOT force-merge without sign-off on:
- Drag flow correctness (optimistic → dialog → confirm/cancel).
- Revert path correctness on error.
- Drawer regression-free (no behavior change to existing drawer).

---

- [ ] **Step 13: Commit (after Stage 2 approved)**

```bash
git add \
  "apps/web/app/(admin)/admin/orders/_components/StatusChangeTriggerDialog.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/kanban/useKanbanDnd.ts" \
  "apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/StatusChangeTriggerDialog.test.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/useKanbanDnd.test.tsx" \
  "apps/web/lib/orders/triggerPreview.ts"
git commit -m "$(cat <<'EOF'
feat(web): useKanbanDnd hook + StatusChangeTriggerDialog extraction + drag flow [milestone:6][task:6-19]

Extracts trigger-preview dialog from OrderDrawerStatusChanger into standalone
StatusChangeTriggerDialog (fromStatus/toStatus/onConfirm(sendTriggers)).
Introduces triggerPreview.ts shared helper (previewForStatus) used by both
drawer and Kanban hook.
useKanbanDnd: optimistic move → dialog → confirm (PATCH) or cancel (revert).
Revert on 4xx/5xx + Polish error toast. Same-column drop is a no-op.
KanbanBoard wired with DragOverlay (ghost from m6-kanban-states.html).
13 dialog tests + 6 hook tests GREEN. OrderDrawerStatusChanger regression-free.
Two-stage review approved before commit.

Refs: docs/dispatch-log/6-19-<UTC>.md
EOF
)"
```

**Acceptance:**
- `StatusChangeTriggerDialog.tsx` exists with `onConfirm(sendTriggers: boolean)` API.
- `OrderDrawerStatusChanger.tsx` uses extracted dialog; existing drawer behavior unchanged.
- `useKanbanDnd.ts` handles all 5 test scenarios (same-col no-op, cross-col optimistic, cancel revert, confirm+commit, confirm+revert on error).
- `KanbanBoard.tsx` renders `DragOverlay` with ghost styling from design export.
- 13 dialog + 6 hook tests GREEN.
- `pnpm typecheck` clean.
- Stage 2 review approved.

---

### Task 6-20: Kanban page wiring + states

**BLOCKED until `handoff/design/m6-kanban-states.html` exists.** Confirm file presence
before dispatching.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/kanban/page.tsx` (~80 LOC) — Server Component
- Create: `apps/web/components/state/Skeleton.tsx` (if not created by W2/W3)
- Create: `apps/web/components/state/EmptyState.tsx` (if not created by W2/W3)
- Create: `apps/web/components/state/ErrorBanner.tsx` (if not created by W2/W3)
- Create: `apps/web/app/(admin)/admin/orders/kanban/__tests__/page.test.tsx`

**Design source:** `admin.jsx:660-714` for board. `handoff/design/m6-kanban-states.html` for column skeleton, error banner. BLOCK if absent.

**Review:** combined single-stage.

---

- [ ] **Step 1: Check for existing shared state primitives**

```bash
ls apps/web/components/state/ 2>/dev/null || echo "MISSING"
```

If any of `Skeleton.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx` already exist (created by
W2 or W3), skip creating them. Only create what is missing.

---

- [ ] **Step 2: Read `handoff/design/m6-kanban-states.html`**

Identify:
1. Skeleton / shimmer markup for a column in loading state.
2. Error banner markup (background color, icon placement, retry-link text).

Apply exactly as specified. Do NOT invent layout.

---

- [ ] **Step 3: Create missing shared state components**

Create only the components confirmed missing in Step 1.

**`apps/web/components/state/Skeleton.tsx`** (if missing):

```typescript
interface Props {
  className?: string;
}

/** Generic shimmer block. Apply w-*/h-* via className. */
export function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`animate-pulse bg-ink/10 rounded ${className}`}
      aria-hidden="true"
    />
  );
}
```

**`apps/web/components/state/EmptyState.tsx`** (if missing):

```typescript
interface Props {
  message: string;
  className?: string;
}

export function EmptyState({ message, className = "" }: Props) {
  return (
    <p className={`text-sm text-admin-mute text-center py-8 ${className}`}>
      {message}
    </p>
  );
}
```

**`apps/web/components/state/ErrorBanner.tsx`** (if missing):

```typescript
interface Props {
  message?: string;
  /** Refresh link href — defaults to current path */
  retryHref?: string;
}

/**
 * Full-width error banner with a retry link.
 * Styling from handoff/design/m6-kanban-states.html (or m6-dashboard-states.html
 * if that shipped first). Apply exact markup from whichever export shipped first.
 */
export function ErrorBanner({
  message = "Nie udało się załadować danych.",
  retryHref = ".",
}: Props) {
  return (
    <div
      role="alert"
      className="w-full border-2 border-ink bg-pink/10 px-4 py-3 flex items-center justify-between"
    >
      <span className="text-sm text-ink">{message}</span>
      <a
        href={retryHref}
        className="text-xs font-medium text-ink underline hover:no-underline ml-4"
      >
        Odśwież
      </a>
    </div>
  );
}
```

If W2/W3 shipped `ErrorBanner` with different markup, reuse it. Styling must come from a design export, never invented.

---

- [ ] **Step 4: Create `apps/web/app/(admin)/admin/orders/kanban/page.tsx`**

Server Component: fetches board + triggers, renders tabs + `KanbanBoardWrapper`.

**Version note:** `KanbanCardDto` (spec §6-8) does not include `order.version`. Preferred fix: add `version: number` to `KanbanCardDto` with a matching backend change to `KanbanCardDto.java` (avoids a second round-trip). If 6-8 already included it, use directly. If not, add as an inline backend slice and note in Findings.

```typescript
import { Suspense } from "react";
import { getKanbanBoardServer } from "@/lib/kanban/api-server";
import { getTriggersServer } from "@/lib/messaging/api-server";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { KanbanBoardWrapper } from "../_components/kanban/KanbanBoardWrapper";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import { Skeleton } from "@/components/state/Skeleton";

export default async function KanbanPage() {
  let board;
  let triggers;
  let fetchError = false;

  try {
    [board, triggers] = await Promise.all([
      getKanbanBoardServer(),
      getTriggersServer(),
    ]);
  } catch {
    fetchError = true;
    board = null;
    triggers = [];
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4">
        <OrderViewTabs active="kanban" />
      </div>

      {fetchError && (
        <div className="px-6 pt-4">
          <ErrorBanner message="Nie udało się załadować tablicy Kanban." />
        </div>
      )}

      {board && (
        <Suspense
          fallback={
            <div
              className="flex-1 p-6 grid gap-4"
              style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 3 }).map((__, j) => (
                    <Skeleton key={j} className="h-24 w-full" />
                  ))}
                </div>
              ))}
            </div>
          }
        >
          <KanbanBoardWrapper
            initialColumns={board.columns}
            triggers={triggers}
          />
        </Suspense>
      )}
    </div>
  );
}
```

Note: `KanbanBoardWrapper` is a thin client component that calls `useKanbanDnd` and
renders `<KanbanBoard>`. Create it in the same task:

```typescript
// apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoardWrapper.tsx
"use client";

import { useMemo, useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { getTriggers } from "@/lib/messaging/api";
import { useKanbanDnd } from "./useKanbanDnd";
import { KanbanBoard } from "./KanbanBoard";
import type { KanbanColumnDto } from "@/lib/kanban/types";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("kanban.wrapper");

interface Props {
  initialColumns: KanbanColumnDto[];
  triggers: TriggerDto[];
}

export function KanbanBoardWrapper({ initialColumns, triggers }: Props) {
  const versionMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const col of initialColumns) {
      for (const card of col.cards) {
        m.set(card.id, (card as KanbanCardDto & { version?: number }).version ?? 0);
      }
    }
    return m;
  }, [initialColumns]);

  const { columns, pendingMove, onDragEnd, onConfirm, onCancel, errorToast, dismissToast } =
    useKanbanDnd(initialColumns, triggers, versionMap);

  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [errorToast, dismissToast]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <KanbanBoard
        columns={columns}
        onDragEnd={onDragEnd}
        pendingMove={pendingMove}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />

      {/* Error toast — bottom-right */}
      {errorToast && (
        <div
          role="alert"
          className="absolute bottom-6 right-6 bg-paper border-2 border-ink shadow-[3px_3px_0_var(--pink),3px_3px_0_1.5px_var(--ink)] px-4 py-3 max-w-xs"
        >
          <p className="text-sm text-ink">{errorToast}</p>
          <button
            onClick={dismissToast}
            className="text-xs text-admin-mute mt-1 hover:text-ink"
          >
            Zamknij
          </button>
        </div>
      )}
    </div>
  );
}
```

---

- [ ] **Step 5: Verify `OrderViewTabs` exists**

```bash
ls "apps/web/app/(admin)/admin/orders/_components/OrderViewTabs.tsx" 2>/dev/null || echo "MISSING"
```

If `OrderViewTabs` was not shipped by W3 (6-13), create a stub here so the page
compiles. The stub must match the interface used in W3:

```typescript
// apps/web/app/(admin)/admin/orders/_components/OrderViewTabs.tsx
"use client";

import Link from "next/link";

type View = "lista" | "kalendarz" | "kanban";

interface Props {
  active: View;
}

const VIEWS: { id: View; label: string; href: string }[] = [
  { id: "lista",     label: "Lista",     href: "/admin/orders" },
  { id: "kalendarz", label: "Kalendarz", href: "/admin/orders/calendar" },
  { id: "kanban",    label: "Kanban",    href: "/admin/orders/kanban" },
];

export function OrderViewTabs({ active }: Props) {
  return (
    <div className="inline-flex border-2 border-ink bg-paper shadow-[2px_2px_0_var(--ink)]">
      {VIEWS.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          className={`px-4 py-2 font-stencil text-xs tracking-[.08em] uppercase font-bold border-r border-ink last:border-r-0 transition-colors ${
            active === v.id
              ? "bg-ink text-paper"
              : "bg-transparent text-ink hover:bg-ink/5"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
```

If `OrderViewTabs` already exists from W3, do NOT overwrite it — just confirm it
accepts `active="kanban"`.

---

- [ ] **Step 6: Create test file**

```typescript
// apps/web/app/(admin)/admin/orders/kanban/__tests__/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock server-side fetchers
vi.mock("@/lib/kanban/api-server", () => ({
  getKanbanBoardServer: vi.fn().mockResolvedValue({
    columns: [
      { status: "PRZYJETE",          total: 1, cards: [
        { id: "c1", code: "DR-1001", clientName: "Jan K.", itemSummary: "item", plannedPickupAt: null, urgent: false },
      ], hasMore: false },
      { status: "W_REALIZACJI",      total: 0, cards: [], hasMore: false },
      { status: "CZEKA_NA_KLIENTA",  total: 0, cards: [], hasMore: false },
      { status: "GOTOWE_DO_ODBIORU", total: 0, cards: [], hasMore: false },
      { status: "WYDANE",            total: 0, cards: [], hasMore: false },
    ],
  }),
}));
vi.mock("@/lib/messaging/api-server", () => ({
  getTriggersServer: vi.fn().mockResolvedValue([]),
}));

// Mock client components to avoid dnd-kit / next/navigation in jsdom
vi.mock("../../../_components/kanban/KanbanBoardWrapper", () => ({
  KanbanBoardWrapper: ({ initialColumns }: { initialColumns: Array<{ status: string }> }) => (
    <div data-testid="kanban-board">
      {initialColumns.map((c) => (
        <div key={c.status} data-testid={`col-${c.status}`} />
      ))}
    </div>
  ),
}));
vi.mock("../../../_components/OrderViewTabs", () => ({
  OrderViewTabs: ({ active }: { active: string }) => (
    <div data-testid="order-view-tabs" data-active={active} />
  ),
}));

import KanbanPage from "../page";

describe("KanbanPage", () => {
  it("renders OrderViewTabs with active=kanban", async () => {
    const jsx = await KanbanPage();
    render(jsx);
    const tabs = screen.getByTestId("order-view-tabs");
    expect(tabs.getAttribute("data-active")).toBe("kanban");
  });

  it("renders all 5 columns via KanbanBoardWrapper", async () => {
    const jsx = await KanbanPage();
    render(jsx);
    expect(screen.getByTestId("col-PRZYJETE")).toBeTruthy();
    expect(screen.getByTestId("col-WYDANE")).toBeTruthy();
  });

  it("renders ErrorBanner when fetch throws", async () => {
    const { getKanbanBoardServer } = await import("@/lib/kanban/api-server");
    vi.mocked(getKanbanBoardServer).mockRejectedValueOnce(new Error("503"));

    const jsx = await KanbanPage();
    render(jsx);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/nie udało się załadować/i)).toBeTruthy();
  });
});
```

---

- [ ] **Step 7: Run vitest**

```bash
cd apps/web && npx vitest run "app/(admin)/admin/orders/kanban/__tests__/page.test.tsx"
```

Expected: 3 tests GREEN.

---

- [ ] **Step 8: `pnpm typecheck` + `pnpm build` — both clean**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Fix any type errors or import resolution issues before committing.

---

- [ ] **Step 9: Commit**

```bash
git add \
  "apps/web/app/(admin)/admin/orders/kanban/page.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoardWrapper.tsx" \
  "apps/web/app/(admin)/admin/orders/kanban/__tests__/page.test.tsx"

# Only add state primitives that were newly created in this task:
# git add apps/web/components/state/Skeleton.tsx       (if created here)
# git add apps/web/components/state/EmptyState.tsx     (if created here)
# git add apps/web/components/state/ErrorBanner.tsx    (if created here)
# Only add OrderViewTabs if it was created here (not by W3):
# git add "apps/web/app/(admin)/admin/orders/_components/OrderViewTabs.tsx"

git commit -m "$(cat <<'EOF'
feat(web): Kanban page wiring — /admin/orders/kanban live with drag flow [milestone:6][task:6-20]

Server Component fetches board + triggers; KanbanBoardWrapper mounts useKanbanDnd.
5-column grid, OrderViewTabs (active=kanban), Suspense skeleton shimmer.
ErrorBanner on fetch failure. Error toast auto-dismisses after 5 s.
Column empty-state ("brak zleceń w tym statusie") from KanbanColumn.
Shared state primitives (Skeleton/EmptyState/ErrorBanner) added if missing.
3 page tests GREEN (happy, all-columns, error).

Refs: docs/dispatch-log/6-20-<UTC>.md
EOF
)"
```

**Acceptance:**
- `GET /admin/orders/kanban` renders at runtime with a real backend.
- All 5 columns display with header badge and card list.
- Empty columns show "brak zleceń w tym statusie".
- Dragging a card cross-column opens the trigger-preview dialog.
- Confirming the dialog PATCHes status and commits the move.
- Cancelling or PATCH failure reverts the card to its original column.
- Fetch failure renders the error banner (no unhandled exception).
- 3 page tests GREEN.
- `pnpm typecheck` + `pnpm build` clean.
- `pnpm lint` clean.
## Wave 5 — List polish frontend

> **Design-export gate:**
> - Task 6-21 may be dispatched immediately (chip styles from `admin.jsx:266-272`; no fresh export). Precondition slice 6-21a must ship first if the backend check confirms missing params.
> - Task 6-22 is **BLOCKED** until `handoff/design/m6-bulk-action-bar.html` exists on disk. Before dispatching, verify the file is present; stop and ask the orchestrator if it is missing.
> - Task 6-23 is **BLOCKED** until `handoff/design/m6-row-quick-actions-menu.html` exists on disk. Before dispatching, verify the file is present; stop and ask the orchestrator if it is missing.

---

### Task 6-21: `SavedFilterPresets.tsx` chip row + URL param plumbing

**Backend check — precondition slice required (6-21a):**
`OrderController.list()` was read at plan-write time. It accepts only `status` (single `OrderStatus`), `type[]` (multi-value kind), `craftsmanId`, `q`, and `Pageable`. It does NOT accept:
- `tag=` (string matching against the `tags` JSONB column)
- `plannedPickupAtFrom=` (lower bound on `planned_pickup_at`)
- `plannedPickupAtTo=` (upper bound on `planned_pickup_at`)
- Multi-value `status=` (comma-separated list)

`OrderSpecifications.forList` also lacks these predicates. Therefore **precondition slice 6-21a (inline) must ship before the frontend steps**.

---

#### Precondition slice 6-21a (inline) — backend list-endpoint extension

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java` — add `list` overload / extend signature
- Modify: `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java` — accept new `@RequestParam`s
- Modify: `apps/web/lib/orders/types.ts` — extend `OrderListFilters` with new fields
- Modify: `apps/web/lib/orders/api-server.ts` — forward new fields in `buildQuery`
- Create: `backend/app/src/test/java/com/drshoes/app/order/api/OrderListExtendedIntegrationTest.java`

**Review:** combined single-stage (mechanical extension; no new domain logic).

---

- [ ] **Step 1: Write the failing IT**

Create `backend/app/src/test/java/com/drshoes/app/order/api/OrderListExtendedIntegrationTest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Extended GET /api/admin/orders: tag=, plannedPickupAtFrom/To=, multi-status. */
class OrderListExtendedIntegrationTest extends AbstractIntegrationTest {

    @Autowired private TestRestTemplate rest;
    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID orderA; // pilne tag, 2026-06-01, W_REALIZACJI
    private UUID orderB; // pilne tag, 2026-06-10, PRZYJETE
    private UUID orderC; // no tag, no date, GOTOWE_DO_ODBIORU

    @BeforeEach
    void seed() {
        clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
            "VALUES (?::uuid, 'Filter', 'TestClient', ?, '+48000999001', 'EMAIL')",
            clientId, "filter-test-" + clientId + "@test.pl");

        orderA = UUID.randomUUID();
        jdbc.update("INSERT INTO orders (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'W_REALIZACJI', 'ADMIN', '[\"pilne\"]'::jsonb, " +
            "'2026-06-01T10:00:00Z', now(), 1000, 'PLN', 0)",
            orderA, "EXT-A-" + orderA.toString().substring(0, 6), clientId);

        orderB = UUID.randomUUID();
        jdbc.update("INSERT INTO orders (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'PRZYJETE', 'ADMIN', '[\"pilne\"]'::jsonb, " +
            "'2026-06-10T10:00:00Z', now(), 1000, 'PLN', 0)",
            orderB, "EXT-B-" + orderB.toString().substring(0, 6), clientId);

        orderC = UUID.randomUUID();
        jdbc.update("INSERT INTO orders (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'GOTOWE_DO_ODBIORU', 'ADMIN', NULL, " +
            "NULL, now(), 1000, 'PLN', 0)",
            orderC, "EXT-C-" + orderC.toString().substring(0, 6), clientId);
    }

    @Test
    @DisplayName("tag=pilne returns only orders with pilne tag")
    void filterByTag() {
        ResponseEntity<String> resp = rest.getForEntity(
            "/api/admin/orders?tag=pilne", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains(orderA.toString());
        assertThat(resp.getBody()).contains(orderB.toString());
        assertThat(resp.getBody()).doesNotContain(orderC.toString());
    }

    @Test
    @DisplayName("plannedPickupAtFrom + plannedPickupAtTo filters by date range")
    void filterByDateRange() {
        ResponseEntity<String> resp = rest.getForEntity(
            "/api/admin/orders?plannedPickupAtFrom=2026-06-01&plannedPickupAtTo=2026-06-05",
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains(orderA.toString());
        assertThat(resp.getBody()).doesNotContain(orderB.toString());
    }

    @Test
    @DisplayName("multi-value status= returns orders matching any of the statuses")
    void filterByMultiStatus() {
        ResponseEntity<String> resp = rest.getForEntity(
            "/api/admin/orders?status=W_REALIZACJI&status=GOTOWE_DO_ODBIORU",
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains(orderA.toString());
        assertThat(resp.getBody()).contains(orderC.toString());
        assertThat(resp.getBody()).doesNotContain(orderB.toString());
    }

    @Test
    @DisplayName("tag + date range + multi-status combined")
    void filterCombined() {
        ResponseEntity<String> resp = rest.getForEntity(
            "/api/admin/orders?tag=pilne&plannedPickupAtFrom=2026-05-01&plannedPickupAtTo=2026-06-30" +
            "&status=W_REALIZACJI&status=PRZYJETE", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains(orderA.toString());
        assertThat(resp.getBody()).contains(orderB.toString());
        assertThat(resp.getBody()).doesNotContain(orderC.toString());
    }
}
```

- [ ] **Step 2: Run — confirm RED**

```bash
mvn -B -pl app -am test -Dtest=OrderListExtendedIntegrationTest
```

Expected: compile failure or `4 failing` — `tag`, `plannedPickupAtFrom`, `plannedPickupAtTo`, and multi-`status` don't exist yet.

- [ ] **Step 3: Extend `OrderSpecifications`**

Edit `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`.

Replace `forList` signature and body:

```java
public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                           List<OrderItemKind> kinds, String q,
                                           String tag, Instant plannedPickupAtFrom,
                                           Instant plannedPickupAtTo) {
    return (root, query, cb) -> {
        List<Predicate> preds = new ArrayList<>();
        preds.add(cb.isNull(root.get("deletedAt")));
        if (statuses != null && !statuses.isEmpty())
            preds.add(root.get("status").in(statuses));
        if (assigneeId != null)
            preds.add(cb.equal(root.get("assignedCraftsmanId"), assigneeId));
        if (kinds != null && !kinds.isEmpty()) {
            var sq = query.subquery(UUID.class);
            var item = sq.from(OrderItem.class);
            sq.select(item.get("orderId")).where(
                cb.and(cb.equal(item.get("orderId"), root.get("id")),
                       item.get("kind").in(kinds)));
            preds.add(cb.exists(sq));
        }
        if (q != null && !q.isBlank()) {
            String like = "%" + q.toLowerCase() + "%";
            preds.add(cb.or(
                cb.like(cb.lower(root.get("code")), like),
                cb.like(cb.lower(root.get("description")), like)));
        }
        if (tag != null && !tag.isBlank()) {
            // Postgres: tags @> jsonb_build_array(?::text)
            // Register jsonb_array_contains_text as a Hibernate dialect function OR use
            // a native-SQL Specification for the @> predicate. Either path is acceptable;
            // document chosen approach in Findings. If dialect-function approach adds > 15 LOC,
            // prefer a separate @NativeQuery repository method guarded by the tag param.
            preds.add(cb.isTrue(
                cb.function("jsonb_array_contains_text", Boolean.class,
                    root.get("tags"), cb.literal(tag))));
        }
        if (plannedPickupAtFrom != null)
            preds.add(cb.greaterThanOrEqualTo(root.get("plannedPickupAt"), plannedPickupAtFrom));
        if (plannedPickupAtTo != null)
            preds.add(cb.lessThan(root.get("plannedPickupAt"), plannedPickupAtTo));
        return cb.and(preds.toArray(new Predicate[0]));
    };
}
```

Import `java.time.Instant` at the top.

- [ ] **Step 4: Update `OrderService.list` signature**

Edit `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`.

Replace:
```java
public Page<OrderListRow> list(OrderStatus status, UUID assigneeId,
                               List<OrderItemKind> kinds, String q, Pageable pageable) {
    return orderRepo.findAll(OrderSpecifications.forList(status, assigneeId, kinds, q), pageable)
        .map(OrderListRow::of);
}
```

With:
```java
public Page<OrderListRow> list(List<OrderStatus> statuses, UUID assigneeId,
                               List<OrderItemKind> kinds, String q,
                               String tag, Instant plannedPickupAtFrom,
                               Instant plannedPickupAtTo, Pageable pageable) {
    return orderRepo.findAll(
        OrderSpecifications.forList(statuses, assigneeId, kinds, q, tag,
                                    plannedPickupAtFrom, plannedPickupAtTo),
        pageable).map(OrderListRow::of);
}
```

Add import `java.time.Instant`.

- [ ] **Step 5: Update `OrderController.list` params**

Edit `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`.

Replace the `list` method:

```java
@GetMapping
public Page<OrderListRow> list(
        @RequestParam(required = false) List<OrderStatus> status,
        @RequestParam(required = false, name = "type") List<OrderItemKind> kinds,
        @RequestParam(required = false) UUID craftsmanId,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtFrom,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtTo,
        Pageable pageable,
        Authentication auth) {
    Instant from = plannedPickupAtFrom != null
        ? plannedPickupAtFrom.atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
    // to is exclusive: plusDays(1) then start-of-day
    Instant to = plannedPickupAtTo != null
        ? plannedPickupAtTo.plusDays(1).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
    log.info("op=listOrders actor={} outcome=ok", actor(auth));
    return svc.list(status, craftsmanId, kinds, q, tag, from, to, pageable);
}
```

- [ ] **Step 6: Run test — GREEN**

```bash
mvn -B -pl app -am test -Dtest=OrderListExtendedIntegrationTest
```

Expected: 4 passing. If the `jsonb` tag filter compile-fails, implement the fallback approach documented in Step 3 and note in Findings.

- [ ] **Step 7: Full suite — GREEN**

```bash
mvn -B -pl app -am test
```

Expected: ≥ baseline + 4 new, 0 failures, 0 errors.

- [ ] **Step 8: Extend frontend types + fetcher**

Edit `apps/web/lib/orders/types.ts` — extend `OrderListFilters`:

```ts
export interface OrderListFilters {
  status?: OrderStatus | OrderStatus[];
  type?: OrderItemKind[];
  craftsmanId?: string;
  q?: string;
  tag?: string;
  plannedPickupAtFrom?: string; // YYYY-MM-DD
  plannedPickupAtTo?: string;   // YYYY-MM-DD
}
```

Edit `apps/web/lib/orders/api-server.ts` — extend `buildQuery`:

```ts
function buildQuery(filters: OrderListFilters, page: number, size: number): string {
  const p = new URLSearchParams();
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach((s) => p.append("status", s));
    } else {
      p.set("status", filters.status);
    }
  }
  if (filters.craftsmanId) p.set("craftsmanId", filters.craftsmanId);
  if (filters.q) p.set("q", filters.q);
  if (filters.type?.length) filters.type.forEach((k) => p.append("type", k));
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.plannedPickupAtFrom) p.set("plannedPickupAtFrom", filters.plannedPickupAtFrom);
  if (filters.plannedPickupAtTo) p.set("plannedPickupAtTo", filters.plannedPickupAtTo);
  p.set("page", String(page));
  p.set("size", String(size));
  return p.toString();
}
```

- [ ] **Step 9: Commit 6-21a**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java \
  backend/app/src/main/java/com/drshoes/app/order/OrderService.java \
  backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java \
  backend/app/src/test/java/com/drshoes/app/order/api/OrderListExtendedIntegrationTest.java \
  apps/web/lib/orders/types.ts \
  apps/web/lib/orders/api-server.ts
git commit -m "$(cat <<'EOF'
feat(order): extend list endpoint — tag, plannedPickupAtFrom/To, multi-status [milestone:6][task:6-21a]

OrderController.list now accepts tag= (JSONB array containment), plannedPickupAtFrom/To=
(LocalDate → Europe/Warsaw Instant), and multi-value status= (List<OrderStatus>).
OrderSpecifications extended accordingly; OrderService signature updated.
Frontend types.ts + api-server.ts buildQuery forwarded.
4 new integration test cases green.

Refs: docs/dispatch-log/6-21a-<UTC>.md
EOF
)"
```

---

#### Main 6-21 steps — `SavedFilterPresets.tsx`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx` (~80 LOC)
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx` — render `<SavedFilterPresets />` between `<OrderViewTabs>` and `<OrdersFilters>`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/SavedFilterPresets.test.tsx`

**Design source:** `admin.jsx:266-272` (chip row styles already in design file; no fresh export needed).

**Review:** combined single-stage.

---

- [ ] **Step 10: Write failing tests**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/SavedFilterPresets.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SavedFilterPresets } from "../SavedFilterPresets";

// next/navigation stub
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/orders",
}));

describe("SavedFilterPresets", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    vi.useFakeTimers();
    // Fix today's date for deterministic URL assertions
    vi.setSystemTime(new Date("2026-06-02T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all three preset chips + the disabled save chip", () => {
    render(<SavedFilterPresets />);
    expect(screen.getByText(/pilne na ten tydzień/i)).toBeInTheDocument();
    expect(screen.getByText(/gotowe do odbioru/i)).toBeInTheDocument();
    expect(screen.getByText(/zaległe/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ zapisz widok/i)).toBeInTheDocument();
  });

  it("clicking Pilne na ten tydzień pushes correct URL params", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/pilne na ten tydzień/i));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("tag=pilne"),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("plannedPickupAtFrom=2026-06-02"),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("plannedPickupAtTo=2026-06-09"),
    );
  });

  it("clicking Gotowe do odbioru pushes status=GOTOWE_DO_ODBIORU", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/gotowe do odbioru/i));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("status=GOTOWE_DO_ODBIORU"),
    );
  });

  it("clicking Zaległe pushes plannedPickupAtTo=yesterday + two statuses", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/zaległe/i));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("plannedPickupAtTo=2026-06-01");
    expect(arg).toContain("status=W_REALIZACJI");
    expect(arg).toContain("status=GOTOWE_DO_ODBIORU");
  });

  it("+ zapisz widok chip is disabled and not clickable", () => {
    render(<SavedFilterPresets />);
    const saveChip = screen.getByText(/\+ zapisz widok/i).closest("button");
    expect(saveChip).toBeDisabled();
    fireEvent.click(saveChip!);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("active chip has visual highlight class when its params match current URL", () => {
    vi.mock("next/navigation", () => ({
      useRouter: () => ({ replace: mockReplace }),
      useSearchParams: () => new URLSearchParams("status=GOTOWE_DO_ODBIORU"),
      usePathname: () => "/admin/orders",
    }));
    render(<SavedFilterPresets />);
    const chip = screen.getByText(/gotowe do odbioru/i).closest("button");
    expect(chip?.className).toMatch(/active|bg-ink|text-paper/);
  });
});
```

- [ ] **Step 11: Run test — confirm RED**

```bash
pnpm -C apps/web test SavedFilterPresets.test.tsx
```

Expected: FAIL — `Cannot find module '../SavedFilterPresets'`.

- [ ] **Step 12: Implement `SavedFilterPresets.tsx`**

Create `apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx`:

```tsx
"use client";

/**
 * Hard-coded saved-filter preset chip row.
 * Three presets per spec §7 (locked). The "+ zapisz widok" chip renders disabled.
 * Chip styles mirror admin.jsx:266-272.
 */
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";

const log = createLogger("saved-filter-presets");

interface Preset {
  label: string;
  /** Returns URLSearchParams entries for this preset. */
  params: () => Record<string, string | string[]>;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildPresets(): Preset[] {
  return [
    {
      label: "Pilne na ten tydzień",
      params: () => {
        const today = new Date();
        const plus7 = new Date(today);
        plus7.setDate(plus7.getDate() + 7);
        return {
          tag: "pilne",
          plannedPickupAtFrom: toIsoDate(today),
          plannedPickupAtTo: toIsoDate(plus7),
        };
      },
    },
    {
      label: "Gotowe do odbioru",
      params: () => ({ status: "GOTOWE_DO_ODBIORU" }),
    },
    {
      label: "Zaległe",
      params: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          plannedPickupAtTo: toIsoDate(yesterday),
          status: ["W_REALIZACJI", "GOTOWE_DO_ODBIORU"],
        };
      },
    },
  ];
}

/** Returns true when the current search params exactly satisfy the preset's params. */
function isActive(
  preset: Preset,
  current: URLSearchParams,
): boolean {
  const required = preset.params();
  for (const [k, v] of Object.entries(required)) {
    if (Array.isArray(v)) {
      const got = current.getAll(k).sort();
      const want = [...v].sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) return false;
    } else {
      if (current.get(k) !== v) return false;
    }
  }
  return true;
}

export function SavedFilterPresets() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presets = buildPresets();

  function applyPreset(preset: Preset) {
    const p = new URLSearchParams();
    p.delete("page");
    const entries = preset.params();
    for (const [k, v] of Object.entries(entries)) {
      if (Array.isArray(v)) {
        v.forEach((x) => p.append(k, x));
      } else {
        p.set(k, v);
      }
    }
    log.info("op=applyPreset", { label: preset.label, params: p.toString() });
    router.replace(`/admin/orders?${p.toString()}` as Route);
  }

  const activeIdx = presets.findIndex((pr) => isActive(pr, searchParams));

  const chipBase = "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-admin-line transition-colors cursor-pointer select-none";
  const chipDefault = chipBase + " bg-admin-surface text-admin-ink hover:bg-acid/10";
  const chipActive  = chipBase + " bg-ink text-paper border-ink";
  const chipPink    = chipBase + " bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200";
  const chipDisabled = chipBase + " bg-transparent border-dashed text-admin-mute cursor-not-allowed opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
      <span className="font-mono text-[11px] text-admin-mute uppercase tracking-widest">
        Presety:
      </span>

      {presets.map((preset, i) => {
        const isFirstPreset = i === 0; // "Pilne" — pink accent per admin.jsx:268
        const active = i === activeIdx;
        const cls = active ? chipActive : isFirstPreset ? chipPink : chipDefault;
        return (
          <button
            key={preset.label}
            type="button"
            className={cls}
            onClick={() => applyPreset(preset)}
            aria-pressed={active}
          >
            {preset.label}
          </button>
        );
      })}

      <button
        type="button"
        className={chipDisabled}
        disabled
        title="Wkrótce: możliwość zapisywania własnych widoków"
        aria-label="Zapisz widok (wkrótce)"
      >
        + zapisz widok
      </button>
    </div>
  );
}
```

- [ ] **Step 13: Run test — GREEN**

```bash
pnpm -C apps/web test SavedFilterPresets.test.tsx
```

Expected: 5 passing.

- [ ] **Step 14: Wire into `page.tsx`**

Edit `apps/web/app/(admin)/admin/orders/page.tsx`.

Add import:
```ts
import { SavedFilterPresets } from "./_components/SavedFilterPresets";
```

In the JSX, after `<OrderViewTabs>` (which ships in W3/6-13) and before `<OrdersFilters>`:

```tsx
{/* W3 adds <OrderViewTabs /> here */}
<SavedFilterPresets />
<OrdersFilters initial={filtersInitial} users={users} />
```

If `OrderViewTabs` is not yet present (W3 not shipped), place `<SavedFilterPresets />` directly before `<OrdersFilters />`.

Also extend `SearchParams` interface to accept the new params so `page.tsx` compiles cleanly:

```ts
interface SearchParams {
  status?: string | string[];
  type?: string | string[];
  craftsmanId?: string;
  q?: string;
  page?: string;
  orderId?: string;
  tag?: string;
  plannedPickupAtFrom?: string;
  plannedPickupAtTo?: string;
}
```

And update the coercion block:

```ts
const status = sp.status
  ? (Array.isArray(sp.status) ? sp.status : [sp.status]) as OrderStatus[]
  : undefined;
const tag = sp.tag;
const plannedPickupAtFrom = sp.plannedPickupAtFrom;
const plannedPickupAtTo = sp.plannedPickupAtTo;
```

Pass `tag`, `plannedPickupAtFrom`, `plannedPickupAtTo` into `listOrdersServer`.

- [ ] **Step 15: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: 0 errors.

- [ ] **Step 16: Commit**

```bash
git add \
  "apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/SavedFilterPresets.test.tsx" \
  "apps/web/app/(admin)/admin/orders/page.tsx"
git commit -m "$(cat <<'EOF'
feat(orders): SavedFilterPresets chip row — three preset definitions, URL param wiring [milestone:6][task:6-21]

Three hard-coded preset chips (Pilne na ten tydzień, Gotowe do odbioru, Zaległe)
push corresponding URL params; active chip highlights; + zapisz widok renders
disabled with wkrótce tooltip. Wired into OrdersPage between view-tabs and filters.
page.tsx SearchParams extended for tag/date-range params added by 6-21a.
5 vitest cases green.

Refs: docs/dispatch-log/6-21-<UTC>.md
EOF
)"
```

**Acceptance:**
- 6-21a: 4 IT cases green; existing suite ≥ baseline + 4, 0 failures.
- 6-21: 5 vitest tests green; `pnpm typecheck` clean; chip row renders in browser; clicking each chip changes the URL correctly.

---

### Task 6-22: `useOrderRowSelection.ts` + `BulkActionBar.tsx`

> **BLOCKED:** Do not start until `handoff/design/m6-bulk-action-bar.html` exists on disk. Verify at dispatch time. Stop and ask the orchestrator if the file is absent.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/useOrderRowSelection.ts` (~60 LOC)
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` — wire checkbox column to selection hook; lift selection state to page
- Create: `apps/web/app/(admin)/admin/orders/_components/BulkActionBar.tsx` (~130 LOC; JSX-density exempt)
- Create: `apps/web/app/(admin)/admin/orders/_components/BulkResultModal.tsx` (~80 LOC; JSX-density exempt)
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx` — wire selection state + bar
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/useOrderRowSelection.test.ts`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/BulkActionBar.test.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/BulkResultModal.test.tsx`

**Design source:** `handoff/design/m6-bulk-action-bar.html` (BLOCK if missing). The result-modal layout is part of the same export per spec §7.

**Review:** TWO-STAGE. Stage 1 lands implementation + tests. Stage 2 reviews bulk semantics: sendTriggers wiring, per-order failure rendering, selection-clear-on-partial-success behavior, and any LOC overruns.

---

- [ ] **Step 1: Write failing tests for `useOrderRowSelection`**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/useOrderRowSelection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderRowSelection } from "../useOrderRowSelection";

const IDS = ["a", "b", "c", "d"];

describe("useOrderRowSelection", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    expect(result.current.selectedIds).toEqual([]);
  });

  it("toggleRow adds an id when not selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("b"));
    expect(result.current.selectedIds).toContain("b");
    expect(result.current.selectedIds).toHaveLength(1);
  });

  it("toggleRow removes an id when already selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("b"));
    act(() => result.current.toggleRow("b"));
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("toggleAll selects all visible ids", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual(IDS);
  });

  it("toggleAll deselects all when all are already selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("clear empties selection", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("selectedIds order is stable (insertion order)", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("c"));
    act(() => result.current.toggleRow("a"));
    expect(result.current.selectedIds).toEqual(["c", "a"]);
  });

  it("isAllSelected is true only when all visible ids are selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(true);
  });

  it("isAllSelected is false when partial selection", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("a"));
    expect(result.current.isAllSelected).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — confirm RED**

```bash
pnpm -C apps/web test useOrderRowSelection.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useOrderRowSelection.ts`**

Create `apps/web/app/(admin)/admin/orders/_components/useOrderRowSelection.ts`:

```ts
"use client";

/**
 * Selection-state hook for the orders table.
 * Manages a Set<string> of selected order IDs.
 * visibleIds is the current page's row IDs — used for toggleAll and isAllSelected.
 */
import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("order-row-selection");

export interface OrderRowSelectionState {
  selectedIds: string[]; isAllSelected: boolean;
  toggleRow: (id: string) => void; toggleAll: () => void; clear: () => void;
}

export function useOrderRowSelection(visibleIds: string[]): OrderRowSelectionState {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        log.info("op=toggleRow action=deselect", { orderId: id });
      } else {
        next.add(id);
        log.info("op=toggleRow action=select", { orderId: id });
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        log.info("op=toggleAll action=clearAll", { count: visibleIds.length });
        return new Set();
      }
      log.info("op=toggleAll action=selectAll", { count: visibleIds.length });
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const clear = useCallback(() => {
    log.info("op=clearSelection");
    setSelected(new Set());
  }, []);

  const selectedIds = Array.from(selected);
  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return { selectedIds, isAllSelected, toggleRow, toggleAll, clear };
}
```

- [ ] **Step 4: Run hook test — GREEN**

```bash
pnpm -C apps/web test useOrderRowSelection.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Write failing tests for `BulkActionBar` and `BulkResultModal`**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/BulkActionBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkActionBar } from "../BulkActionBar";

const mockPost = vi.fn();
vi.mock("@/lib/orders/bulk-api", () => ({
  bulkChangeStatus: (...args: unknown[]) => mockPost(...args),
}));

const baseProps = {
  selectedIds: ["id-1", "id-2"],
  onClear: vi.fn(),
};

describe("BulkActionBar", () => {
  beforeEach(() => {
    mockPost.mockReset();
    vi.mocked(baseProps.onClear).mockReset();
  });

  it("renders when selectedIds is non-empty", () => {
    render(<BulkActionBar {...baseProps} />);
    expect(screen.getByText("2 zaznaczone")).toBeInTheDocument();
  });

  it("does not render when selectedIds is empty", () => {
    const { container } = render(
      <BulkActionBar {...baseProps} selectedIds={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("Anuluj button clears selection", () => {
    render(<BulkActionBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /anuluj/i }));
    expect(baseProps.onClear).toHaveBeenCalled();
  });

  it("Wykonaj button calls bulkChangeStatus with selectedIds and chosen status", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [{ orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" }],
      failed: [],
    });
    render(<BulkActionBar {...baseProps} />);

    // Select a target status in the dropdown
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "W_REALIZACJI" },
    });

    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        orderIds: ["id-1", "id-2"],
        newStatus: "W_REALIZACJI",
        sendTriggers: false, // default
      });
    });
  });

  it("result modal opens after submit and shows success count", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [
        { orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
        { orderId: "id-2", code: "DR-02", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
      ],
      failed: [],
    });
    render(<BulkActionBar {...baseProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "W_REALIZACJI" } });
    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 sukces/i)).toBeInTheDocument();
    });
  });

  it("result modal shows mixed outcomes with failure reasons", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [{ orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" }],
      failed: [{ orderId: "id-2", code: "DR-02", fromStatus: "WYDANE", error: "ILLEGAL_TRANSITION" }],
    });
    render(<BulkActionBar {...baseProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "W_REALIZACJI" } });
    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(screen.getByText(/DR-02/)).toBeInTheDocument();
      expect(screen.getByText(/ILLEGAL_TRANSITION/i)).toBeInTheDocument();
    });
  });
});
```

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/BulkResultModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkResultModal } from "../BulkResultModal";
import type { BulkStatusResult } from "@/lib/orders/bulk-api";

const succeeded = [
  { orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
];
const failed = [
  { orderId: "id-2", code: "DR-02", fromStatus: "WYDANE", error: "ILLEGAL_TRANSITION" as const },
];

describe("BulkResultModal", () => {
  it("renders success rows", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-01")).toBeInTheDocument();
    expect(screen.getByText(/W_REALIZACJI/i)).toBeInTheDocument();
  });

  it("renders failure rows with error reason", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded: [], failed }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-02")).toBeInTheDocument();
    expect(screen.getByText(/ILLEGAL_TRANSITION/i)).toBeInTheDocument();
  });

  it("renders mixed outcomes", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-01")).toBeInTheDocument();
    expect(screen.getByText("DR-02")).toBeInTheDocument();
  });

  it("calls onClose when Zamknij is clicked", () => {
    const onClose = vi.fn();
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run tests — confirm RED**

```bash
pnpm -C apps/web test BulkActionBar.test.tsx BulkResultModal.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 7: Create `lib/orders/bulk-api.ts`**

Create `apps/web/lib/orders/bulk-api.ts`:

```ts
import { createLogger } from "@/lib/log";
import type { OrderStatus } from "./types";

const log = createLogger("orders.bulk-api");

export interface BulkStatusRequest { orderIds: string[]; newStatus: OrderStatus; reason?: string; sendTriggers: boolean; }
export type BulkFailureReason = "ILLEGAL_TRANSITION" | "NOT_FOUND" | "VERSION_CONFLICT" | "UNKNOWN";
export interface BulkSuccessRow { orderId: string; code: string; fromStatus: OrderStatus; toStatus: OrderStatus; }
export interface BulkFailureRow { orderId: string; code: string; fromStatus: OrderStatus; error: BulkFailureReason; }
export interface BulkStatusResult { succeeded: BulkSuccessRow[]; failed: BulkFailureRow[]; }

export async function bulkChangeStatus(req: BulkStatusRequest): Promise<BulkStatusResult> {
  log.info("op=bulkChangeStatus", { count: req.orderIds.length, newStatus: req.newStatus, sendTriggers: req.sendTriggers });
  const resp = await fetch("/api/admin/orders/bulk/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    log.warn("op=bulkChangeStatus outcome=error", { status: resp.status });
    throw new Error(`bulk/status failed: ${resp.status}`);
  }
  const result = (await resp.json()) as BulkStatusResult;
  log.info("op=bulkChangeStatus outcome=ok", { succeeded: result.succeeded.length, failed: result.failed.length });
  return result;
}
```

- [ ] **Step 8: Implement `BulkResultModal.tsx`**

Read `handoff/design/m6-bulk-action-bar.html` for modal layout before writing.

Create `apps/web/app/(admin)/admin/orders/_components/BulkResultModal.tsx`:

```tsx
"use client";

/**
 * Post-bulk-action result dialog.
 * Shows per-order success/failure rows from the 6-9 API response.
 * Layout sourced from handoff/design/m6-bulk-action-bar.html (result-modal section).
 */
import * as Dialog from "@radix-ui/react-dialog";
import type { BulkStatusResult, BulkSuccessRow, BulkFailureRow } from "@/lib/orders/bulk-api";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

interface Props {
  open: boolean;
  result: BulkStatusResult;
  onClose: () => void;
}

const FAILURE_LABELS: Record<string, string> = { ILLEGAL_TRANSITION: "Niedozwolona zmiana", NOT_FOUND: "Nie znaleziono", VERSION_CONFLICT: "Konflikt wersji", UNKNOWN: "Błąd nieznany" };

export function BulkResultModal({ open, result, onClose }: Props) {
  const successCount = result.succeeded.length;
  const failureCount = result.failed.length;
  const total = successCount + failureCount;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          bg-paper rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col">
          <Dialog.Title className="font-semibold text-ink text-base">
            Wynik zmiany zbiorczej ({total} zleceń)
          </Dialog.Title>

          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">{successCount} sukces{successCount !== 1 ? "y" : ""}</span>
            {failureCount > 0 && (
              <span className="text-red-600 font-medium">{failureCount} błąd{failureCount > 1 ? "y" : ""}</span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {result.succeeded.map((row: BulkSuccessRow) => (
              <div key={row.orderId} className="flex items-center justify-between py-2 border-b border-admin-line last:border-0">
                <span className="font-mono text-xs text-admin-ink">{row.code}</span>
                <span className="text-xs text-green-700">{STATUS_LABELS_PL[row.fromStatus as OrderStatus]} → {STATUS_LABELS_PL[row.toStatus as OrderStatus]}</span>
              </div>
            ))}
            {result.failed.map((row: BulkFailureRow) => (
              <div key={row.orderId} className="flex items-center justify-between py-2 border-b border-admin-line last:border-0">
                <span className="font-mono text-xs text-admin-ink">{row.code}</span>
                <span className="text-xs text-red-600">{FAILURE_LABELS[row.error] ?? row.error}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-ink text-paper rounded hover:bg-ink/80 transition-colors"
            >
              Zamknij
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 9: Implement `BulkActionBar.tsx`**

Read `handoff/design/m6-bulk-action-bar.html` for sticky-bar layout before writing.

Create `apps/web/app/(admin)/admin/orders/_components/BulkActionBar.tsx`:

```tsx
"use client";

/**
 * Sticky-bottom bulk-action bar.
 * Appears when ≥ 1 table row is selected.
 * Calls POST /api/admin/orders/bulk/status (6-9) on submit.
 * Layout sourced from handoff/design/m6-bulk-action-bar.html.
 */
import { useState } from "react";
import { createLogger } from "@/lib/log";
import { bulkChangeStatus } from "@/lib/orders/bulk-api";
import type { BulkStatusResult } from "@/lib/orders/bulk-api";
import { STATUS_LABELS_PL, STATUS_ORDER } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";
import { BulkResultModal } from "./BulkResultModal";

const log = createLogger("bulk-action-bar");

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActionBar({ selectedIds, onClear }: Props) {
  const [targetStatus, setTargetStatus] = useState<OrderStatus | "">("");
  const [sendTriggers, setSendTriggers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkStatusResult | null>(null);

  if (selectedIds.length === 0) return null;

  async function handleSubmit() {
    if (!targetStatus) return;
    setBusy(true);
    log.info("op=bulkSubmit", {
      count: selectedIds.length,
      newStatus: targetStatus,
      sendTriggers,
    });
    try {
      const res = await bulkChangeStatus({
        orderIds: selectedIds,
        newStatus: targetStatus,
        sendTriggers,
      });
      setResult(res);
      if (res.failed.length === 0) {
        // Full success — clear selection immediately
        onClear();
      }
    } catch (err) {
      log.error("op=bulkSubmit outcome=error", { err: String(err) });
    } finally {
      setBusy(false);
    }
  }

  function handleResultClose() {
    setResult(null);
    onClear();
  }

  const selectCls = "border border-admin-line rounded px-2 py-1 text-sm bg-paper text-admin-ink focus:outline-none focus:ring-1 focus:ring-acid";

  return (
    <>
      <div
        role="region"
        aria-label="Akcje zbiorcze"
        className="fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-admin-line shadow-lg px-6 py-3 flex flex-wrap items-center gap-4" 
      >
        <span className="text-sm font-medium text-admin-ink">
          {selectedIds.length} zaznaczone
        </span>

        <label className="flex items-center gap-2 text-sm text-admin-mute">
          Zmień status:
          <select
            className={selectCls}
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as OrderStatus | "")}
          >
            <option value="">— wybierz —</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_PL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-admin-mute cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendTriggers}
            onChange={(e) => setSendTriggers(e.target.checked)}
            className="accent-acid"
          />
          Wyślij wyzwalacze
        </label>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-admin-mute hover:text-ink transition-colors"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !targetStatus}
            className="px-4 py-1.5 text-sm rounded bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
          >
            {busy ? "Przetwarzanie…" : "Wykonaj"}
          </button>
        </div>
      </div>

      {result && (
        <BulkResultModal
          open
          result={result}
          onClose={handleResultClose}
        />
      )}
    </>
  );
}
```

- [ ] **Step 10: Wire checkbox column into `OrdersTable.tsx`**

Read `handoff/design/m6-bulk-action-bar.html` for checkbox column styling before editing.

Edit `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx`.

Add the selection props to the `Props` interface:

```ts
interface Props {
  rows: OrderListRow[]; totalPages: number; currentPage: number;
  // Selection props — optional; injected by OrdersPageClient when BulkActionBar is active
  selectedIds?: string[]; isAllSelected?: boolean;
  onToggleRow?: (id: string) => void; onToggleAll?: () => void;
}
```

Add a checkbox `<th>` as the first column header:

```tsx
<th className={thCls + " w-10"}>
  {onToggleAll && <input type="checkbox" checked={isAllSelected ?? false}
    onChange={onToggleAll} className="accent-acid" aria-label="Zaznacz wszystkie" />}
</th>
```

Add a checkbox `<td>` as the first cell in each row:

```tsx
<td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
  {onToggleRow && <input type="checkbox" checked={selectedIds?.includes(row.id) ?? false}
    onChange={() => onToggleRow(row.id)} className="accent-acid"
    aria-label={`Zaznacz zlecenie ${row.code}`} />}
</td>
```

- [ ] **Step 11: Wire into `page.tsx`**

Edit `apps/web/app/(admin)/admin/orders/page.tsx`. Because `page.tsx` is a Server Component, selection state must live in a thin `"use client"` wrapper.

Create `apps/web/app/(admin)/admin/orders/_components/OrdersPageClient.tsx` (~70 LOC):

```tsx
"use client";
import { useOrderRowSelection } from "./useOrderRowSelection";
import { OrdersTable } from "./OrdersTable";
import { BulkActionBar } from "./BulkActionBar";
import type { OrderListRow } from "@/lib/orders/types";

interface Props { rows: OrderListRow[]; totalPages: number; currentPage: number; }

export function OrdersPageClient({ rows, totalPages, currentPage }: Props) {
  const visibleIds = rows.map((r) => r.id);
  const { selectedIds, isAllSelected, toggleRow, toggleAll, clear } = useOrderRowSelection(visibleIds);
  return (
    <>
      <OrdersTable rows={rows} totalPages={totalPages} currentPage={currentPage}
        selectedIds={selectedIds} isAllSelected={isAllSelected}
        onToggleRow={toggleRow} onToggleAll={toggleAll} />
      <BulkActionBar selectedIds={selectedIds} onClear={clear} />
    </>
  );
}
```

In `page.tsx`, replace `<OrdersTable ...>` with `<OrdersPageClient ...>`.

- [ ] **Step 12: Run all tests — GREEN**

```bash
pnpm -C apps/web test useOrderRowSelection.test.ts BulkActionBar.test.tsx BulkResultModal.test.tsx
```

Expected: 9 + 5 + 4 = 18 passing.

- [ ] **Step 13: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: 0 errors.

- [ ] **Step 14: Stage 1 commit**

```bash
git add \
  "apps/web/app/(admin)/admin/orders/_components/useOrderRowSelection.ts" \
  "apps/web/app/(admin)/admin/orders/_components/BulkActionBar.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/BulkResultModal.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/OrdersPageClient.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx" \
  "apps/web/app/(admin)/admin/orders/page.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/useOrderRowSelection.test.ts" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/BulkActionBar.test.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/BulkResultModal.test.tsx" \
  "apps/web/lib/orders/bulk-api.ts"
git commit -m "$(cat <<'EOF'
feat(orders): useOrderRowSelection + BulkActionBar + BulkResultModal [milestone:6][task:6-22]

Row-level checkbox selection hook with toggleRow/toggleAll/clear; OrdersTable
checkbox column wired via OrdersPageClient wrapper (Server→Client boundary).
BulkActionBar sticky-bottom bar with status dropdown + sendTriggers toggle +
anuluj; POSTs to 6-9 bulk endpoint; BulkResultModal shows per-order outcomes.
Selection cleared on full success; modal open on mixed/partial result.
18 vitest tests green. TWO-STAGE: Stage 2 review pending.

Refs: docs/dispatch-log/6-22-<UTC>.md
EOF
)"
```

**Stage 2 review checklist (orchestrator performs before acceptance):**

1. `sendTriggers=true` path: confirm the checkbox value is forwarded correctly in `handleSubmit` and that the backend 6-9 contract semantics match (`true` → trigger fan-out, `false` → status only).
2. Partial-success behavior: confirm `onClear()` is NOT called when `result.failed.length > 0`; modal stays open for user acknowledgment; `handleResultClose` clears selection after modal dismiss.
3. LOC check: `BulkActionBar.tsx` ≤ 170 LOC (JSX-density exempt), `BulkResultModal.tsx` ≤ 120 LOC.
4. `BulkResultModal` `STATUS_LABELS_PL` type-cast: confirm cast from `BulkSuccessRow.fromStatus` (string) to `OrderStatus` is safe or guarded.
5. Confirm `OrdersTable.tsx` total LOC ≤ 150 after checkbox column additions; if overrun, split helpers out.
6. `OrdersPageClient.tsx` must be `"use client"` (verify directive present).

**Acceptance (both stages):**
- 18 vitest cases green.
- `pnpm typecheck` clean.
- Sticky bar appears/disappears with selection; submit calls 6-9; result modal renders both success and failure rows per design export.
- Stage 2 checklist all pass.

---

### Task 6-23: `RowQuickActionsMenu.tsx`

> **BLOCKED:** Do not start until `handoff/design/m6-row-quick-actions-menu.html` exists on disk. Verify at dispatch time. Stop and ask the orchestrator if the file is absent.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/RowQuickActionsMenu.tsx` (~110 LOC; JSX-density exempt)
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` — add a `…` actions cell per row; render `<RowQuickActionsMenu>`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/RowQuickActionsMenu.test.tsx`

**Design source:** `handoff/design/m6-row-quick-actions-menu.html` (BLOCK if missing).

**Review:** combined single-stage.

**Pre-implementation note on `PhotoUploader`:** `PhotoUploader` manages its own `open` state internally — there is no external `open` prop. When "Dodaj zdjęcie" is selected, mount `<PhotoUploader>` conditionally (local `active === "photo"` state); it auto-shows its form on first render. Unmount on `onUploaded` callback.

---

- [ ] **Step 1: Write failing tests**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/RowQuickActionsMenu.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RowQuickActionsMenu } from "../RowQuickActionsMenu";
import type { OrderListRow } from "@/lib/orders/types";

// Mock the child modal components
vi.mock("../StatusChangeConfirm", () => ({
  StatusChangeConfirm: ({ open }: { open: boolean }) =>
    open ? <div data-testid="status-confirm">StatusChangeConfirm</div> : null,
}));
vi.mock("../MessageComposerModal", () => ({
  MessageComposerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="message-composer">MessageComposerModal</div> : null,
}));
vi.mock("../PhotoUploader", () => ({
  PhotoUploader: () => <div data-testid="photo-uploader">PhotoUploader</div>,
}));

// Stub trigger fetch used by StatusChangeConfirm machinery
vi.mock("@/lib/messaging/api", () => ({
  getTriggers: () => Promise.resolve([]),
  changeStatus: () => Promise.resolve({}),
}));

const row: OrderListRow = {
  id: "order-abc-123",
  code: "DR-001",
  clientId: "client-xyz",
  status: "PRZYJETE",
  totalPriceCents: 5000,
  currency: "PLN",
  description: "Naprawa buta",
  plannedPickupAt: null,
  version: 0,
  updatedAt: new Date().toISOString(),
};

describe("RowQuickActionsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button (three-dot)", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /opcje/i })).toBeInTheDocument();
  });

  it("menu opens on trigger button click", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /opcje/i }));
    expect(screen.getByText(/zmień status/i)).toBeInTheDocument();
    expect(screen.getByText(/wyślij wiadomość/i)).toBeInTheDocument();
    expect(screen.getByText(/dodaj zdjęcie/i)).toBeInTheDocument();
  });

  it("clicking Zmień status opens StatusChangeConfirm", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /opcje/i }));
    fireEvent.click(screen.getByText(/zmień status/i));
    expect(screen.getByTestId("status-confirm")).toBeInTheDocument();
  });

  it("clicking Wyślij wiadomość opens MessageComposerModal", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /opcje/i }));
    fireEvent.click(screen.getByText(/wyślij wiadomość/i));
    expect(screen.getByTestId("message-composer")).toBeInTheDocument();
  });

  it("clicking Dodaj zdjęcie mounts PhotoUploader", () => {
    render(<RowQuickActionsMenu row={row} onOrderUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /opcje/i }));
    fireEvent.click(screen.getByText(/dodaj zdjęcie/i));
    expect(screen.getByTestId("photo-uploader")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — confirm RED**

```bash
pnpm -C apps/web test RowQuickActionsMenu.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RowQuickActionsMenu.tsx`**

Read `handoff/design/m6-row-quick-actions-menu.html` for dropdown layout before writing.

Create `apps/web/app/(admin)/admin/orders/_components/RowQuickActionsMenu.tsx`:

```tsx
"use client";

/**
 * Three-dot dropdown menu for a single order row.
 * Uses Radix DropdownMenu (already a dep from M2/M5).
 * Three items: Zmień status, Wyślij wiadomość, Dodaj zdjęcie.
 * Dispatches into existing M1/M2/M3 components; no new endpoints.
 * Layout sourced from handoff/design/m6-row-quick-actions-menu.html.
 */
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createLogger } from "@/lib/log";
import { getTriggers } from "@/lib/messaging/api";
import { changeStatus } from "@/lib/orders/api";
import type { TriggerDto } from "@/lib/messaging/types";
import type { OrderListRow, OrderStatus } from "@/lib/orders/types";
import { StatusChangeConfirm } from "./StatusChangeConfirm";
import type { TriggerPreview } from "./StatusChangeConfirm";
import { MessageComposerModal } from "./MessageComposerModal";
import { PhotoUploader } from "./PhotoUploader";

const log = createLogger("row-quick-actions");

interface Props {
  row: OrderListRow;
  onOrderUpdated: () => void;
}

function previewFor(targetStatus: OrderStatus, triggers: TriggerDto[]): TriggerPreview {
  const matched = triggers.find((t) => {
    if (t.event !== "STATUS_CHANGE") return false;
    try { return (JSON.parse(t.eventParams) as { toStatus?: string }).toStatus === targetStatus; }
    catch { return false; }
  });
  if (!matched) return { kind: "none" };
  if (!matched.enabled) return { kind: "disabled", triggerName: matched.name };
  let channels: string[] = [];
  try { channels = JSON.parse(matched.channels) as string[]; } catch { /* empty */ }
  return { kind: "match", templateName: matched.templateName, channels, delayMinutes: matched.delayMinutes, requiresManualConfirmation: matched.requiresManualConfirmation };
}

type ActivePanel = "status" | "message" | "photo" | null;

export function RowQuickActionsMenu({ row, onOrderUpdated }: Props) {
  const [active, setActive] = useState<ActivePanel>(null);
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [triggers, setTriggers] = useState<TriggerDto[]>([]);
  const [busy, setBusy] = useState(false);

  function openStatus() {
    log.info("op=openStatusPanel", { orderId: row.id });
    getTriggers()
      .then((ts) => setTriggers(ts))
      .catch((err: unknown) => log.error("op=loadTriggers outcome=error", { err }));
    setStatusTarget(null);
    setActive("status");
  }

  async function handleStatusConfirm() {
    if (!statusTarget) return;
    setBusy(true);
    try {
      await changeStatus(row.id, statusTarget, row.version);
      log.info("op=statusChange outcome=ok", { orderId: row.id, to: statusTarget });
      setActive(null);
      onOrderUpdated();
    } catch (err) {
      log.error("op=statusChange outcome=error", { orderId: row.id, err: String(err) });
    } finally {
      setBusy(false);
    }
  }

  const itemCls = "flex items-center gap-2 px-3 py-2 text-sm text-admin-ink rounded cursor-pointer hover:bg-acid/10 focus:bg-acid/10 outline-none";

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Opcje zlecenia"
            className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-admin-line/50 text-admin-mute transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            ···
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[180px] bg-paper rounded-lg shadow-lg border border-admin-line py-1 animate-in fade-in-0 zoom-in-95"
            sideOffset={4}
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => openStatus()}
            >
              Zmień status
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-admin-line my-1" />

            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => {
                log.info("op=openMessagePanel", { orderId: row.id });
                setActive("message");
              }}
            >
              Wyślij wiadomość
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-admin-line my-1" />

            <DropdownMenu.Item
              className={itemCls}
              onSelect={() => {
                log.info("op=openPhotoPanel", { orderId: row.id });
                setActive("photo");
              }}
            >
              Dodaj zdjęcie
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Status change confirm — needs a target status; open a sub-menu step */}
      {active === "status" && (
        <StatusChangeConfirm
          open
          from={row.status}
          to={statusTarget}
          busy={busy}
          triggerPreview={statusTarget ? previewFor(statusTarget, triggers) : { kind: "none" }}
          onConfirm={() => void handleStatusConfirm()}
          onCancel={() => setActive(null)}
        />
      )}

      {/* Message composer */}
      <MessageComposerModal
        orderId={row.id}
        open={active === "message"}
        onOpenChange={(o) => { if (!o) setActive(null); }}
        onSent={() => { setActive(null); onOrderUpdated(); }}
      />

      {/* Photo uploader — mounted in portal when active */}
      {active === "photo" && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-paper rounded-lg shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-medium text-sm">Dodaj zdjęcie — {row.code}</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-admin-mute hover:text-ink text-lg leading-none"
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <PhotoUploader
              orderId={row.id}
              onUploaded={() => { setActive(null); onOrderUpdated(); }}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

**Note on status selection flow:** `StatusChangeConfirm` takes a `to` status; `RowQuickActionsMenu` opens the dialog with `to={null}` (no target yet). Add a `<select>` for the target status above the trigger-preview section in `StatusChangeConfirm` when `to === null`, OR add a minimal inline status-picker step before opening the confirm. Document chosen approach in Findings. If `StatusChangeConfirm.tsx` exceeds 120 LOC after the addition, extract the picker as `StatusSelectRow.tsx`.

- [ ] **Step 4: Wire into `OrdersTable.tsx`**

Read `handoff/design/m6-row-quick-actions-menu.html` for cell placement before editing.

Edit `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx`.

Add to column headers:

```tsx
<th className={thCls + " w-10 text-right"}>
  {/* actions */}
</th>
```

Add to each row's cells (last position):

```tsx
<td
  className="px-2 py-3 text-right"
  onClick={(e) => e.stopPropagation()}
>
  <RowQuickActionsMenu
    row={row}
    onOrderUpdated={() => {
      // Reload the page data (Server Component re-render via router.refresh)
      router.refresh();
    }}
  />
</td>
```

Import `RowQuickActionsMenu` at the top:

```ts
import { RowQuickActionsMenu } from "./RowQuickActionsMenu";
```

- [ ] **Step 5: Run test — GREEN**

```bash
pnpm -C apps/web test RowQuickActionsMenu.test.tsx
```

Expected: 5 passing.

- [ ] **Step 6: Typecheck**

```bash
pnpm -C apps/web typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add \
  "apps/web/app/(admin)/admin/orders/_components/RowQuickActionsMenu.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/__tests__/RowQuickActionsMenu.test.tsx"
git commit -m "$(cat <<'EOF'
feat(orders): RowQuickActionsMenu — three-dot dropdown dispatching into status/message/photo components [milestone:6][task:6-23]

Radix DropdownMenu on every order row; three items open existing StatusChangeConfirm,
MessageComposerModal, and PhotoUploader (wrapped in inline portal overlay).
No new endpoints. 5 vitest cases green.

Refs: docs/dispatch-log/6-23-<UTC>.md
EOF
)"
```

**Acceptance:**
- 5 vitest tests green.
- `pnpm typecheck` clean.
- Three-dot menu opens on click; each item opens the corresponding component; menu closes after selection; row click still opens the drawer (stopPropagation on actions cell).
- Status-change flow: user can select a target status and confirm; message and photo flows work end-to-end.

---

## Milestone closure

After all 23 tasks (6-1..6-23, plus inline 6-21a if it fired) are complete and reviewed, run the closure bar:

- [ ] **Step 1: Backend suite green**

Run: `mvn -B -pl backend/app verify`

Expected: 0 failures, 0 errors, 0 skipped. Suite count target ~325-340 (M5 ended at 301; W1 added ~24, W0/6-1 fixed the carried error).

- [ ] **Step 2: Frontend typecheck**

Run: `pnpm -C apps/web typecheck`

Expected: 0 errors.

- [ ] **Step 3: Frontend build**

Run: `pnpm -C apps/web build`

Expected: build completes, no compile errors, no runtime warnings about missing `"use client"` boundaries.

- [ ] **Step 4: Frontend lint (NEW in M6 closure bar)**

Run: `pnpm -C apps/web lint`

Expected: 0 errors, 0 warnings (or `--max-warnings=0` configured to fail on warnings).

- [ ] **Step 5: Manual smoke pass**

Bring up the dev stack and walk:
1. `/admin` Dashboard renders 4 KPI tiles with real numbers, both charts render, both lower-row panels (Gotowe-do-odbioru + Ostatnie wiadomości) populated.
2. `/admin/orders` Lista loads; click "Pilne na ten tydzień" preset chip → URL params set, table re-filters; tick 2 rows → bulk action bar appears → "Zmień status" → "W realizacji" → submit → result modal shows successes; click three-dot menu on a row → all three items work.
3. `/admin/orders/calendar` renders Month grid for current month; click a calendar cell with orders → drawer opens; "Bez terminu" panel lists undated orders; week/day toggle visibly disabled.
4. `/admin/orders/kanban` renders 5 columns with correct counts; drag a card from "Przyjęte" → "W realizacji" → trigger-preview dialog appears with template; pick "Wyślij wiadomość" → status changes + audit fires + trigger sends; cancel another drag → optimistic move reverts.
5. Dispatch logs for all 23 tasks live under `docs/dispatch-log/6-*.md` with non-empty `Files:`, `Commands:`, `Test summary:`, `Decisions:`, `Commit SHA:` fields.

- [ ] **Step 6: Tag the milestone (local-only, matching prior milestone precedent)**

Run:

```bash
git tag -a milestone-6 -m "M6 — Order processing polish + Dashboard

Dashboard with live KPIs + 2 charts + 2 panels.
Calendar (read-only Month grid + Bez-terminu).
Kanban with drag-to-status + M2 trigger-confirm.
List polish: saved presets + bulk + row quick-actions.
W0 hygiene: AdminWebTestBase FK fix, MessageRouter split,
V013 message_thread uniqueness, pnpm lint verification.

Suite: ~325-340/0/0/0. Frontend lint clean (NEW in closure bar)."
```

Do NOT push the tag (consistent with M0a/0b/1/2/3/4/5 precedent — tags are local).

- [ ] **Step 7: Update CLAUDE.md status row**

Flip `- [ ] Milestone 6: Order processing polish + Dashboard` → `- [x]` in the project root `CLAUDE.md` and update the "next active" pointer to M7.

- [ ] **Step 8: Update ROADMAP.md**

Move M6 from "In flight" to "Done" in `docs/superpowers/ROADMAP.md`. Add the `milestone-6` tag to the table.

- [ ] **Step 9: Commit closure bookkeeping**

```bash
git add CLAUDE.md docs/superpowers/ROADMAP.md docs/dispatch-log/tasks.json
git commit -m "docs: mark Milestone 6 complete [milestone:6][task:6-closure]

Refs: docs/dispatch-log/6-closure-<UTC>.md"
```

## Hygiene debt parked for M7

Per spec §11:
- Async / batched bulk-status fan-out if the synchronous run gets slow at >50-order calls.
- Calendar drag-to-reschedule (heaviest deferred item from M6 candidate scope).
- Calendar Week & Day grid views.
- Inline cell edit on the orders table.
- Keyboard shortcuts.
- Custom user-defined saved presets ("+ zapisz widok").
- "Najnowsze rezerwacje ze sklepu" Dashboard panel — gated on Sklep real implementation.
- Order history-as-tab restructure of the OrderDrawer Timeline.

These are not M6 scope. Capture any newly-discovered M6 follow-up in this section as it surfaces.
