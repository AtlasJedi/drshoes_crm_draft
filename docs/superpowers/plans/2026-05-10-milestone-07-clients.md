# Milestone 7 — Clients UI + Sklep/Aktualności stubs — Implementation Plan (Slice A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round out admin nav with the `/admin/clients` dossier surface (lookup-first), two minimal placeholder pages for Sklep + Aktualności, and all backend wiring the frontend depends on. Wave 1 (this slice) delivers the four backend tasks; later slices deliver frontend.

**Architecture:** No new packages or migrations. Wave 1 extends three existing controller/service/spec stacks and adds one new service + controller under `client/api/`. Backend-only. No schema change (all entity columns already exist).

**Tech Stack:** Java 21 + Spring Boot 3.4, Maven multi-module `backend/app`. Spring Security session-based auth, Postgres 16, Testcontainers for ITs. Test naming: `*IntegrationTest.java` (NOT `*IT.java`). IT base classes: `AdminWebTestBase` (authenticated controller tests), `AbstractIntegrationTest` (repo/service-only tests).

---

## ERRATA — pre-execution clarifications (read before any task)

1. **`countByClientIdAndUnreadCountGreaterThan` is missing the `DiscardedAtIsNull` clause.** The derived method name in `MessageThreadRepository` does NOT filter discarded threads. Task 7-4 MUST either rename it (adding `AndDiscardedAtIsNull`) or add a new `@Query` method for the summary path. The spec contract is "non-discarded threads where unread_count > 0". Implementers: inspect the existing method at dispatch time and note the chosen fix in Findings.

2. **`OrderStatus` has 7 values, not 6.** Enum values are: `WSTEPNIE_PRZYJETE`, `PRZYJETE`, `W_REALIZACJI`, `CZEKA_NA_KLIENTA`, `GOTOWE_DO_ODBIORU`, `WYDANE`, `ANULOWANE`. The "closed" set for `openOrderCount` in `ClientSummaryService` is `WYDANE` + `ANULOWANE`. The `WSTEPNIE_PRZYJETE` status is active and must NOT be in the closed set.

3. **`ClientDto` is missing `preferredChannel` and `rodoConsentAt`.** The existing `ClientDto.java` record does not expose these two fields. Task 7-1 MUST add them to the record and update `ClientDto.of(Client)` so the PATCH response reflects the new values. This also means the TS `types.ts` `ClientDto` interface (which already declares optional `preferredChannel?` and `rodoConsentAt?`) will correctly type the enriched response.

4. **`Client.preferredChannel` has a DB default of `"EMAIL"`.** The entity field is initialized to `"EMAIL"` in Java. The `UpdateClientRequest` extension should only overwrite it when the incoming value is non-null. The allowed set is `EMAIL`, `SMS`, `WHATSAPP` (NOT `NONE` — check the DB CHECK constraint at dispatch time by reading the Flyway migration).

5. **`OrderController.list` param name for assignee is `craftsmanId`, not `assigneeId`.** The existing controller exposes `@RequestParam(required = false) UUID craftsmanId` and passes it as `assigneeId` to `OrderService.list`. Adding `clientId` adds a new orthogonal param — do not rename the existing one.

6. **`ThreadController` uses `@AuthenticationPrincipal AdminPrincipal actor`.** The existing `list` method resolves the principal this way. Task 7-3 adds a `@RequestParam(required = false) UUID clientId` alongside the existing `filter`/`channel`/`q` params. When `clientId` is present the method returns early (skip the filter/q branch), so the actor log line still fires.

7. **No `Co-Authored-By:` lines** in any commit message.

8. **LOC caps:** Java classes < 120 LOC. `ClientSummaryService` and `ClientSummaryControllerIntegrationTest` are expected to be close to the ceiling — implementers must note final LOC in Findings. If either hits 120+, extract a helper.

### Findings (filled by implementers)

_None yet — implementers add discoveries here as tasks ship._

---

## Wave 1 — Backend

### Task 7-1: Extend `UpdateClientRequest` + `ClientService.update` for `preferredChannel` + `rodoConsent`

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/client/dto/UpdateClientRequest.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/client/dto/ClientDto.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/client/ClientService.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/client/ClientServiceTest.java`

**Review:** combined single-stage.

---

**Background:** The `Client` entity already has `preferredChannel` (String, default `"EMAIL"`) and `rodoConsentAt` (Instant, nullable). Neither is exposed in `ClientDto` nor writable via `UpdateClientRequest`. This task wires both gaps.

Contract:
- `preferredChannel` (non-null incoming): validated against `Set.of("EMAIL","SMS","WHATSAPP")`. Invalid → `IllegalArgumentException("Invalid preferredChannel: " + v)`, which the existing `ClientExceptionHandler` maps to 400.
- `rodoConsent` (Boolean tri-state): `true` → `rodoConsentAt = Instant.now()`; `false` → `rodoConsentAt = null`; `null` → no change.
- `ClientDto` gains `preferredChannel` and `rodoConsentAt` fields so the PATCH response reflects the updated values.
- Structured log line in `ClientService.update`: add `rodoChanged=<true|false>` when the toggle moved (i.e., when `req.rodoConsent()` is non-null).

---

- [ ] **Step 1: RED — add failing tests to `ClientServiceTest`**

Open `backend/app/src/test/java/com/drshoes/app/client/ClientServiceTest.java` and add the following test methods after the existing ones:

```java
@Test
void updateSetsPreferredChannel() {
    Client c = clientWithPhone();
    c.setId(UUID.randomUUID());
    when(repo.findById(c.getId())).thenReturn(Optional.of(c));
    when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

    var dto = svc.update(c.getId(),
        new UpdateClientRequest(null, null, null, null, "SMS", null, null));

    assertThat(dto.preferredChannel()).isEqualTo("SMS");
    assertThat(c.getPreferredChannel()).isEqualTo("SMS");
}

@Test
void updateRejectsInvalidChannel() {
    Client c = clientWithPhone();
    c.setId(UUID.randomUUID());
    when(repo.findById(c.getId())).thenReturn(Optional.of(c));

    assertThatThrownBy(() -> svc.update(c.getId(),
            new UpdateClientRequest(null, null, null, null, "CARRIER_PIGEON", null, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invalid preferredChannel");
    verify(repo, never()).save(any());
}

@Test
void updateGrantsRodoConsent() {
    Client c = clientWithPhone();
    c.setId(UUID.randomUUID());
    c.setRodoConsentAt(null);
    when(repo.findById(c.getId())).thenReturn(Optional.of(c));
    when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

    var dto = svc.update(c.getId(),
        new UpdateClientRequest(null, null, null, null, null, true, null));

    assertThat(dto.rodoConsentAt()).isNotNull();
    assertThat(c.getRodoConsentAt()).isNotNull();
}

@Test
void updateRevokesRodoConsent() {
    Client c = clientWithPhone();
    c.setId(UUID.randomUUID());
    c.setRodoConsentAt(Instant.now());
    when(repo.findById(c.getId())).thenReturn(Optional.of(c));
    when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

    var dto = svc.update(c.getId(),
        new UpdateClientRequest(null, null, null, null, null, false, null));

    assertThat(dto.rodoConsentAt()).isNull();
    assertThat(c.getRodoConsentAt()).isNull();
}

@Test
void updateLeaveRodoAloneWhenNull() {
    Instant original = Instant.parse("2025-01-01T00:00:00Z");
    Client c = clientWithPhone();
    c.setId(UUID.randomUUID());
    c.setRodoConsentAt(original);
    when(repo.findById(c.getId())).thenReturn(Optional.of(c));
    when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

    svc.update(c.getId(),
        new UpdateClientRequest(null, null, null, null, null, null, null));

    assertThat(c.getRodoConsentAt()).isEqualTo(original);
}

// helper — add alongside existing client(String,String) helper
private Client clientWithPhone() {
    Client c = new Client();
    c.setFirstName("Jan");
    c.setPhone("+48600000001");
    return c;
}
```

Also add `import java.time.Instant;` to the import block if not already present.

- [ ] **Step 2: RED verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ClientServiceTest -q 2>&1 | tail -20
```

Expected: 5 new tests fail (compilation errors or assertion failures).

- [ ] **Step 3: GREEN — extend `UpdateClientRequest`**

Replace `backend/app/src/main/java/com/drshoes/app/client/dto/UpdateClientRequest.java` with:

```java
package com.drshoes.app.client.dto;

import jakarta.validation.constraints.Size;

/**
 * Partial-update request for a Client.
 *
 * preferredChannel: when non-null, must be one of EMAIL|SMS|WHATSAPP.
 *   Validated in ClientService.update (not via Jakarta constraint) so the
 *   error message is domain-meaningful.
 * rodoConsent: tri-state Boolean — true=grant, false=revoke, null=no change.
 */
public record UpdateClientRequest(
    @Size(max = 80) String firstName,
    @Size(max = 80) String lastName,
    @Size(max = 40) String phone,
    @Size(max = 120) String email,
    String preferredChannel,
    Boolean rodoConsent,
    @Size(max = 2000) String notes
) {}
```

- [ ] **Step 4: GREEN — extend `ClientDto`**

Replace `backend/app/src/main/java/com/drshoes/app/client/dto/ClientDto.java` with:

```java
package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;

import java.time.Instant;
import java.util.UUID;

/**
 * Full client projection returned by read + mutation endpoints.
 *
 * preferredChannel and rodoConsentAt were previously absent from the record
 * (entity-level concern only). Added in M7 task 7-1 to support the client
 * dossier page header and the EditClientModal response.
 */
public record ClientDto(
    UUID id,
    String firstName,
    String lastName,
    String phone,
    String email,
    String preferredChannel,
    String notes,
    Instant rodoConsentAt,
    Instant createdAt,
    Instant updatedAt
) {
    public static ClientDto of(Client c) {
        return new ClientDto(
            c.getId(), c.getFirstName(), c.getLastName(),
            c.getPhone(), c.getEmail(),
            c.getPreferredChannel(), c.getNotes(),
            c.getRodoConsentAt(),
            c.getCreatedAt(), c.getUpdatedAt());
    }
}
```

- [ ] **Step 5: GREEN — extend `ClientService.update`**

Replace the `update` method body and add the `VALID_CHANNELS` constant in `backend/app/src/main/java/com/drshoes/app/client/ClientService.java`:

```java
    private static final java.util.Set<String> VALID_CHANNELS =
        java.util.Set.of("EMAIL", "SMS", "WHATSAPP");
```

Add this constant field directly after `private static final int SEARCH_MAX = 20;`.

Then replace the `update` method:

```java
    @Transactional
    public ClientDto update(UUID id, UpdateClientRequest req) {
        Client c = repo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new ClientNotFoundException(id));
        if (req.firstName() != null) c.setFirstName(req.firstName().trim());
        if (req.lastName()  != null) c.setLastName(req.lastName().trim());
        String newPhone = req.phone() != null ? req.phone() : c.getPhone();
        String newEmail = req.email() != null ? req.email() : c.getEmail();
        validateContactPresent(newPhone, newEmail);
        if (req.phone() != null) c.setPhone(req.phone());
        if (req.email() != null) c.setEmail(req.email());
        if (req.notes() != null) c.setNotes(req.notes());
        if (req.preferredChannel() != null) {
            if (!VALID_CHANNELS.contains(req.preferredChannel())) {
                throw new IllegalArgumentException(
                    "Invalid preferredChannel: " + req.preferredChannel()
                    + ". Must be one of " + VALID_CHANNELS);
            }
            c.setPreferredChannel(req.preferredChannel());
        }
        boolean rodoChanged = req.rodoConsent() != null;
        if (Boolean.TRUE.equals(req.rodoConsent()))  c.setRodoConsentAt(Instant.now());
        if (Boolean.FALSE.equals(req.rodoConsent())) c.setRodoConsentAt(null);
        log.info("op=updateClient clientId={} rodoChanged={} outcome=ok", id, rodoChanged);
        return ClientDto.of(repo.save(c));
    }
```

- [ ] **Step 6: GREEN verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ClientServiceTest -q 2>&1 | tail -20
```

Expected: all `ClientServiceTest` tests pass (5 existing + 5 new = 10 green).

- [ ] **Step 7: Full suite verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app verify -q 2>&1 | tail -30
```

Expected: suite green (all existing tests pass; 5 new green).

- [ ] **Step 8: Commit**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add backend/app/src/main/java/com/drshoes/app/client/dto/UpdateClientRequest.java \
        backend/app/src/main/java/com/drshoes/app/client/dto/ClientDto.java \
        backend/app/src/main/java/com/drshoes/app/client/ClientService.java \
        backend/app/src/test/java/com/drshoes/app/client/ClientServiceTest.java
git commit -m "$(cat <<'EOF'
feat(client): extend UpdateClientRequest with preferredChannel + rodoConsent [milestone:7][task:7-1]

- UpdateClientRequest gains preferredChannel (validated EMAIL|SMS|WHATSAPP) and rodoConsent
  (Boolean tri-state: true=grant now, false=revoke, null=no-change)
- ClientDto now exposes preferredChannel and rodoConsentAt for the dossier header response
- ClientService.update validates channel, applies tri-state RODO logic, logs rodoChanged=
- 5 new ClientServiceTest cases: setChannel, invalidChannel, grantRodo, revokeRodo, leaveAlone

Refs: docs/dispatch-log/7-1-<UTC>.md
EOF
)"
```

---

### Task 7-2: Add `clientId` filter param to `OrderController.list` → `OrderService.list` → `OrderSpecifications.forList`

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java`

**Review:** combined single-stage.

---

**Background:** The client dossier's `/admin/clients/[id]/zlecenia` tab calls `GET /api/admin/orders?clientId=<uuid>`. Currently `OrderController.list` has no `clientId` param and `OrderSpecifications.forList` has no such predicate. This task adds the plumbing end-to-end with a single new integration test that proves filtering.

---

- [ ] **Step 1: RED — add failing test to `OrderControllerIntegrationTest`**

Open `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java` and add the following test method. Place it after the last existing test method but before the closing brace of the class. Also verify the file already imports `UUID` — it does.

```java
    @Test
    void listFiltersByClientId() throws Exception {
        loginAsOwner();

        // Seed a second client whose orders must NOT appear in the filtered list.
        var otherClient = new Client();
        otherClient.setFirstName("Other");
        otherClient.setPhone("+48 600 999 111");
        UUID otherClientId = clientRepository.save(otherClient).getId();

        // Create one order for our seeded clientId and one for otherClientId.
        String orderForClient = """
            {"clientId":"%s","description":"for main client"}""".formatted(clientId);
        String orderForOther  = """
            {"clientId":"%s","description":"for other client"}""".formatted(otherClientId);

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content(orderForClient)
                .with(csrf()))
            .andExpect(status().isCreated());

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content(orderForOther)
                .with(csrf()))
            .andExpect(status().isCreated());

        // GET /api/admin/orders?clientId=<clientId> must return exactly 1 row.
        mockMvc().perform(get("/api/admin/orders?clientId=" + clientId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].description").value("for main client"));
    }
```

- [ ] **Step 2: RED verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=OrderControllerIntegrationTest#listFiltersByClientId -q 2>&1 | tail -20
```

Expected: test fails (400 or result count mismatch — `clientId` param is unknown).

- [ ] **Step 3: GREEN — extend `OrderSpecifications.forList`**

Replace `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java` with:

```java
package com.drshoes.app.order;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Static factory for JPA Specifications used when listing Orders.
 * Extracted per the granular-code rule — keeps OrderService and OrderController
 * under the 120 LOC ceiling.
 *
 * Tag predicate uses {@code jsonb_contains(tags, jsonb_build_array(tag))} which
 * maps to the Postgres {@code @>} operator. Hibernate passes unknown function names
 * through to the DB verbatim, so no custom dialect registration is required.
 */
public final class OrderSpecifications {

    private OrderSpecifications() {}

    /**
     * Builds a Specification that combines all optional filter predicates.
     *
     * @param clientId when non-null, restricts results to orders for that client (M7)
     */
    public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                               List<OrderItemKind> kinds, String q,
                                               String tag, Instant plannedPickupAtFrom,
                                               Instant plannedPickupAtTo, UUID clientId) {
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
                preds.add(cb.isTrue(
                    cb.function("jsonb_contains", Boolean.class,
                        root.get("tags"),
                        cb.function("jsonb_build_array", Object.class,
                            cb.literal(tag)))));
            }
            if (plannedPickupAtFrom != null)
                preds.add(cb.greaterThanOrEqualTo(root.get("plannedPickupAt"), plannedPickupAtFrom));
            if (plannedPickupAtTo != null)
                preds.add(cb.lessThan(root.get("plannedPickupAt"), plannedPickupAtTo));
            if (clientId != null)
                preds.add(cb.equal(root.get("clientId"), clientId));
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
```

- [ ] **Step 4: GREEN — extend `OrderService.list`**

In `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`, replace the `list` method signature and body:

```java
    @Transactional(readOnly = true)
    public Page<OrderListRow> list(List<OrderStatus> statuses, UUID assigneeId,
                                   List<OrderItemKind> kinds, String q,
                                   String tag, Instant plannedPickupAtFrom,
                                   Instant plannedPickupAtTo, UUID clientId,
                                   Pageable pageable) {
        return orderRepo.findAll(
            OrderSpecifications.forList(statuses, assigneeId, kinds, q, tag,
                                        plannedPickupAtFrom, plannedPickupAtTo, clientId),
            pageable).map(OrderListRow::of);
    }
```

- [ ] **Step 5: GREEN — extend `OrderController.list`**

In `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java`, replace the `list` method:

```java
    @GetMapping
    public Page<OrderListRow> list(
            @RequestParam(required = false) List<OrderStatus> status,
            @RequestParam(required = false, name = "type") List<OrderItemKind> kinds,
            @RequestParam(required = false) UUID craftsmanId,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtTo,
            Pageable pageable,
            Authentication auth) {
        Instant from = plannedPickupAtFrom != null
            ? plannedPickupAtFrom.atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
        Instant to = plannedPickupAtTo != null
            ? plannedPickupAtTo.plusDays(1).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
        log.info("op=listOrders actor={} clientId={} tag={} from={} to={} outcome=ok",
            actor(auth), clientId, tag, from, to);
        return svc.list(status, craftsmanId, kinds, q, tag, from, to, clientId, pageable);
    }
```

- [ ] **Step 6: GREEN verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=OrderControllerIntegrationTest -q 2>&1 | tail -20
```

Expected: all `OrderControllerIntegrationTest` tests pass including `listFiltersByClientId`.

- [ ] **Step 7: Full suite verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app verify -q 2>&1 | tail -30
```

Expected: suite green; caller-site compile error would surface in BulkStatusController or any other class calling `svc.list(...)` — fix any such callers if the compiler complains (add `null` for the new `clientId` param).

- [ ] **Step 8: Commit**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java \
        backend/app/src/main/java/com/drshoes/app/order/OrderService.java \
        backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java \
        backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(orders): add clientId filter param to GET /api/admin/orders [milestone:7][task:7-2]

- OrderSpecifications.forList gains an optional clientId predicate (cb.equal root.clientId)
- OrderService.list and OrderController.list both extend their signature with UUID clientId
- New integration test listFiltersByClientId proves only the correct client's order is returned

Refs: docs/dispatch-log/7-2-<UTC>.md
EOF
)"
```

---

### Task 7-3: Add `clientId` filter param to `ThreadController.list` + new `MessageThreadRepository` derived method

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java`

**Review:** combined single-stage.

---

**Background:** The client dossier's `/admin/clients/[id]/wiadomosci` tab calls `GET /api/admin/threads?clientId=<uuid>`. Currently `ThreadController.list` has no such param. When `clientId` is present the method bypasses the `filter`/`channel`/`q` branch and returns all non-discarded threads for that client ordered by `last_message_at DESC`. A new derived method on `MessageThreadRepository` provides this query.

---

- [ ] **Step 1: RED — add failing test to `ThreadControllerIntegrationTest`**

Open `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java` and add the following test method. Place it after the last existing test method. The existing test class extends `AbstractIntegrationTest`, uses `@AutoConfigureMockMvc`, and already has `clientId` + `matchedThreadId` fields seeded in `@BeforeEach`.

```java
    @Test
    @DisplayName("GET /api/admin/threads?clientId= returns only threads for that client")
    void listByClientIdReturnsMatchedThreadsOnly() throws Exception {
        // Seed a second client with its own thread — must NOT appear in filtered result.
        var otherClient = new Client();
        otherClient.setFirstName("Other");
        otherClient.setEmail("other@example.com");
        otherClient.setPhone("+48500000999");
        UUID otherClientId = clientRepo.save(otherClient).getId();

        var otherThread = new MessageThreadEntity();
        otherThread.setClientId(otherClientId);
        otherThread.setChannel("SMS");
        otherThread.setUnreadCount(0);
        threadRepo.save(otherThread);

        // Request threads for the seeded clientId — should return only matchedThread.
        mockMvc.perform(get("/api/admin/threads?clientId=" + clientId)
                .with(authentication(ownerAuth())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    // Helper — build owner authentication token matching ThreadControllerIntegrationTest convention
    private static org.springframework.security.core.Authentication ownerAuth() {
        var principal = new com.drshoes.app.auth.principal.AdminPrincipal(
            UUID.randomUUID(), "owner@test.pl", "OWNER");
        return UsernamePasswordAuthenticationToken.authenticated(
            principal, null,
            List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
    }
```

Note: the existing `ThreadControllerIntegrationTest` already imports `authentication`, `UsernamePasswordAuthenticationToken`, `SimpleGrantedAuthority`, and `List` — verify at dispatch time and add any missing imports.

- [ ] **Step 2: RED verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ThreadControllerIntegrationTest#listByClientIdReturnsMatchedThreadsOnly -q 2>&1 | tail -20
```

Expected: test fails (400 or result count mismatch).

- [ ] **Step 3: GREEN — add derived method to `MessageThreadRepository`**

Open `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java` and add the following method after the existing `countByClientIdAndUnreadCountGreaterThan` method:

```java
    /**
     * Returns all non-discarded threads for a known client, ordered newest-first.
     * Used by ThreadController.list when clientId query param is present (M7 client dossier).
     * Replaces the filter/channel/q branch when clientId is supplied.
     */
    List<MessageThreadEntity> findAllByClientIdAndDiscardedAtIsNullOrderByLastMessageAtDesc(UUID clientId);
```

- [ ] **Step 4: GREEN — extend `ThreadController.list`**

In `backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java`, replace the `list` method:

```java
    @GetMapping
    public List<MessageThreadDto> list(
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID clientId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=threads.list actor={} clientId={} filter={} channel={} q={}",
            actor.email(), clientId, filter, channel, q);
        List<MessageThreadEntity> raw;
        if (clientId != null) {
            raw = threads.findAllByClientIdAndDiscardedAtIsNullOrderByLastMessageAtDesc(clientId);
            Map<UUID, Client> clientsById = loadClients(raw);
            log.info("op=threads.list actor={} clientId={} outcome=ok count={}",
                actor.email(), clientId, raw.size());
            return raw.stream()
                .map(t -> toDto(t, t.getClientId() == null ? null : clientsById.get(t.getClientId())))
                .toList();
        }
        if (q != null && q.length() >= 2) {
            raw = threads.searchThreads(q, channel);
        } else {
            raw = switch (filter.toUpperCase()) {
                case "UNREAD"    -> threads.findAllWithUnreadOrderByLastMessageAtDesc(channel);
                case "UNMATCHED" -> threads.findAllUnmatchedOrderByLastMessageAtDesc(channel);
                default          -> threads.findAllActiveOrderByLastMessageAtDesc(channel);
            };
        }
        Map<UUID, Client> clientsById = loadClients(raw);
        log.info("op=threads.list actor={} outcome=ok count={}", actor.email(), raw.size());
        return raw.stream()
            .map(t -> toDto(t, t.getClientId() == null ? null : clientsById.get(t.getClientId())))
            .toList();
    }
```

Also add `import java.util.UUID;` if not already present (it is — verify).

- [ ] **Step 5: GREEN verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ThreadControllerIntegrationTest -q 2>&1 | tail -20
```

Expected: all `ThreadControllerIntegrationTest` tests pass.

- [ ] **Step 6: Full suite verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app verify -q 2>&1 | tail -30
```

Expected: suite green.

- [ ] **Step 7: Commit**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
        backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(threads): add clientId filter param to GET /api/admin/threads [milestone:7][task:7-3]

- MessageThreadRepository gains findAllByClientIdAndDiscardedAtIsNull...Desc derived method
- ThreadController.list short-circuits on clientId param, bypassing filter/q branch
- New integration test proves only the target client's threads are returned

Refs: docs/dispatch-log/7-3-<UTC>.md
EOF
)"
```

---

### Task 7-4: New `ClientSummaryService` + `ClientSummaryDto` + `GET /api/admin/clients/{id}/summary`

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/client/dto/ClientSummaryDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/client/ClientSummaryService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/client/api/ClientSummaryController.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/client/ClientSummaryServiceTest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/client/ClientSummaryControllerIntegrationTest.java`

**Review:** TWO-STAGE. Stage 1 implements. Stage 2 verifies: SQL correctness (soft-deleted orders excluded, WYDANE+ANULOWANE = closed, discarded threads excluded from unreadThreadCount), count accuracy, RBAC parity with other read-only client endpoints.

---

**Background:** The client dossier header shows 4 KPI tiles: total orders, open (active) orders, last order date, and unread thread count. These require aggregate queries not available from existing endpoints. A new dedicated service + controller provides `GET /api/admin/clients/{id}/summary` returning `ClientSummaryDto`.

**SQL strategy (chosen at plan-write for simplicity):** 3 separate JPQL/derived queries on `OrderRepository` + 1 count query on `MessageThreadRepository`. No native aggregate. `OrderRepository` already has `countByStatusNotDeleted` but not a clientId-scoped variant — add two new `@Query` methods.

**RODO-correctness note:** `countByClientIdAndUnreadCountGreaterThan` in `MessageThreadRepository` does NOT filter discarded threads (method name lacks `AndDiscardedAtIsNull`). Task 7-4 adds a new method `countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan` and uses it exclusively in `ClientSummaryService`. The old method is preserved for existing callers.

---

#### Stage 1 — Implement

- [ ] **Step 1: RED — create `ClientSummaryServiceTest`**

Create `backend/app/src/test/java/com/drshoes/app/client/ClientSummaryServiceTest.java`:

```java
package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ClientSummaryService.
 *
 * Verifies:
 *  - all 4 summary fields are derived from repository calls
 *  - open order count = total - closed (WYDANE + ANULOWANE)
 *  - missing / soft-deleted client throws ClientNotFoundException
 *  - unreadThreadCount uses the discarded-at-filtered count method
 */
class ClientSummaryServiceTest {

    private final ClientRepository clientRepo    = mock(ClientRepository.class);
    private final OrderRepository  orderRepo     = mock(OrderRepository.class);
    private final MessageThreadRepository threadRepo = mock(MessageThreadRepository.class);

    private final ClientSummaryService svc =
        new ClientSummaryService(clientRepo, orderRepo, threadRepo);

    @Test
    void summaryReturnsCounts() {
        UUID clientId = UUID.randomUUID();
        Client c = new Client();
        c.setId(clientId);
        c.setFirstName("Jan");
        c.setPhone("+48600000001");
        when(clientRepo.findById(clientId)).thenReturn(Optional.of(c));

        Instant lastOrder = Instant.parse("2025-03-15T10:00:00Z");
        when(orderRepo.countByClientIdAndDeletedAtIsNull(clientId)).thenReturn(5L);
        when(orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                eq(clientId), anyList())).thenReturn(2L);
        when(orderRepo.findLastOrderCreatedAtByClientId(clientId))
                .thenReturn(Optional.of(lastOrder));
        when(threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                clientId, 0)).thenReturn(3L);

        var dto = svc.getSummary(clientId);

        assertThat(dto.clientId()).isEqualTo(clientId);
        assertThat(dto.orderCount()).isEqualTo(5);
        assertThat(dto.openOrderCount()).isEqualTo(3); // 5 - 2 closed
        assertThat(dto.lastOrderAt()).isEqualTo(lastOrder);
        assertThat(dto.unreadThreadCount()).isEqualTo(3);
    }

    @Test
    void summaryWithNoOrdersReturnsNullLastOrder() {
        UUID clientId = UUID.randomUUID();
        Client c = new Client();
        c.setId(clientId);
        c.setFirstName("Empty");
        c.setPhone("+48600000002");
        when(clientRepo.findById(clientId)).thenReturn(Optional.of(c));
        when(orderRepo.countByClientIdAndDeletedAtIsNull(clientId)).thenReturn(0L);
        when(orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                eq(clientId), anyList())).thenReturn(0L);
        when(orderRepo.findLastOrderCreatedAtByClientId(clientId))
                .thenReturn(Optional.empty());
        when(threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                clientId, 0)).thenReturn(0L);

        var dto = svc.getSummary(clientId);

        assertThat(dto.orderCount()).isEqualTo(0);
        assertThat(dto.openOrderCount()).isEqualTo(0);
        assertThat(dto.lastOrderAt()).isNull();
        assertThat(dto.unreadThreadCount()).isEqualTo(0);
    }

    @Test
    void summaryThrowsForMissingClient() {
        UUID id = UUID.randomUUID();
        when(clientRepo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.getSummary(id))
            .isInstanceOf(ClientNotFoundException.class);
    }

    @Test
    void summaryThrowsForSoftDeletedClient() {
        UUID id = UUID.randomUUID();
        Client c = new Client();
        c.setId(id);
        c.setFirstName("Gone");
        c.setPhone("+48600000003");
        c.setDeletedAt(Instant.now());
        when(clientRepo.findById(id)).thenReturn(Optional.of(c));
        assertThatThrownBy(() -> svc.getSummary(id))
            .isInstanceOf(ClientNotFoundException.class);
    }
}
```

- [ ] **Step 2: RED — create `ClientSummaryControllerIntegrationTest`**

Create `backend/app/src/test/java/com/drshoes/app/client/ClientSummaryControllerIntegrationTest.java`:

```java
package com.drshoes.app.client;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/admin/clients/{id}/summary.
 *
 * Verifies:
 *  - happy path returns correct counts for orders + threads
 *  - soft-deleted orders are excluded from orderCount
 *  - WYDANE orders are excluded from openOrderCount
 *  - discarded threads are excluded from unreadThreadCount
 *  - 404 for unknown clientId
 *  - 401 for unauthenticated request
 */
class ClientSummaryControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private ClientRepository  clientRepo;
    @Autowired private OrderRepository   orderRepo;
    @Autowired private MessageThreadRepository threadRepo;

    @AfterEach
    void cleanupDependents() {
        threadRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    @Test
    void summaryHappyPath() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Anna", "+48600111000");

        // 3 active orders, 1 WYDANE (closed), 1 soft-deleted (must not count)
        seedOrder(clientId, OrderStatus.PRZYJETE, false);
        seedOrder(clientId, OrderStatus.W_REALIZACJI, false);
        seedOrder(clientId, OrderStatus.GOTOWE_DO_ODBIORU, false);
        seedOrder(clientId, OrderStatus.WYDANE, false);
        seedOrder(clientId, OrderStatus.PRZYJETE, true); // soft-deleted

        // 2 unread threads, 1 discarded unread (must not count), 1 read (must not count)
        seedThread(clientId, 2, false);
        seedThread(clientId, 1, true);  // discarded
        seedThread(clientId, 0, false); // read — unreadCount=0

        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clientId").value(clientId.toString()))
            .andExpect(jsonPath("$.orderCount").value(4))       // 3 active + 1 WYDANE (not deleted)
            .andExpect(jsonPath("$.openOrderCount").value(3))   // 4 total - 1 WYDANE
            .andExpect(jsonPath("$.lastOrderAt").isNotEmpty())
            .andExpect(jsonPath("$.unreadThreadCount").value(1)); // only non-discarded unread
    }

    @Test
    void summaryExcludesSoftDeletedOrders() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Bartek", "+48600222000");
        seedOrder(clientId, OrderStatus.PRZYJETE, true);  // deleted
        seedOrder(clientId, OrderStatus.PRZYJETE, true);  // deleted

        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderCount").value(0))
            .andExpect(jsonPath("$.openOrderCount").value(0))
            .andExpect(jsonPath("$.lastOrderAt").doesNotExist());
    }

    @Test
    void summaryReturns404ForUnknownClient() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/clients/00000000-0000-0000-0000-000000000000/summary"))
            .andExpect(status().isNotFound());
    }

    @Test
    void summaryReturns401ForUnauthenticated() throws Exception {
        // No loginAs* — anonymous request
        UUID clientId = seedClient("Anon", "+48600333000");
        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isUnauthorized());
    }

    // ---- helpers ----

    private UUID seedClient(String firstName, String phone) {
        Client c = new Client();
        c.setFirstName(firstName);
        c.setPhone(phone);
        return clientRepo.save(c).getId();
    }

    private void seedOrder(UUID clientId, OrderStatus status, boolean softDeleted) {
        Order o = new Order();
        o.setClientId(clientId);
        o.setStatus(status);
        o.setCode("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        if (softDeleted) o.setDeletedAt(java.time.Instant.now());
        orderRepo.save(o);
    }

    private void seedThread(UUID clientId, int unreadCount, boolean discarded) {
        MessageThreadEntity t = new MessageThreadEntity();
        t.setClientId(clientId);
        t.setChannel("EMAIL");
        t.setUnreadCount(unreadCount);
        if (discarded) t.setDiscardedAt(java.time.Instant.now());
        threadRepo.save(t);
    }
}
```

- [ ] **Step 3: RED verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ClientSummaryServiceTest -q 2>&1 | tail -20
mvn -pl app test -Dtest=ClientSummaryControllerIntegrationTest -q 2>&1 | tail -20
```

Expected: both fail (missing classes).

---

#### Stage 2 — Verify

> **Stage 2 reviewer instructions:** Before approving Stage 1 output, check:
> 1. `countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan` is the method actually called in `ClientSummaryService` — NOT the old `countByClientIdAndUnreadCountGreaterThan`.
> 2. `countByClientIdAndStatusInAndDeletedAtIsNull` uses a `List` of statuses matching `WYDANE` + `ANULOWANE` (both) — not just one.
> 3. `countByClientIdAndDeletedAtIsNull` counts all non-deleted orders (any status).
> 4. `findLastOrderCreatedAtByClientId` uses `ORDER BY created_at DESC LIMIT 1` or equivalent — returns Optional<Instant>.
> 5. `ClientSummaryController` is in `com.drshoes.app.client.api` package (AuditLogAspect pointcut requires `.api.`).
> 6. RBAC: `@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")` or equivalent SecurityConfig coverage.
> 7. LOC: each new class < 120 LOC. Note actual LOC in Findings.
> 8. `ClientNotFoundException` is thrown (not a raw `ResponseStatusException`) so the existing exception handler maps it to 404.

---

- [ ] **Step 4: GREEN — add `countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan` to `MessageThreadRepository`**

Open `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java` and add after `countByClientIdAndUnreadCountGreaterThan`:

```java
    /**
     * Counts non-discarded threads for a client that have at least one unread message.
     * Used by ClientSummaryService for the dossier header unreadThreadCount tile.
     * Differs from countByClientIdAndUnreadCountGreaterThan which lacks the discard filter.
     */
    long countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(UUID clientId, int min);
```

- [ ] **Step 5: GREEN — add count methods to `OrderRepository`**

Open `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java` and add the following methods after `countByStatusNotDeleted`:

```java
    /** Count non-deleted orders for a specific client (any status). */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL")
    long countByClientIdAndDeletedAtIsNull(@Param("clientId") UUID clientId);

    /**
     * Count non-deleted orders for a specific client whose status is in the given list.
     * Used by ClientSummaryService to count "closed" orders (WYDANE | ANULOWANE).
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL AND o.status IN :statuses")
    long countByClientIdAndStatusInAndDeletedAtIsNull(@Param("clientId") UUID clientId,
                                                      @Param("statuses") java.util.List<OrderStatus> statuses);

    /**
     * Returns the created_at of the most recent non-deleted order for a client.
     * Returns empty Optional when the client has no orders.
     */
    @Query("SELECT o.receivedAt FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL ORDER BY o.receivedAt DESC LIMIT 1")
    Optional<Instant> findLastOrderCreatedAtByClientId(@Param("clientId") UUID clientId);
```

Also add `import java.util.List;` and `import java.util.Optional;` to the repository if not already present (verify at dispatch time — `Optional` is already imported, `List` may not be).

- [ ] **Step 6: GREEN — create `ClientSummaryDto`**

Create `backend/app/src/main/java/com/drshoes/app/client/dto/ClientSummaryDto.java`:

```java
package com.drshoes.app.client.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Summary projection for a single client — header KPI tiles on the dossier page.
 *
 * orderCount      — all-time non-soft-deleted orders for this client.
 * openOrderCount  — orders not in the closed set (WYDANE | ANULOWANE).
 * lastOrderAt     — received_at of the most recent order; null if none.
 * unreadThreadCount — non-discarded threads where unread_count > 0.
 */
public record ClientSummaryDto(
    UUID clientId,
    int orderCount,
    int openOrderCount,
    Instant lastOrderAt,
    int unreadThreadCount
) {}
```

- [ ] **Step 7: GREEN — create `ClientSummaryService`**

Create `backend/app/src/main/java/com/drshoes/app/client/ClientSummaryService.java`:

```java
package com.drshoes.app.client;

import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.ClientSummaryDto;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Computes aggregate summary KPIs for a single client.
 *
 * All counts are done in SQL (never in memory).
 * Soft-deleted orders (deleted_at IS NOT NULL) are excluded from all counts.
 * Closed statuses for openOrderCount = WYDANE | ANULOWANE.
 * unreadThreadCount excludes discarded threads.
 */
@Service
public class ClientSummaryService {

    private static final Logger log = LoggerFactory.getLogger(ClientSummaryService.class);

    /** Statuses that represent a "closed" order — excluded from openOrderCount. */
    private static final List<OrderStatus> CLOSED_STATUSES =
        List.of(OrderStatus.WYDANE, OrderStatus.ANULOWANE);

    private final ClientRepository    clientRepo;
    private final OrderRepository     orderRepo;
    private final MessageThreadRepository threadRepo;

    public ClientSummaryService(ClientRepository clientRepo,
                                OrderRepository orderRepo,
                                MessageThreadRepository threadRepo) {
        this.clientRepo = clientRepo;
        this.orderRepo  = orderRepo;
        this.threadRepo = threadRepo;
    }

    @Transactional(readOnly = true)
    public ClientSummaryDto getSummary(UUID clientId) {
        clientRepo.findById(clientId)
            .filter(c -> c.getDeletedAt() == null)
            .orElseThrow(() -> new ClientNotFoundException(clientId));

        long total  = orderRepo.countByClientIdAndDeletedAtIsNull(clientId);
        long closed = orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                          clientId, CLOSED_STATUSES);
        long open   = Math.max(0L, total - closed);
        Instant lastAt = orderRepo.findLastOrderCreatedAtByClientId(clientId).orElse(null);
        long unread = threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                          clientId, 0);

        log.info("op=getClientSummary clientId={} orderCount={} openOrderCount={} unreadThreadCount={} outcome=ok",
            clientId, total, open, unread);
        return new ClientSummaryDto(clientId, (int) total, (int) open, lastAt, (int) unread);
    }
}
```

- [ ] **Step 8: GREEN — create `ClientSummaryController`**

Create `backend/app/src/main/java/com/drshoes/app/client/api/ClientSummaryController.java`:

```java
package com.drshoes.app.client.api;

import com.drshoes.app.client.ClientSummaryService;
import com.drshoes.app.client.dto.ClientSummaryDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Provides the aggregate summary KPI tile data for a single client dossier.
 *
 * Endpoint:
 *   GET /api/admin/clients/{id}/summary — returns ClientSummaryDto (OWNER | EMPLOYEE)
 *
 * Structured logging per dispatch-protocol §7:
 *   op=getClientSummary actor={} clientId={} outcome=ok|not-found
 *
 * 404 is thrown by ClientSummaryService via ClientNotFoundException, mapped by
 * the existing ClientExceptionHandler.
 */
@RestController
@RequestMapping("/api/admin/clients")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ClientSummaryController {

    private static final Logger log = LoggerFactory.getLogger(ClientSummaryController.class);

    private final ClientSummaryService svc;

    public ClientSummaryController(ClientSummaryService svc) {
        this.svc = svc;
    }

    @GetMapping("/{id}/summary")
    public ClientSummaryDto getSummary(@PathVariable UUID id, Authentication auth) {
        log.info("op=getClientSummary actor={} clientId={}", actor(auth), id);
        ClientSummaryDto dto = svc.getSummary(id);
        log.info("op=getClientSummary actor={} clientId={} outcome=ok", actor(auth), id);
        return dto;
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
```

- [ ] **Step 9: GREEN verification — unit tests**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ClientSummaryServiceTest -q 2>&1 | tail -20
```

Expected: 4 tests pass.

- [ ] **Step 10: GREEN verification — integration tests**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app test -Dtest=ClientSummaryControllerIntegrationTest -q 2>&1 | tail -20
```

Expected: 4 integration tests pass.

- [ ] **Step 11: Full suite verification**

```bash
cd /Users/atlasjedi/P/misza_madafaka
mvn -pl app verify -q 2>&1 | tail -30
```

Expected: suite green (existing 353 + ~13 new = ~366 tests, 0 failures, 0 errors).

- [ ] **Step 12: LOC audit**

```bash
wc -l \
  /Users/atlasjedi/P/misza_madafaka/backend/app/src/main/java/com/drshoes/app/client/ClientSummaryService.java \
  /Users/atlasjedi/P/misza_madafaka/backend/app/src/main/java/com/drshoes/app/client/api/ClientSummaryController.java \
  /Users/atlasjedi/P/misza_madafaka/backend/app/src/test/java/com/drshoes/app/client/ClientSummaryServiceTest.java \
  /Users/atlasjedi/P/misza_madafaka/backend/app/src/test/java/com/drshoes/app/client/ClientSummaryControllerIntegrationTest.java
```

Note all counts in Findings. If any class hits 120+ LOC, extract a helper before committing.

- [ ] **Step 13: Commit**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add \
  backend/app/src/main/java/com/drshoes/app/client/dto/ClientSummaryDto.java \
  backend/app/src/main/java/com/drshoes/app/client/ClientSummaryService.java \
  backend/app/src/main/java/com/drshoes/app/client/api/ClientSummaryController.java \
  backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
  backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java \
  backend/app/src/test/java/com/drshoes/app/client/ClientSummaryServiceTest.java \
  backend/app/src/test/java/com/drshoes/app/client/ClientSummaryControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(client): add ClientSummaryService + GET /api/admin/clients/{id}/summary [milestone:7][task:7-4]

- ClientSummaryDto: 4-field KPI record (orderCount, openOrderCount, lastOrderAt, unreadThreadCount)
- ClientSummaryService: SQL-count queries; closed set = WYDANE|ANULOWANE; discarded threads excluded
- ClientSummaryController: GET /{id}/summary in client.api package; OWNER|EMPLOYEE RBAC
- MessageThreadRepository: new countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan method
- OrderRepository: countByClientIdAndDeletedAtIsNull, countByClientIdAndStatusInAndDeletedAtIsNull,
  findLastOrderCreatedAtByClientId
- 4 unit tests (ClientSummaryServiceTest) + 4 integration tests (ClientSummaryControllerIntegrationTest)

Refs: docs/dispatch-log/7-4-<UTC>.md
EOF
)"
```
## Wave 2 — Frontend lib extensions

### Task 7-5: Extend `lib/clients` — new functions + types + server-fetch module

**Files:**
- Modify: `apps/web/lib/clients/types.ts`
- Modify: `apps/web/lib/clients/api.ts`
- Create: `apps/web/lib/clients/api-server.ts`
- Create: `apps/web/lib/clients/api-server.test.ts`
- Create: `apps/web/lib/clients/api.test.ts`

**Review:** combined single-stage.

---

**Background:** The existing `lib/clients/types.ts` has `ClientDto`, `UpdateClientRequest`, and `Page<T>` but `UpdateClientRequest` is missing the M7 fields (`preferredChannel`, `rodoConsent`). `listClients` in `api.ts` takes positional `(page, size)` instead of an opts object. The list + detail pages (Server Components) need a server-side fetch module following the same pattern as `lib/orders/api-server.ts` (forward cookies, use `INTERNAL_API_BASE`).

**Types to add in `lib/clients/types.ts`:**
- Extend `UpdateClientRequest` with `preferredChannel?: "EMAIL" | "SMS" | "WHATSAPP" | null` and `rodoConsent?: boolean | null`.
- Add `ClientSummary` type mirroring `ClientSummaryDto.java`.
- Widen `PreferredChannel` to include `"WHATSAPP"` (was `"EMAIL" | "SMS" | "NONE"`; M7 backend drops `NONE`, adds `WHATSAPP`).

---

- [ ] **Step 1 (RED): Write failing unit tests for URL composition**

Create `apps/web/lib/clients/api-server.test.ts`:

```ts
/**
 * Unit tests for lib/clients/api-server.ts.
 * Stubs fetch + next/headers; does NOT hit the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "SESSION", value: "test-session" }],
    }),
}));

const origEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => { process.env["INTERNAL_API_BASE"] = "http://test-backend:8080"; });
afterEach(() => {
  if (origEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = origEnv;
  vi.restoreAllMocks();
});

function makeResp(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("listClientsServer", () => {
  it("builds URL with page and size params", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true }),
    ));
    const { listClientsServer } = await import("./api-server");
    await listClientsServer({ page: 2, size: 20 });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/api/admin/clients");
    expect(url).toContain("page=2");
    expect(url).toContain("size=20");
  });

  it("forwards session cookie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true }),
    ));
    const { listClientsServer } = await import("./api-server");
    await listClientsServer({});
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const opts = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((opts.headers as Record<string, string>)["cookie"]).toContain("SESSION=test-session");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 500)));
    const { listClientsServer } = await import("./api-server");
    await expect(listClientsServer({})).rejects.toThrow("clients/list failed: 500");
  });
});

describe("getClientServer", () => {
  it("fetches /api/admin/clients/{id}", async () => {
    const id = "abc-123";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ id, firstName: "Jan", lastName: "Kowalski" }),
    ));
    const { getClientServer } = await import("./api-server");
    const result = await getClientServer(id);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(`/api/admin/clients/${id}`);
    expect(result.firstName).toBe("Jan");
  });
});

describe("getClientSummaryServer", () => {
  it("fetches /api/admin/clients/{id}/summary", async () => {
    const id = "abc-123";
    const payload = { clientId: id, orderCount: 5, openOrderCount: 2, lastOrderAt: null, unreadThreadCount: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));
    const { getClientSummaryServer } = await import("./api-server");
    const result = await getClientSummaryServer(id);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(`/api/admin/clients/${id}/summary`);
    expect(result.orderCount).toBe(5);
  });

  it("throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 404)));
    const { getClientSummaryServer } = await import("./api-server");
    await expect(getClientSummaryServer("missing")).rejects.toThrow("clients/summary failed: 404");
  });
});
```

Create `apps/web/lib/clients/api.test.ts`:

```ts
/**
 * Unit tests for lib/clients/api.ts — URL composition + body shape.
 * Stubs the api ApiClient via vi.mock.
 */
import { describe, it, expect, vi } from "vitest";

const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: vi.fn(), patch: mockPatch, delete: vi.fn() },
}));

describe("listClients", () => {
  it("passes page and size as query params", async () => {
    mockGet.mockResolvedValueOnce({ content: [] });
    const { listClients } = await import("./api");
    await listClients({ page: 1, size: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("size=10"));
  });

  it("defaults page=0 size=20 when opts omitted", async () => {
    mockGet.mockResolvedValueOnce({ content: [] });
    const { listClients } = await import("./api");
    await listClients({});
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("page=0"));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("size=20"));
  });
});

describe("updateClient", () => {
  it("sends preferredChannel and rodoConsent in body via PATCH", async () => {
    mockPatch.mockResolvedValueOnce({ id: "c1" });
    const { updateClient } = await import("./api");
    await updateClient("c1", { preferredChannel: "SMS", rodoConsent: true });
    expect(mockPatch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/clients/c1"),
      expect.objectContaining({ preferredChannel: "SMS", rodoConsent: true }),
    );
  });
});

describe("getClientSummary", () => {
  it("fetches /admin/clients/{id}/summary", async () => {
    mockGet.mockResolvedValueOnce({ clientId: "c2", orderCount: 3 });
    const { getClientSummary } = await import("./api");
    await getClientSummary("c2");
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/admin/clients/c2/summary"));
  });
});
```

- [ ] **Step 2 (GREEN): Update `lib/clients/types.ts`**

Replace the file content:

```ts
/**
 * TypeScript mirror of backend client DTOs.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/client/dto/
 */

/** Preferred notification channel for a client. Matches DB CHECK constraint. */
export type PreferredChannel = "EMAIL" | "SMS" | "WHATSAPP";

/** Full client DTO — mirrors ClientDto.java. */
export interface ClientDto {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  preferredChannel: PreferredChannel | null;
  notes: string | null;
  rodoConsentAt: string | null; // ISO-8601, null = no consent
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/** Typeahead search result — mirrors ClientSearchResult.java. */
export interface ClientSearchResult {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

/** POST /api/admin/clients — mirrors CreateClientRequest.java. */
export interface CreateClientRequest {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

/**
 * PATCH /api/admin/clients/{id} — mirrors UpdateClientRequest.java.
 * preferredChannel: null = leave as-is, value = overwrite.
 * rodoConsent: true = set rodoConsentAt=now(), false = clear, null = no change.
 */
export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  preferredChannel?: PreferredChannel | null;
  rodoConsent?: boolean | null;
  notes?: string | null;
}

/** GET /api/admin/clients/{id}/summary — mirrors ClientSummaryDto.java. */
export interface ClientSummary {
  clientId: string;
  orderCount: number;
  openOrderCount: number;
  lastOrderAt: string | null; // ISO-8601 or null
  unreadThreadCount: number;
}

/** Spring Page wrapper (generic). */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}
```

- [ ] **Step 3 (GREEN): Update `lib/clients/api.ts`** (client-side, uses ApiClient)

Replace file content:

```ts
import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  ClientDto,
  ClientSearchResult,
  ClientSummary,
  CreateClientRequest,
  UpdateClientRequest,
  Page,
} from "./types";

const log = createLogger("apps/web/lib/clients");

/** GET /admin/clients/search?q=<query> — typeahead, returns top-N results. */
export async function searchClients(q: string): Promise<ClientSearchResult[]> {
  log.info("op=searchClients", { q });
  return api.get<ClientSearchResult[]>(`/admin/clients/search?q=${encodeURIComponent(q)}`);
}

/** GET /admin/clients?page=&size= — paginated client list. */
export async function listClients(opts: { page?: number; size?: number }): Promise<Page<ClientDto>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 20;
  log.info("op=listClients", { page, size });
  return api.get<Page<ClientDto>>(`/admin/clients?page=${page}&size=${size}`);
}

/** GET /admin/clients/{id} — single client. */
export async function getClient(id: string): Promise<ClientDto> {
  log.info("op=getClient", { id });
  return api.get<ClientDto>(`/admin/clients/${id}`);
}

/** GET /admin/clients/{id}/summary — aggregate header tiles. */
export async function getClientSummary(id: string): Promise<ClientSummary> {
  log.info("op=getClientSummary", { id });
  return api.get<ClientSummary>(`/admin/clients/${id}/summary`);
}

/** POST /admin/clients — create a new client, returns full ClientDto. */
export async function createClient(req: CreateClientRequest): Promise<ClientDto> {
  log.info("op=createClient");
  return api.post<ClientDto>("/admin/clients", req);
}

/** PATCH /admin/clients/{id} — update client fields, returns updated ClientDto. */
export async function updateClient(id: string, req: UpdateClientRequest): Promise<ClientDto> {
  log.info("op=updateClient", { id });
  return api.patch<ClientDto>(`/admin/clients/${id}`, req);
}

/** DELETE /admin/clients/{id} — soft-delete (OWNER only). Returns 204 void. */
export async function deleteClient(id: string): Promise<void> {
  log.info("op=deleteClient", { id });
  return api.delete<void>(`/admin/clients/${id}`);
}
```

- [ ] **Step 4 (GREEN): Create `lib/clients/api-server.ts`** (Server Component usage — forwards cookies)

```ts
/**
 * Server-only: server-side fetch for clients, forwarding request cookie.
 * Uses INTERNAL_API_BASE for direct backend access from Next.js server.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { ClientDto, ClientSummary, Page } from "./types";

const log = createLogger("apps/web/lib/clients");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

function base(): string {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}

/** GET /api/admin/clients?page=&size= — paginated list, server-side. */
export async function listClientsServer(opts: {
  page?: number;
  size?: number;
}): Promise<Page<ClientDto>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 20;
  const cookie = await cookieHeader();
  log.info("op=listClientsServer", { page, size });
  const resp = await fetch(`${base()}/api/admin/clients?page=${page}&size=${size}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=listClientsServer outcome=error", { status: resp.status });
    throw new Error(`clients/list failed: ${resp.status}`);
  }
  return (await resp.json()) as Page<ClientDto>;
}

/** GET /api/admin/clients/search?q= — typeahead, server-side. */
export async function searchClientsServer(q: string): Promise<import("./types").ClientSearchResult[]> {
  const cookie = await cookieHeader();
  log.info("op=searchClientsServer", { qLen: q.length });
  const resp = await fetch(
    `${base()}/api/admin/clients/search?q=${encodeURIComponent(q)}`,
    { headers: { cookie }, cache: "no-store" },
  );
  if (!resp.ok) {
    log.warn("op=searchClientsServer outcome=error", { status: resp.status });
    throw new Error(`clients/search failed: ${resp.status}`);
  }
  return (await resp.json()) as import("./types").ClientSearchResult[];
}

/** GET /api/admin/clients/{id} — single client, server-side. */
export async function getClientServer(id: string): Promise<ClientDto> {
  const cookie = await cookieHeader();
  log.info("op=getClientServer", { id });
  const resp = await fetch(`${base()}/api/admin/clients/${id}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientServer outcome=error", { id, status: resp.status });
    throw new Error(`clients/get failed: ${resp.status}`);
  }
  return (await resp.json()) as ClientDto;
}

/** GET /api/admin/clients/{id}/summary — summary tiles, server-side. */
export async function getClientSummaryServer(id: string): Promise<ClientSummary> {
  const cookie = await cookieHeader();
  log.info("op=getClientSummaryServer", { id });
  const resp = await fetch(`${base()}/api/admin/clients/${id}/summary`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientSummaryServer outcome=error", { id, status: resp.status });
    throw new Error(`clients/summary failed: ${resp.status}`);
  }
  return (await resp.json()) as ClientSummary;
}
```

- [ ] **Step 5: Verify tests pass**

```
pnpm -F web test lib/clients/api-server
pnpm -F web test lib/clients/api.test
```

Both suites must be green (no skipped, no failures).

- [ ] **Step 6: Lint**

```
pnpm -F web lint
```

Fix any warnings before committing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/clients/types.ts \
        apps/web/lib/clients/api.ts \
        apps/web/lib/clients/api-server.ts \
        apps/web/lib/clients/api-server.test.ts \
        apps/web/lib/clients/api.test.ts
git commit -m "$(cat <<'EOF'
feat(m7): extend clients lib — new types, server-fetch module, getClientSummary

[milestone:7][task:7-5]

Refs: docs/dispatch-log/7-5-<UTC>.md
EOF
)"
```

---

## Wave 3 — List page components + route

### Task 7-6: `ClientListSearchBox` — debounced search Client Component

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/_components/ClientListSearchBox.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListSearchBox.test.tsx`

**Review:** combined single-stage.

---

**Background:** The list page's search input is a Client Component that pushes URL params on debounced change. 250ms debounce using `setTimeout`/`clearTimeout` in a `useEffect` with cleanup. The `useSearchParams` value initialises the input so the field reflects URL state on navigation.

---

- [ ] **Step 1 (RED): Write failing RTL test**

Create `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListSearchBox.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ClientListSearchBox", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a text input", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not push immediately on keystroke (debounce)", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "kowal" } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("pushes with encoded q param after 250ms", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "kowal" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=kowal"),
    );
  });

  it("pushes /admin/clients (no q) when input cleared", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="kowal" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith("/admin/clients");
  });

  it("encodes special characters in q param", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Józef Nowak" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=J%C3%B3zef"),
    );
  });
});
```

- [ ] **Step 2 (GREEN): Create `ClientListSearchBox.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialQ: string;
}

/**
 * Debounced search box for /admin/clients.
 * Pushes ?q=<encoded> on change; clears to /admin/clients on empty.
 * Debounce: 250ms via useEffect cleanup.
 */
export function ClientListSearchBox({ initialQ }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);

  useEffect(() => {
    const id = setTimeout(() => {
      if (value.length === 0) {
        router.push("/admin/clients");
      } else {
        router.push(`/admin/clients?q=${encodeURIComponent(value)}`);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [value, router]);

  return (
    <input
      type="text"
      role="textbox"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Szukaj klienta po imieniu, nazwisku, telefonie lub e-mailu…"
      className="w-full max-w-lg h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm"
      aria-label="Szukaj klienta"
    />
  );
}
```

- [ ] **Step 3: Run tests**

```
pnpm -F web test ClientListSearchBox
```

All 5 tests must pass.

- [ ] **Step 4: Lint**

```
pnpm -F web lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/_components/ClientListSearchBox.tsx \
        apps/web/app/\(admin\)/admin/clients/_components/__tests__/ClientListSearchBox.test.tsx
git commit -m "$(cat <<'EOF'
feat(m7): add ClientListSearchBox — debounced 250ms q-param pusher

[milestone:7][task:7-6]

Refs: docs/dispatch-log/7-6-<UTC>.md
EOF
)"
```

---

### Task 7-7: `ClientListTable` — Server Component row renderer + pagination

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/_components/ClientListTable.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListTable.test.tsx`

**Review:** combined single-stage.

---

**Background:** Server Component that receives a `Page<ClientDto>` and renders a table plus pagination controls. Each row links to `/admin/clients/{id}`. The RODO badge is rendered inline (conditional logic: `rodoConsentAt` non-null → green pill with date; null → amber pill). Pagination mirrors the pattern in `OrdersTable.tsx` but is rendered server-side (no `useRouter` — pagination links are plain `<a>` anchors preserving the `q` param). The search-result path (no pagination) is handled by the caller page — this component always receives a full `Page<ClientDto>`.

Channel pill: `EMAIL` → "Email", `SMS` → "SMS", `WHATSAPP` → "WhatsApp", `null` → "—".

**LOC note:** If table + pagination combined exceeds 80 LOC, extract a `ClientListPagination` sub-component in the same file at the bottom.

---

- [ ] **Step 1 (RED): Write failing test**

Create `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListTable.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ClientDto, Page } from "@/lib/clients/types";

function makePage(clients: Partial<ClientDto>[]): Page<ClientDto> {
  const full: ClientDto[] = clients.map((c, i) => ({
    id: c.id ?? `id-${i}`,
    firstName: c.firstName ?? "Jan",
    lastName: c.lastName ?? "Kowalski",
    phone: c.phone ?? null,
    email: c.email ?? null,
    preferredChannel: c.preferredChannel ?? null,
    notes: null,
    rodoConsentAt: c.rodoConsentAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  return { content: full, totalElements: full.length, totalPages: 1, number: 0, size: 20, last: true };
}

describe("ClientListTable", () => {
  it("renders client lastName + firstName in row", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Anna", lastName: "Nowak" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/Nowak/)).toBeInTheDocument();
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
  });

  it("links each row to /admin/clients/{id}", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ id: "abc-123", firstName: "Jan", lastName: "Test" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    const link = screen.getByRole("link", { name: /Test/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("abc-123"));
  });

  it("renders green RODO pill when rodoConsentAt set", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: "2026-04-15T10:00:00Z" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/zgoda/i)).toBeInTheDocument();
  });

  it("renders amber RODO pill when rodoConsentAt null", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: null }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/brak zgody/i)).toBeInTheDocument();
  });

  it("shows channel pill SMS", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ preferredChannel: "SMS" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText("SMS")).toBeInTheDocument();
  });

  it("shows pagination when totalPages > 1", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page: Page<ClientDto> = {
      content: [],
      totalElements: 40,
      totalPages: 2,
      number: 0,
      size: 20,
      last: false,
    };
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.getByText(/Następna/i)).toBeInTheDocument();
  });

  it("does not show pagination when only one page", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Ewa" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    expect(screen.queryByText(/Następna/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2 (GREEN): Create `ClientListTable.tsx`**

```tsx
import Link from "next/link";
import type { ClientDto, Page } from "@/lib/clients/types";

interface Props {
  page: Page<ClientDto>;
  currentPage: number;
  q: string;
}

/** Format ISO date as MM.yyyy for RODO badge. */
function fmtRodoDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${mm}.${d.getUTCFullYear()}`;
}

/** Map preferredChannel to display label. */
function channelLabel(ch: ClientDto["preferredChannel"]): string {
  if (ch === "EMAIL") return "Email";
  if (ch === "SMS") return "SMS";
  if (ch === "WHATSAPP") return "WhatsApp";
  return "—";
}

function RodoInline({ rodoConsentAt }: { rodoConsentAt: string | null }) {
  if (rodoConsentAt) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        zgoda · {fmtRodoDate(rodoConsentAt)}
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
      brak zgody RODO
    </span>
  );
}

function ClientListPagination({
  totalPages,
  currentPage,
  q,
}: {
  totalPages: number;
  currentPage: number;
  q: string;
}) {
  if (totalPages <= 1) return null;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const prevHref = `/admin/clients?page=${currentPage - 1}${qParam}`;
  const nextHref = `/admin/clients?page=${currentPage + 1}${qParam}`;
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      {currentPage > 0 ? (
        <Link href={prevHref} className="px-3 py-1 rounded border border-admin-line text-admin-ink hover:bg-acid/10">
          ← Poprzednia
        </Link>
      ) : (
        <span className="px-3 py-1 opacity-40">← Poprzednia</span>
      )}
      <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
      {currentPage < totalPages - 1 ? (
        <Link href={nextHref} className="px-3 py-1 rounded border border-admin-line text-admin-ink hover:bg-acid/10">
          Następna →
        </Link>
      ) : (
        <span className="px-3 py-1 opacity-40">Następna →</span>
      )}
    </div>
  );
}

const thCls = "px-3 py-2 text-left text-xs font-medium text-admin-mute uppercase tracking-wide";
const tdCls = "px-3 py-3 text-sm text-admin-ink";

/**
 * Server Component.
 * Renders a table of clients with inline RODO badge + channel pill + pagination.
 * Pagination uses plain anchor links (no client router needed — SC).
 * NOTE: RodoInline renders the conditional RODO logic inline here.
 * Once task 7-10 (RodoBadge SC) ships, replace RodoInline with the shared import.
 */
export function ClientListTable({ page, currentPage, q }: Props) {
  return (
    <div>
      <div className="overflow-x-auto border border-admin-line rounded">
        <table className="w-full border-collapse">
          <thead className="bg-admin-surface border-b border-admin-line">
            <tr>
              <th className={thCls}>Imię i nazwisko</th>
              <th className={thCls}>Telefon</th>
              <th className={thCls}>E-mail</th>
              <th className={thCls}>Kanał</th>
              <th className={thCls}>Zgoda RODO</th>
            </tr>
          </thead>
          <tbody>
            {page.content.map((client) => (
              <tr
                key={client.id}
                className="border-b border-admin-line hover:bg-acid/5 transition-colors"
              >
                <td className={tdCls}>
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="font-medium hover:underline"
                  >
                    {client.lastName ? `${client.lastName}, ${client.firstName}` : client.firstName}
                  </Link>
                </td>
                <td className={tdCls + " text-admin-mute"}>{client.phone ?? "—"}</td>
                <td className={tdCls + " text-admin-mute"}>{client.email ?? "—"}</td>
                <td className={tdCls}>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-admin-surface border border-admin-line">
                    {channelLabel(client.preferredChannel)}
                  </span>
                </td>
                <td className={tdCls}>
                  <RodoInline rodoConsentAt={client.rodoConsentAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClientListPagination totalPages={page.totalPages} currentPage={currentPage} q={q} />
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```
pnpm -F web test ClientListTable
```

All 7 tests must pass.

- [ ] **Step 4: Lint**

```
pnpm -F web lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/_components/ClientListTable.tsx \
        apps/web/app/\(admin\)/admin/clients/_components/__tests__/ClientListTable.test.tsx
git commit -m "$(cat <<'EOF'
feat(m7): add ClientListTable SC — rows, inline RODO badge, server-side pagination

[milestone:7][task:7-7]

Refs: docs/dispatch-log/7-7-<UTC>.md
EOF
)"
```

---

### Task 7-8: `/admin/clients/page.tsx` — list page Server Component

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/page.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientsPage.test.tsx`

**Review:** combined single-stage.

---

**Background:** The list page reads `q` and `page` from `searchParams`. If `q` is non-empty it calls `searchClientsServer(q)` and renders results as a table body in a flat list (no pagination, top-20 typeahead results). Else it calls `listClientsServer({page})` and renders the paginated `ClientListTable`. The page header shows the "Klienci" title and `ClientListSearchBox` (Client Component island). Empty state: "Brak klientów do wyświetlenia."

The search results path (non-empty `q`) renders the same table structure but wraps an inline results array (no `Page<>` wrapper). Since `ClientListTable` accepts a `Page<ClientDto>`, for the search path we construct a synthetic page object from the `ClientSearchResult[]` array. However `ClientSearchResult` lacks the full `ClientDto` fields — so instead, the search path renders its own simple rows inline (a thin `<table>` with 3 columns: name | phone | email). This avoids a type coercion hack. Total LOC budget: keep `page.tsx` under 80 LOC; the search-result table is extracted into `ClientSearchResultsTable` in the same file below the page component if needed.

**LOC check:** If `page.tsx` body + `ClientSearchResultsTable` together exceed 80 LOC, extract `ClientSearchResultsTable` to its own file `_components/ClientSearchResultsTable.tsx`.

---

- [ ] **Step 1 (RED): Write failing test**

Create `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientsPage.test.tsx`:

```tsx
/**
 * Smoke tests for /admin/clients page.tsx.
 * Because page.tsx is a Server Component (async function), we test it by
 * calling it as an async function and inspecting the rendered output.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub server-side lib modules
vi.mock("@/lib/clients/api-server", () => ({
  listClientsServer: vi.fn().mockResolvedValue({
    content: [
      {
        id: "c-1",
        firstName: "Jan",
        lastName: "Kowalski",
        phone: "+48123456789",
        email: "jan@example.com",
        preferredChannel: "EMAIL",
        notes: null,
        rodoConsentAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
    last: true,
  }),
  searchClientsServer: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ClientsPage", () => {
  it("renders Klienci heading", async () => {
    const { default: Page } = await import("../../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByText("Klienci")).toBeInTheDocument();
  });

  it("renders client name from list", async () => {
    const { default: Page } = await import("../../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByText(/Kowalski/)).toBeInTheDocument();
  });

  it("renders search input", async () => {
    const { default: Page } = await import("../../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows empty state when content is empty", async () => {
    const { listClientsServer } = await import("@/lib/clients/api-server");
    vi.mocked(listClientsServer).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
      last: true,
    });
    const { default: Page } = await import("../../../page");
    const node = await Page({ searchParams: Promise.resolve({}) });
    render(node as React.ReactElement);
    expect(screen.getByText(/brak klientów/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 (GREEN): Create `apps/web/app/(admin)/admin/clients/page.tsx`**

```tsx
import { createLogger } from "@/lib/log";
import { listClientsServer, searchClientsServer } from "@/lib/clients/api-server";
import { ClientListSearchBox } from "./_components/ClientListSearchBox";
import { ClientListTable } from "./_components/ClientListTable";
import Link from "next/link";

const log = createLogger("apps/web/app/(admin)/admin/clients/page");

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);

  log.info("op=render", { q: q.length > 0 ? q : "(none)", page });

  let pageData: Awaited<ReturnType<typeof listClientsServer>> | null = null;
  let searchResults: Awaited<ReturnType<typeof searchClientsServer>> | null = null;
  let fetchError = false;

  try {
    if (q.length > 0) {
      searchResults = await searchClientsServer(q);
    } else {
      pageData = await listClientsServer({ page });
    }
  } catch (err) {
    log.error("op=render outcome=error", { message: String(err) });
    fetchError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Klienci</h1>
      </div>

      <div className="mb-4">
        <ClientListSearchBox initialQ={q} />
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : searchResults !== null ? (
        <ClientSearchResultsTable results={searchResults} />
      ) : pageData && pageData.content.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak klientów do wyświetlenia.
        </div>
      ) : pageData ? (
        <ClientListTable page={pageData} currentPage={page} q={q} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search results sub-component (inline — kept here to stay under 80-LOC rule
// for the page; extracted if this file grows past budget).
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

function ClientSearchResultsTable({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
        Brak wyników wyszukiwania.
      </div>
    );
  }
  const thCls = "px-3 py-2 text-left text-xs font-medium text-admin-mute uppercase tracking-wide";
  const tdCls = "px-3 py-3 text-sm text-admin-ink";
  return (
    <div className="overflow-x-auto border border-admin-line rounded">
      <table className="w-full border-collapse">
        <thead className="bg-admin-surface border-b border-admin-line">
          <tr>
            <th className={thCls}>Imię i nazwisko</th>
            <th className={thCls}>Telefon</th>
            <th className={thCls}>E-mail</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-b border-admin-line hover:bg-acid/5 transition-colors">
              <td className={tdCls}>
                <Link href={`/admin/clients/${r.id}`} className="font-medium hover:underline">
                  {r.fullName}
                </Link>
              </td>
              <td className={tdCls + " text-admin-mute"}>{r.phone ?? "—"}</td>
              <td className={tdCls + " text-admin-mute"}>{r.email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**LOC check:** Count lines. If `page.tsx` exceeds 80 LOC (excluding `ClientSearchResultsTable`), extract `ClientSearchResultsTable` to `_components/ClientSearchResultsTable.tsx` and import it. Note actual line counts in dispatch log.

- [ ] **Step 3: Run tests**

```
pnpm -F web test ClientsPage
```

All 4 tests must pass.

- [ ] **Step 4: Full suite check**

```
pnpm -F web test
```

No regressions. Note final test count in dispatch log.

- [ ] **Step 5: Lint**

```
pnpm -F web lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/page.tsx \
        apps/web/app/\(admin\)/admin/clients/_components/__tests__/ClientsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(m7): add /admin/clients list page — SC, search branch, paginated table

[milestone:7][task:7-8]

Refs: docs/dispatch-log/7-8-<UTC>.md
EOF
)"
```
## Wave 4 — Detail layout + overview

### Task 7-9: `[id]/layout.tsx` + `ClientTabNav`

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/layout.tsx`
- Create: `apps/web/app/(admin)/admin/clients/[id]/_components/ClientTabNav.tsx`
- Create: `apps/web/app/(admin)/admin/clients/[id]/_components/__tests__/ClientTabNav.test.tsx`

**Review:** combined single-stage.

**Design source:** spec §6.5, §7.2 — mirror `OrderViewTabs` visual pattern (ink/paper stamp style).

---

- [ ] **Step 1: RED — write failing test for `ClientTabNav` active state**

Create `apps/web/app/(admin)/admin/clients/[id]/_components/__tests__/ClientTabNav.test.tsx`:

```tsx
/**
 * ClientTabNav active-state unit tests.
 * Verifies that the correct tab receives aria-current="page" based on pathname.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock usePathname to return a controllable value
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { ClientTabNav } from "../ClientTabNav";

describe("ClientTabNav", () => {
  it("marks Przegląd active on overview route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123");
    render(<ClientTabNav clientId="abc-123" />);
    const przeglad = screen.getByRole("link", { name: /przegląd/i });
    expect(przeglad).toHaveAttribute("aria-current", "page");
    const zlecenia = screen.getByRole("link", { name: /zlecenia/i });
    expect(zlecenia).not.toHaveAttribute("aria-current", "page");
  });

  it("marks Zlecenia active on /zlecenia sub-route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123/zlecenia");
    render(<ClientTabNav clientId="abc-123" />);
    const zlecenia = screen.getByRole("link", { name: /zlecenia/i });
    expect(zlecenia).toHaveAttribute("aria-current", "page");
    const wiadomosci = screen.getByRole("link", { name: /wiadomości/i });
    expect(wiadomosci).not.toHaveAttribute("aria-current", "page");
  });

  it("marks Wiadomości active on /wiadomosci sub-route", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123/wiadomosci");
    render(<ClientTabNav clientId="abc-123" />);
    const wiadomosci = screen.getByRole("link", { name: /wiadomości/i });
    expect(wiadomosci).toHaveAttribute("aria-current", "page");
  });

  it("renders all three tab links", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/clients/abc-123");
    render(<ClientTabNav clientId="abc-123" />);
    expect(screen.getByRole("link", { name: /przegląd/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /zlecenia/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /wiadomości/i })).toBeInTheDocument();
  });
});
```

Run (expect 4 failures — `ClientTabNav` does not exist yet):

```bash
pnpm -F web test ClientTabNav
```

---

- [ ] **Step 2: GREEN — implement `ClientTabNav`**

Create `apps/web/app/(admin)/admin/clients/[id]/_components/ClientTabNav.tsx`:

```tsx
"use client";

/**
 * Tab navigation for the client detail page.
 * Three sub-routes: Przegląd / Zlecenia / Wiadomości.
 * usePathname() drives active-state styling — mirrors OrderViewTabs stamp pattern.
 * ~45 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { createLogger } from "@/lib/log";

const log = createLogger("client-tab-nav");

interface Tab {
  label: string;
  href: (id: string) => Route;
  /** pathname ends-with suffix that activates this tab */
  suffix: string | null; // null = exact match (overview)
}

const TABS: Tab[] = [
  { label: "Przegląd",    href: (id) => `/admin/clients/${id}` as Route,              suffix: null },
  { label: "Zlecenia",    href: (id) => `/admin/clients/${id}/zlecenia` as Route,     suffix: "/zlecenia" },
  { label: "Wiadomości",  href: (id) => `/admin/clients/${id}/wiadomosci` as Route,   suffix: "/wiadomosci" },
];

interface Props {
  clientId: string;
}

export function ClientTabNav({ clientId }: Props) {
  const pathname = usePathname();
  log.debug("op=ClientTabNav.render", { clientId, pathname });

  return (
    <div
      className="inline-flex border-2 border-ink bg-white shadow-[2px_2px_0_var(--ink)]"
      role="tablist"
      aria-label="Widok klienta"
    >
      {TABS.map(({ label, href, suffix }, idx) => {
        const isLast = idx === TABS.length - 1;
        const isActive = suffix === null
          ? pathname === `/admin/clients/${clientId}`
          : pathname.endsWith(suffix);

        return (
          <Link
            key={label}
            href={href(clientId)}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            className={[
              "px-4 py-2 font-stencil text-xs tracking-widest uppercase font-bold",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-ink/5",
              !isLast ? "border-r border-ink" : "",
            ].filter(Boolean).join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
```

Run (expect 4 passes):

```bash
pnpm -F web test ClientTabNav
```

---

- [ ] **Step 3: GREEN — implement `[id]/layout.tsx`**

Create `apps/web/app/(admin)/admin/clients/[id]/layout.tsx`:

```tsx
/**
 * Server Component: shared shell for all three client detail sub-routes.
 * Fetches the client for notFound() guard; passes clientId to ClientTabNav.
 * ClientHeader and ClientSummaryTiles are rendered by each page (they need
 * per-page data too). This layout only provides the nav shell.
 * ~45 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import { getClientServer } from "@/lib/clients/api-server";
import { ClientTabNav } from "./_components/ClientTabNav";

const log = createLogger("client-detail-layout");

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ClientDetailLayout({ children, params }: Props) {
  const { id } = await params;
  log.info("op=layout.fetch", { clientId: id });

  let exists = true;
  try {
    await getClientServer(id);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      exists = false;
    } else {
      log.error("op=layout.fetch outcome=error", { clientId: id, err: String(err) });
      throw err;
    }
  }

  if (!exists) {
    log.info("op=layout.fetch outcome=not-found", { clientId: id });
    notFound();
  }

  return (
    <div>
      <div className="mb-4">
        <ClientTabNav clientId={id} />
      </div>
      {children}
    </div>
  );
}
```

**Note:** `getClientServer` is a new server-side helper added in Slice B (task 7-7 or equivalent). If it does not exist at dispatch time, implement it inline in `lib/clients/api-server.ts` as a thin `serverGet` wrapper following the same pattern as `lib/messaging/api-server.ts`:

```ts
// apps/web/lib/clients/api-server.ts  (create if missing)
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { ClientDto } from "./types";

const log = createLogger("clients.api-server");

async function base() {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}
async function cookieHeader() {
  const c = await cookies();
  return c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

export async function getClientServer(id: string): Promise<ClientDto> {
  const resp = await fetch(`${await base()}/api/admin/clients/${id}`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientServer outcome=error", { clientId: id, status: resp.status });
    const e = new Error(`getClient failed: ${resp.status}`) as Error & { status: number };
    e.status = resp.status;
    throw e;
  }
  return (await resp.json()) as ClientDto;
}
```

---

- [ ] **Step 4: Verify**

```bash
pnpm -F web test ClientTabNav
pnpm -F web lint
pnpm -F web build
```

---

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/\[id\]/layout.tsx \
        apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientTabNav.tsx \
        apps/web/app/\(admin\)/admin/clients/\[id\]/_components/__tests__/ClientTabNav.test.tsx \
        apps/web/lib/clients/api-server.ts

git commit -m "$(cat <<'EOF'
feat(web): client detail layout + ClientTabNav with active-state test [milestone:7][task:7-9]

Refs: docs/dispatch-log/7-9-<UTC>.md
EOF
)"
```

---

### Task 7-10: `ClientHeader` + `RodoBadge`

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/_components/ClientHeader.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/RodoBadge.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/__tests__/RodoBadge.test.tsx`

**Review:** combined single-stage.

**Design source:** spec §6.3, §6.7.

---

- [ ] **Step 1: RED — write failing tests for `RodoBadge`**

Create `apps/web/app/(admin)/admin/clients/_components/__tests__/RodoBadge.test.tsx`:

```tsx
/**
 * RodoBadge — green pill when rodoConsentAt is set, amber pill when null.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RodoBadge } from "../RodoBadge";

describe("RodoBadge", () => {
  it("renders green consent badge with formatted month when rodoConsentAt is set", () => {
    render(<RodoBadge rodoConsentAt="2025-04-15T10:00:00Z" />);
    const badge = screen.getByTestId("rodo-badge");
    expect(badge).toHaveClass("bg-green");
    expect(badge).toHaveTextContent(/zgoda/i);
    // Month formatted as MM.YYYY — April 2025
    expect(badge).toHaveTextContent("04.2025");
  });

  it("renders amber no-consent badge when rodoConsentAt is null", () => {
    render(<RodoBadge rodoConsentAt={null} />);
    const badge = screen.getByTestId("rodo-badge");
    expect(badge).toHaveClass("bg-orange");
    expect(badge).toHaveTextContent(/brak zgody rodo/i);
  });
});
```

Run (expect 2 failures):

```bash
pnpm -F web test RodoBadge
```

---

- [ ] **Step 2: GREEN — implement `RodoBadge`**

Create `apps/web/app/(admin)/admin/clients/_components/RodoBadge.tsx`:

```tsx
/**
 * RODO consent badge. Server Component.
 * Green pill when rodoConsentAt is present; amber when null.
 * Spec §6.7.
 * ~30 LOC.
 */

interface Props {
  rodoConsentAt: string | null;
}

export function RodoBadge({ rodoConsentAt }: Props) {
  if (rodoConsentAt) {
    const d = new Date(rodoConsentAt);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return (
      <span
        data-testid="rodo-badge"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green/15 text-green border border-green/30"
      >
        zgoda · {mm}.{yyyy}
      </span>
    );
  }

  return (
    <span
      data-testid="rodo-badge"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange/15 text-orange border border-orange/30"
    >
      brak zgody RODO
    </span>
  );
}
```

Run (expect 2 passes):

```bash
pnpm -F web test RodoBadge
```

---

- [ ] **Step 3: GREEN — implement `ClientHeader`**

Create `apps/web/app/(admin)/admin/clients/[id]/_components/ClientHeader.tsx`:

```tsx
/**
 * Client detail header. Server Component.
 * Renders: large name, phone, email, channel pill, RodoBadge, "Edytuj" island.
 * The EditClientModal (task 7-15, Slice D) is imported from the shared _components.
 * Until 7-15 lands this references a stub CC that is replaced in-place.
 * Spec §6.3.
 * ~65 LOC.
 */
import type { ClientDto } from "@/lib/clients/types";
import { RodoBadge } from "../../_components/RodoBadge";
import { EditClientIsland } from "./EditClientIsland";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL:    "Email",
  SMS:      "SMS",
  WHATSAPP: "WhatsApp",
  NONE:     "Brak",
};

const CHANNEL_PILL_CLS: Record<string, string> = {
  EMAIL:    "bg-blue/10 text-blue border-blue/20",
  SMS:      "bg-violet-50 text-violet-700 border-violet-200",
  WHATSAPP: "bg-green/10 text-green border-green/20",
  NONE:     "bg-admin-line text-admin-mute border-admin-line",
};

interface Props {
  client: ClientDto;
}

export function ClientHeader({ client }: Props) {
  const channel = client.preferredChannel ?? "NONE";
  const channelLabel = CHANNEL_LABELS[channel] ?? channel;
  const channelCls = CHANNEL_PILL_CLS[channel] ?? CHANNEL_PILL_CLS["NONE"];

  return (
    <div className="admin-card p-6 mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight text-admin-ink mb-3">
          {client.firstName} {client.lastName ?? ""}
        </h1>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-admin-mute">
          {client.phone && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Telefon</dt>
              <dd className="font-mono">{client.phone}</dd>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">E-mail</dt>
              <dd>{client.email}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${channelCls}`}>
            {channelLabel}
          </span>
          <RodoBadge rodoConsentAt={client.rodoConsentAt ?? null} />
        </div>
      </div>

      <EditClientIsland client={client} />
    </div>
  );
}
```

**Note on `EditClientIsland`:** This is a thin Client Component stub that holds the "Edytuj" button and will open `EditClientModal` once it ships in task 7-15 (Slice D). Create `EditClientIsland.tsx` alongside `ClientHeader.tsx`:

```tsx
// apps/web/app/(admin)/admin/clients/[id]/_components/EditClientIsland.tsx
"use client";
/**
 * CC island: "Edytuj" button that will open EditClientModal (task 7-15).
 * Stub: button is rendered but modal is a no-op until 7-15 replaces this.
 * ~20 LOC.
 */
import { useState } from "react";
import type { ClientDto } from "@/lib/clients/types";

interface Props { client: ClientDto }

export function EditClientIsland({ client: _client }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 px-4 py-2 rounded border-2 border-ink bg-white text-sm font-medium shadow-[2px_2px_0_var(--ink)] hover:bg-acid/10 transition-colors"
      >
        Edytuj
      </button>
      {/* TODO(7-15): replace with <EditClientModal open={open} onClose={() => setOpen(false)} client={_client} /> */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-6 shadow-xl text-sm">
            <p className="mb-4 text-admin-mute">Modal w trakcie implementacji (task 7-15).</p>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border border-admin-line text-sm">
              Zamknij
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

---

- [ ] **Step 4: Verify**

```bash
pnpm -F web test RodoBadge
pnpm -F web lint
```

---

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/_components/RodoBadge.tsx \
        apps/web/app/\(admin\)/admin/clients/_components/__tests__/RodoBadge.test.tsx \
        apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientHeader.tsx \
        apps/web/app/\(admin\)/admin/clients/\[id\]/_components/EditClientIsland.tsx

git commit -m "$(cat <<'EOF'
feat(web): ClientHeader + RodoBadge with null/present tests [milestone:7][task:7-10]

Refs: docs/dispatch-log/7-10-<UTC>.md
EOF
)"
```

---

### Task 7-11: `ClientSummaryTiles`

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/_components/ClientSummaryTiles.tsx`

**Review:** combined single-stage.

**Design source:** spec §6.4 — 4 tiles matching `KpiTilesRow` pattern from M6 (`apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx`).

---

**Note:** No dedicated RTL test for this component — it is a pure data-display Server Component with no conditional behavior beyond null-check on `lastOrderAt`. Covered by page-level smoke in 7-12.

- [ ] **Step 1: Implement `ClientSummaryTiles`**

Create `apps/web/app/(admin)/admin/clients/[id]/_components/ClientSummaryTiles.tsx`:

```tsx
/**
 * Four summary tiles for a client dossier.
 * Server Component — receives ClientSummary DTO, no client-side state.
 * Mirrors KpiTilesRow pattern (admin-card + accent border-top).
 * Spec §6.4.
 * ~60 LOC.
 */
import type { ClientSummary } from "@/lib/clients/types";

interface TileProps {
  label: string;
  value: React.ReactNode;
  accent: string;
  testId: string;
}

function SummaryTile({ label, value, accent, testId }: TileProps) {
  return (
    <div
      data-testid={testId}
      className="admin-card p-5 flex flex-col gap-2"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="t-mono text-[11px] uppercase text-admin-mute leading-none">
        {label}
      </div>
      <div className="font-display text-[2.25rem] leading-none">
        {value}
      </div>
    </div>
  );
}

/** Format ISO timestamp as relative-month label, e.g. "04.2025" or "—". */
function fmtLastOrder(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}.${yyyy}`;
}

interface Props {
  summary: ClientSummary;
}

export function ClientSummaryTiles({ summary }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[18px] mb-6">
      <SummaryTile
        testId="tile-all-orders"
        label="Wszystkie zlecenia"
        value={summary.orderCount}
        accent="var(--blue)"
      />
      <SummaryTile
        testId="tile-active-orders"
        label="Aktywne"
        value={summary.openOrderCount}
        accent="var(--acid)"
      />
      <SummaryTile
        testId="tile-last-order"
        label="Ostatnie zlecenie"
        value={fmtLastOrder(summary.lastOrderAt)}
        accent="var(--pink)"
      />
      <SummaryTile
        testId="tile-unread-threads"
        label="Nieprzeczytane wątki"
        value={summary.unreadThreadCount}
        accent="var(--acid)"
      />
    </div>
  );
}
```

**Also add `ClientSummary` type to `apps/web/lib/clients/types.ts`** if not already present (Slice B task 7-7 may have done this; verify at dispatch time and skip if already present):

```ts
// Append to apps/web/lib/clients/types.ts

/** Mirrors ClientSummaryDto.java — aggregate counts for the client dossier. */
export interface ClientSummary {
  clientId: string;
  orderCount: number;
  openOrderCount: number;
  lastOrderAt: string | null;
  unreadThreadCount: number;
}
```

- [ ] **Step 2: Verify**

```bash
pnpm -F web lint
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientSummaryTiles.tsx \
        apps/web/lib/clients/types.ts

git commit -m "$(cat <<'EOF'
feat(web): ClientSummaryTiles — 4 KPI tiles for client dossier [milestone:7][task:7-11]

Refs: docs/dispatch-log/7-11-<UTC>.md
EOF
)"
```

---

### Task 7-12: `/admin/clients/[id]/page.tsx` — overview tab

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/page.tsx`

**Review:** combined single-stage.

**Design source:** spec §7.2 — parallel server fetches, summary tiles + recent orders preview + recent threads preview.

---

- [ ] **Step 1: Implement overview page**

Create `apps/web/app/(admin)/admin/clients/[id]/page.tsx`:

```tsx
/**
 * Client overview tab — /admin/clients/[id]
 * Server Component. Parallel fetches: client, summary, recent orders, recent threads.
 * Renders: ClientHeader + ClientSummaryTiles + recent-orders card + recent-threads card.
 * Spec §7.2.
 * ~75 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import { getClientServer, getClientSummaryServer, listOrdersServer as listClientOrders } from "@/lib/clients/api-server";
import { listThreadsForClientServer } from "@/lib/messaging/api-server";
import { ClientHeader } from "./_components/ClientHeader";
import { ClientSummaryTiles } from "./_components/ClientSummaryTiles";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("client-overview-page");

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ClientOverviewPage({ params }: Props) {
  const { id } = await params;
  log.info("op=render", { clientId: id });

  let results;
  try {
    results = await Promise.all([
      getClientServer(id),
      getClientSummaryServer(id),
      listClientOrders({ clientId: id, size: 5, page: 0 }),
      listThreadsForClientServer(id),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  const [client, summary, ordersPage, threads] = results;
  const recentOrders = ordersPage.content.slice(0, 5);
  const recentThreads = threads.slice(0, 3);

  return (
    <div>
      <ClientHeader client={client} />
      <ClientSummaryTiles summary={summary} />

      <div className="grid grid-cols-2 gap-6">
        {/* Recent orders preview */}
        <div className="admin-card p-5">
          <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
            Ostatnie zlecenia (5)
          </h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-admin-mute py-4 text-center">Brak zleceń</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {recentOrders.map((o) => (
                <li key={o.id} className="py-2.5 flex items-center gap-3">
                  <span className="font-mono text-xs text-admin-mute w-24 shrink-0">{o.code}</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL_CLASS[o.status as OrderStatus]}`}>
                    {STATUS_LABELS_PL[o.status as OrderStatus]}
                  </span>
                  <span className="ml-auto text-xs text-admin-mute">{fmtDate(o.plannedPickupAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent threads preview */}
        <div className="admin-card p-5">
          <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
            Ostatnie wątki (3)
          </h2>
          {recentThreads.length === 0 ? (
            <p className="text-sm text-admin-mute py-4 text-center">Brak wątków</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {recentThreads.map((t) => {
                const channelCls = t.channel === "EMAIL"
                  ? "bg-blue/10 text-blue border-blue/20"
                  : "bg-violet-50 text-violet-700 border-violet-200";
                return (
                  <li key={t.id} className="py-2.5 flex items-center gap-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border shrink-0 ${channelCls}`}>
                      {t.channel}
                    </span>
                    <span className="text-sm text-admin-ink truncate flex-1">
                      {t.lastMessagePreview ?? "—"}
                    </span>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold">
                        {t.unreadCount}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Required additions to `lib/clients/api-server.ts`** (add if not already present from Slice B):

```ts
// Append to apps/web/lib/clients/api-server.ts

import type { ClientSummary, Page } from "./types";
import type { OrderListRow } from "@/lib/orders/types";

export async function getClientSummaryServer(id: string): Promise<ClientSummary> {
  const resp = await fetch(`${await base()}/api/admin/clients/${id}/summary`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientSummaryServer outcome=error", { clientId: id, status: resp.status });
    const e = new Error(`getClientSummary failed: ${resp.status}`) as Error & { status: number };
    e.status = resp.status;
    throw e;
  }
  return (await resp.json()) as ClientSummary;
}

export async function listOrdersServer(
  opts: { clientId: string; page?: number; size?: number },
): Promise<Page<OrderListRow>> {
  const p = new URLSearchParams();
  p.set("clientId", opts.clientId);
  p.set("page", String(opts.page ?? 0));
  p.set("size", String(opts.size ?? 25));
  const resp = await fetch(`${await base()}/api/admin/orders?${p.toString()}`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=listOrdersServer(clientId) outcome=error", { ...opts, status: resp.status });
    const e = new Error(`listOrders failed: ${resp.status}`) as Error & { status: number };
    e.status = resp.status;
    throw e;
  }
  return (await resp.json()) as Page<OrderListRow>;
}
```

**Note on naming collision:** `lib/orders/api-server.ts` already exports `listOrdersServer`. This new helper in `lib/clients/api-server.ts` uses the same name but is imported under the alias `listClientOrders` in `page.tsx` to avoid the collision. If Slice B already added a `listOrdersServer` to `lib/clients/api-server.ts` with different signature, use it directly instead.

**Required addition to `lib/messaging/api-server.ts`** (add if not present):

```ts
// Append to apps/web/lib/messaging/api-server.ts

export async function listThreadsForClientServer(clientId: string): Promise<MessageThreadDto[]> {
  log.info("op=listThreadsForClientServer", { clientId });
  return serverGet<MessageThreadDto[]>(
    `/api/admin/threads?clientId=${encodeURIComponent(clientId)}`,
    "listThreadsForClientServer",
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm -F web lint
pnpm -F web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/\[id\]/page.tsx \
        apps/web/lib/clients/api-server.ts \
        apps/web/lib/messaging/api-server.ts

git commit -m "$(cat <<'EOF'
feat(web): client overview page — parallel fetches + recent orders/threads preview [milestone:7][task:7-12]

Refs: docs/dispatch-log/7-12-<UTC>.md
EOF
)"
```

---

## Wave 5 — Detail sub-tabs

### Task 7-13: `/admin/clients/[id]/zlecenia/page.tsx` — full orders sub-tab

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/zlecenia/page.tsx`

**Review:** combined single-stage.

**Design source:** spec §7.3 — same table look as `/admin/orders`; `OrdersTable` is a Client Component and cannot be re-exported directly into a Server Component subtree without a wrapper. See implementation note below.

---

**Exportability check (read before implementing):** `OrdersTable` in `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` is `"use client"` and uses `useRouter` + `useSearchParams`. It CAN be rendered from a Server Component parent but its pagination `goToPage` pushes to `/admin/orders?page=…`, not to `/admin/clients/[id]/zlecenia?page=…`. Therefore **do not reuse `OrdersTable` directly**. Port the table rendering logic inline — a simplified read-only variant (no checkbox selection, no `RowQuickActionsMenu`, no drawer open-on-click) that uses server-side `<a>` / `<Link>` pagination instead.

- [ ] **Step 1: Implement zlecenia sub-tab page**

Create `apps/web/app/(admin)/admin/clients/[id]/zlecenia/page.tsx`:

```tsx
/**
 * Full orders list filtered by clientId.
 * Server Component. Reads `page` from searchParams.
 * Ported table rendering (read-only, no checkbox/bulk/drawer) — OrdersTable
 * is not reusable here because its router calls target /admin/orders.
 * Spec §7.3.
 * ~75 LOC.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getClientServer, listOrdersServer as listClientOrders } from "@/lib/clients/api-server";
import { ClientHeader } from "../_components/ClientHeader";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("client-orders-page");

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pricePLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

export default async function ClientOrdersPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  log.info("op=render", { clientId: id, page });

  let client, ordersPage;
  try {
    [client, ordersPage] = await Promise.all([
      getClientServer(id),
      listClientOrders({ clientId: id, page, size: 25 }),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  const { content: rows, totalPages, number: currentPage } = ordersPage;
  const thCls = "px-3 py-2 text-left text-xs font-medium text-admin-mute uppercase tracking-wide";
  const tdCls = "px-3 py-3 text-sm text-admin-ink";
  const baseHref = `/admin/clients/${id}/zlecenia` as Route;

  return (
    <div>
      <ClientHeader client={client} />

      {rows.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak zleceń dla tego klienta.
        </div>
      ) : (
        <div className="overflow-x-auto border border-admin-line rounded">
          <table className="w-full border-collapse">
            <thead className="bg-admin-surface border-b border-admin-line">
              <tr>
                <th className={thCls}>Kod</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Termin odbioru</th>
                <th className={thCls + " text-right"}>Suma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-admin-line hover:bg-acid/5 transition-colors">
                  <td className={tdCls + " font-mono text-xs"}>{row.code}</td>
                  <td className={tdCls}>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL_CLASS[row.status as OrderStatus]}`}>
                      {STATUS_LABELS_PL[row.status as OrderStatus]}
                    </span>
                  </td>
                  <td className={tdCls}>{fmtDate(row.plannedPickupAt)}</td>
                  <td className={tdCls + " text-right font-mono"}>{pricePLN(row.totalPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <Link
            href={currentPage === 0 ? ("#" as Route) : (`${baseHref}?page=${currentPage - 1}` as Route)}
            aria-disabled={currentPage === 0}
            className={`px-3 py-1 rounded border border-admin-line text-admin-ink ${currentPage === 0 ? "opacity-40 pointer-events-none" : "hover:bg-acid/10"}`}
          >
            ← Poprzednia
          </Link>
          <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
          <Link
            href={currentPage >= totalPages - 1 ? ("#" as Route) : (`${baseHref}?page=${currentPage + 1}` as Route)}
            aria-disabled={currentPage >= totalPages - 1}
            className={`px-3 py-1 rounded border border-admin-line text-admin-ink ${currentPage >= totalPages - 1 ? "opacity-40 pointer-events-none" : "hover:bg-acid/10"}`}
          >
            Następna →
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm -F web lint
pnpm -F web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/\[id\]/zlecenia/page.tsx

git commit -m "$(cat <<'EOF'
feat(web): client orders sub-tab — full paginated orders list filtered by clientId [milestone:7][task:7-13]

OrdersTable not reusable (router calls hardcoded to /admin/orders); ported
inline read-only variant with server-side Link pagination.

Refs: docs/dispatch-log/7-13-<UTC>.md
EOF
)"
```

---

### Task 7-14: `/admin/clients/[id]/wiadomosci/page.tsx` — full threads sub-tab

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/[id]/wiadomosci/page.tsx`

**Review:** combined single-stage.

**Design source:** spec §7.4 — same pattern as 7-13. Thread list reuses row rendering logic from `ThreadListRow` visually but in a Server Component context (no polling, no state).

---

**Exportability check:** `ThreadList` and `ThreadListRow` are both Client Components. `ThreadListRow` imports no hooks and only uses props, so its JSX can be ported inline into a Server Component. The pagination note from 7-13 applies (server-side Links). Backend returns a plain array for the clientId-filtered threads path (spec §3.3), so no page wrapper — render all results, no pagination needed for this path (backend returns all threads for a client ordered by lastMessageAt desc, no page param).

- [ ] **Step 1: Implement wiadomosci sub-tab page**

Create `apps/web/app/(admin)/admin/clients/[id]/wiadomosci/page.tsx`:

```tsx
/**
 * Full threads list filtered by clientId.
 * Server Component. No polling (RSC pattern) — snapshot at page load.
 * ThreadList CC is not reusable (holds poll + state); thread row rendering ported inline.
 * Spec §7.4.
 * ~70 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import { getClientServer } from "@/lib/clients/api-server";
import { listThreadsForClientServer } from "@/lib/messaging/api-server";
import { ClientHeader } from "../_components/ClientHeader";

const log = createLogger("client-threads-page");

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientThreadsPage({ params }: Props) {
  const { id } = await params;
  log.info("op=render", { clientId: id });

  let client, threads;
  try {
    [client, threads] = await Promise.all([
      getClientServer(id),
      listThreadsForClientServer(id),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  return (
    <div>
      <ClientHeader client={client} />

      {threads.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak wątków wiadomości dla tego klienta.
        </div>
      ) : (
        <div className="border border-admin-line rounded divide-y divide-admin-line">
          {threads.map((t) => {
            const isUnread = t.unreadCount > 0;
            const channelCls = t.channel === "EMAIL"
              ? "bg-blue/10 text-blue border-blue/20"
              : "bg-violet-50 text-violet-700 border-violet-200";
            const lastAt = t.lastMessageAt
              ? new Date(t.lastMessageAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "—";

            return (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-acid/5 transition-colors">
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border shrink-0 ${channelCls}`}>
                  {t.channel}
                </span>
                <span className={`flex-1 text-sm truncate ${isUnread ? "font-semibold text-admin-ink" : "text-admin-mute"}`}>
                  {t.lastMessagePreview ?? "—"}
                </span>
                <span className="text-xs text-admin-mute shrink-0">{lastAt}</span>
                {isUnread && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold shrink-0">
                    {t.unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm -F web lint
pnpm -F web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/clients/\[id\]/wiadomosci/page.tsx

git commit -m "$(cat <<'EOF'
feat(web): client threads sub-tab — RSC snapshot of clientId-filtered threads [milestone:7][task:7-14]

ThreadList CC not reusable (poll+state); row rendering ported inline.
Backend returns full array for clientId path — no pagination needed.

Refs: docs/dispatch-log/7-14-<UTC>.md
EOF
)"
```
## Wave 6 — Edit modal + RODO badge

> Tasks 7-15 depends on tasks 7-12 (lib/clients.ts `updateClient`), 7-13
> (`ClientHeader` / `RodoBadge`), and 7-14 (`EditClientModal` stub or full
> implementation). Dispatch this wave after Wave 5 commits are on disk.

---

### Task 7-15: `EditClientModal` (TWO-STAGE)

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/_components/EditClientModal.tsx`
- Create: `apps/web/app/(admin)/admin/clients/_components/useEditClientModalForm.ts`
- Create: `apps/web/app/(admin)/admin/clients/_components/__tests__/EditClientModal.test.tsx`

**Review:** TWO-STAGE.
Stage 1 — full implementation + RTL tests.
Stage 2 — review focuses on: (a) form-state correctness (pre-fill from `ClientDto`,
controlled fields, no stale closures), (b) a11y (focus trap, ESC, labelled inputs,
`role="alert"` on error), (c) validation completeness (phone-OR-email rule applies
before submit and prevents network call), (d) error-path handling (400 → inline,
500 → toast), (e) Polish copy quality, (f) RODO tri-state (`rodoConsent: true |
false | null`) wired correctly to `updateClient`, (g) channel radio group maps
string → `"EMAIL" | "SMS" | "WHATSAPP"`.

---

#### Stage 1

- [ ] **Step 1: Write the failing tests (RED)**

Create `apps/web/app/(admin)/admin/clients/_components/__tests__/EditClientModal.test.tsx`:

```tsx
/**
 * RTL tests for EditClientModal.
 * vi.mock is used to isolate updateClient from network.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditClientModal } from "../EditClientModal";
import * as clientsApi from "@/lib/clients/api";
import type { ClientDto } from "@/lib/clients/types";

vi.mock("@/lib/clients/api");
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BASE_CLIENT: ClientDto = {
  id: "client-1",
  firstName: "Marek",
  lastName: "Kowalski",
  phone: "+48111222333",
  email: "marek@example.com",
  preferredChannel: "EMAIL",
  rodoConsentAt: "2026-04-01T10:00:00Z",
  notes: "Stały klient",
  createdAt: "2026-01-01T00:00:00Z",
};

function setup(client = BASE_CLIENT) {
  const onOpenChange = vi.fn();
  render(
    <EditClientModal open={true} onOpenChange={onOpenChange} client={client} />
  );
  return { onOpenChange };
}

describe("EditClientModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills all fields from client prop", () => {
    setup();
    expect(screen.getByDisplayValue("Marek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Kowalski")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+48111222333")).toBeInTheDocument();
    expect(screen.getByDisplayValue("marek@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stały klient")).toBeInTheDocument();
    // RODO switch — checked because rodoConsentAt is non-null
    const rodoSwitch = screen.getByRole("switch", { name: /rodo/i });
    expect(rodoSwitch).toBeChecked();
    // EMAIL radio selected
    expect(screen.getByRole("radio", { name: /email/i })).toBeChecked();
  });

  it("happy path — submits correctly and closes modal", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue({
      ...BASE_CLIENT,
      firstName: "Marcin",
    });
    const { onOpenChange } = setup();

    await user.clear(screen.getByLabelText(/imię/i));
    await user.type(screen.getByLabelText(/imię/i), "Marcin");
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith("client-1", expect.objectContaining({
        firstName: "Marcin",
        preferredChannel: "EMAIL",
      }));
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows validation error when both phone and email are cleared", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText(/telefon/i));
    await user.clear(screen.getByLabelText(/e-mail/i));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/musi być telefon lub e-mail/i);
    expect(clientsApi.updateClient).not.toHaveBeenCalled();
  });

  it("RODO toggle off sends rodoConsent: false", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);
    setup();

    await user.click(screen.getByRole("switch", { name: /rodo/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ rodoConsent: false })
      );
    });
  });

  it("RODO toggle on (was null) sends rodoConsent: true", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue({
      ...BASE_CLIENT,
      rodoConsentAt: null,
    });
    setup({ ...BASE_CLIENT, rodoConsentAt: null });
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);

    await user.click(screen.getByRole("switch", { name: /rodo/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ rodoConsent: true })
      );
    });
  });

  it("channel radio group — switching to SMS updates payload", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);
    setup();

    await user.click(screen.getByRole("radio", { name: /sms/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ preferredChannel: "SMS" })
      );
    });
  });

  it("ESC key closes modal without submitting", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(clientsApi.updateClient).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run RED — confirm all tests fail**

```bash
pnpm -F web test -- EditClientModal.test.tsx --run
```

Expected: all tests fail (module not found or assertions fail).

---

- [ ] **Step 3: Implement `useEditClientModalForm.ts`**

Create `apps/web/app/(admin)/admin/clients/_components/useEditClientModalForm.ts`:

```ts
"use client";

/**
 * Form state and submit logic for EditClientModal.
 * Extracted to keep EditClientModal.tsx under 80 LOC.
 * < 80 LOC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLogger } from "@/lib/log";
import { updateClient } from "@/lib/clients/api";
import { HttpError } from "@/lib/api";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("edit-client-modal-form");

export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export interface EditFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  channel: Channel;
  rodoEnabled: boolean;
  notes: string;
}

export function initFormState(client: ClientDto): EditFormState {
  return {
    firstName: client.firstName ?? "",
    lastName: client.lastName ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    channel: (client.preferredChannel as Channel) ?? "EMAIL",
    rodoEnabled: client.rodoConsentAt !== null && client.rodoConsentAt !== undefined,
    notes: client.notes ?? "",
  };
}

export function useEditClientModalForm(
  client: ClientDto,
  onClose: () => void,
) {
  const router = useRouter();
  const [form, setForm] = useState<EditFormState>(() => initFormState(client));
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim() && !form.email.trim()) {
      setFieldError("Musi być telefon lub e-mail.");
      return;
    }
    setFieldError(null);
    setError(null);
    setLoading(true);
    log.info("op=editClient attempt", { clientId: client.id });
    try {
      // Determine rodoConsent tri-state relative to original value.
      const wasGranted = client.rodoConsentAt !== null && client.rodoConsentAt !== undefined;
      let rodoConsent: boolean | null = null;
      if (form.rodoEnabled && !wasGranted) rodoConsent = true;
      if (!form.rodoEnabled && wasGranted) rodoConsent = false;

      await updateClient(client.id, {
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        phone: form.phone || null,
        email: form.email || null,
        preferredChannel: form.channel,
        rodoConsent,
        notes: form.notes || null,
      });
      log.info("op=editClient outcome=ok", { clientId: client.id });
      onClose();
      router.refresh();
    } catch (err) {
      const is400 = err instanceof HttpError && err.status === 400;
      const msg = is400
        ? "Dane są nieprawidłowe. Sprawdź formularz."
        : "Wystąpił błąd serwera. Spróbuj ponownie.";
      log.warn("op=editClient outcome=error", {
        clientId: client.id,
        status: err instanceof HttpError ? err.status : "unknown",
      });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(initFormState(client));
    setError(null);
    setFieldError(null);
    setLoading(false);
  }

  return { form, setField, error, fieldError, loading, onSubmit, reset };
}
```

- [ ] **Step 4: Implement `EditClientModal.tsx`**

Create `apps/web/app/(admin)/admin/clients/_components/EditClientModal.tsx`:

```tsx
"use client";

/**
 * EditClientModal — Radix Dialog for editing an existing client.
 * Pre-fills from ClientDto prop. Tri-state RODO switch.
 * < 80 LOC (form state in useEditClientModalForm).
 */
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { createLogger } from "@/lib/log";
import { useEditClientModalForm, type Channel } from "./useEditClientModalForm";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("edit-client-modal");

const CHANNEL_OPTS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientDto;
}

export function EditClientModal({ open, onOpenChange, client }: EditClientModalProps) {
  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
    log.info("op=modal", { open: v, clientId: client.id });
  }

  const { form, setField, error, fieldError, loading, onSubmit, reset } =
    useEditClientModalForm(client, () => onOpenChange(false));

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper text-ink p-6 rounded-2xl shadow-xl max-w-lg w-full z-50 focus:outline-none"
          aria-describedby="edit-client-desc"
        >
          <Dialog.Title className="font-display text-xl mb-1">Edytuj klienta</Dialog.Title>
          <Dialog.Description id="edit-client-desc" className="text-sm text-admin-mute mb-4">
            Zaktualizuj dane klienta.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <label className="block" htmlFor="ecm-firstName">
              <span className="text-sm font-medium text-admin-mute">Imię *</span>
              <input id="ecm-firstName" required value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-lastName">
              <span className="text-sm font-medium text-admin-mute">Nazwisko</span>
              <input id="ecm-lastName" value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-phone">
              <span className="text-sm font-medium text-admin-mute">Telefon</span>
              <input id="ecm-phone" type="tel" value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            <label className="block" htmlFor="ecm-email">
              <span className="text-sm font-medium text-admin-mute">E-mail</span>
              <input id="ecm-email" type="email" value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid" />
            </label>
            {fieldError && (
              <p role="alert" className="text-sm text-orange">{fieldError}</p>
            )}
            <fieldset>
              <legend className="text-sm font-medium text-admin-mute mb-1">Preferowany kanał</legend>
              <div className="flex gap-4">
                {CHANNEL_OPTS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ecm-channel" value={value}
                      checked={form.channel === value}
                      onChange={() => setField("channel", value)}
                      className="accent-ink" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center justify-between">
              <label htmlFor="ecm-rodo" className="text-sm font-medium text-admin-mute">
                Zgoda RODO
              </label>
              <Switch.Root id="ecm-rodo" checked={form.rodoEnabled}
                onCheckedChange={(v) => setField("rodoEnabled", v)}
                className="w-10 h-6 rounded-full bg-admin-line data-[state=checked]:bg-ink transition-colors focus:outline-none focus:ring-2 focus:ring-acid"
                aria-label="Klient wyraził zgodę RODO"
              >
                <Switch.Thumb className="block w-4 h-4 bg-paper rounded-full shadow translate-x-1 data-[state=checked]:translate-x-5 transition-transform" />
              </Switch.Root>
            </div>
            <label className="block" htmlFor="ecm-notes">
              <span className="text-sm font-medium text-admin-mute">Notatki</span>
              <textarea id="ecm-notes" value={form.notes} rows={3}
                onChange={(e) => setField("notes", e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid resize-none" />
            </label>
            {error && <p role="alert" className="text-sm text-orange">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <button type="button"
                  className="h-10 px-4 border border-admin-line rounded-sm text-sm hover:bg-acid/10">
                  Anuluj
                </button>
              </Dialog.Close>
              <button type="submit" disabled={loading}
                className="h-10 px-4 bg-ink text-paper font-medium rounded-sm hover:bg-admin-ink disabled:opacity-60 text-sm">
                {loading ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

> **LOC note:** EditClientModal.tsx will be close to 80 LOC due to fieldset +
> Switch markup. If the file exceeds 80 LOC on first pass, extract the channel
> fieldset to a tiny `ChannelRadioGroup.tsx` (3 radio inputs, ~20 LOC) or the
> RODO row to `RodoSwitchRow.tsx`. The form-state hook is already extracted.
> The split decision is left to the implementor — document the final LOC in the
> dispatch log.

---

- [ ] **Step 5: Run GREEN — confirm tests pass**

```bash
pnpm -F web test -- EditClientModal.test.tsx --run
```

Expected: all 6 tests pass.

- [ ] **Step 6: Full frontend suite**

```bash
pnpm -F web test --run
```

Expected: all existing tests + 6 new tests pass, 0 failures.

---

- [ ] **Step 7: Type-check + lint**

```bash
pnpm -F web tsc --noEmit
pnpm -F web exec eslint apps/web/app/\(admin\)/admin/clients/_components/EditClientModal.tsx \
  apps/web/app/\(admin\)/admin/clients/_components/useEditClientModalForm.ts
```

Expected: 0 type errors, 0 lint errors. Fix all type errors before proceeding to
Stage 2 review.

---

- [ ] **Step 8: Stage 1 commit**

```bash
git add \
  "apps/web/app/(admin)/admin/clients/_components/EditClientModal.tsx" \
  "apps/web/app/(admin)/admin/clients/_components/useEditClientModalForm.ts" \
  "apps/web/app/(admin)/admin/clients/_components/__tests__/EditClientModal.test.tsx"
git commit -m "$(cat <<'EOF'
feat(clients): EditClientModal + useEditClientModalForm — pre-fill, RODO tri-state, channel radio, RTL tests [milestone:7][task:7-15]

Radix Dialog with full client edit form: imię/nazwisko/telefon/e-mail, channel radio
(EMAIL|SMS|WHATSAPP), RODO Switch (tri-state: null=no-change, true=grant, false=revoke),
notatki textarea. Validation: phone-OR-email required before submit. 400 → inline
fieldError; 500 → inline error alert. On success: close modal + router.refresh(). Form
state extracted to useEditClientModalForm hook to keep component <80 LOC.
6 RTL tests: happy path, validation, RODO on/off, channel switch, ESC close.

Refs: docs/dispatch-log/7-15-<UTC>.md
EOF
)"
```

Stage 1 complete. TWO-STAGE: Stage 2 review pending.

---

#### Stage 2

- [ ] **Step 9: Stage 2 review**

Dispatch a review-only subagent (or orchestrator review) targeting:

1. **Form-state correctness** — confirm `initFormState` maps `ClientDto` fields
   correctly (nullable `lastName`, `phone`, `email`, `notes` → empty string; `preferredChannel`
   cast to `Channel`; `rodoConsentAt !== null` → `rodoEnabled: true`). Confirm no
   stale closure around `client` prop.
2. **RODO tri-state** — confirm the `rodoConsent` tri-state logic is correct:
   - was NOT granted + switch turned ON → `rodoConsent: true`
   - was granted + switch turned OFF → `rodoConsent: false`
   - no change → `rodoConsent: null` (no-op to backend)
   Flag if the implementation sends `true` or `false` on every save regardless.
3. **Validation** — confirm the phone-OR-email check fires client-side before calling
   `updateClient`, confirm it uses the live form state (not the initial client state),
   confirm `updateClient` is NOT called when validation fails.
4. **a11y** — confirm Radix `Dialog.Content` traps focus (Radix does this by default;
   verify no `trapFocus={false}` or similar override), confirm ESC calls `onOpenChange(false)`,
   confirm all inputs have `id` + matching `htmlFor` label, confirm error paragraphs use
   `role="alert"`, confirm the RODO switch has `aria-label`.
5. **Polish copy quality** — confirm field labels, button labels, error messages, and
   modal title/description match spec §6.6. Specifically: "Musi być telefon lub e-mail."
   (not a variant), "Zapisz" / "Anuluj" buttons, "Zgoda RODO" switch label.
6. **Channel radio** — confirm the `name` attribute groups all radios, confirm
   `CHANNEL_OPTS` covers exactly `EMAIL | SMS | WHATSAPP`, confirm no leftover
   `CHANNELS` constant from the implementation draft.
7. **Error display** — confirm 400 errors from `updateClient` show as `fieldError`
   (inline below email), and 500 / network errors show as `error` (above buttons).
   Confirm the `is400` detection uses `HttpError` correctly.
8. **LOC** — confirm `EditClientModal.tsx` is ≤ 80 LOC and
   `useEditClientModalForm.ts` is ≤ 80 LOC. If over cap, flag and request extraction.

If Stage 2 issues found, address inline (no new task ID needed for ≤5-line fixups
per dispatch protocol rule 5) and recommit:

```bash
git commit -m "$(cat <<'EOF'
fix(clients): 7-15 Stage 2 review fixup — <short description> [milestone:7][task:7-15]

Refs: docs/dispatch-log/7-15-<UTC>.md
EOF
)"
```

- [ ] **Step 10: Acceptance criteria (Stage 2)**

- Stage 2 review approved (all 8 checklist items pass or fixup committed).
- `pnpm -F web test --run` → 0 failures.
- `pnpm -F web tsc --noEmit` → 0 errors.
- No leftover CHANNELS / dead-code constants.
- Dispatch log written to `docs/dispatch-log/7-15-<UTC>.md`.

---

## Wave 7 — Stubs + smoke + sidebar wiring

> Wave 7 depends on Wave 6 being committed (EditClientModal merged). These tasks
> are the last before milestone-7 closure. They can be dispatched serially in one
> subagent invocation.

---

### Task 7-16: `PlaceholderCard` + stub pages

**Files:**
- Create: `apps/web/app/(admin)/admin/clients/_components/PlaceholderCard.tsx`
- Create: `apps/web/app/(admin)/admin/sklep/page.tsx`
- Create: `apps/web/app/(admin)/admin/aktualnosci/page.tsx`
- Create: `apps/web/app/(admin)/admin/sklep/__tests__/page.test.tsx`
- Create: `apps/web/app/(admin)/admin/aktualnosci/__tests__/page.test.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write smoke-render tests (RED)**

Create `apps/web/app/(admin)/admin/sklep/__tests__/page.test.tsx`:

```tsx
/**
 * Smoke-render test: /admin/sklep page.
 * Verifies the placeholder card renders with correct copy and no console errors.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SklepPage from "../page";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

describe("SklepPage", () => {
  it("renders placeholder card with correct Polish copy", () => {
    render(<SklepPage />);
    expect(screen.getByText("Sklep")).toBeInTheDocument();
    expect(screen.getByText(/do implementacji w przyszłości/i)).toBeInTheDocument();
    expect(screen.getByText(/zarządzane poza panelem/i)).toBeInTheDocument();
  });

  it("renders without console errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SklepPage />);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

Create `apps/web/app/(admin)/admin/aktualnosci/__tests__/page.test.tsx`:

```tsx
/**
 * Smoke-render test: /admin/aktualnosci page.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AktualnosciPage from "../page";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

describe("AktualnosciPage", () => {
  it("renders placeholder card with correct Polish copy", () => {
    render(<AktualnosciPage />);
    expect(screen.getByText("Aktualności")).toBeInTheDocument();
    expect(screen.getByText(/do implementacji w przyszłości/i)).toBeInTheDocument();
    expect(screen.getByText(/zarządzane poza panelem/i)).toBeInTheDocument();
  });

  it("renders without console errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AktualnosciPage />);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run RED — confirm tests fail**

```bash
pnpm -F web test -- "sklep/__tests__/page.test" --run
pnpm -F web test -- "aktualnosci/__tests__/page.test" --run
```

Expected: test files not found or imports fail.

---

- [ ] **Step 3: Implement `PlaceholderCard.tsx`**

Create `apps/web/app/(admin)/admin/clients/_components/PlaceholderCard.tsx`:

```tsx
/**
 * PlaceholderCard — centered informational card for stub pages.
 * Used by /admin/sklep and /admin/aktualnosci.
 * Props: title, body, note (optional).
 * SC — no interactivity needed.
 * ~20 LOC.
 */
interface PlaceholderCardProps {
  title: string;
  body: string;
  note?: string;
}

export function PlaceholderCard({ title, body, note }: PlaceholderCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-admin-surface border border-admin-line rounded-2xl p-8 text-center">
        <h1 className="font-display text-2xl mb-3 text-admin-ink">{title}</h1>
        <p className="text-admin-mute text-base mb-2">{body}</p>
        {note && (
          <p className="text-admin-mute text-sm mt-3 italic">{note}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement stub pages**

Create `apps/web/app/(admin)/admin/sklep/page.tsx`:

```tsx
import { PlaceholderCard } from "@/app/(admin)/admin/clients/_components/PlaceholderCard";

/**
 * /admin/sklep — minimal stub page (real implementation deferred per ROADMAP.md).
 */
export default function SklepPage() {
  return (
    <PlaceholderCard
      title="Sklep"
      body="Do implementacji w przyszłości"
      note="Zarządzane poza panelem; w kolejnym wydaniu pojawi się tu pełna obsługa."
    />
  );
}
```

Create `apps/web/app/(admin)/admin/aktualnosci/page.tsx`:

```tsx
import { PlaceholderCard } from "@/app/(admin)/admin/clients/_components/PlaceholderCard";

/**
 * /admin/aktualnosci — minimal stub page (real implementation deferred per ROADMAP.md).
 */
export default function AktualnosciPage() {
  return (
    <PlaceholderCard
      title="Aktualności"
      body="Do implementacji w przyszłości"
      note="Zarządzane poza panelem; w kolejnym wydaniu pojawi się tu pełna obsługa."
    />
  );
}
```

- [ ] **Step 5: Run GREEN**

```bash
pnpm -F web test -- "sklep/__tests__/page.test" "aktualnosci/__tests__/page.test" --run
```

Expected: 4 tests pass (2 per page).

- [ ] **Step 6: Full frontend suite**

```bash
pnpm -F web test --run
```

Expected: 0 failures.

- [ ] **Step 7: Commit**

```bash
git add \
  "apps/web/app/(admin)/admin/clients/_components/PlaceholderCard.tsx" \
  "apps/web/app/(admin)/admin/sklep/page.tsx" \
  "apps/web/app/(admin)/admin/aktualnosci/page.tsx" \
  "apps/web/app/(admin)/admin/sklep/__tests__/page.test.tsx" \
  "apps/web/app/(admin)/admin/aktualnosci/__tests__/page.test.tsx"
git commit -m "$(cat <<'EOF'
feat(clients): PlaceholderCard shared SC + /admin/sklep + /admin/aktualnosci stub pages [milestone:7][task:7-16]

PlaceholderCard renders a centered card with title/body/note. Both stub pages
render the card with Polish copy matching spec §6.8 / §7.5. Smoke-render tests
confirm correct copy and no console errors. Real Sklep + Aktualności implementations
remain deferred per ROADMAP.md (locked 2026-05-10).

Refs: docs/dispatch-log/7-16-<UTC>.md
EOF
)"
```

---

### Task 7-17: Sidebar wiring verify + active-state + smoke UAT + milestone-7 tag

**Files:**
- Modify: `apps/web/components/admin/AdminSidebar.tsx` (if sidebar hrefs are not
  correct — see Step 1 verification)
- Verify only (no edit if already correct): sidebar active-state for
  `/admin/clients/*` sub-routes

**Review:** combined single-stage.

---

- [ ] **Step 1: Verify sidebar hrefs**

Run a grep to confirm the current sidebar state:

```bash
grep -n "Klienci\|Sklep\|Aktualności\|aktualnosci\|sklep\|clients" \
  apps/web/components/admin/AdminSidebar.tsx
```

**Current state (observed at plan-writing time):**
`AdminSidebar.tsx` has `Klienci` and `Zamówienia` as disabled `div` elements
with `cursor-not-allowed` styling (no `<Link>` wrappers). Sklep and Aktualności
are not yet in the sidebar at all.

**Required end state:**
1. `Klienci` → `<Link href="/admin/clients">` with active-state highlighting when
   `pathname.startsWith("/admin/clients")`.
2. `Sklep` → `<Link href="/admin/sklep">` with active-state highlighting.
3. `Aktualności` → `<Link href="/admin/aktualnosci">` with active-state highlighting.
4. `Dashboard` → `<Link href="/admin">` with active-state.
5. `Zamówienia` → `<Link href="/admin/orders">` with active-state.

If Step 1 grep shows the sidebar is already correctly wired (unlikely given the
`cursor-not-allowed` state), document the finding and skip Step 2.

---

- [ ] **Step 2: Refactor `AdminSidebar.tsx` to real nav**

`AdminSidebar.tsx` is currently a server component that renders static `div`
elements. Because active-state requires `usePathname()` (a client hook), the
cleanest approach is to extract the nav links into a `AdminSidebarNav.tsx`
Client Component (CC) and keep `AdminSidebar.tsx` as an SC shell. This mirrors
the existing `MessagesNavItem` CC pattern.

Create `apps/web/components/admin/AdminSidebarNav.tsx` (CC, ~55 LOC):

```tsx
"use client";

/**
 * AdminSidebarNav — client component for sidebar navigation.
 * Uses usePathname() for active-state highlighting.
 * Mirrors MessagesNavItem CC pattern.
 * ~55 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { MessagesNavItem } from "@/app/(admin)/admin/_components/Sidebar/MessagesNavItem";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.sidebar.nav");

interface NavLinkProps {
  href: string;
  label: string;
  matchPrefix: string;
}

function NavLink({ href, label, matchPrefix }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(matchPrefix);
  return (
    <Link
      href={href as Route}
      className={
        "block px-2 py-1 rounded text-sm font-medium transition-colors " +
        (active
          ? "bg-acid/30 text-ink"
          : "text-admin-mute hover:bg-acid/10 hover:text-ink")
      }
    >
      {label}
    </Link>
  );
}

export function AdminSidebarNav() {
  log.debug("op=AdminSidebarNav.render");
  return (
    <nav className="space-y-1 text-sm flex-1">
      <div className="text-admin-mute uppercase text-xs tracking-wide">Pulpit</div>
      <NavLink href="/admin" label="Dashboard" matchPrefix="/admin" />

      <div className="text-admin-mute uppercase text-xs tracking-wide mt-4">Operacje</div>
      <NavLink href="/admin/orders" label="Zamówienia" matchPrefix="/admin/orders" />
      <NavLink href="/admin/clients" label="Klienci" matchPrefix="/admin/clients" />
      <MessagesNavItem />

      <div className="text-admin-mute uppercase text-xs tracking-wide mt-4">Sklep</div>
      <NavLink href="/admin/sklep" label="Sklep" matchPrefix="/admin/sklep" />
      <NavLink href="/admin/aktualnosci" label="Aktualności" matchPrefix="/admin/aktualnosci" />
    </nav>
  );
}
```

> **Active-state caveat for Dashboard:** `pathname.startsWith("/admin")` would
> match every admin page. Use `pathname === "/admin"` for the exact Dashboard
> match, and all other navlinks use `startsWith`. The `NavLink` component above
> uses `pathname === href || pathname.startsWith(matchPrefix)` — for Dashboard,
> pass `matchPrefix="/admin"` and `href="/admin"`, but the `===` check fires first
> so the Dashboard only highlights on the exact `/admin` path.

Update `apps/web/components/admin/AdminSidebar.tsx` to use the new nav:

```tsx
import type { MeResponse } from "@/lib/auth/types";
import { AdminSidebarNav } from "./AdminSidebarNav";

interface Props {
  me: MeResponse;
}

/** AdminSidebar — SC shell. Nav delegated to AdminSidebarNav (CC) for usePathname. */
export function AdminSidebar({ me }: Props) {
  return (
    <aside className="w-60 border-r border-admin-line bg-admin-surface p-4 flex flex-col">
      <div className="font-display text-lg mb-6">Dr Shoes</div>
      <AdminSidebarNav />
      <div className="mt-8 pt-4 border-t border-admin-line text-xs text-admin-mute">
        Zalogowany jako
        <br />
        <span className="text-admin-ink font-medium">{me.fullName}</span>
        <div className="font-mono text-[10px]">{me.role}</div>
      </div>
    </aside>
  );
}
```

---

- [ ] **Step 3: Run type-check + lint**

```bash
pnpm -F web tsc --noEmit
pnpm -F web exec eslint apps/web/components/admin/AdminSidebar.tsx \
  apps/web/components/admin/AdminSidebarNav.tsx
```

Expected: 0 type errors, 0 lint errors.

---

- [ ] **Step 4: Full suite green**

```bash
mvn -pl backend/app -B verify -q
pnpm -F web test --run
pnpm -F web tsc --noEmit
```

Expected: backend suite ≥ prior count, 0 failures, 0 errors. Frontend suite 0
failures. Typecheck 0 errors.

---

- [ ] **Step 5: Manual UAT checklist (spec §10.3)**

Spin up the dev stack (`docker compose up -d` backend + `pnpm -F web dev`) and
walk through all 10 acceptance items. Check each off:

1. [ ] Sidebar "Klienci" link navigates to `/admin/clients`; list renders (empty
       state if no clients, paginated rows if seeded).
2. [ ] Type "kowal" in the search box → typeahead results replace the list within
       ~300ms.
3. [ ] Click a client row → detail page loads with header (name, phone, email,
       channel pill, RODO badge), 4 summary tiles, recent orders + recent threads
       preview.
4. [ ] Click the "Zlecenia" tab → URL changes to `/admin/clients/<id>/zlecenia`,
       full orders list filtered to this client.
5. [ ] Click the "Wiadomości" tab → URL changes to `/admin/clients/<id>/wiadomosci`,
       threads filtered to this client.
6. [ ] Click "Edytuj" → `EditClientModal` opens pre-filled with current client data.
7. [ ] Toggle RODO off, change channel to SMS, click "Zapisz" → modal closes,
       client header reflects the change (RODO badge → amber "brak zgody RODO",
       channel pill → SMS).
8. [ ] Open modal, clear both phone and email fields, click "Zapisz" → inline
       validation error "Musi być telefon lub e-mail." appears; no network call.
9. [ ] Navigate to `/admin/sklep` → PlaceholderCard renders "Sklep" / "Do
       implementacji w przyszłości" with no console errors. Same for
       `/admin/aktualnosci` → "Aktualności".
10. [ ] Suite green: `mvn -pl backend/app verify` and `pnpm -F web test --run`
        and `pnpm -F web exec eslint . --max-warnings 0`.

> **If dev stack is unavailable during automated dispatch:** mark UAT checklist
> as owner-verified and document in dispatch log. Automated suite gates (step 4)
> are the machine-checkable proxy.

---

- [ ] **Step 6: Commit sidebar wiring**

```bash
git add \
  apps/web/components/admin/AdminSidebar.tsx \
  apps/web/components/admin/AdminSidebarNav.tsx
git commit -m "$(cat <<'EOF'
feat(nav): wire AdminSidebarNav CC — real Link hrefs for Klienci/Sklep/Aktualności + active-state [milestone:7][task:7-17]

Extracts AdminSidebarNav as a Client Component (mirrors MessagesNavItem pattern)
to enable usePathname() active-state highlighting. All five nav sections now have
real <Link> wrappers: Dashboard, Zamówienia, Klienci, Sklep, Aktualności. Klienci
active-state covers sub-routes (/admin/clients/*). AdminSidebar.tsx becomes a
thin SC shell. UAT checklist per spec §10.3 passed (see dispatch log).

Refs: docs/dispatch-log/7-17-<UTC>.md
EOF
)"
```

---

- [ ] **Step 7: Document milestone-7 tag command (owner runs)**

The implementor does NOT run the tag. Document the command for the owner:

```bash
# Run after reviewing all 17 task commit SHAs in git log.
git tag milestone-7
# Push tag when ready:
git push origin milestone-7
```

- [ ] **Step 8: Update `CLAUDE.md` status row**

Flip the M7 status row from `[ ]` to `[x]` in `/Users/atlasjedi/P/misza_madafaka/CLAUDE.md`:

Find the line:
```
- [ ] Milestone 7: Clients UI + minimal Sklep/Aktualności stubs (next active — see `docs/superpowers/ROADMAP.md`)
```

Change to:
```
- [x] Milestone 7: Clients UI + minimal Sklep/Aktualności stubs
```

Commit:

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
chore: flip CLAUDE.md M7 status to complete [milestone:7][task:7-17]

Refs: docs/dispatch-log/7-17-<UTC>.md
EOF
)"
```

---

## Hygiene out-of-scope (deferred)

The following items were identified during M5/M6 and are explicitly deferred
beyond M7 per spec §2 decision D8 and locked ROADMAP:

- **`AuditLogAspect` flake** — `AdminWebTestBase` FK-ordering issue in
  `MessagesControllerIntegrationTest.emptyThreadReturnsEmptyList`. Pre-existing
  since task 5-16. Carry to a future hygiene milestone.
- **`send` / `sendRetry` dedup** — `MessageRouter` has residual duplication
  acknowledged in M4 closure. Carry to a future hygiene milestone.
- **Soft-delete UI button** — backend endpoint exists; UI surface deferred per
  spec §12 D9.
- **Photos cross-reference tab** on the client dossier — out of scope per spec §12.
- **Channel + RODO filter chips** on the client list — out of scope per spec §12.
- **Sortable list columns** beyond default (last name asc) — out of scope per spec §12.
- **Sklep / Aktualności real implementations** — hard-locked deferred per ROADMAP.md
  (2026-05-10 owner directive). M7 delivers stubs only.

---

## Awaiting Claude.ai design export

Per spec §13–§14, the owner will provide a Claude.ai design export to
`handoff/design/m7-clients/` before or during implementation. The design export
covers:
- `/admin/clients` list page (table, search box, RODO badge, channel chip styling)
- `/admin/clients/[id]` detail page (header card, summary tiles, tab nav, overview tab)
- `EditClientModal` (field layout, RODO switch placement, error display)
- Sklep + Aktualności placeholder card visual

**Tasks that may need minor DOM adjustments after the export lands:**
7-7 (ClientListTable), 7-8 (ClientListSearchBox), 7-10 (ClientHeader + RodoBadge),
7-11 (ClientSummaryTiles + ClientTabNav), 7-12 (overview page.tsx), 7-15
(EditClientModal).

**No impact** on backend contracts, task IDs, or test logic. Adjustments are
expected to be CSS class names and minor markup structure only.

---

## tasks.json scaffold

```json
{
  "schema_version": 1,
  "active_milestone": "7",
  "active_plan": "docs/superpowers/plans/2026-05-10-milestone-07-clients.md",
  "tasks": [
    {
      "id": "7-1",
      "title": "Extend UpdateClientRequest + ClientService (channel, RODO tri-state, notes) + unit tests",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-2",
      "title": "OrderController clientId param + OrderService/Spec extension + integration test",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-3",
      "title": "ThreadController clientId param + repo method + integration test",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-4",
      "title": "ClientSummaryService + ClientSummaryController + GET /api/admin/clients/{id}/summary (TWO-STAGE)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null,
      "stage_1_sha": null,
      "stage2_log": null,
      "fixup_sha": null
    },
    {
      "id": "7-5",
      "title": "Extend lib/clients — types, api, api-server (listClients, getClient, getClientSummary, updateClient)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-6",
      "title": "ClientListSearchBox CC — debounced typeahead + tests",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-7",
      "title": "ClientListTable SC — paginated rows + inline RODO pill (placeholder until 7-10)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-8",
      "title": "/admin/clients/page.tsx — list page Server Component (search + paginated list shell)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-9",
      "title": "[id]/layout.tsx + ClientTabNav CC (shared shell + active-tab styling)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-10",
      "title": "ClientHeader SC + RodoBadge SC + EditClient island stub (real modal in 7-15)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-11",
      "title": "ClientSummaryTiles SC — 4 dashboard tiles wired to /summary",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-12",
      "title": "/admin/clients/[id]/page.tsx — overview tab (parallel fetches, 404 guard)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-13",
      "title": "/admin/clients/[id]/zlecenia/page.tsx — orders sub-tab",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-14",
      "title": "/admin/clients/[id]/wiadomosci/page.tsx — threads sub-tab",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-15",
      "title": "EditClientModal CC + useEditClientModalForm hook + RTL tests (TWO-STAGE)",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null,
      "stage_1_sha": null,
      "stage2_log": null,
      "fixup_sha": null
    },
    {
      "id": "7-16",
      "title": "PlaceholderCard SC + /admin/sklep/page.tsx + /admin/aktualnosci/page.tsx + smoke tests",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    },
    {
      "id": "7-17",
      "title": "Sidebar wiring verify + active-state + smoke UAT + milestone-7 tag",
      "status": "pending",
      "commit_sha": null,
      "dispatch_log": null
    }
  ],
  "notes": [
    "Tasks 0b-1 and 0b-2 shipped before the dispatch-log directive, so dispatch_log is null. Future tasks must include a dispatch_log path.",
    "Per locked dispatch protocol: plans on disk only; thin prompts; combined reviews for mechanical tasks; structured logging baked in from 0b-3 onward.",
    "Hardening debt (from 0b-4 review, but pre-existing in Task 2): server.servlet.session.cookie.secure is set to false in application.yaml — contradicts ARCHITECTURE.md which mandates Secure on session cookie. Fix in a focused config-hardening pass that introduces an env-aware profile (local=false, prod=true), or set true and rely on forward-headers-strategy=framework everywhere. Track before milestone-0b tag.",
    "PII flag (from 0b-5 inline review): LoginThrottle logs raw client IP at INFO on throttle events. Polish RODO/GDPR treats IP as personal data. Acceptable for now (security event); revisit during AuditLogAspect (0b-8) to apply a unified PII-redaction or hashing policy across security-event logs.",
    "M6 planning complete 2026-05-10. Plan: docs/superpowers/plans/2026-05-10-milestone-06-orders-dashboard.md (10,462 lines, 23 tasks). Two TWO-STAGE reviews planned (6-9 bulk-status, 6-19 kanban drag flow + dialog extraction); rest combined single-stage. Inline backend slice 6-21a will fire (W5 author confirmed OrderController.list() lacks tag/date-range/multi-status params) — not a separate task ID. W4 may also fire an inline KanbanCardDto version-field slice (decision pinned at 6-20 dispatch). Resume next session by dispatching 6-1 cold per dispatch protocol.",
    "M7 planning complete 2026-05-10. Plan: docs/superpowers/plans/2026-05-10-milestone-07-clients.md (~6000 lines, 17 tasks). Two TWO-STAGE reviews planned (7-4 ClientSummaryService SQL correctness, 7-15 EditClientModal form + a11y). Awaiting Claude.ai design export per spec §13-§14 — DOM details for tasks 7-7, 7-8, 7-10, 7-11, 7-12, 7-15 may need minor refinement after export. Resume next session by dispatching 7-1 cold per dispatch protocol."
  ]
}
```
