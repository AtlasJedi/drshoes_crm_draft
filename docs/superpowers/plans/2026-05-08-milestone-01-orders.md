# Milestone 1 — Order domain + drawer + audit timeline (PLAN)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task is dispatched as a thin prompt pointing here per the dispatch protocol in `CLAUDE.md`.

**Goal:** Ship the thin slice of the Order domain — Misza can onboard a Client, create an Order with items, drive it through 6 statuses in an admin drawer, and read a curated audit timeline.

**Architecture:** Backend-first vertical slice. Spring Boot 3.4 / Java 21 services do all business logic, validation, code generation, and audit curation server-side. Next.js 16 frontend stays thin — server components fetch, client components render and capture intent. Optimistic locking via `@Version`. Soft delete via `deleted_at`. Polish UI copy.

**Tech Stack:** Spring Boot 3.4, Java 21, JPA, Postgres 16 (gin tsvector for search), Flyway, Bucket4j (existing), Spring Security (existing 0B), Next.js 16, Radix Dialog, Tailwind, lib/log.ts named loggers (existing).

**Source-of-truth references (every task assumes these are open):**
- Design spec: `docs/superpowers/specs/2026-05-08-milestone-01-orders-design.md`
- 0B reference patterns: `backend/app/src/main/java/com/drshoes/app/auth/`
- Audit aspect: `backend/app/src/main/java/com/drshoes/app/audit/AuditLogAspect.java`
- Frontend lib: `apps/web/lib/{api.ts,log.ts,auth/}`

**Conventions (every commit):**
- Conventional Commits + `[milestone:1][task:1-N]` suffix.
- Body ends with `Refs: docs/dispatch-log/1-N-<UTC>.md`.
- Dispatch log per task at `docs/dispatch-log/1-N-<UTC>.md` from `_TEMPLATE.md`.
- Update `docs/dispatch-log/tasks.json` (set `active_milestone: "1"` and add tasks `1-1`..`1-20` first thing — see Task 1-0 below).

---

## ERRATA — V001 baseline reality (added 2026-05-08 after task 1-1)

**The plan was drafted assuming the schema would be built up incrementally per milestone. In fact `V001__init.sql` is a comprehensive baseline that already creates almost every table.** Tasks below that "create" already-existing tables MUST be recast as no-op marker migrations or as additive ALTERs. Authors of downstream tasks must read this section before generating SQL or entity classes.

**Already in V001 baseline (do NOT re-create):**
- `client` — full schema. Real columns: `id UUID`, `first_name VARCHAR(80) NOT NULL`, `last_name VARCHAR(80)` *(nullable)*, `email CITEXT`, `phone VARCHAR(40)`, `preferred_channel VARCHAR(16) NOT NULL DEFAULT 'EMAIL'` *(CHECK in {EMAIL,SMS,NONE})*, `notes TEXT`, `rodo_consent_at TIMESTAMPTZ`, `deleted_at`, `created_at`, `updated_at`. CHECK constraint `client_contact_present` requires `phone IS NOT NULL OR email IS NOT NULL`. gin trigram index on `first_name||last_name||coalesce(email,'')||coalesce(phone,'')`.
- `order_` — full schema with `code`, `status` (7-value CHECK incl. WSTEPNIE_PRZYJETE..ANULOWANE), `source`, timestamps, `assigned_craftsman_id`, `current_storage_location_id`, `tags JSONB`, `total_price_cents`, `currency`, `description`, `cancelled_reason`, `deleted_at`, `created_at`, `updated_at`. Indexes for status+pickup, client+created, craftsman+status, storage, gin search.
- `order_item` — `id, order_id, position, kind` (CHECK in {NAPRAWA,CUSTOM_BUTY,CUSTOM_KURTKA}), `description`, `craftsman_notes`, `price_cents`, timestamps.
- `order_code_counter` (table) + `next_order_code(p_year INT)` PL/pgSQL function. **Task 1-5's `OrderCodeSequence` service should wrap a SELECT of this function, not implement its own counter.**
- `user_`, `storage_location`, `message_template`, `trigger_`, `audit_log`, `idempotency_key`, plus messaging/scheduling tables.

**Still legitimately additive (V005 et al. retain real DDL):**
- `audit_log` exists but has NO `parent_entity_id` column. Task 1-8's V005 migration is real DDL that adds this single UUID column + its partial index.

**Per-task corrections:**
- **Task 1-1 (V003):** comment-only marker (already shipped; see commit `9dabeef`).
- **Task 1-4 (V004):** **NOT** a no-op marker. V001 already creates `order_` and `order_item`, but neither has the `version` column required by the plan's `@Version` optimistic-locking architecture (see plan body line 884 + line 1076). V004 must `ALTER TABLE order_ ADD COLUMN version INTEGER NOT NULL DEFAULT 0;` (do **not** add a version to `order_item` — plan reserves @Version for the aggregate root only). Entities are otherwise mapped to existing V001 columns. Treat the rest of the plan's V004 DDL (CREATE TABLE order_, etc.) as already-done and skip it.
- **Task 1-5 (OrderCodeSequence):** thin Spring service that runs `SELECT next_order_code(?)` against the existing PL/pgSQL function. No new DDL.
- **Task 1-8 (V005):** real ALTER TABLE — plan body wins: a SINGLE `parent_entity_id UUID` column + partial index on `(parent_entity_id, created_at) WHERE parent_entity_id IS NOT NULL`. (Earlier errata wording mentioned a `parent_entity_type` column — that was a miswrite. The aspect populates parent UUIDs only; entity type can be derived from `audit_log.path` if needed by the timeline curator in 1-10.)
- **Task 1-8 shipped TWO-ROW audit semantics (important for 1-10).** Every successful admin item-op produces TWO `audit_log` rows: (1) the HTTP controller row — `method` ∈ {GET,POST,PATCH,DELETE}, `path` = HTTP path, real `status` (200/201/204/...), `parent_entity_id` = null. (2) The `@Audited` service row — `method` = `"INTERNAL"`, `path` = synthetic `"OrderService#addItem"`-style string, `status` = `0` (sentinel for non-HTTP), `parent_entity_id` = the `#orderId` SpEL result. **The TimelineEventCurator (1-9) and AuditTimelineService (1-10) MUST handle both kinds**: typically filter `status != 0` for the public timeline view OR explicitly include service rows when grouping by `parent_entity_id`. Decide once in 1-10 and document; do not silently ignore one or the other.

**Test infrastructure correction:**
- Plan references `com.drshoes.app.test.PostgresIntegrationTestBase` in several tasks. **The actual base class is `com.drshoes.app.AbstractIntegrationTest`** (no `test` sub-package). All integration tests extend that. The base already carries `@SpringBootTest` + Testcontainers — do not redeclare those annotations.
- For controller integration tests use the shared `com.drshoes.app.AdminWebTestBase` (introduced in 1-3) — it provides MockMvc + `loginAsOwner()` / `loginAsEmployee()` post-processors and helpers like `createClientAndReturnId(...)`. State-changing requests must include `.with(csrf())`.

**Controller package convention (added 2026-05-08 after task 1-3-fixup):**
- All admin REST controllers MUST live at `com.drshoes.app.<domain>.api.<X>Controller`. The `AuditLogAspect` pointcut is `execution(public * com.drshoes.app..api..*Controller.*(..))` — anything outside `.api.` will silently lose audit-log coverage. This applies to upcoming tasks 1-7 (`OrderController`), 1-10 (`AuditTimelineController`), and 1-11 (`UsersController`). The plan body's file-tree ASCII diagram omits the `.api.` segment; treat that as a typo, not a directive.
- Controller exception handlers (`@RestControllerAdvice`) belong alongside their controller in the same `.api.` package.
- A regression test asserting at least one audit row written by a successful POST on the controller is the proof — see `ClientControllerIntegrationTest#postCreateWritesAuditRow`. Each new admin controller should include an equivalent.

**Entity exception reminder:** Java entities are an explicit exception to the < 120 LOC granular-code rule. JPA boilerplate naturally pushes them past 80 LOC; that's fine.

---

## File Structure

### Backend (NEW or MODIFIED)

```
backend/app/src/main/
├── java/com/drshoes/app/
│   ├── client/
│   │   ├── domain/
│   │   │   ├── Client.java                              # NEW entity
│   │   │   └── ClientRepository.java                    # NEW JpaRepository
│   │   ├── ClientService.java                           # NEW
│   │   ├── ClientController.java                        # NEW
│   │   └── dto/
│   │       ├── ClientDto.java                           # NEW
│   │       ├── CreateClientRequest.java                 # NEW
│   │       ├── UpdateClientRequest.java                 # NEW
│   │       └── ClientSearchResult.java                  # NEW
│   ├── order/
│   │   ├── domain/
│   │   │   ├── Order.java                               # NEW entity (table order_)
│   │   │   ├── OrderItem.java                           # NEW entity
│   │   │   ├── OrderStatus.java                         # NEW enum
│   │   │   ├── OrderItemKind.java                       # NEW enum
│   │   │   ├── OrderRepository.java                     # NEW
│   │   │   └── OrderItemRepository.java                 # NEW
│   │   ├── OrderCodeSequence.java                       # NEW
│   │   ├── OrderService.java                            # NEW
│   │   ├── OrderController.java                         # NEW
│   │   └── dto/
│   │       ├── OrderDto.java                            # NEW
│   │       ├── OrderListRow.java                        # NEW
│   │       ├── CreateOrderRequest.java                  # NEW
│   │       ├── UpdateOrderRequest.java                  # NEW
│   │       ├── ChangeStatusRequest.java                 # NEW
│   │       ├── ChangeStatusResponse.java                # NEW
│   │       ├── TriggerSuggestion.java                   # NEW (empty record stub)
│   │       ├── CreateOrderItemRequest.java              # NEW
│   │       ├── UpdateOrderItemRequest.java              # NEW
│   │       └── OrderItemDto.java                        # NEW
│   ├── audit/
│   │   ├── AuditLogAspect.java                          # MODIFIED — populate parent_entity_id
│   │   ├── domain/AuditLog.java                         # MODIFIED — add parentEntityId field
│   │   ├── AuditTimelineService.java                    # NEW
│   │   ├── AuditTimelineController.java                 # NEW
│   │   ├── TimelineEventCurator.java                    # NEW
│   │   └── dto/
│   │       ├── TimelineEvent.java                       # NEW
│   │       └── TimelineEventKind.java                   # NEW
│   └── auth/
│       ├── UsersController.java                         # NEW (small — list users for assignee dropdown)
│       └── dto/UserStubDto.java                         # NEW
└── resources/db/migration/
    ├── V003__clients.sql                                # NEW
    ├── V004__orders.sql                                 # NEW
    └── V005__audit_parent_entity.sql                    # NEW
```

### Frontend (NEW or MODIFIED)

```
apps/web/
├── lib/
│   ├── clients/
│   │   ├── types.ts                                     # NEW
│   │   └── api.ts                                       # NEW
│   ├── orders/
│   │   ├── types.ts                                     # NEW
│   │   ├── status.ts                                    # NEW (PL labels + colors)
│   │   └── api.ts                                       # NEW
│   └── timeline/
│       ├── types.ts                                     # NEW
│       └── api.ts                                       # NEW
├── components/
│   └── clients/
│       ├── ClientPicker.tsx                             # NEW
│       └── ClientCreateModal.tsx                        # NEW
└── app/(admin)/admin/orders/
    ├── page.tsx                                         # NEW (server component)
    ├── new/page.tsx                                     # NEW (create form)
    └── _components/
        ├── OrdersFilters.tsx                            # NEW
        ├── OrdersTable.tsx                              # NEW
        ├── OrderDrawer.tsx                              # NEW
        ├── OrderDrawerHeader.tsx                        # NEW
        ├── OrderDrawerCoreFields.tsx                    # NEW
        ├── OrderDrawerStatusChanger.tsx                 # NEW
        ├── OrderDrawerItems.tsx                         # NEW
        └── OrderDrawerTimeline.tsx                      # NEW
```

---

## Wave 0 — Bookkeeping

### Task 1-0: Activate milestone 1 in tasks.json + push origin

**Files:**
- Modify: `docs/dispatch-log/tasks.json`

- [ ] **Step 1: Update `tasks.json`**

Set `active_milestone: "1"`, `active_plan: "docs/superpowers/plans/2026-05-08-milestone-01-orders.md"`, and APPEND tasks 1-1..1-20 with `status: "pending"`. Do NOT remove the 0B section — it stays as the milestone history.

- [ ] **Step 2: Commit**

```bash
git add docs/dispatch-log/tasks.json
git commit -m "chore(dispatch): activate milestone 1 in tasks.json [milestone:1][task:1-0]

Refs: design spec docs/superpowers/specs/2026-05-08-milestone-01-orders-design.md"
```

(No dispatch log for this bookkeeping task — main session does it inline.)

---

## Wave 1 — Client domain (backend)

### Task 1-1: V003 clients migration + Client entity + repo

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V003__clients.sql`
- Create: `backend/app/src/main/java/com/drshoes/app/client/domain/Client.java`
- Create: `backend/app/src/main/java/com/drshoes/app/client/domain/ClientRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/client/domain/ClientRepositoryIntegrationTest.java`

- [ ] **Step 1: Write `V003__clients.sql`**

```sql
-- V003: clients table for milestone 1
CREATE TABLE client (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX client_phone_idx ON client(phone) WHERE deleted_at IS NULL;

CREATE INDEX client_search_idx ON client USING gin(
    to_tsvector('simple',
        coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
        coalesce(phone,'') || ' ' || coalesce(email,'')
    )
);
```

- [ ] **Step 2: Write `Client.java`** (mirror `User.java` style)

```java
package com.drshoes.app.client.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "client")
public class Client {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column
    private String phone;

    @Column
    private String email;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    // getters/setters for all fields — write them explicitly, no Lombok in this codebase
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String v) { this.firstName = v; }
    public String getLastName() { return lastName; }
    public void setLastName(String v) { this.lastName = v; }
    public String getPhone() { return phone; }
    public void setPhone(String v) { this.phone = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { this.email = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant v) { this.deletedAt = v; }
}
```

(File is just over 80 LOC due to getters — acceptable; Java entities are an explicit exception in the dispatch-protocol granular-code rule. Document the override in the dispatch log "Decisions" section.)

- [ ] **Step 3: Write `ClientRepository.java`**

```java
package com.drshoes.app.client.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    Page<Client> findAllByDeletedAtIsNull(Pageable pageable);

    @Query("""
        SELECT c FROM Client c
        WHERE c.deletedAt IS NULL
          AND (LOWER(c.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(c.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
            OR c.phone LIKE CONCAT('%', :q, '%')
            OR LOWER(c.email) LIKE LOWER(CONCAT('%', :q, '%')))
        ORDER BY c.lastName, c.firstName
        """)
    List<Client> searchTopN(String q, Pageable pageable);
}
```

(`searchTopN` uses LIKE for unit-test simplicity — the gin index from V003 is for production performance. Document in dispatch log.)

- [ ] **Step 4: Write `ClientRepositoryIntegrationTest.java`** mirroring `UserRepositoryIntegrationTest`. Test:
  - persist + findById
  - `findAllByDeletedAtIsNull` excludes a soft-deleted row
  - `searchTopN("kowal", ...)` finds "Kowalski" by last name

```java
package com.drshoes.app.client.domain;

import com.drshoes.app.test.PostgresIntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ClientRepositoryIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired ClientRepository repo;

    @Test
    void persistAndFindById() {
        Client c = new Client();
        c.setFirstName("Anna"); c.setLastName("Kowalska");
        c.setPhone("+48 600 100 200"); c.setEmail("anna@example.com");
        repo.save(c);
        assertThat(repo.findById(c.getId())).isPresent();
    }

    @Test
    void softDeletedExcludedFromActiveList() {
        Client active = newClient("Jan", "Nowak");
        Client gone   = newClient("Stara", "Klientka");
        gone.setDeletedAt(Instant.now());
        repo.saveAll(java.util.List.of(active, gone));
        var page = repo.findAllByDeletedAtIsNull(PageRequest.of(0, 10));
        assertThat(page.getContent()).extracting(Client::getId).contains(active.getId()).doesNotContain(gone.getId());
    }

    @Test
    void searchByLastNamePartial() {
        repo.save(newClient("Anna", "Kowalska"));
        repo.save(newClient("Adam", "Wiśniewski"));
        var hits = repo.searchTopN("kowal", PageRequest.of(0, 20));
        assertThat(hits).extracting(Client::getLastName).containsExactly("Kowalska");
    }

    private Client newClient(String f, String l) {
        Client c = new Client(); c.setFirstName(f); c.setLastName(l); return c;
    }
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=ClientRepositoryIntegrationTest
```

Expected: 3/3 pass. V003 logs `Migrating schema "public" to version "003 - clients"`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V003__clients.sql \
        backend/app/src/main/java/com/drshoes/app/client/domain/ \
        backend/app/src/test/java/com/drshoes/app/client/domain/
git commit -m "feat(client): V003 + Client entity + repository [milestone:1][task:1-1]

Refs: docs/dispatch-log/1-1-<UTC>.md"
```

---

### Task 1-2: ClientService (CRUD + search)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/client/ClientService.java`
- Create: `backend/app/src/test/java/com/drshoes/app/client/ClientServiceTest.java`

- [ ] **Step 1: Write `ClientServiceTest.java`** — unit test the service with a mocked repo. Cover: create returns persisted DTO, search delegates to repo with trimmed q, softDelete sets deletedAt.

```java
package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.CreateClientRequest;
import com.drshoes.app.client.dto.UpdateClientRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClientServiceTest {

    private final ClientRepository repo = mock(ClientRepository.class);
    private final ClientService svc = new ClientService(repo);

    @Test
    void createPersistsAndReturnsDto() {
        when(repo.save(any(Client.class))).thenAnswer(inv -> {
            Client c = inv.getArgument(0); c.setId(UUID.randomUUID()); return c;
        });
        var dto = svc.create(new CreateClientRequest("Jan", "Nowak", "+48", "j@n", "vip"));
        assertThat(dto.firstName()).isEqualTo("Jan");
        assertThat(dto.id()).isNotNull();
        verify(repo).save(any(Client.class));
    }

    @Test
    void searchTrimsQueryAndDelegates() {
        when(repo.searchTopN(eq("kowal"), any())).thenReturn(List.of(client("Anna", "Kowalska")));
        var results = svc.search("  kowal  ");
        assertThat(results).hasSize(1);
        assertThat(results.get(0).fullName()).isEqualTo("Anna Kowalska");
        verify(repo).searchTopN(eq("kowal"), any());
    }

    @Test
    void softDeleteSetsDeletedAtAndSaves() {
        Client c = client("Stara", "Klientka"); c.setId(UUID.randomUUID());
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        svc.softDelete(c.getId());
        assertThat(c.getDeletedAt()).isNotNull();
        verify(repo).save(c);
    }

    @Test
    void softDeleteUnknownIdThrows() {
        UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.softDelete(id))
            .isInstanceOf(ClientNotFoundException.class);
    }

    private Client client(String f, String l) {
        Client c = new Client(); c.setFirstName(f); c.setLastName(l); return c;
    }
}
```

- [ ] **Step 2: Run test → fails (no `ClientService` yet)**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=ClientServiceTest
```

Expected: compile failure (`ClientService`, `ClientNotFoundException`, DTOs don't exist).

- [ ] **Step 3: Write the DTOs first**

Create `dto/CreateClientRequest.java`:
```java
package com.drshoes.app.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateClientRequest(
    @NotBlank @Size(max = 80) String firstName,
    @NotBlank @Size(max = 80) String lastName,
    @Size(max = 32)  String phone,
    @Size(max = 120) String email,
    @Size(max = 2000) String notes
) {}
```

Create `dto/UpdateClientRequest.java`:
```java
package com.drshoes.app.client.dto;

import jakarta.validation.constraints.Size;

public record UpdateClientRequest(
    @Size(max = 80) String firstName,
    @Size(max = 80) String lastName,
    @Size(max = 32) String phone,
    @Size(max = 120) String email,
    @Size(max = 2000) String notes
) {}
```

Create `dto/ClientDto.java`:
```java
package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;
import java.time.Instant;
import java.util.UUID;

public record ClientDto(
    UUID id, String firstName, String lastName, String phone, String email, String notes,
    Instant createdAt, Instant updatedAt
) {
    public static ClientDto of(Client c) {
        return new ClientDto(c.getId(), c.getFirstName(), c.getLastName(),
            c.getPhone(), c.getEmail(), c.getNotes(),
            c.getCreatedAt(), c.getUpdatedAt());
    }
}
```

Create `dto/ClientSearchResult.java`:
```java
package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;
import java.util.UUID;

public record ClientSearchResult(UUID id, String fullName, String phone, String email) {
    public static ClientSearchResult of(Client c) {
        return new ClientSearchResult(c.getId(),
            (c.getFirstName() + " " + c.getLastName()).trim(),
            c.getPhone(), c.getEmail());
    }
}
```

- [ ] **Step 4: Write `ClientNotFoundException`**

```java
package com.drshoes.app.client;

import java.util.UUID;

public class ClientNotFoundException extends RuntimeException {
    public ClientNotFoundException(UUID id) { super("Client not found: " + id); }
}
```

- [ ] **Step 5: Write `ClientService.java`**

```java
package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ClientService {

    private static final Logger log = LoggerFactory.getLogger(ClientService.class);
    private static final int SEARCH_MAX = 20;

    private final ClientRepository repo;

    public ClientService(ClientRepository repo) { this.repo = repo; }

    @Transactional
    public ClientDto create(CreateClientRequest req) {
        Client c = new Client();
        c.setFirstName(req.firstName().trim());
        c.setLastName(req.lastName().trim());
        c.setPhone(req.phone());
        c.setEmail(req.email());
        c.setNotes(req.notes());
        Client saved = repo.save(c);
        log.info("op=createClient clientId={} outcome=ok", saved.getId());
        return ClientDto.of(saved);
    }

    @Transactional(readOnly = true)
    public Page<ClientDto> list(Pageable pageable) {
        return repo.findAllByDeletedAtIsNull(pageable).map(ClientDto::of);
    }

    @Transactional(readOnly = true)
    public ClientDto get(UUID id) {
        return repo.findById(id)
            .filter(c -> c.getDeletedAt() == null)
            .map(ClientDto::of)
            .orElseThrow(() -> new ClientNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public List<ClientSearchResult> search(String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.isEmpty()) return List.of();
        var results = repo.searchTopN(trimmed, PageRequest.of(0, SEARCH_MAX))
            .stream().map(ClientSearchResult::of).toList();
        log.info("op=searchClients q.length={} hits={} outcome=ok", trimmed.length(), results.size());
        return results;
    }

    @Transactional
    public ClientDto update(UUID id, UpdateClientRequest req) {
        Client c = repo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new ClientNotFoundException(id));
        if (req.firstName() != null) c.setFirstName(req.firstName().trim());
        if (req.lastName()  != null) c.setLastName(req.lastName().trim());
        if (req.phone() != null) c.setPhone(req.phone());
        if (req.email() != null) c.setEmail(req.email());
        if (req.notes() != null) c.setNotes(req.notes());
        log.info("op=updateClient clientId={} outcome=ok", id);
        return ClientDto.of(repo.save(c));
    }

    @Transactional
    public void softDelete(UUID id) {
        Client c = repo.findById(id).orElseThrow(() -> new ClientNotFoundException(id));
        if (c.getDeletedAt() != null) {
            log.info("op=softDeleteClient clientId={} outcome=already-deleted", id);
            return;
        }
        c.setDeletedAt(Instant.now());
        repo.save(c);
        log.info("op=softDeleteClient clientId={} outcome=ok", id);
    }
}
```

- [ ] **Step 6: Run tests → green**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=ClientServiceTest
```

Expected: 4/4 pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/client/ \
        backend/app/src/test/java/com/drshoes/app/client/
git commit -m "feat(client): ClientService CRUD + search [milestone:1][task:1-2]

Refs: docs/dispatch-log/1-2-<UTC>.md"
```

---

### Task 1-3: ClientController + DTOs + integration test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/client/ClientController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/client/ClientExceptionHandler.java`
- Create: `backend/app/src/test/java/com/drshoes/app/client/ClientControllerIntegrationTest.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/auth/RbacService.java` — add `canManageClients` returning `role == OWNER`

- [ ] **Step 1: Write `ClientControllerIntegrationTest.java`** — covers: list, search, create (201 + Location), get, patch, delete (OWNER only), unauthorized (no session → 401), employee can't delete (403).

```java
package com.drshoes.app.client;

import com.drshoes.app.test.AdminWebTestBase;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ClientControllerIntegrationTest extends AdminWebTestBase {

    @Test
    void createListAndGetAsOwner() throws Exception {
        loginAsOwner();
        String body = """
            {"firstName":"Anna","lastName":"Kowalska","phone":"+48 600 100 200","email":"a@k.pl"}""";
        mockMvc().perform(post("/api/admin/clients").contentType("application/json").content(body)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.firstName").value("Anna"));

        mockMvc().perform(get("/api/admin/clients?page=0&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].lastName").value("Kowalska"));

        mockMvc().perform(get("/api/admin/clients/search?q=kowal"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].fullName").value("Anna Kowalska"));
    }

    @Test
    void deleteRequiresOwner() throws Exception {
        loginAsEmployee();
        var id = createClientAndReturnId(); // helper in AdminWebTestBase or inline via repo
        mockMvc().perform(delete("/api/admin/clients/" + id).with(csrf()))
            .andExpect(status().isForbidden());

        loginAsOwner();
        mockMvc().perform(delete("/api/admin/clients/" + id).with(csrf()))
            .andExpect(status().isNoContent());
    }

    @Test
    void unauthenticatedRejected() throws Exception {
        mockMvc().perform(get("/api/admin/clients"))
            .andExpect(status().isUnauthorized());
    }
}
```

(If `AdminWebTestBase` and `loginAsOwner/loginAsEmployee` helpers don't exist yet, this task creates them — they'll be reused by every controller test from M1 forward. Add helpers minimally: bootstrap a User in DB, perform the login curl-equivalent via MockMvc, return the cookie. Inspect existing `AuthIntegrationTest` for the pattern and extract.)

- [ ] **Step 2: Run test → fails**

Expected: NoSuchBean / 404 because `ClientController` doesn't exist.

- [ ] **Step 3: Write `ClientController.java`**

```java
package com.drshoes.app.client;

import com.drshoes.app.client.dto.*;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/clients")
public class ClientController {

    private static final Logger log = LoggerFactory.getLogger(ClientController.class);
    private final ClientService svc;

    public ClientController(ClientService svc) { this.svc = svc; }

    @GetMapping
    public Page<ClientDto> list(Pageable pageable) { return svc.list(pageable); }

    @GetMapping("/search")
    public List<ClientSearchResult> search(@RequestParam("q") String q) { return svc.search(q); }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable UUID id) { return svc.get(id); }

    @PostMapping
    public ResponseEntity<ClientDto> create(@Valid @RequestBody CreateClientRequest req) {
        ClientDto created = svc.create(req);
        return ResponseEntity.created(URI.create("/api/admin/clients/" + created.id())).body(created);
    }

    @PatchMapping("/{id}")
    public ClientDto update(@PathVariable UUID id, @Valid @RequestBody UpdateClientRequest req) {
        return svc.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@rbacService.canManageClients(authentication)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        svc.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: Add `canManageClients` to `RbacService`**

In `RbacService.java`, add:
```java
public boolean canManageClients(Authentication authentication) {
    return hasRole(authentication, UserRole.OWNER);
}
```

(Match the existing `canDeleteOrders` style. Add a unit test in `RbacServiceTest` that asserts OWNER true / EMPLOYEE false.)

- [ ] **Step 5: Write `ClientExceptionHandler.java`**

```java
package com.drshoes.app.client;

import com.drshoes.app.web.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class ClientExceptionHandler {

    @ExceptionHandler(ClientNotFoundException.class)
    public ResponseEntity<ApiError> notFound(ClientNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ApiError("CLIENT_NOT_FOUND", e.getMessage(), null));
    }
}
```

(`ApiError` already exists in 0B. If not, inspect `AuthExceptionHandler` and mirror.)

- [ ] **Step 6: Run tests**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=ClientControllerIntegrationTest,RbacServiceTest
```

Expected: all green.

- [ ] **Step 7: Run full app verify to catch regressions**

```bash
mvn -B -pl app -am verify
```

Expected: all green; row count from M0/M1 grows to 30+.

- [ ] **Step 8: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/client/ \
        backend/app/src/main/java/com/drshoes/app/auth/RbacService.java \
        backend/app/src/test/java/com/drshoes/app/
git commit -m "feat(client): ClientController + RBAC + integration tests [milestone:1][task:1-3]

Refs: docs/dispatch-log/1-3-<UTC>.md"
```

---

## Wave 2 — Order domain (backend)

### Task 1-4: V004 orders migration + Order/OrderItem entities + repos + integration test

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V004__orders.sql`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/Order.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItem.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderStatus.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemKind.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderRepository.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/domain/OrderRepositoryIntegrationTest.java`

- [ ] **Step 1: Write `V004__orders.sql`** — full SQL from §2 of the design spec, ending with creating sequence `order_code_seq_2026`. Don't reproduce here; subagent reads spec.

- [ ] **Step 2: Write enums**

```java
// OrderStatus.java
package com.drshoes.app.order.domain;
public enum OrderStatus { PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU, WYDANE, ANULOWANE }

// OrderItemKind.java
package com.drshoes.app.order.domain;
public enum OrderItemKind { NAPRAWA, CUSTOM_BUTY, CUSTOM_KURTKA }
```

- [ ] **Step 3: Write `Order.java` and `OrderItem.java`**

`Order.java` follows the `User`/`Client` style. Fields: `id, code, clientId (UUID, not @ManyToOne — keep aggregate boundaries), status (Enumerated.STRING), description, receivedAt, plannedPickupAt, pickedUpAt, assignedCraftsmanId, totalPriceCents, currency, version (@Version), createdAt, updatedAt, deletedAt`. Plus a one-to-many `@OneToMany(mappedBy="orderId", cascade=ALL, orphanRemoval=true)` for items — actually JPA doesn't directly map UUID FKs that way; pragmatic choice: keep `items` as a transient field populated by service, OR use `@JoinColumn(name="order_id")` referencing a UUID column. Simplest pattern: do NOT model items as a JPA association; query them separately via `OrderItemRepository.findAllByOrderIdOrderByPosition(orderId)`. This keeps both entities simple and matches the backend-heavy "service composes the aggregate" principle.

`OrderItem.java`: `id, orderId, kind (enum), description, craftsmanNotes, priceCents, workMinutes, position, createdAt, updatedAt`.

- [ ] **Step 4: Write repos**

```java
// OrderRepository.java
package com.drshoes.app.order.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {
    Optional<Order> findByCode(String code);
    Page<Order> findAllByDeletedAtIsNull(Pageable pageable);
}

// OrderItemRepository.java
package com.drshoes.app.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    List<OrderItem> findAllByOrderIdOrderByPosition(UUID orderId);
    void deleteAllByOrderId(UUID orderId);
}
```

- [ ] **Step 5: Write `OrderRepositoryIntegrationTest.java`**

Cover:
1. Persist + findByCode.
2. Specification filtering: status=PRZYJETE returns only PRZYJETE.
3. Soft-deleted order excluded from `findAllByDeletedAtIsNull`.
4. `OrderItemRepository.findAllByOrderIdOrderByPosition` returns by position asc.

- [ ] **Step 6: Run tests**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=OrderRepositoryIntegrationTest
```

Expected: 4/4 pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V004__orders.sql \
        backend/app/src/main/java/com/drshoes/app/order/domain/ \
        backend/app/src/test/java/com/drshoes/app/order/domain/
git commit -m "feat(order): V004 + Order/OrderItem entities + repositories [milestone:1][task:1-4]

Refs: docs/dispatch-log/1-4-<UTC>.md"
```

---

### Task 1-5: OrderCodeSequence service + unit test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderCodeSequence.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/OrderCodeSequenceIntegrationTest.java`

- [ ] **Step 1: Write `OrderCodeSequenceIntegrationTest.java`**

```java
package com.drshoes.app.order;

import com.drshoes.app.test.PostgresIntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Year;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class OrderCodeSequenceIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired OrderCodeSequence seq;

    @Test
    void firstCodeIsZeroPaddedYearOne() {
        String code = seq.next();
        assertThat(code).matches("DR-" + Year.now().getValue() + "-\\d{4}");
    }

    @Test
    void monotonicWithinSameYear() {
        String a = seq.next();
        String b = seq.next();
        int aN = Integer.parseInt(a.substring(8));
        int bN = Integer.parseInt(b.substring(8));
        assertThat(bN).isEqualTo(aN + 1);
    }
}
```

- [ ] **Step 2: Run → fails (no `OrderCodeSequence`)**

- [ ] **Step 3: Write `OrderCodeSequence.java`**

```java
package com.drshoes.app.order;

import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;

@Service
public class OrderCodeSequence {

    private static final Logger log = LoggerFactory.getLogger(OrderCodeSequence.class);
    private final EntityManager em;

    public OrderCodeSequence(EntityManager em) { this.em = em; }

    @Transactional
    public String next() {
        int year = Year.now().getValue();
        String seqName = "order_code_seq_" + year;
        Number n = (Number) em.createNativeQuery("SELECT nextval(:sn)")
            .setParameter("sn", seqName).getSingleResult();
        String code = String.format("DR-%d-%04d", year, n.intValue());
        log.info("op=nextOrderCode year={} sequence={} code={}", year, n.intValue(), code);
        return code;
    }
}
```

(Sequence `order_code_seq_2026` exists from V004. For year rollover, a new migration `V00X__order_code_seq_YYYY.sql` is added — out of scope for M1 since we're in 2026.)

- [ ] **Step 4: Run tests → green**

```bash
mvn -B -pl app -am test -Dtest=OrderCodeSequenceIntegrationTest
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/order/OrderCodeSequence.java \
        backend/app/src/test/java/com/drshoes/app/order/OrderCodeSequenceIntegrationTest.java
git commit -m "feat(order): OrderCodeSequence (DR-YYYY-NNNN) [milestone:1][task:1-5]

Refs: docs/dispatch-log/1-5-<UTC>.md"
```

---

### Task 1-6: OrderService (CRUD + status change + soft-delete)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderNotFoundException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderVersionConflictException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderAlreadyDeletedException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/OrderDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/OrderListRow.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/CreateOrderRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/UpdateOrderRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/ChangeStatusResponse.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/dto/TriggerSuggestion.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/OrderServiceIntegrationTest.java`

This task is the biggest single backend unit. **Two-stage review** — dispatch protocol rule 4 applies because this is substantial logic with security-sensitive paths (RBAC, optimistic lock, audit emission).

- [ ] **Step 1: Write DTO records** (mostly mechanical — record types from §3 of the spec). `TriggerSuggestion` is an empty record `public record TriggerSuggestion() {}` for the M1 placeholder.

- [ ] **Step 2: Write `OrderServiceIntegrationTest.java`**

Use `@SpringBootTest` + Testcontainers. Cover at minimum:
- `createOrder(...)` persists order + items, assigns generated code, status defaults to PRZYJETE, totalPriceCents = sum of item prices.
- `getOrder(id)` includes items list ordered by position.
- `listOrders(...)` with `status=PRZYJETE` filter excludes orders in other statuses.
- `listOrders(...)` with `q=` filter matches code prefix (`DR-2026-`) and description substring.
- `updateOrder(...)` ignores soft-deleted orders (404).
- `changeStatus(id, target, expectedVersion)` happy path moves status and bumps version.
- `changeStatus(...)` with stale version throws `OrderVersionConflictException`.
- `softDelete(id)` sets deletedAt; subsequent list-all hides it; subsequent updateOrder throws `OrderAlreadyDeletedException`.
- `addItem(orderId, req)` inserts and recomputes totalPriceCents.
- `updateItem(orderId, itemId, req)` updates and recomputes totalPriceCents.
- `removeItem(orderId, itemId)` deletes and recomputes totalPriceCents.

That's ~10 tests. They're integration because the optimistic lock needs a real EntityManager.

- [ ] **Step 3: Run → red**

- [ ] **Step 4: Write the exception classes** (one-liners mirroring `ClientNotFoundException`).

- [ ] **Step 5: Write `OrderService.java`** — substantial; key methods sketched here, full body lives in subagent's implementation:

```java
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;
    private final OrderCodeSequence codeSeq;

    public OrderService(OrderRepository o, OrderItemRepository i, ClientRepository c, OrderCodeSequence s) {
        this.orderRepo = o; this.itemRepo = i; this.clientRepo = c; this.codeSeq = s;
    }

    @Transactional
    public OrderDto create(CreateOrderRequest req) {
        if (clientRepo.findById(req.clientId()).filter(x -> x.getDeletedAt() == null).isEmpty())
            throw new ClientNotFoundException(req.clientId());
        Order o = new Order();
        o.setCode(codeSeq.next());
        o.setClientId(req.clientId());
        o.setStatus(OrderStatus.PRZYJETE);
        o.setDescription(req.description());
        o.setReceivedAt(req.receivedAt() != null ? req.receivedAt() : Instant.now());
        o.setPlannedPickupAt(req.plannedPickupAt());
        o.setAssignedCraftsmanId(req.assignedCraftsmanId());
        o.setCurrency("PLN");
        o.setTotalPriceCents(0);
        Order saved = orderRepo.save(o);

        if (req.items() != null) {
            int pos = 0;
            for (var iReq : req.items()) {
                OrderItem item = new OrderItem();
                item.setOrderId(saved.getId());
                item.setKind(iReq.kind());
                item.setDescription(iReq.description());
                item.setCraftsmanNotes(iReq.craftsmanNotes());
                item.setPriceCents(iReq.priceCents());
                item.setWorkMinutes(iReq.workMinutes());
                item.setPosition(pos++);
                itemRepo.save(item);
            }
            recomputeTotal(saved.getId());
            saved = orderRepo.findById(saved.getId()).orElseThrow();
        }

        log.info("op=createOrder orderId={} code={} clientId={} itemCount={} outcome=ok",
            saved.getId(), saved.getCode(), saved.getClientId(),
            req.items() == null ? 0 : req.items().size());
        return toDto(saved);
    }

    @Transactional
    public ChangeStatusResponse changeStatus(UUID id, OrderStatus target, int expectedVersion) {
        Order o = orderRepo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new OrderNotFoundException(id));
        if (o.getVersion() != expectedVersion)
            throw new OrderVersionConflictException(id, o.getVersion());
        OrderStatus old = o.getStatus();
        o.setStatus(target);
        Order saved = orderRepo.save(o);
        log.info("op=changeOrderStatus orderId={} fromStatus={} toStatus={} outcome=ok",
            id, old, target);
        return new ChangeStatusResponse(toDto(saved), new TriggerSuggestion());
    }

    // updateOrder / softDelete / addItem / updateItem / removeItem / list / get / recomputeTotal — analogous patterns
}
```

Key requirements:
- Every public method has structured INFO logging (`op=...`, `orderId=...`, `outcome=ok|...`).
- Item add/edit/remove always calls `recomputeTotal(orderId)` which sums `priceCents` and persists `totalPriceCents`.
- `softDelete(id)` sets `deletedAt`; if already deleted, log and idempotent-return (no exception).
- `updateOrder` throws `OrderAlreadyDeletedException` if invoked on a deleted order (since UI shouldn't allow it).
- All read-only methods are `@Transactional(readOnly = true)`.
- `OrderService.list(filters, pageable)` builds a JPA `Specification` from filters: status (IN), kinds (EXISTS subquery on items), assigneeId, q (code prefix OR description LIKE). Default sort: `updatedAt DESC`.

The list spec subquery for "kinds":
```java
Specification<Order> hasKind = (root, q, cb) -> {
    if (kinds == null || kinds.isEmpty()) return cb.conjunction();
    Subquery<UUID> sq = q.subquery(UUID.class);
    Root<OrderItem> item = sq.from(OrderItem.class);
    sq.select(item.get("orderId")).where(
        cb.and(
            cb.equal(item.get("orderId"), root.get("id")),
            item.get("kind").in(kinds)
        )
    );
    return cb.exists(sq);
};
```

- [ ] **Step 6: Run tests → all green**

```bash
mvn -B -pl app -am test -Dtest=OrderServiceIntegrationTest
```

Expected: 10/10 pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/order/ \
        backend/app/src/test/java/com/drshoes/app/order/
git commit -m "feat(order): OrderService CRUD + status change + soft-delete + items [milestone:1][task:1-6]

- create/get/list/update/delete with optimistic lock
- changeStatus returns ChangeStatusResponse with placeholder TriggerSuggestion
- item add/edit/remove + automatic totalPriceCents recompute
- structured INFO logging on every operation

Refs: docs/dispatch-log/1-6-<UTC>.md"
```

---

### Task 1-7: OrderController + ExceptionHandler + integration test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/OrderExceptionHandler.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/auth/RbacService.java` — `canDeleteOrders` already exists from 0B; verify it's `OWNER only`.

- [ ] **Step 1: Write `OrderControllerIntegrationTest.java`** — through MockMvc with `loginAsOwner/Employee` helpers. Cover:
  - POST creates order → 201 + Location header.
  - GET list returns paged result with filter params.
  - PATCH update returns updated DTO.
  - POST /status with stale version → 409 + body `{"code":"ORDER_VERSION_CONFLICT","currentVersion":N}`.
  - DELETE as EMPLOYEE → 403.
  - DELETE as OWNER → 204; subsequent GET → 404.
  - POST /items + PATCH /items/{itemId} + DELETE /items/{itemId}.
  - All RBAC enforcement (no session → 401).

- [ ] **Step 2: Run → red**

- [ ] **Step 3: Write `OrderController.java`** — straightforward delegation to `OrderService`. Use `@PreAuthorize("@rbacService.canDeleteOrders(authentication)")` on DELETE. Use `Pageable` for list, parse status/kinds as `List<OrderStatus>` / `List<OrderItemKind>` from comma-or-repeated query params.

```java
@GetMapping
public Page<OrderListRow> list(
        @RequestParam(required = false) List<OrderStatus> status,
        @RequestParam(required = false, name = "type") List<OrderItemKind> kinds,
        @RequestParam(required = false) UUID craftsmanId,
        @RequestParam(required = false) String q,
        Pageable pageable) {
    return svc.list(status, kinds, craftsmanId, q, pageable);
}
```

- [ ] **Step 4: Write `OrderExceptionHandler.java`** with mappings for 404 (NotFound, ClientNotFound), 409 (VersionConflict — body includes `currentVersion`), 410 / 409 (AlreadyDeleted).

- [ ] **Step 5: Run tests → green**

```bash
mvn -B -pl app -am test -Dtest=OrderControllerIntegrationTest
```

- [ ] **Step 6: Run full verify**

```bash
mvn -B -pl app -am verify
```

Expected: cumulative test count ~50+, all green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/order/ \
        backend/app/src/test/java/com/drshoes/app/order/
git commit -m "feat(order): OrderController + RBAC + integration tests [milestone:1][task:1-7]

Refs: docs/dispatch-log/1-7-<UTC>.md"
```

---

## Wave 3 — Audit timeline (backend)

### Task 1-8: V005 audit_parent_entity column + AuditLogAspect parent-id population

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V005__audit_parent_entity.sql`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/domain/AuditLog.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/AuditLogAspect.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/Audited.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/audit/AuditLogAspectIntegrationTest.java` — add a test for parent_entity_id population.

- [ ] **Step 1: Write `V005__audit_parent_entity.sql`**

```sql
ALTER TABLE audit_log ADD COLUMN parent_entity_id UUID;
CREATE INDEX audit_log_parent_idx ON audit_log(parent_entity_id, created_at)
    WHERE parent_entity_id IS NOT NULL;
```

- [ ] **Step 2: Add `parentEntityId` field + getter/setter to `AuditLog`**

- [ ] **Step 3: Create `Audited` annotation**

```java
package com.drshoes.app.audit;

import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Audited {
    /** SpEL expression evaluated against method args/return; result populates parent_entity_id. */
    String parent() default "";
}
```

- [ ] **Step 4: Modify `AuditLogAspect`** — when wrapping a method annotated `@Audited(parent = "#orderId")`, evaluate the SpEL against the JoinPoint args + return value (after method completes), set the resulting UUID on the AuditLog row before persisting. If `parent` is empty (existing behavior), do nothing.

Key implementation detail: use Spring's `SpelExpressionParser` + `MethodBasedEvaluationContext`. Annotate `OrderService.addItem`, `updateItem`, `removeItem` with `@Audited(parent = "#orderId")` (passes through to audit_log.parent_entity_id = the order's id).

- [ ] **Step 5: Add test in `AuditLogAspectIntegrationTest`** — call an `OrderItem` operation, assert that `audit_log` row has `parent_entity_id == orderId`.

- [ ] **Step 6: Run tests**

```bash
mvn -B -pl app -am test -Dtest=AuditLogAspectIntegrationTest
```

Expected: existing tests + new parent test all pass. V005 applies in startup logs.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V005__audit_parent_entity.sql \
        backend/app/src/main/java/com/drshoes/app/audit/ \
        backend/app/src/test/java/com/drshoes/app/audit/
git commit -m "feat(audit): parent_entity_id + @Audited annotation for child entities [milestone:1][task:1-8]

Refs: docs/dispatch-log/1-8-<UTC>.md"
```

---

### Task 1-9: TimelineEventCurator (pure function) + unit tests

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEvent.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEventKind.java`
- Create: `backend/app/src/test/java/com/drshoes/app/audit/TimelineEventCuratorTest.java`

- [ ] **Step 1: Write `TimelineEventKind.java`**

```java
public enum TimelineEventKind {
    ORDER_CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, PICKUP_DATE_CHANGED,
    ITEM_ADDED, ITEM_EDITED, ITEM_REMOVED, ORDER_SOFT_DELETED
}
```

- [ ] **Step 2: Write `TimelineEvent.java`**

```java
public record TimelineEvent(
    UUID id,
    TimelineEventKind kind,
    Instant occurredAt,
    String actorFullName,
    Map<String, String> labels
) {}
```

- [ ] **Step 3: Write `TimelineEventCuratorTest.java`** — 8 tests, one per `TimelineEventKind`, plus 2 "skip" cases (description-only PATCH → null, version-only bump → null). Each test feeds an `AuditLog` row to `curate(log, actorFullName)` and asserts the produced event kind + label values.

- [ ] **Step 4: Run → red**

- [ ] **Step 5: Write `TimelineEventCurator.java`** — pure function, inspects audit_log fields (entity_type, operation, fields_changed JSON, before/after JSON) and dispatches to the right `TimelineEventKind`. Polish strings live in a `Map<TimelineEventKind, String>` template.

```java
@Component
public class TimelineEventCurator {

    public Optional<TimelineEvent> curate(AuditLog log, String actorFullName) {
        // ORDER entity
        if ("Order".equals(log.getEntityType())) {
            if ("CREATE".equals(log.getOperation())) return Optional.of(orderCreated(log, actorFullName));
            if ("UPDATE".equals(log.getOperation())) {
                Map<String, ChangeDelta> delta = parseDelta(log);
                if (delta.containsKey("status")) return Optional.of(statusChanged(log, actorFullName, delta));
                if (delta.containsKey("assignedCraftsmanId")) return Optional.of(assigneeChanged(log, actorFullName, delta));
                if (delta.containsKey("plannedPickupAt"))     return Optional.of(pickupChanged(log, actorFullName, delta));
                if (delta.containsKey("deletedAt") && delta.get("deletedAt").after() != null)
                    return Optional.of(softDeleted(log, actorFullName));
            }
        }
        // ORDER_ITEM entity
        if ("OrderItem".equals(log.getEntityType())) {
            if ("CREATE".equals(log.getOperation())) return Optional.of(itemAdded(log, actorFullName));
            if ("UPDATE".equals(log.getOperation())) return Optional.of(itemEdited(log, actorFullName));
            if ("DELETE".equals(log.getOperation())) return Optional.of(itemRemoved(log, actorFullName));
        }
        return Optional.empty();
    }

    // private helper methods build TimelineEvent with labels map populated from delta + entity snapshot
    // Polish label strings: see design spec §5
}
```

- [ ] **Step 6: Run tests → green**

```bash
mvn -B -pl app -am test -Dtest=TimelineEventCuratorTest
```

Expected: 10/10 pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java \
        backend/app/src/main/java/com/drshoes/app/audit/dto/ \
        backend/app/src/test/java/com/drshoes/app/audit/TimelineEventCuratorTest.java
git commit -m "feat(audit): TimelineEventCurator (server-side audit_log → curated events) [milestone:1][task:1-9]

Refs: docs/dispatch-log/1-9-<UTC>.md"
```

---

### Task 1-10: AuditTimelineService + AuditTimelineController + integration test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/audit/AuditTimelineService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/AuditTimelineController.java`
- Create: `backend/app/src/test/java/com/drshoes/app/audit/AuditTimelineServiceIntegrationTest.java`

- [ ] **Step 1: Write `AuditTimelineServiceIntegrationTest.java`** — `@SpringBootTest` + Testcontainers. Seed an order, change its status twice, add an item, edit it, remove it. Assert `timelineForOrder(orderId)` returns events in chronological order with the right kinds: `[ORDER_CREATED, STATUS_CHANGED, STATUS_CHANGED, ITEM_ADDED, ITEM_EDITED, ITEM_REMOVED]`.

- [ ] **Step 2: Run → red**

- [ ] **Step 3: Write `AuditTimelineService.java`**

```java
@Service
public class AuditTimelineService {

    private static final Logger log = LoggerFactory.getLogger(AuditTimelineService.class);
    private final AuditLogRepository repo;
    private final UserRepository userRepo;
    private final TimelineEventCurator curator;

    public AuditTimelineService(AuditLogRepository r, UserRepository u, TimelineEventCurator c) {
        this.repo = r; this.userRepo = u; this.curator = c;
    }

    @Transactional(readOnly = true)
    public List<TimelineEvent> timelineForOrder(UUID orderId) {
        var rows = repo.findOrderTimelineRows(orderId);
        Map<UUID, String> nameById = nameLookup(rows);
        var events = rows.stream()
            .map(row -> curator.curate(row, nameById.getOrDefault(row.getActorId(), "—")))
            .flatMap(Optional::stream)
            .sorted(Comparator.comparing(TimelineEvent::occurredAt))
            .toList();
        log.info("op=timelineForOrder orderId={} rowsRaw={} rowsCurated={} outcome=ok",
            orderId, rows.size(), events.size());
        return events;
    }

    private Map<UUID, String> nameLookup(List<AuditLog> rows) { /* batch find users by id */ }
}
```

`AuditLogRepository.findOrderTimelineRows(orderId)` (add method): returns rows where `(entity_type='Order' AND entity_id=:orderId) OR (entity_type='OrderItem' AND parent_entity_id=:orderId)`.

- [ ] **Step 4: Write `AuditTimelineController.java`**

```java
@RestController
@RequestMapping("/api/admin/orders/{orderId}/timeline")
public class AuditTimelineController {

    private final AuditTimelineService svc;
    public AuditTimelineController(AuditTimelineService svc) { this.svc = svc; }

    @GetMapping
    public List<TimelineEvent> timeline(@PathVariable UUID orderId) {
        return svc.timelineForOrder(orderId);
    }
}
```

- [ ] **Step 5: Run tests → green**

```bash
mvn -B -pl app -am test -Dtest=AuditTimelineServiceIntegrationTest
```

- [ ] **Step 6: Run full verify**

```bash
mvn -B -pl app -am verify
```

Expected: ~60+ tests, all green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/audit/AuditTimelineService.java \
        backend/app/src/main/java/com/drshoes/app/audit/AuditTimelineController.java \
        backend/app/src/test/java/com/drshoes/app/audit/AuditTimelineServiceIntegrationTest.java
git commit -m "feat(audit): AuditTimelineService + Controller [milestone:1][task:1-10]

Refs: docs/dispatch-log/1-10-<UTC>.md"
```

---

### Task 1-11: UsersController for assignee dropdown

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/UsersController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/dto/UserStubDto.java`
- Create: `backend/app/src/test/java/com/drshoes/app/auth/UsersControllerIntegrationTest.java`

Small endpoint. `GET /api/admin/users` returns `List<UserStubDto>` of all active (non-deleted) users for the assignee dropdown. RBAC: any authenticated user.

`UserStubDto`:
```java
public record UserStubDto(UUID id, String fullName, UserRole role) {
    public static UserStubDto of(User u) { return new UserStubDto(u.getId(), u.getFullName(), u.getRole()); }
}
```

Test covers: 200 returns the seeded users (Misza + Pomocnik), 401 unauthenticated.

Commit:
```bash
git commit -m "feat(auth): UsersController for assignee dropdown [milestone:1][task:1-11]

Refs: docs/dispatch-log/1-11-<UTC>.md"
```

---

## Wave 4 — Frontend

### Task 1-12: lib/clients + lib/orders + lib/timeline modules

**Files:**
- Create: `apps/web/lib/clients/types.ts`, `apps/web/lib/clients/api.ts`
- Create: `apps/web/lib/orders/types.ts`, `apps/web/lib/orders/status.ts`, `apps/web/lib/orders/api.ts`
- Create: `apps/web/lib/timeline/types.ts`, `apps/web/lib/timeline/api.ts`

- [ ] **Step 1: `lib/clients/types.ts`**

```ts
export interface ClientDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ClientSearchResult { id: string; fullName: string; phone: string | null; email: string | null; }
export interface CreateClientRequest { firstName: string; lastName: string; phone?: string; email?: string; notes?: string; }
export interface UpdateClientRequest { firstName?: string; lastName?: string; phone?: string; email?: string; notes?: string; }
```

- [ ] **Step 2: `lib/clients/api.ts`**

```ts
import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type { ClientDto, ClientSearchResult, CreateClientRequest, UpdateClientRequest } from "./types";

const log = createLogger("clients-api");

export async function searchClients(q: string): Promise<ClientSearchResult[]> {
  if (!q.trim()) return [];
  const results = await api.get<ClientSearchResult[]>(`/admin/clients/search?q=${encodeURIComponent(q)}`);
  log.info("op=searchClients", { qLen: q.length, hits: results.length });
  return results;
}
export const createClient = (req: CreateClientRequest) => api.post<ClientDto>("/admin/clients", req);
export const updateClient = (id: string, req: UpdateClientRequest) => api.patch<ClientDto>(`/admin/clients/${id}`, req);
export const deleteClient = (id: string) => api.delete<void>(`/admin/clients/${id}`);
```

- [ ] **Step 3: `lib/orders/status.ts`** (Polish labels + Tailwind class lookup for status pills)

```ts
import type { OrderStatus } from "./types";

export const STATUS_LABELS_PL: Record<OrderStatus, string> = {
  PRZYJETE: "Przyjęte",
  W_REALIZACJI: "W realizacji",
  CZEKA_NA_KLIENTA: "Czeka na klienta",
  GOTOWE_DO_ODBIORU: "Gotowe do odbioru",
  WYDANE: "Wydane",
  ANULOWANE: "Anulowane",
};

export const STATUS_PILL_CLASS: Record<OrderStatus, string> = {
  PRZYJETE: "bg-gray-200 text-ink",
  W_REALIZACJI: "bg-acid text-ink",
  CZEKA_NA_KLIENTA: "bg-orange/30 text-ink",
  GOTOWE_DO_ODBIORU: "bg-emerald-300 text-ink",
  WYDANE: "bg-ink text-paper",
  ANULOWANE: "bg-pink/40 text-ink line-through",
};

export const STATUS_ORDER: OrderStatus[] = [
  "PRZYJETE", "W_REALIZACJI", "CZEKA_NA_KLIENTA", "GOTOWE_DO_ODBIORU", "WYDANE", "ANULOWANE"
];

export const KIND_LABELS_PL = { NAPRAWA: "Naprawa", CUSTOM_BUTY: "Custom buty", CUSTOM_KURTKA: "Custom kurtka" } as const;
```

- [ ] **Step 4: `lib/orders/types.ts` and `lib/orders/api.ts`** — analogous to clients. Includes `listOrders(filters, page, size)`, `getOrder(id)`, `createOrder`, `updateOrder`, `softDeleteOrder`, `changeStatus(id, target, expectedVersion)`, item add/edit/remove.

- [ ] **Step 5: `lib/timeline/types.ts` and `lib/timeline/api.ts`** — types mirror backend `TimelineEvent` + `TimelineEventKind`. `getOrderTimeline(orderId)`.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @drshoes/web typecheck
```

Expected: 0 errors. Skip lint (Next 16 known broken).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/clients apps/web/lib/orders apps/web/lib/timeline
git commit -m "feat(web): lib/clients + lib/orders + lib/timeline API modules [milestone:1][task:1-12]

Refs: docs/dispatch-log/1-12-<UTC>.md"
```

---

### Task 1-13: ClientPicker + ClientCreateModal

**Files:**
- Create: `apps/web/components/clients/ClientPicker.tsx`
- Create: `apps/web/components/clients/ClientCreateModal.tsx`

`ClientPicker.tsx` — debounced (250ms) combobox over `searchClients`. Props: `value: ClientDto | null`, `onChange: (c: ClientDto) => void`. Renders selected client as a chip (Imię Nazwisko · phone), clicking opens dropdown of search results. "+ Dodaj nowego klienta" option opens `ClientCreateModal`.

`ClientCreateModal.tsx` — Radix Dialog with form (firstName, lastName, phone, email). On submit calls `createClient` then `onCreate(client)` callback closes the modal and selects the new client.

Each component < 80 LOC. If picker exceeds, extract `ClientPickerResults.tsx` for the result list.

Verify with `pnpm --filter @drshoes/web typecheck && pnpm --filter @drshoes/web build`. Build must succeed; the components aren't used yet by any page so no route changes expected.

Commit:
```bash
git commit -m "feat(web): ClientPicker + ClientCreateModal components [milestone:1][task:1-13]

Refs: docs/dispatch-log/1-13-<UTC>.md"
```

---

### Task 1-14: Orders list page + filters + table

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/page.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx`

`page.tsx` — server component. Reads `searchParams` (status[], type[], craftsmanId, q, page). Fetches via `listOrders` server-side using a server-only API helper that forwards the cookie (mirroring `getMe` pattern). Renders header ("Zlecenia", "+ Nowe zlecenie" link to `/admin/orders/new`), `<OrdersFilters initial={params}/>` (client), `<OrdersTable rows={pageData.content}/>` (client). Empty state in Polish.

`OrdersFilters.tsx` — client component. Multi-checkbox for status (6 statuses), type (3 kinds), assignee dropdown (uses `useEffect` + `getUsers()`), debounced text input for q. Each change triggers `router.replace(...)` with new URL params (page resets to 0).

`OrdersTable.tsx` — client component. Plain `<table>` with columns: code, status (pill), client, items summary, planned pickup, assignee, total. Row click → `router.push("?orderId=" + row.id)`.

Verify:
```bash
pnpm --filter @drshoes/web typecheck && pnpm --filter @drshoes/web build
```

Expected: build succeeds with `/admin/orders` listed in route output.

Commit:
```bash
git commit -m "feat(web): /admin/orders list page + filters + table [milestone:1][task:1-14]

Refs: docs/dispatch-log/1-14-<UTC>.md"
```

---

### Task 1-15: Create-new-order page

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/new/page.tsx`

Server component renders client form. Form fields: `<ClientPicker>` (required), description (textarea), planned_pickup_at (date input), assignedCraftsmanId (dropdown of users), repeating items section (each item: kind dropdown, description, priceCents). On submit POSTs to `createOrder`, then `router.push("/admin/orders?orderId=" + newOrder.id)`.

Submit-time validation: clientId required. Other fields optional. Items can be empty (added later in drawer).

Verify build. Commit:
```bash
git commit -m "feat(web): /admin/orders/new create form [milestone:1][task:1-15]

Refs: docs/dispatch-log/1-15-<UTC>.md"
```

---

### Task 1-16: OrderDrawer scaffold (header + core fields + URL state)

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx` — read `orderId` from searchParams, fetch detail server-side if present, pass to `<OrderDrawer initialOrder={...}/>`.
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerCoreFields.tsx`

`OrderDrawer.tsx` — client component, Radix Dialog with `Side="right"` styling (use Radix Dialog's modal + custom Tailwind: `data-[state=open]:animate-in slide-in-from-right`). Closes on `onOpenChange(false)` → router.replace removes `orderId` param. Content: `<OrderDrawerHeader>`, tabbed/stacked sections for core fields, status, items, timeline. M1 stacks them; tabs are M2.

Header: code (`DR-2026-0001`), status pill, close (×).

Core fields: read-only client (after creation), editable description, planned_pickup_at, assignedCraftsmanId. PATCH on field blur. Show subtle "Zapisano" toast on success, "Konflikt — odśwież" on 409.

Verify build. Commit:
```bash
git commit -m "feat(web): OrderDrawer scaffold + URL state + core fields [milestone:1][task:1-16]

Refs: docs/dispatch-log/1-16-<UTC>.md"
```

---

### Task 1-17: OrderDrawerStatusChanger + trigger preview placeholder

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx`

Renders 6 buttons (statuses) with current highlighted. Click target → confirm dialog showing:
> "Zmienić status z **{currentLabel}** na **{targetLabel}**?"
> "Co się stanie:" preview block:
>   "_Triggery dochodzą w M2 — żadne powiadomienia nie wyślą się teraz._"

On confirm, POST `/admin/orders/{id}/status` with `expectedVersion`. On 409 → "Konflikt — odśwież". On success update local order state.

Component < 80 LOC; if confirm dialog body grows, extract `StatusChangeConfirm.tsx`.

Commit:
```bash
git commit -m "feat(web): OrderDrawerStatusChanger + trigger placeholder [milestone:1][task:1-17]

Refs: docs/dispatch-log/1-17-<UTC>.md"
```

---

### Task 1-18: OrderDrawerItems (add / edit / remove)

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerItems.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/ItemEditRow.tsx` (if needed for granularity)

Renders item list. Each row: kind label (pill), description, price. "+ Dodaj pozycję" button opens an inline blank `ItemEditRow`. On save, POST `/admin/orders/{id}/items`, refetch order detail (so `totalPriceCents` updates). Edit and remove similarly.

Commit:
```bash
git commit -m "feat(web): OrderDrawerItems CRUD [milestone:1][task:1-18]

Refs: docs/dispatch-log/1-18-<UTC>.md"
```

---

### Task 1-19: OrderDrawerTimeline (right rail)

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`

Client component. On mount + after each mutation in the drawer, fetches `getOrderTimeline(orderId)`. Renders vertical list: timestamp (formatted PL), actor name, kind icon (mini emoji or Lucide icon mapped per kind), composed Polish text from `event.labels` (label assembly happens server-side; client just renders).

Empty state: "Brak zdarzeń." Reload-on-error: shows "Nie udało się załadować historii. Spróbuj ponownie." with a retry button.

Commit:
```bash
git commit -m "feat(web): OrderDrawerTimeline (audit timeline right rail) [milestone:1][task:1-19]

Refs: docs/dispatch-log/1-19-<UTC>.md"
```

---

## Wave 5 — Closure

### Task 1-20: E2E compose smoke + milestone-1 tag + CLAUDE.md status flip

**Files:**
- Modify: `CLAUDE.md` — flip status checklist
- Local annotated tag `milestone-1` (do not push automatically)

- [ ] **Step 1: Boot stack**

```bash
docker compose down -v
docker compose up -d --build
```

Wait for backend health.

- [ ] **Step 2: Smoke flow**

Login as Misza (per 0b-13 pattern). Then:

```bash
# Create a client
curl -sS -b /tmp/dr-cookies.txt -X POST http://localhost:${BACKEND_PORT:-8081}/api/admin/clients \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Anna","lastName":"Kowalska","phone":"+48 600 100 200","email":"a@k.pl"}'
# → 201 + ClientDto

# Create an order
curl -sS -b /tmp/dr-cookies.txt -X POST http://localhost:${BACKEND_PORT:-8081}/api/admin/orders \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"<id>","description":"czarne sneakery","items":[{"kind":"NAPRAWA","description":"podzelowanie","priceCents":12000}]}'
# → 201 + OrderDto with code DR-2026-0001

# Change status
curl -sS -b /tmp/dr-cookies.txt -X POST http://localhost:${BACKEND_PORT:-8081}/api/admin/orders/<orderId>/status \
  -H 'Content-Type: application/json' \
  -d '{"targetStatus":"W_REALIZACJI","expectedVersion":0}'
# → 200 + ChangeStatusResponse

# Read timeline
curl -sS -b /tmp/dr-cookies.txt http://localhost:${BACKEND_PORT:-8081}/api/admin/orders/<orderId>/timeline
# → [{"kind":"ORDER_CREATED",...},{"kind":"STATUS_CHANGED",...}]

# Verify list view
curl -sS -L -o /dev/null -w '%{http_code}\n' -b /tmp/dr-cookies.txt http://localhost:${WEB_PORT:-3000}/admin/orders
# → 200
```

- [ ] **Step 3: Tear down**

```bash
docker compose down
```

- [ ] **Step 4: Tag milestone**

```bash
git tag -a milestone-1 -m "Order domain + drawer + audit timeline complete

- Client domain (entity, repo, service, controller, RBAC) — basic CRUD + tsvector search.
- Order domain (entity, items, optimistic lock, soft delete, code DR-YYYY-NNNN) — full CRUD + status change + items.
- Audit timeline: server-side curation of audit_log → TimelineEvent[] with Polish labels.
- /admin/orders list + filters (status/type/assignee/q) + paginated table.
- /admin/orders/new create form with ClientPicker.
- OrderDrawer with header, core fields, status changer (free transitions + trigger placeholder), items CRUD, timeline.
- 60+ tests, all green.

Known deferred to M2: photos, messages, calendar/kanban, status triggers, tag filters, saved presets, change-client on existing order, restore-deleted-order UI."
```

- [ ] **Step 5: Update `CLAUDE.md`**

Change `- [ ] Milestone 1: Order domain + drawer + audit timeline` → `- [x] Milestone 1: Order domain + drawer + audit timeline`. Add ` - [ ] Milestone 2: Photos + messages + calendar/kanban + triggers` (or whatever's next per roadmap).

- [ ] **Step 6: Commit doc + bookkeeping**

```bash
git add CLAUDE.md
git commit -m "docs: mark Milestone 1 complete [milestone:1][task:1-20]

Refs: docs/dispatch-log/1-20-<UTC>.md"
```

Plus the bookkeeping commit recording the dispatch log + tasks.json updates.

---

## Self-Review

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| §1 Architecture (Client/Order/Audit dirs) | 1-1, 1-2, 1-3, 1-4, 1-5, 1-6, 1-7, 1-8, 1-9, 1-10, 1-11 |
| §2 Data model (V003, V004, V005) | 1-1, 1-4, 1-8 |
| §3 API surface (clients) | 1-3 |
| §3 API surface (orders + status + items) | 1-7 |
| §3 API surface (timeline) | 1-10 |
| §3 API surface (users for assignee) | 1-11 |
| §4 lib/{clients,orders,timeline} | 1-12 |
| §4 ClientPicker | 1-13 |
| §4 Orders list + filters + table | 1-14 |
| §4 Create-new-order | 1-15 |
| §4 OrderDrawer scaffold + core fields | 1-16 |
| §4 OrderDrawerStatusChanger + trigger placeholder | 1-17 |
| §4 OrderDrawerItems | 1-18 |
| §4 OrderDrawerTimeline | 1-19 |
| §5 TimelineEventCurator + Polish labels | 1-9 |
| §6 Test strategy (unit + integration per task) | every task |
| §7 Out of scope (deferred items captured in milestone-1 tag) | 1-20 |
| §8 Task list outline | this entire plan |

**Placeholder scan:** No `TBD` / `TODO` / "implement later" markers. Sequence year rollover migration (V00X__order_code_seq_YYYY.sql for 2027+) is intentionally deferred and documented inline.

**Type consistency:**
- `OrderStatus` used identically backend (`com.drshoes.app.order.domain.OrderStatus`) and frontend (`apps/web/lib/orders/types.ts`).
- `TimelineEventKind` mirrored in both layers.
- `OrderDto.version` (int) → `expectedVersion` (int) in `ChangeStatusRequest` — round-trip type matches.
- `ClientDto`, `OrderDto`, `OrderListRow`, `OrderItemDto`, `TimelineEvent` shapes are stable across backend service / DTO / frontend type definitions.

**Granular code compliance:**
- Java: most classes well under 120 LOC. Exception: entity classes (Client, Order, OrderItem) run to 130-150 LOC due to Java getter/setter boilerplate — explicitly authorized in dispatch log.
- TS: every component / module < 80 LOC by design. Where a component naturally grows (e.g. `OrderDrawerItems`), the plan splits into `ItemEditRow.tsx`.

**Backend-heavy compliance:**
- All status-transition validation, code generation, soft-delete semantics, audit curation — backend.
- Frontend `OrderDrawerStatusChanger` only sends intent; response from server is authoritative.
- Frontend `OrderDrawerTimeline` renders pre-curated `TimelineEvent[]` with no client-side mapping logic.
- No business rules duplicated client-side. ✅
