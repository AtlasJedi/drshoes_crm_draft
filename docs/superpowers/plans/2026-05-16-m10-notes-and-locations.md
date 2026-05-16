# Milestone 10 — Wave 1: Custom Notes + Storage Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pozwolić pracownikowi dodawać wolne notatki do historii zlecenia i przenosić zlecenie między fizycznymi miejscami warsztatu (półka, suszarka, szuflada) — bez zmiany statusu.

**Architecture:** Trzy wave'y, 12 tasków. Wave 1 (backend) jest niezależne od UI designu — startuje natychmiast. Waves 2+3 (frontend admin panel + drawer integration) czekają na owner-provided visual exports z Claude.ai. Pattern audit'u reuse'uje istniejący `AuditLogAspect` (M1) — żadnej nowej infrastruktury, tylko nowa ścieżka HTTP + dwie nowe kolumny w `audit_log` (V020).

**Tech Stack:** Java 21 + Spring Boot 3.4 + Postgres 16 + Flyway. Next.js 16 App Router + TS + Tailwind + Radix Dialog. Vitest 84+ frontend, Testcontainers + Spring `*IntegrationTest` backend.

**Spec source of truth:** `docs/superpowers/specs/2026-05-16-m10-notes-and-locations-design.md`

---

## Plan overview

**12 tasków w 3 wave'ach.** Combined single-stage dla każdego per anti-bloat directive 2026-05-11 (czysty feature, brak security/state-machine/migracji-z-danymi risk).

| Wave | Tasks | Scope | Block |
|---|---|---|---|
| 1 | 10-1 .. 10-6 | Backend: V018 storage_location + V019 orders.location + V020 audit_log.location_from/_to + StorageLocationController + OrderNotesController + frontend lib | Niezależne — start natychmiast |
| 2 | 10-7 .. 10-9 | Frontend admin panel `/admin/settings/miejsca` + sidebar KONFIGURACJA | **Blocked on owner-provided visual export** (LocationsList + FormModal mockup) |
| 3 | 10-10 .. 10-12 | Frontend drawer: NoteComposer + Notes extension + Header location pill | **Blocked on owner-provided visual export** (composer + move chip + header pill mockup) |

---

## Cross-cutting integration notes (orchestrator MUST track)

### A. Spec errata — audit_log schema correction

Spec sekcja 2.3 mówiła o "action = 'ORDER_NOTE'" + "diff JSONB". Po inspekcji rzeczywistego `AuditLog.java` (commit istnieje od V001/V015):

- **Nie ma kolumny `action`** — action identity = `method + path` (np. `POST /api/admin/orders/{id}/notes`). To wystarczy do filtrowania w `OrderDrawerNotes` na froncie i `AuditTimelineService` w backendzie.
- **Nie ma kolumny `diff`** — istniejące kolumny: `id, actor_id, method, path, status, ip, user_agent, request_id, body_hash, parent_entity_id, trace_id, note, created_at`.
- **Rozwiązanie**: V020 dodaje DWA dedykowane kolumny `location_from VARCHAR(64) NULL` i `location_to VARCHAR(64) NULL` (zamiast generycznego JSONB). Prostsze, indeksowalne, brak parsowania JSON na froncie. To mała denormalizacja akceptowalna dla feature-scoped pola.

Wszystkie odniesienia w spec do "action='ORDER_NOTE'" w runtime znaczą **"audit row z method=POST i path matching /api/admin/orders/{id}/notes"**. Wszystkie odniesienia do "diff.location" w runtime znaczą **"audit row z location_from != null OR location_to != null"**.

### B. AuditLogAspect już handle'uje controller pointcut

Per `BulkStatusController.java` komentarz: "AuditLogAspect controller pointcut already writes audit rows for /api/admin/**". To znaczy: **NIE dodajemy @Audited do nowych controllerów**. Aspect zapisuje row automatycznie z method+path+status. Dla notes endpointa potrzebujemy tylko żeby request DTO `AddOrderNoteRequest` implementował `HasAuditNote` aby aspect threadował `auditNote()` do `audit_log.note`. Location values muszą zostać zapisane przez serwis (nie aspect) — patrz Task 10-5.

### C. Location-change pisanie do audit_log z serwisu

Aspect pisze `audit_log` AFTER controller returns, w `Propagation.REQUIRES_NEW`. Nasz serwis musi:
1. Wewnątrz swojej transakcji wykonać `UPDATE orders SET location=:new`.
2. Zapamiętać `oldLocation` z przed-update'u.
3. **Update audit row po fakcie**: AuditLogAspect zapisuje wiersz w REQUIRES_NEW po returnie controllera. Wstawiamy `location_from` i `location_to` przez nowe pola w `HasAuditNote`-podobnym kontrakcie LUB przez bezpośredni write w serwisie.

**Decyzja**: rozszerzamy `HasAuditNote` o dodatkowe metody `auditLocationFrom()` i `auditLocationTo()` w nowym interfejsie `HasAuditLocationDiff` (separate interface, addytywny — `AddOrderNoteRequest` implements both). Aspect-side: `AuditWriteCoordinator` extracts oba pola tak samo jak note. Wymaga rozszerzenia `AuditLogWriter.write(...)` o 2 nowe parametry + odpowiadająca kolumna w insercie.

**Alternatywa rozważona, odrzucona**: serwis bezpośrednio pisze row do `audit_log` ręcznie (zamiast przez aspect). To dubluje audit pipeline'y — bad.

### D. orders.location atomicity z audit row

Endpoint `POST /notes` MUSI być atomowy: albo audit row + orders.location update OBA się zapisują, albo żaden. Trick: AuditLogAspect używa REQUIRES_NEW. Jeśli serwis throwsuje po update'cie orders.location ale przed return, audit row się NIE zapisze (bo aspect zapisuje po returnie controllera). 

**Rozwiązanie**: serwis robi `UPDATE orders` jako ostatnią rzecz przed returnem. Jeśli rzucił błąd, `@Transactional` rollback'uje orders update. Aspect NIE pisze audit row bo controller throwsuje. Spójność osiągnięta.

### E. Validation: at-least-one-of (note, location)

Walidacja na warstwie controllera:
- Jeśli `note` jest null/blank AND `location` jest null/blank → 400 `at_least_one_required`.
- Jeśli `location` jest podany ale taki sam jak `orders.location` AND note jest null/blank → 400 `no_op_change`.
- Jeśli `location` jest podany ale nie istnieje w `storage_location WHERE active=true` → 409 `unknown_location`.

### F. *IntegrationTest.java NIE *IT.java

Per M3 hygiene fact (memory `project_session_2026_05_09_part4`): Failsafe pluginManagement-only. Wszystkie nowe IT mają suffix `*IntegrationTest.java`.

### G. AdminPrincipal threading

Wszystkie nowe endpointy używają `@AuthenticationPrincipal AdminPrincipal me` jako sygnatury argumentu. Pattern z M3 `PhotoController`. Aktor jest auto-rozwiązywany przez AuditWriteCoordinator z SecurityContext, więc explicit threading do audit'u nie trzeba.

### H. Granularność kodu

- Java pliki ≤ 120 LOC (z wyjątkiem CRUD controllerów per CLAUDE.md exception).
- TS moduły ≤ 80 LOC. Większe → split na sub-komponenty.

### I. Frontend wave'y blokowane visualem

Po Wave 1 (backend gotowe), wysyłamy do ownera **prompt do Claude.ai design tool** dla 5 visual artifacts: LocationsList layout, LocationFormModal, OrderDrawerNoteComposer, _LocationMoveChip, OrderDrawerHeader location pill, AdminSidebarNav KONFIGURACJA section. Implementacja Wave 2+3 czeka aż owner wrzuci 5 exports.

---

## Dispatch protocol (per `feedback_dispatch_protocol.md`)

1. **Thin prompts** — subagent reads ten plan + spec + task id, NIE full task text re-pastowany.
2. **Dispatch log per task** — `docs/dispatch-log/10-N-<UTC>.md` z plikami, komendami, suite outcome, decyzjami, commit SHA.
3. **tasks.json** — przed startem Wave 1 dispatcher dopisuje wpisy `10-1`..`10-12` z `status=pending`.
4. **Combined single-stage** dla wszystkich 12 — brak TWO-STAGE per anti-bloat directive 2026-05-11.
5. **Commit format**: `feat(<scope>): <subject> [milestone:10][task:10-N]` z `Refs: docs/dispatch-log/10-N-<UTC>.md` w body.
6. **Sonnet subagenty** — Opus orkiestruje, Sonnet implementuje. Cold dispatch z thin promptem.

---

## Resume from a fresh session

After `/clear`, paste:

```
Read docs/superpowers/specs/2026-05-16-m10-notes-and-locations-design.md.
Read docs/superpowers/plans/2026-05-16-m10-notes-and-locations.md (start with "Cross-cutting integration notes").
Verify HEAD with git log --oneline -1.
Confirm task status:
  python3 -c "import json;d=json.load(open('docs/dispatch-log/tasks.json'));[print(t['id'],t['status']) for t in d['tasks'] if t['id'].startswith('10-')]"
Then dispatch the next pending 10-N task per dispatch template.
```

---

# Wave 1 — Backend (10-1 .. 10-6)

---

## Task 10-1: V018 migration + StorageLocation entity + repository

**Review:** combined single-stage

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V018__storage_location.sql`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/domain/StorageLocation.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/domain/StorageLocationRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/storage/domain/StorageLocationRepositoryIntegrationTest.java`

- [ ] **Step 1: Write V018 migration**

Create `backend/app/src/main/resources/db/migration/V018__storage_location.sql`:

```sql
-- Storage locations administered as a simple string set (M10 wave 1, owner directive 2026-05-16).
-- Used by orders.location (V019) as a soft FK — no constraint, denormalized for rename-resistance.
CREATE TABLE storage_location (
  id          BIGSERIAL    PRIMARY KEY,
  name        VARCHAR(64)  NOT NULL UNIQUE,
  position    INTEGER      NOT NULL DEFAULT 0,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_location_active_position
  ON storage_location (active, position);
```

- [ ] **Step 2: Write StorageLocation entity (RED — repository test will reference it)**

Create `backend/app/src/main/java/com/drshoes/app/storage/domain/StorageLocation.java`:

```java
package com.drshoes.app.storage.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Storage location administered as a simple string set.
 *
 * Design: see docs/superpowers/specs/2026-05-16-m10-notes-and-locations-design.md
 * — owner directive "simple CRM, no IDs in UX". The id is internal only.
 */
@Entity
@Table(name = "storage_location")
public class StorageLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String name;

    @Column(nullable = false)
    private int position = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 3: Write StorageLocationRepository (RED)**

Create `backend/app/src/main/java/com/drshoes/app/storage/domain/StorageLocationRepository.java`:

```java
package com.drshoes.app.storage.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {

    /** Active locations ordered by position then name (UI picker default). */
    @Query("SELECT l FROM StorageLocation l WHERE l.active = true ORDER BY l.position ASC, l.name ASC")
    List<StorageLocation> findAllActive();

    /** All locations including inactive — admin panel view. */
    @Query("SELECT l FROM StorageLocation l ORDER BY l.active DESC, l.position ASC, l.name ASC")
    List<StorageLocation> findAllIncludingInactive();

    Optional<StorageLocation> findByName(String name);

    boolean existsByNameAndActiveTrue(String name);
}
```

- [ ] **Step 4: Write repository integration test**

Create `backend/app/src/test/java/com/drshoes/app/storage/domain/StorageLocationRepositoryIntegrationTest.java`:

```java
package com.drshoes.app.storage.domain;

import com.drshoes.app.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StorageLocationRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired StorageLocationRepository repo;

    @Test
    void findAllActive_returns_active_only_sorted_by_position_then_name() {
        var a = save("półka 1", 1, true);
        var b = save("suszarka", 0, true);
        save("stary kąt", 99, false);

        List<StorageLocation> active = repo.findAllActive();

        assertThat(active).extracting(StorageLocation::getName)
            .containsExactly("suszarka", "półka 1");
    }

    @Test
    void findAllIncludingInactive_returns_all_active_first_then_inactive() {
        save("a-active", 1, true);
        save("z-inactive", 0, false);

        List<StorageLocation> all = repo.findAllIncludingInactive();

        assertThat(all).extracting(StorageLocation::getName)
            .containsExactly("a-active", "z-inactive");
    }

    @Test
    void existsByNameAndActiveTrue_true_when_active_match() {
        save("półka 1", 0, true);
        assertThat(repo.existsByNameAndActiveTrue("półka 1")).isTrue();
    }

    @Test
    void existsByNameAndActiveTrue_false_when_inactive_match() {
        save("półka 1", 0, false);
        assertThat(repo.existsByNameAndActiveTrue("półka 1")).isFalse();
    }

    @Test
    void existsByNameAndActiveTrue_false_when_no_match() {
        assertThat(repo.existsByNameAndActiveTrue("brak")).isFalse();
    }

    private StorageLocation save(String name, int position, boolean active) {
        var l = new StorageLocation();
        l.setName(name);
        l.setPosition(position);
        l.setActive(active);
        return repo.save(l);
    }
}
```

- [ ] **Step 5: Run test from backend/ (RED first time? Should be GREEN — only fails if Flyway can't apply V018)**

Run: `cd backend && mvn -pl app test -Dtest=StorageLocationRepositoryIntegrationTest`
Expected: 5/5 PASS, Flyway log shows `Migrating schema "public" to version "18 - storage location"`.

- [ ] **Step 6: Run full backend suite to verify no V018 breaks other tests**

Run: `cd backend && mvn -pl app verify -B`
Expected: 409+5 = 414 tests pass (or similar — exact baseline 409 per milestone-9 close).

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V018__storage_location.sql \
        backend/app/src/main/java/com/drshoes/app/storage/ \
        backend/app/src/test/java/com/drshoes/app/storage/
git commit -m "feat(storage): add storage_location table + entity + repo [milestone:10][task:10-1]

V018 migration creates storage_location (id, name UNIQUE, position, active, timestamps).
StorageLocation entity + StorageLocationRepository with findAllActive / findAllIncludingInactive /
existsByNameAndActiveTrue. Repository integration test covers active/inactive sort,
position ordering, and existence check.

Refs: docs/dispatch-log/10-1-<UTC>.md"
```

---

## Task 10-2: StorageLocationService + unit tests

**Review:** combined single-stage

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/storage/service/StorageLocationService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/service/LocationConflictException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/service/LocationNotFoundException.java`
- Create: `backend/app/src/test/java/com/drshoes/app/storage/service/StorageLocationServiceTest.java`

- [ ] **Step 1: Write service unit test (RED)**

Create `backend/app/src/test/java/com/drshoes/app/storage/service/StorageLocationServiceTest.java`:

```java
package com.drshoes.app.storage.service;

import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class StorageLocationServiceTest {

    StorageLocationRepository repo;
    StorageLocationService svc;

    @BeforeEach
    void setUp() {
        repo = mock(StorageLocationRepository.class);
        svc = new StorageLocationService(repo);
    }

    @Test
    void create_persists_new_location_with_default_position() {
        when(repo.findByName("półka 1")).thenReturn(Optional.empty());
        when(repo.save(any(StorageLocation.class))).thenAnswer(inv -> {
            StorageLocation arg = inv.getArgument(0);
            return arg;
        });

        StorageLocation created = svc.create("półka 1");

        ArgumentCaptor<StorageLocation> cap = ArgumentCaptor.forClass(StorageLocation.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue().getName()).isEqualTo("półka 1");
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test
    void create_throws_conflict_when_name_exists() {
        when(repo.findByName("dup")).thenReturn(Optional.of(new StorageLocation()));

        assertThatThrownBy(() -> svc.create("dup"))
            .isInstanceOf(LocationConflictException.class)
            .hasMessageContaining("dup");
    }

    @Test
    void update_changes_name_and_position() {
        StorageLocation existing = new StorageLocation();
        existing.setName("old");
        existing.setPosition(0);
        when(repo.findById(7L)).thenReturn(Optional.of(existing));
        when(repo.findByName("new")).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StorageLocation updated = svc.update(7L, "new", 5, true);

        assertThat(updated.getName()).isEqualTo("new");
        assertThat(updated.getPosition()).isEqualTo(5);
    }

    @Test
    void update_rename_to_existing_throws_conflict() {
        StorageLocation target = new StorageLocation();
        when(repo.findById(7L)).thenReturn(Optional.of(target));
        StorageLocation other = new StorageLocation();
        other.setName("taken");
        when(repo.findByName("taken")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> svc.update(7L, "taken", null, null))
            .isInstanceOf(LocationConflictException.class);
    }

    @Test
    void update_missing_id_throws_not_found() {
        when(repo.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.update(99L, "x", null, null))
            .isInstanceOf(LocationNotFoundException.class);
    }

    @Test
    void deactivate_sets_active_false() {
        StorageLocation existing = new StorageLocation();
        existing.setActive(true);
        when(repo.findById(7L)).thenReturn(Optional.of(existing));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        svc.deactivate(7L);

        assertThat(existing.isActive()).isFalse();
        verify(repo).save(existing);
    }

    @Test
    void list_active_delegates_to_repo() {
        when(repo.findAllActive()).thenReturn(List.of());
        svc.listActive();
        verify(repo).findAllActive();
    }

    @Test
    void list_all_delegates_to_repo() {
        when(repo.findAllIncludingInactive()).thenReturn(List.of());
        svc.listAll();
        verify(repo).findAllIncludingInactive();
    }
}
```

- [ ] **Step 2: Run test — expect compile fail (no service class)**

Run: `cd backend && mvn -pl app test -Dtest=StorageLocationServiceTest`
Expected: FAIL — `cannot find symbol: class StorageLocationService`.

- [ ] **Step 3: Write exception classes**

Create `backend/app/src/main/java/com/drshoes/app/storage/service/LocationConflictException.java`:

```java
package com.drshoes.app.storage.service;

public class LocationConflictException extends RuntimeException {
    public LocationConflictException(String name) {
        super("location name already exists: " + name);
    }
}
```

Create `backend/app/src/main/java/com/drshoes/app/storage/service/LocationNotFoundException.java`:

```java
package com.drshoes.app.storage.service;

public class LocationNotFoundException extends RuntimeException {
    public LocationNotFoundException(Long id) {
        super("storage_location not found: id=" + id);
    }
}
```

- [ ] **Step 4: Write StorageLocationService (GREEN)**

Create `backend/app/src/main/java/com/drshoes/app/storage/service/StorageLocationService.java`:

```java
package com.drshoes.app.storage.service;

import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CRUD for the simple string-set of storage locations.
 *
 * Policy:
 *   - name UNIQUE — rename to existing → LocationConflictException (mapped 409 by controller).
 *   - Missing id on update/deactivate → LocationNotFoundException (mapped 404).
 *   - deactivate is soft-delete (active=false). Historical orders.location strings unaffected.
 */
@Service
public class StorageLocationService {

    private static final Logger log = LoggerFactory.getLogger(StorageLocationService.class);

    private final StorageLocationRepository repo;

    public StorageLocationService(StorageLocationRepository repo) {
        this.repo = repo;
    }

    public List<StorageLocation> listActive() {
        return repo.findAllActive();
    }

    public List<StorageLocation> listAll() {
        return repo.findAllIncludingInactive();
    }

    @Transactional
    public StorageLocation create(String name) {
        if (repo.findByName(name).isPresent()) {
            log.info("op=storageLocation.create name={} outcome=conflict", name);
            throw new LocationConflictException(name);
        }
        StorageLocation l = new StorageLocation();
        l.setName(name);
        l.setPosition(0);
        l.setActive(true);
        StorageLocation saved = repo.save(l);
        log.info("op=storageLocation.create name={} id={} outcome=ok", name, saved.getId());
        return saved;
    }

    @Transactional
    public StorageLocation update(Long id, String name, Integer position, Boolean active) {
        StorageLocation l = repo.findById(id)
            .orElseThrow(() -> new LocationNotFoundException(id));
        if (name != null && !name.equals(l.getName())) {
            if (repo.findByName(name).isPresent()) {
                throw new LocationConflictException(name);
            }
            l.setName(name);
        }
        if (position != null) l.setPosition(position);
        if (active != null) l.setActive(active);
        StorageLocation saved = repo.save(l);
        log.info("op=storageLocation.update id={} name={} position={} active={} outcome=ok",
            id, l.getName(), l.getPosition(), l.isActive());
        return saved;
    }

    @Transactional
    public void deactivate(Long id) {
        StorageLocation l = repo.findById(id)
            .orElseThrow(() -> new LocationNotFoundException(id));
        l.setActive(false);
        repo.save(l);
        log.info("op=storageLocation.deactivate id={} outcome=ok", id);
    }
}
```

- [ ] **Step 5: Run unit test (GREEN)**

Run: `cd backend && mvn -pl app test -Dtest=StorageLocationServiceTest`
Expected: 8/8 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/storage/service/ \
        backend/app/src/test/java/com/drshoes/app/storage/service/
git commit -m "feat(storage): add StorageLocationService with CRUD + conflict/not-found handling [milestone:10][task:10-2]

Service layer for storage_location CRUD. Policy:
  - name UNIQUE — rename to existing throws LocationConflictException (409).
  - Missing id throws LocationNotFoundException (404).
  - deactivate is soft-delete (active=false), keeps historical orders.location strings.

8 unit tests cover create/update/deactivate happy paths + both exception paths.

Refs: docs/dispatch-log/10-2-<UTC>.md"
```

---

## Task 10-3: StorageLocationController + DTOs + IT

**Review:** combined single-stage

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/api/CreateStorageLocationRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/api/UpdateStorageLocationRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationExceptionHandler.java`
- Create: `backend/app/src/test/java/com/drshoes/app/storage/api/StorageLocationControllerIntegrationTest.java`

- [ ] **Step 1: Write DTOs (records)**

Create `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationDto.java`:

```java
package com.drshoes.app.storage.api;

import com.drshoes.app.storage.domain.StorageLocation;

public record StorageLocationDto(Long id, String name, int position, boolean active) {
    public static StorageLocationDto from(StorageLocation l) {
        return new StorageLocationDto(l.getId(), l.getName(), l.getPosition(), l.isActive());
    }
}
```

Create `backend/app/src/main/java/com/drshoes/app/storage/api/CreateStorageLocationRequest.java`:

```java
package com.drshoes.app.storage.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStorageLocationRequest(
    @NotBlank @Size(max = 64) String name
) {}
```

Create `backend/app/src/main/java/com/drshoes/app/storage/api/UpdateStorageLocationRequest.java`:

```java
package com.drshoes.app.storage.api;

import jakarta.validation.constraints.Size;

public record UpdateStorageLocationRequest(
    @Size(max = 64) String name,
    Integer position,
    Boolean active
) {}
```

- [ ] **Step 2: Write IT (RED — controller doesn't exist yet)**

Create `backend/app/src/test/java/com/drshoes/app/storage/api/StorageLocationControllerIntegrationTest.java`:

```java
package com.drshoes.app.storage.api;

import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import com.drshoes.app.support.AdminWebTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StorageLocationControllerIntegrationTest extends AdminWebTestBase {

    @Autowired StorageLocationRepository repo;

    @Test
    void GET_storage_locations_returns_only_active_by_default() throws Exception {
        save("aktywne", 0, true);
        save("nieaktywne", 0, false);

        mvc.perform(get("/api/admin/storage-locations").session(ownerSession()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("aktywne"))
            .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    void GET_storage_locations_includeInactive_returns_all() throws Exception {
        save("a-active", 0, true);
        save("b-inactive", 0, false);

        mvc.perform(get("/api/admin/storage-locations?includeInactive=true").session(ownerSession()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void POST_creates_location_returns_201() throws Exception {
        mvc.perform(post("/api/admin/storage-locations")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"półka 1\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("półka 1"))
            .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void POST_duplicate_name_returns_409() throws Exception {
        save("dup", 0, true);
        mvc.perform(post("/api/admin/storage-locations")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"dup\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("location_name_conflict"));
    }

    @Test
    void POST_blank_name_returns_400() throws Exception {
        mvc.perform(post("/api/admin/storage-locations")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void PATCH_updates_name_and_position() throws Exception {
        var l = save("orig", 0, true);
        mvc.perform(patch("/api/admin/storage-locations/" + l.getId())
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"renamed\",\"position\":5}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("renamed"))
            .andExpect(jsonPath("$.position").value(5));
    }

    @Test
    void PATCH_rename_to_existing_returns_409() throws Exception {
        save("taken", 0, true);
        var l = save("other", 0, true);
        mvc.perform(patch("/api/admin/storage-locations/" + l.getId())
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"taken\"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void PATCH_unknown_id_returns_404() throws Exception {
        mvc.perform(patch("/api/admin/storage-locations/99999")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"name\":\"x\"}"))
            .andExpect(status().isNotFound());
    }

    @Test
    void DELETE_soft_deletes_returns_204() throws Exception {
        var l = save("kandydat", 0, true);
        mvc.perform(delete("/api/admin/storage-locations/" + l.getId()).session(ownerSession()))
            .andExpect(status().isNoContent());
        StorageLocation reread = repo.findById(l.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(reread.isActive()).isFalse();
    }

    private StorageLocation save(String name, int position, boolean active) {
        var l = new StorageLocation();
        l.setName(name);
        l.setPosition(position);
        l.setActive(active);
        return repo.save(l);
    }
}
```

- [ ] **Step 3: Run IT — expect compile fail**

Run: `cd backend && mvn -pl app test -Dtest=StorageLocationControllerIntegrationTest`
Expected: FAIL — `StorageLocationController` symbol not found.

- [ ] **Step 4: Write controller (GREEN)**

Create `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationController.java`:

```java
package com.drshoes.app.storage.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.storage.service.StorageLocationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * CRUD endpoints for the storage_location string set.
 * AuditLogAspect handles audit row writes (controller pointcut).
 */
@RestController
@RequestMapping("/api/admin/storage-locations")
public class StorageLocationController {

    private static final Logger log = LoggerFactory.getLogger(StorageLocationController.class);

    private final StorageLocationService svc;

    public StorageLocationController(StorageLocationService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<StorageLocationDto> list(
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive,
            @AuthenticationPrincipal AdminPrincipal me) {
        log.info("op=storageLocation.list actor={} includeInactive={} outcome=ok",
            me.getEmail(), includeInactive);
        return (includeInactive ? svc.listAll() : svc.listActive())
            .stream().map(StorageLocationDto::from).toList();
    }

    @PostMapping
    public ResponseEntity<StorageLocationDto> create(
            @Valid @RequestBody CreateStorageLocationRequest req,
            @AuthenticationPrincipal AdminPrincipal me) {
        var created = svc.create(req.name());
        log.info("op=storageLocation.create actor={} id={} name={} outcome=ok",
            me.getEmail(), created.getId(), created.getName());
        return ResponseEntity
            .created(URI.create("/api/admin/storage-locations/" + created.getId()))
            .body(StorageLocationDto.from(created));
    }

    @PatchMapping("/{id}")
    public StorageLocationDto update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStorageLocationRequest req,
            @AuthenticationPrincipal AdminPrincipal me) {
        var updated = svc.update(id, req.name(), req.position(), req.active());
        log.info("op=storageLocation.update actor={} id={} outcome=ok", me.getEmail(), id);
        return StorageLocationDto.from(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id,
                                           @AuthenticationPrincipal AdminPrincipal me) {
        svc.deactivate(id);
        log.info("op=storageLocation.deactivate actor={} id={} outcome=ok", me.getEmail(), id);
        return ResponseEntity.noContent().build();
    }
}
```

Create `backend/app/src/main/java/com/drshoes/app/storage/api/StorageLocationExceptionHandler.java`:

```java
package com.drshoes.app.storage.api;

import com.drshoes.app.storage.service.LocationConflictException;
import com.drshoes.app.storage.service.LocationNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice(assignableTypes = StorageLocationController.class)
public class StorageLocationExceptionHandler {

    @ExceptionHandler(LocationConflictException.class)
    public ResponseEntity<Map<String, String>> conflict(LocationConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", "location_name_conflict", "message", ex.getMessage()));
    }

    @ExceptionHandler(LocationNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(LocationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "location_not_found", "message", ex.getMessage()));
    }
}
```

- [ ] **Step 5: Run IT (GREEN)**

Run: `cd backend && mvn -pl app test -Dtest=StorageLocationControllerIntegrationTest`
Expected: 9/9 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/storage/api/ \
        backend/app/src/test/java/com/drshoes/app/storage/api/
git commit -m "feat(storage): expose /api/admin/storage-locations CRUD [milestone:10][task:10-3]

GET /api/admin/storage-locations            → active locations
GET /api/admin/storage-locations?includeInactive=true → all
POST  /api/admin/storage-locations          → create (409 on dup name)
PATCH /api/admin/storage-locations/{id}     → update (409 on rename clash, 404 on missing)
DELETE /api/admin/storage-locations/{id}    → soft-delete (active=false)

DTOs as records. ControllerAdvice maps service exceptions to 409/404.
AuditLogAspect handles audit row writes via /api/admin/** pointcut.

9 IT cases cover happy paths + 409 + 404 + 400.

Refs: docs/dispatch-log/10-3-<UTC>.md"
```

---

## Task 10-4: V019 migration + Order.location field + Order DTO update

**Review:** combined single-stage

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V019__orders_location.sql`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/domain/Order.java` (add `location` field + accessors)
- Modify: `backend/app/src/main/java/com/drshoes/app/order/dto/OrderDto.java` (add `location` field to record)
- Modify: existing Order DTO mapper to populate `location` from entity
- Create: `backend/app/src/test/java/com/drshoes/app/order/domain/OrderLocationFieldIntegrationTest.java`

- [ ] **Step 1: Write V019 migration**

Create `backend/app/src/main/resources/db/migration/V019__orders_location.sql`:

```sql
-- M10 wave 1: add denormalized storage location to orders.
-- Plain VARCHAR, no FK to storage_location.name — rename-resistant by design
-- (owner directive 2026-05-16: "no IDs, no joins, simple CRM").
ALTER TABLE orders ADD COLUMN location VARCHAR(64) NULL;
```

- [ ] **Step 2: Add `location` field to Order entity**

Open `backend/app/src/main/java/com/drshoes/app/order/domain/Order.java`. After the existing `@Column` block (right after `tags` if present, or before timestamps), add:

```java
@Column(name = "location", length = 64)
private String location;
```

Add accessors near other getters/setters:

```java
public String getLocation() { return location; }
public void setLocation(String location) { this.location = location; }
```

- [ ] **Step 3: Add `location` to OrderDto record**

Open `backend/app/src/main/java/com/drshoes/app/order/dto/OrderDto.java`. Add `String location` to the record fields list (preferably right before the timestamp fields). Update the `from(Order)` factory or whatever mapper exists to populate it:

```java
// In OrderDto.from(Order o) (or the equivalent mapper):
//   return new OrderDto(... , o.getLocation(), ...);
```

If there is no static factory, find the mapper class (`OrderMapper` or similar — likely in `com.drshoes.app.order.dto`) and add the field there.

- [ ] **Step 4: Write integration test (RED if Order entity missing the column)**

Create `backend/app/src/test/java/com/drshoes/app/order/domain/OrderLocationFieldIntegrationTest.java`:

```java
package com.drshoes.app.order.domain;

import com.drshoes.app.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class OrderLocationFieldIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderRepository orderRepo;

    @Test
    void order_location_field_persists_and_reads_back() {
        // Use whatever Order factory exists in the codebase. If there is an
        // OrderFixtures helper, use it; otherwise build minimal Order inline.
        Order o = newMinimalOrder();
        o.setLocation("półka 1");
        orderRepo.save(o);

        Order reread = orderRepo.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isEqualTo("półka 1");
    }

    @Test
    void order_location_field_nullable() {
        Order o = newMinimalOrder();
        o.setLocation(null);
        orderRepo.save(o);
        Order reread = orderRepo.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isNull();
    }

    // Helper: build a minimal valid Order. Pattern lifted from existing
    // OrderControllerIntegrationTest or similar — subagent: inline what existing
    // tests use. Do not invent a new helper if one already exists in
    // com.drshoes.app.support or com.drshoes.app.order.
    private Order newMinimalOrder() {
        // Subagent: search for OrderFixtures, OrderTestData, or AbstractIntegrationTest helpers
        // and reuse. If absent, mirror the construction pattern in
        // OrderControllerIntegrationTest's @BeforeEach setup.
        throw new UnsupportedOperationException("subagent: replace with project Order factory");
    }
}
```

**Subagent note**: replace `newMinimalOrder()` body with the existing project helper. Do NOT invent a new fixture pattern — grep `OrderControllerIntegrationTest` for the canonical setup.

- [ ] **Step 5: Run test (GREEN after V019 + entity field + helper wired)**

Run: `cd backend && mvn -pl app test -Dtest=OrderLocationFieldIntegrationTest`
Expected: 2/2 PASS.

- [ ] **Step 6: Run full backend suite to verify Order DTO change didn't break callers**

Run: `cd backend && mvn -pl app verify -B`
Expected: prior 414 (or whatever 10-1+10-2+10-3 raised it to) + 2 new = no regressions. If OrderDto change broke serialization tests, update fixtures.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V019__orders_location.sql \
        backend/app/src/main/java/com/drshoes/app/order/domain/Order.java \
        backend/app/src/main/java/com/drshoes/app/order/dto/OrderDto.java \
        backend/app/src/test/java/com/drshoes/app/order/domain/OrderLocationFieldIntegrationTest.java
# Also add any DTO mapper file touched in step 3
git commit -m "feat(order): add orders.location varchar(64) + Order.location field + OrderDto.location [milestone:10][task:10-4]

V019 migration adds nullable orders.location column (plain VARCHAR, no FK to
storage_location.name — rename-resistant by design). Order entity gets the field
+ accessors; OrderDto exposes it for the admin drawer to render.

2 IT cases verify field persists and is nullable.

Refs: docs/dispatch-log/10-4-<UTC>.md"
```

---

## Task 10-5: V020 audit_log location columns + OrderNotesController + OrderNotesService + IT

**Review:** combined single-stage

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V020__audit_log_location.sql`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/AuditLog.java` (add `locationFrom`, `locationTo`)
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/AuditLogWriter.java` (extend `write(...)` signature)
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/AuditWriteCoordinator.java` (extract location-diff from method args)
- Create: `backend/app/src/main/java/com/drshoes/app/audit/HasAuditLocationDiff.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteResponse.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/service/OrderNotesService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesExceptionHandler.java`
- Create: `backend/app/src/test/java/com/drshoes/app/order/api/OrderNotesControllerIntegrationTest.java`

- [ ] **Step 1: V020 migration**

Create `backend/app/src/main/resources/db/migration/V020__audit_log_location.sql`:

```sql
-- M10 wave 1: capture location change in audit row for ORDER_NOTE events.
-- Both nullable — notes without location move set both NULL; moves set both
-- (or only locationTo when previous was NULL).
ALTER TABLE audit_log ADD COLUMN location_from VARCHAR(64) NULL;
ALTER TABLE audit_log ADD COLUMN location_to   VARCHAR(64) NULL;
```

- [ ] **Step 2: Extend AuditLog entity**

Open `backend/app/src/main/java/com/drshoes/app/audit/AuditLog.java`. Add fields after `note`:

```java
@Column(name = "location_from", length = 64)
private String locationFrom;

@Column(name = "location_to", length = 64)
private String locationTo;
```

Add accessors:

```java
public String getLocationFrom() { return locationFrom; }
public void setLocationFrom(String locationFrom) { this.locationFrom = locationFrom; }
public String getLocationTo() { return locationTo; }
public void setLocationTo(String locationTo) { this.locationTo = locationTo; }
```

- [ ] **Step 3: New marker interface**

Create `backend/app/src/main/java/com/drshoes/app/audit/HasAuditLocationDiff.java`:

```java
package com.drshoes.app.audit;

/**
 * Companion to {@link HasAuditNote} — request DTOs implement this when they
 * carry a location change (orders.location move). AuditLogAspect reads both
 * fields from the first matching arg and writes them to audit_log.
 *
 * Returning null from either method means "no change" / "no value" — the
 * audit row gets a NULL in the corresponding column.
 */
public interface HasAuditLocationDiff {
    String auditLocationFrom();
    String auditLocationTo();
}
```

- [ ] **Step 4: Extend AuditLogWriter + AuditWriteCoordinator**

In `AuditLogWriter.java`, find the `write(...)` overload that AuditWriteCoordinator calls with the note. Add two new parameters `String locationFrom, String locationTo` and persist them on the entity:

```java
// Before save():
audit.setLocationFrom(locationFrom);
audit.setLocationTo(locationTo);
```

Update the `write(...)` signature. All callers (currently only AuditWriteCoordinator) get extra two arguments.

In `AuditWriteCoordinator.java`, mirror the `extractAuditNote(...)` pattern with `extractAuditLocationDiff(...)`. Add a method that scans `joinPoint.getArgs()` for the first `HasAuditLocationDiff` instance and returns `{from, to}` (both nullable). Pass these to `writer.write(...)`.

Also extend `persistHttp(...)` overload to accept locationFrom/locationTo:

```java
public void persistHttp(HttpServletRequest r, int status, String note,
                        String locationFrom, String locationTo) {
    // … existing logic …
    () -> writer.write(method, path, status, ..., note, locationFrom, locationTo)
}
```

And in `AuditLogAspect.java` controller advice, call the new overload with extracted location-diff. (If the aspect currently does `persistHttp(r, status, note)`, change to `persistHttp(r, status, note, lf, lt)`.)

- [ ] **Step 5: Write request/response DTOs**

Create `backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteRequest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.audit.HasAuditLocationDiff;
import com.drshoes.app.audit.HasAuditNote;
import jakarta.validation.constraints.Size;

/**
 * Body for POST /api/admin/orders/{orderId}/notes.
 *
 * Validation:
 *   - co najmniej jedno z (note, location) musi być obecne i niepuste
 *     (checked in service to allow context-aware messaging).
 *   - note trimmed, max 1000 chars.
 *   - location max 64 chars; service rejects unknown / inactive.
 *
 * HasAuditNote   → AuditLogAspect captures note into audit_log.note.
 * HasAuditLocationDiff → captures location move into audit_log.location_from/location_to.
 *   auditLocationFrom() returns the ORDER's current location at request-time,
 *   which the controller injects after the service computes it (see controller).
 */
public record AddOrderNoteRequest(
    @Size(max = 1000) String note,
    @Size(max = 64)   String location
) implements HasAuditNote, HasAuditLocationDiff {

    /** Aspect bridge — operator note text. */
    @Override public String auditNote() { return note; }

    /** Captured by the controller before calling the service. */
    private static final ThreadLocal<String> FROM_CONTEXT = new ThreadLocal<>();
    /** Captured by the controller after computing. */
    private static final ThreadLocal<String> TO_CONTEXT = new ThreadLocal<>();

    public static void setMoveContext(String from, String to) {
        FROM_CONTEXT.set(from);
        TO_CONTEXT.set(to);
    }

    public static void clearMoveContext() {
        FROM_CONTEXT.remove();
        TO_CONTEXT.remove();
    }

    @Override public String auditLocationFrom() { return FROM_CONTEXT.get(); }
    @Override public String auditLocationTo()   { return TO_CONTEXT.get(); }
}
```

**Note**: ThreadLocal is the pattern that works because AuditLogAspect runs in the same thread (synchronous HTTP). Controller sets values before calling service; aspect reads after controller returns; controller's `finally` block clears. Alternative considered: mutable fields on the record — records are immutable, so ThreadLocal is the simplest workaround given the aspect must read these AFTER the service mutates orders.location.

Create `backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteResponse.java`:

```java
package com.drshoes.app.order.api;

import java.time.Instant;
import java.util.UUID;

public record AddOrderNoteResponse(
    UUID auditEntryId,
    String note,
    String locationFrom,
    String locationTo,
    Instant createdAt
) {}
```

- [ ] **Step 6: Service exceptions**

Add to `com.drshoes.app.order.service` (or wherever order exceptions live):

```java
// OrderNotesService.java will declare these — see step 7.
public static class NoteValidationException extends RuntimeException {
    public final String code; // "at_least_one_required" | "no_op_change"
    public NoteValidationException(String code, String msg) { super(msg); this.code = code; }
}
public static class UnknownLocationException extends RuntimeException {
    public UnknownLocationException(String name) {
        super("storage_location not active or unknown: " + name);
    }
}
public static class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(java.util.UUID id) { super("order not found: " + id); }
}
```

Put them as static nested classes inside `OrderNotesService` for locality (small, single-use).

- [ ] **Step 7: Write OrderNotesService**

Create `backend/app/src/main/java/com/drshoes/app/order/service/OrderNotesService.java`:

```java
package com.drshoes.app.order.service;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Handles POST /api/admin/orders/{orderId}/notes.
 *
 * Semantics:
 *   - At least one of (note, newLocation) must be non-blank.
 *   - If newLocation given: must exist in storage_location WHERE active=true.
 *   - If newLocation equals current order.location AND note is blank → no_op_change.
 *   - Atomic: orders.location updated only if validation passes; aspect writes
 *     audit row after controller returns. If service throws, controller throws,
 *     aspect does not persist audit. orders.location update is in same @Transactional
 *     so it rolls back too.
 */
@Service
public class OrderNotesService {

    private static final Logger log = LoggerFactory.getLogger(OrderNotesService.class);

    private final OrderRepository orders;
    private final StorageLocationRepository locations;

    public OrderNotesService(OrderRepository orders, StorageLocationRepository locations) {
        this.orders = orders;
        this.locations = locations;
    }

    public record Result(String oldLocation, String newLocation, String note) {}

    @Transactional
    public Result addNote(UUID orderId, String rawNote, String rawLocation) {
        String note = trimOrNull(rawNote);
        String newLoc = trimOrNull(rawLocation);

        if (note == null && newLoc == null) {
            throw new NoteValidationException("at_least_one_required",
                "either note or location must be provided");
        }

        Order o = orders.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));

        String oldLoc = o.getLocation();
        boolean locationActuallyChanged = newLoc != null && !newLoc.equals(oldLoc);

        if (newLoc != null && !locationActuallyChanged && note == null) {
            throw new NoteValidationException("no_op_change",
                "location equals current and no note provided");
        }
        if (newLoc != null && locationActuallyChanged
                && !locations.existsByNameAndActiveTrue(newLoc)) {
            throw new UnknownLocationException(newLoc);
        }

        if (locationActuallyChanged) {
            o.setLocation(newLoc);
            orders.save(o);
        }

        log.info("op=order.addNote orderId={} hasNote={} locationChanged={} from={} to={} outcome=ok",
            orderId, note != null, locationActuallyChanged, oldLoc, newLoc);

        return new Result(
            locationActuallyChanged ? oldLoc : null,
            locationActuallyChanged ? newLoc : null,
            note
        );
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    public static class NoteValidationException extends RuntimeException {
        public final String code;
        public NoteValidationException(String code, String msg) { super(msg); this.code = code; }
    }

    public static class UnknownLocationException extends RuntimeException {
        public UnknownLocationException(String name) {
            super("storage_location not active or unknown: " + name);
        }
    }

    public static class OrderNotFoundException extends RuntimeException {
        public OrderNotFoundException(UUID id) { super("order not found: " + id); }
    }
}
```

- [ ] **Step 8: Write OrderNotesController**

Create `backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesController.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.order.service.OrderNotesService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.util.UUID;

/**
 * POST /api/admin/orders/{orderId}/notes
 * Adds a free-text note (and/or location move) to the order's history.
 *
 * AuditLogAspect writes the audit row from method+path+note+location-diff.
 * AddOrderNoteRequest implements HasAuditNote + HasAuditLocationDiff so aspect
 * threads operator note + location move into audit_log.
 */
@RestController
@RequestMapping("/api/admin/orders/{orderId}/notes")
public class OrderNotesController {

    private static final Logger log = LoggerFactory.getLogger(OrderNotesController.class);

    private final OrderNotesService svc;

    public OrderNotesController(OrderNotesService svc) {
        this.svc = svc;
    }

    @PostMapping
    public ResponseEntity<AddOrderNoteResponse> add(
            @PathVariable UUID orderId,
            @Valid @RequestBody AddOrderNoteRequest req,
            @AuthenticationPrincipal AdminPrincipal me) {

        OrderNotesService.Result r;
        try {
            r = svc.addNote(orderId, req.note(), req.location());
            AddOrderNoteRequest.setMoveContext(r.oldLocation(), r.newLocation());
        } catch (RuntimeException ex) {
            AddOrderNoteRequest.clearMoveContext();
            throw ex;
        }

        log.info("op=orderNote.add actor={} orderId={} hasNote={} hasLocationMove={} outcome=ok",
            me.getEmail(), orderId, r.note() != null, r.newLocation() != null);

        // The aspect persists audit row AFTER this returns and reads from ThreadLocal.
        // Response auditEntryId is left null — frontend doesn't need it (audit row id
        // is generated by the aspect and not exposed back). Use a synthetic UUID.zero
        // to signal "audit will be written"; if you need the real one later, expose
        // it via AuditLogRepository.findLatestForOrder().
        AddOrderNoteResponse resp = new AddOrderNoteResponse(
            new UUID(0, 0),
            r.note(),
            r.oldLocation(),
            r.newLocation(),
            Instant.now()
        );
        AddOrderNoteRequest.clearMoveContext(); // belt-and-suspenders — aspect already ran in same thread
        return ResponseEntity
            .created(URI.create("/api/admin/orders/" + orderId + "/audit-log"))
            .body(resp);
    }
}
```

**Subagent note**: `clearMoveContext()` after `return ResponseEntity...` is unreachable — but Java doesn't have a clean "after-return" hook. The cleaner alternative is a `try-finally` wrapping the whole method body — refactor accordingly if linting complains. The key invariant: aspect reads ThreadLocal between controller return and aspect's `persistHttp` call (same thread, no async).

Create `backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesExceptionHandler.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.order.service.OrderNotesService.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice(assignableTypes = OrderNotesController.class)
public class OrderNotesExceptionHandler {

    @ExceptionHandler(NoteValidationException.class)
    public ResponseEntity<Map<String, String>> validation(NoteValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", ex.code, "message", ex.getMessage()));
    }

    @ExceptionHandler(UnknownLocationException.class)
    public ResponseEntity<Map<String, String>> unknownLocation(UnknownLocationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", "unknown_location", "message", ex.getMessage()));
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "order_not_found", "message", ex.getMessage()));
    }
}
```

- [ ] **Step 9: Write IT**

Create `backend/app/src/test/java/com/drshoes/app/order/api/OrderNotesControllerIntegrationTest.java`:

```java
package com.drshoes.app.order.api;

import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import com.drshoes.app.support.AdminWebTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OrderNotesControllerIntegrationTest extends AdminWebTestBase {

    @Autowired OrderRepository orders;
    @Autowired StorageLocationRepository locations;
    @Autowired AuditLogRepository audits;

    @Test
    void POST_note_only_writes_audit_row_with_note_no_location_change() throws Exception {
        Order o = persistOrderWithLocation(null);
        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"note\":\"wyczyszczony elo\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.note").value("wyczyszczony elo"))
            .andExpect(jsonPath("$.locationFrom").doesNotExist())
            .andExpect(jsonPath("$.locationTo").doesNotExist());

        Order reread = orders.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isNull();
        // audit row count for this order should be > 0
        assertThat(audits.findByParentEntityIdOrderByCreatedAtDesc(o.getId())).isNotEmpty();
    }

    @Test
    void POST_location_only_updates_order_and_audit_row_carries_diff() throws Exception {
        persistLocation("suszarka");
        Order o = persistOrderWithLocation("półka 1");

        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"location\":\"suszarka\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.locationFrom").value("półka 1"))
            .andExpect(jsonPath("$.locationTo").value("suszarka"));

        Order reread = orders.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isEqualTo("suszarka");
    }

    @Test
    void POST_note_and_move_both_visible_in_response() throws Exception {
        persistLocation("suszarka");
        Order o = persistOrderWithLocation(null);

        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"note\":\"po cleaningu\",\"location\":\"suszarka\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.note").value("po cleaningu"))
            .andExpect(jsonPath("$.locationTo").value("suszarka"));
    }

    @Test
    void POST_both_empty_returns_400_at_least_one_required() throws Exception {
        Order o = persistOrderWithLocation(null);
        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("at_least_one_required"));
    }

    @Test
    void POST_location_same_as_current_and_no_note_returns_400_no_op() throws Exception {
        persistLocation("półka 1");
        Order o = persistOrderWithLocation("półka 1");
        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"location\":\"półka 1\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("no_op_change"));
    }

    @Test
    void POST_unknown_location_returns_409() throws Exception {
        Order o = persistOrderWithLocation(null);
        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"location\":\"brak-takiej-lokacji\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("unknown_location"));
    }

    @Test
    void POST_inactive_location_returns_409() throws Exception {
        StorageLocation l = persistLocation("staraSzuflada");
        l.setActive(false);
        locations.save(l);
        Order o = persistOrderWithLocation(null);
        mvc.perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"location\":\"staraSzuflada\"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void POST_unknown_order_returns_404() throws Exception {
        UUID random = UUID.randomUUID();
        mvc.perform(post("/api/admin/orders/" + random + "/notes")
                .session(ownerSession())
                .contentType("application/json")
                .content("{\"note\":\"x\"}"))
            .andExpect(status().isNotFound());
    }

    // --- helpers ---

    private StorageLocation persistLocation(String name) {
        StorageLocation l = new StorageLocation();
        l.setName(name);
        l.setActive(true);
        return locations.save(l);
    }

    private Order persistOrderWithLocation(String loc) {
        // Subagent: reuse existing order-builder helper from AdminWebTestBase /
        // OrderControllerIntegrationTest. Replace placeholder below.
        throw new UnsupportedOperationException("subagent: use existing order factory");
    }
}
```

**Subagent note**: replace `persistOrderWithLocation(...)` body with existing project helper. Grep `OrderControllerIntegrationTest` for the canonical persist pattern. Set `o.setLocation(loc)` before saving.

If `AuditLogRepository.findByParentEntityIdOrderByCreatedAtDesc` does not exist by that exact name, use the existing query name (grep for `parentEntityId` in `AuditLogRepository.java`).

- [ ] **Step 10: Run IT (GREEN)**

Run: `cd backend && mvn -pl app test -Dtest=OrderNotesControllerIntegrationTest`
Expected: 8/8 PASS.

- [ ] **Step 11: Run full backend suite**

Run: `cd backend && mvn -pl app verify -B`
Expected: 414 + 8 = ~422 tests pass (or whatever 10-4 brought it to + 8 new).

- [ ] **Step 12: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V020__audit_log_location.sql \
        backend/app/src/main/java/com/drshoes/app/audit/AuditLog.java \
        backend/app/src/main/java/com/drshoes/app/audit/AuditLogWriter.java \
        backend/app/src/main/java/com/drshoes/app/audit/AuditWriteCoordinator.java \
        backend/app/src/main/java/com/drshoes/app/audit/AuditLogAspect.java \
        backend/app/src/main/java/com/drshoes/app/audit/HasAuditLocationDiff.java \
        backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteRequest.java \
        backend/app/src/main/java/com/drshoes/app/order/api/AddOrderNoteResponse.java \
        backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesController.java \
        backend/app/src/main/java/com/drshoes/app/order/api/OrderNotesExceptionHandler.java \
        backend/app/src/main/java/com/drshoes/app/order/service/OrderNotesService.java \
        backend/app/src/test/java/com/drshoes/app/order/api/OrderNotesControllerIntegrationTest.java
git commit -m "feat(order): POST /api/admin/orders/{id}/notes — note + optional location move [milestone:10][task:10-5]

V020 adds audit_log.location_from + location_to (nullable VARCHAR(64)).
HasAuditLocationDiff marker interface mirrors HasAuditNote; AuditWriteCoordinator
extracts both fields from method args alongside the existing note extraction.

POST /api/admin/orders/{orderId}/notes:
  - body { note?, location? } — at least one required
  - 400 at_least_one_required | no_op_change
  - 409 unknown_location (not in storage_location WHERE active=true)
  - 404 order_not_found
  - Atomic: orders.location update + audit row in same transactional flow.

8 IT cases cover happy paths + all error codes + audit row presence.

Refs: docs/dispatch-log/10-5-<UTC>.md"
```

---

## Task 10-6: Frontend lib helpers (`lib/locations.ts` + types)

**Review:** combined single-stage

**Files:**
- Modify: `apps/web/lib/types.ts` (add types)
- Create: `apps/web/lib/locations.ts` (fetch helpers)
- Create: `apps/web/lib/__tests__/locations.test.ts`

- [ ] **Step 1: Add types to `apps/web/lib/types.ts`**

Append to the existing `apps/web/lib/types.ts` (do not overwrite — only add):

```typescript
export type StorageLocation = {
  id: number;
  name: string;
  position: number;
  active: boolean;
};

export type AddOrderNotePayload = {
  note?: string;
  location?: string;
};

export type AddOrderNoteResult = {
  auditEntryId: string;
  note: string | null;
  locationFrom: string | null;
  locationTo: string | null;
  createdAt: string; // ISO instant
};
```

If `Order` type already exists in this file, add `location: string | null;` to its fields.

- [ ] **Step 2: Write fetch helpers + tests (RED first via tests pointing at non-existent functions)**

Create `apps/web/lib/__tests__/locations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listLocations,
  createLocation,
  updateLocation,
  deactivateLocation,
  addOrderNote,
} from "../locations";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("listLocations", () => {
  it("GETs /api/admin/storage-locations and returns parsed array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "półka 1", position: 0, active: true }],
    });
    const r = await listLocations();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/storage-locations",
      expect.objectContaining({ credentials: "include" })
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("półka 1");
  });

  it("passes includeInactive=true when requested", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    await listLocations({ includeInactive: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/storage-locations?includeInactive=true",
      expect.any(Object)
    );
  });
});

describe("createLocation", () => {
  it("POSTs with name and returns body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 5, name: "x", position: 0, active: true }),
    });
    const r = await createLocation("x");
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("POST");
    expect(r.id).toBe(5);
  });

  it("throws on 409", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "location_name_conflict", message: "x" }),
    });
    await expect(createLocation("dup")).rejects.toThrow(/conflict|409/);
  });
});

describe("updateLocation", () => {
  it("PATCHes with partial body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: "renamed", position: 2, active: true }),
    });
    const r = await updateLocation(1, { name: "renamed", position: 2 });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("PATCH");
    expect(r.name).toBe("renamed");
  });
});

describe("deactivateLocation", () => {
  it("sends DELETE and returns void", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 204 });
    await deactivateLocation(7);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("addOrderNote", () => {
  it("POSTs to /api/admin/orders/{id}/notes with body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        auditEntryId: "00000000-0000-0000-0000-000000000000",
        note: "x",
        locationFrom: null,
        locationTo: null,
        createdAt: "2026-05-16T10:00:00Z",
      }),
    });
    const r = await addOrderNote("oid-1", { note: "x" });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/admin/orders/oid-1/notes"
    );
    expect(r.note).toBe("x");
  });

  it("throws on 400 with error code from body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "at_least_one_required", message: "x" }),
    });
    await expect(addOrderNote("oid-1", {})).rejects.toMatchObject({
      code: "at_least_one_required",
    });
  });
});
```

- [ ] **Step 3: Run test — expect compile fail**

Run: `cd apps/web && pnpm exec vitest run lib/__tests__/locations.test.ts`
Expected: FAIL — cannot find module `../locations`.

- [ ] **Step 4: Write `apps/web/lib/locations.ts` (GREEN)**

Create `apps/web/lib/locations.ts`:

```typescript
import { mkLogger } from "./log";
import type {
  StorageLocation,
  AddOrderNotePayload,
  AddOrderNoteResult,
} from "./types";

const log = mkLogger("lib/locations");

export class LocationsApiError extends Error {
  constructor(public status: number, public code: string, msg: string) {
    super(msg);
  }
}

async function parseError(res: Response): Promise<LocationsApiError> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return new LocationsApiError(
      res.status,
      body.error ?? `http_${res.status}`,
      body.message ?? `request failed with ${res.status}`
    );
  } catch {
    return new LocationsApiError(res.status, `http_${res.status}`, res.statusText);
  }
}

export async function listLocations(
  opts: { includeInactive?: boolean } = {}
): Promise<StorageLocation[]> {
  const qs = opts.includeInactive ? "?includeInactive=true" : "";
  log.debug("op=list includeInactive=%s", !!opts.includeInactive);
  const res = await fetch(`/api/admin/storage-locations${qs}`, { credentials: "include" });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as StorageLocation[];
}

export async function createLocation(name: string): Promise<StorageLocation> {
  log.debug("op=create name=%s", name);
  const res = await fetch(`/api/admin/storage-locations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 409) {
      throw Object.assign(new Error(`conflict: ${err.message}`), { code: err.code, status: 409 });
    }
    throw err;
  }
  return (await res.json()) as StorageLocation;
}

export async function updateLocation(
  id: number,
  patch: { name?: string; position?: number; active?: boolean }
): Promise<StorageLocation> {
  log.debug("op=update id=%d patch=%o", id, patch);
  const res = await fetch(`/api/admin/storage-locations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as StorageLocation;
}

export async function deactivateLocation(id: number): Promise<void> {
  log.debug("op=deactivate id=%d", id);
  const res = await fetch(`/api/admin/storage-locations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
}

export async function addOrderNote(
  orderId: string,
  payload: AddOrderNotePayload
): Promise<AddOrderNoteResult> {
  log.debug("op=addOrderNote orderId=%s hasNote=%s hasLocation=%s",
    orderId, !!payload.note, !!payload.location);
  const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await parseError(res);
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
  }
  return (await res.json()) as AddOrderNoteResult;
}
```

- [ ] **Step 5: Run vitest (GREEN)**

Run: `cd apps/web && pnpm exec vitest run lib/__tests__/locations.test.ts`
Expected: all describe blocks PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/locations.ts \
        apps/web/lib/types.ts \
        apps/web/lib/__tests__/locations.test.ts
git commit -m "feat(web): add lib/locations.ts fetch helpers + StorageLocation types [milestone:10][task:10-6]

Wraps /api/admin/storage-locations CRUD and POST /api/admin/orders/{id}/notes
with typed helpers. LocationsApiError surfaces backend error codes
(location_name_conflict, at_least_one_required, no_op_change, unknown_location,
order_not_found) for UI mapping.

Refs: docs/dispatch-log/10-6-<UTC>.md"
```

---

## Wave 1 closure checklist

After 10-6 lands:

- [ ] Update `docs/dispatch-log/tasks.json` — mark 10-1..10-6 as `completed` with their commit SHAs.
- [ ] Run full backend suite: `cd backend && mvn -pl app verify -B` — target ~430 tests GREEN.
- [ ] Run full frontend suite: `cd apps/web && pnpm exec vitest run` — target ~530 tests GREEN.
- [ ] **Pause for owner**: send the visual-design prompt for Claude.ai design tool covering 5 artifacts:
  1. `/admin/settings/miejsca` LocationsList layout
  2. LocationFormModal (add/edit dialog)
  3. OrderDrawerNoteComposer (textarea + select + button placement)
  4. `_LocationMoveChip` (history note + chip variants)
  5. OrderDrawerHeader location pill placement
  6. AdminSidebarNav KONFIGURACJA section

Until owner returns 5 design exports, **do not start Wave 2 or Wave 3**.

---

# Wave 2 — Frontend admin panel (10-7 .. 10-9)

> **Blocked: requires owner-provided visual exports.** When unblocked, dispatch one task at a time. Each task reads the spec, the relevant design export, and writes its slice.

---

## Task 10-7: `/admin/settings/miejsca` route + `LocationsList` component

**Review:** combined single-stage

**Files:**
- Create: `apps/web/app/(admin)/admin/settings/miejsca/page.tsx`
- Create: `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationsList.tsx`
- Create: `apps/web/app/(admin)/admin/settings/miejsca/_components/__tests__/LocationsList.test.tsx`

- [ ] **Step 1: Write `LocationsList` test (RED)**

Create `apps/web/app/(admin)/admin/settings/miejsca/_components/__tests__/LocationsList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationsList } from "../LocationsList";

const ACTIVE = { id: 1, name: "półka 1", position: 0, active: true };
const INACTIVE = { id: 2, name: "stary kąt", position: 0, active: false };

describe("LocationsList", () => {
  it("renders active locations", () => {
    render(<LocationsList locations={[ACTIVE]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByText("półka 1")).toBeInTheDocument();
  });

  it("renders inactive locations as muted", () => {
    render(<LocationsList locations={[INACTIVE]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    const row = screen.getByText("stary kąt").closest("[data-active]");
    expect(row).toHaveAttribute("data-active", "false");
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    render(<LocationsList locations={[ACTIVE]} onEdit={onEdit} onDeactivate={vi.fn()} />);
    screen.getByLabelText(/edytuj/i).click();
    expect(onEdit).toHaveBeenCalledWith(ACTIVE);
  });

  it("calls onDeactivate when deactivate button clicked", () => {
    const onDeactivate = vi.fn();
    render(<LocationsList locations={[ACTIVE]} onEdit={vi.fn()} onDeactivate={onDeactivate} />);
    screen.getByLabelText(/dezaktywuj/i).click();
    expect(onDeactivate).toHaveBeenCalledWith(ACTIVE);
  });

  it("shows empty state when list is empty", () => {
    render(<LocationsList locations={[]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByText(/brak miejsc/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (RED — component missing)**

Run: `cd apps/web && pnpm exec vitest run app/\\(admin\\)/admin/settings/miejsca/_components/__tests__/LocationsList.test.tsx`
Expected: FAIL — cannot find `../LocationsList`.

- [ ] **Step 3: Write `LocationsList` (use owner design export for visual structure)**

Create `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationsList.tsx`. Build the component per owner-provided mockup. Must include these structural elements:

```tsx
"use client";

import { mkLogger } from "@/lib/log";
import type { StorageLocation } from "@/lib/types";

const log = mkLogger("LocationsList");

type Props = {
  locations: StorageLocation[];
  onEdit: (l: StorageLocation) => void;
  onDeactivate: (l: StorageLocation) => void;
};

export function LocationsList({ locations, onEdit, onDeactivate }: Props) {
  log.debug("op=render count=%d", locations.length);

  if (locations.length === 0) {
    return (
      <div className="text-admin-mute italic">
        Brak miejsc. Dodaj pierwsze za pomocą przycisku powyżej.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-admin-line">
      {locations.map((l) => (
        <li
          key={l.id}
          data-active={l.active}
          className={`flex items-center gap-3 py-2.5 ${!l.active ? "opacity-50" : ""}`}
        >
          <span className="flex-1 t-stencil text-[14px]">{l.name}</span>
          <button
            aria-label={`Edytuj ${l.name}`}
            className="btn-clean"
            onClick={() => onEdit(l)}
          >
            edytuj
          </button>
          {l.active && (
            <button
              aria-label={`Dezaktywuj ${l.name}`}
              className="btn-clean"
              style={{ color: "var(--red, #e1342b)" }}
              onClick={() => onDeactivate(l)}
            >
              dezaktywuj
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

**Subagent note**: Adjust class names + layout to match the owner-provided design export. The TEST assertions (`text "półka 1"`, `data-active` attribute, `aria-label` content, empty state copy) MUST stay green — they're the contract.

- [ ] **Step 4: Run test (GREEN)**

Run: `cd apps/web && pnpm exec vitest run app/\\(admin\\)/admin/settings/miejsca/_components/__tests__/LocationsList.test.tsx`
Expected: 5/5 PASS.

- [ ] **Step 5: Write page.tsx**

Create `apps/web/app/(admin)/admin/settings/miejsca/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listLocations, deactivateLocation } from "@/lib/locations";
import type { StorageLocation } from "@/lib/types";
import { LocationsList } from "./_components/LocationsList";
import { mkLogger } from "@/lib/log";
import { usePageHeader } from "../../_components/PageHeaderContext";

const log = mkLogger("settings/miejsca");

export default function MiejscaPage() {
  usePageHeader({ title: "Miejsca", subtitle: "gdzie leżą zlecenia w pracowni" });
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    log.debug("op=reload");
    setLocations(await listLocations({ includeInactive: true }));
  }

  useEffect(() => { reload(); }, []);

  async function handleDeactivate(l: StorageLocation) {
    if (!confirm(`Dezaktywować "${l.name}"?`)) return;
    await deactivateLocation(l.id);
    reload();
  }

  return (
    <div className="admin-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="t-display text-[22px]">Miejsca w pracowni</h2>
        <button className="btn-clean primary" onClick={() => setShowAdd(true)}>
          + dodaj miejsce
        </button>
      </div>
      <LocationsList
        locations={locations}
        onEdit={setEditing}
        onDeactivate={handleDeactivate}
      />
      {/* LocationFormModal wired in 10-8 — placeholder mount points: */}
      {/* {showAdd && <LocationFormModal onClose={() => { setShowAdd(false); reload(); }} />} */}
      {/* {editing && <LocationFormModal target={editing} onClose={...} />} */}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/(admin)/admin/settings/miejsca/'
git commit -m "feat(admin): add /admin/settings/miejsca route + LocationsList component [milestone:10][task:10-7]

Renders the storage_location set in a graffiti-styled list with edit/deactivate
actions per row. Empty state copy. Inactive rows visually muted via opacity.
LocationFormModal hooked in via task 10-8.

5 vitest cases cover list render + edit/deactivate callbacks + empty state.

Refs: docs/dispatch-log/10-7-<UTC>.md"
```

---

## Task 10-8: `LocationFormModal` add/edit + deactivate confirm flow

**Review:** combined single-stage

**Files:**
- Create: `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationFormModal.tsx`
- Create: `apps/web/app/(admin)/admin/settings/miejsca/_components/__tests__/LocationFormModal.test.tsx`
- Modify: `apps/web/app/(admin)/admin/settings/miejsca/page.tsx` (wire it in, uncomment placeholders)

- [ ] **Step 1: Write modal test (RED)**

Create `apps/web/app/(admin)/admin/settings/miejsca/_components/__tests__/LocationFormModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationFormModal } from "../LocationFormModal";
import * as api from "@/lib/locations";

vi.mock("@/lib/locations", () => ({
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}));

describe("LocationFormModal — add mode", () => {
  it("calls createLocation on submit then onClose", async () => {
    (api.createLocation as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, name: "nowa", position: 0, active: true,
    });
    const onClose = vi.fn();
    render(<LocationFormModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/nazwa/i), { target: { value: "nowa" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));
    await waitFor(() => expect(api.createLocation).toHaveBeenCalledWith("nowa"));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });

  it("shows error toast on 409 conflict", async () => {
    (api.createLocation as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("conflict"), { code: "location_name_conflict", status: 409 })
    );
    render(<LocationFormModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/nazwa/i), { target: { value: "dup" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));
    await waitFor(() => {
      expect(screen.getByText(/już istnieje/i)).toBeInTheDocument();
    });
  });
});

describe("LocationFormModal — edit mode", () => {
  it("pre-fills with target and calls updateLocation", async () => {
    (api.updateLocation as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, name: "renamed", position: 0, active: true,
    });
    const onClose = vi.fn();
    render(
      <LocationFormModal
        target={{ id: 5, name: "orig", position: 0, active: true }}
        onClose={onClose}
      />
    );
    expect(screen.getByLabelText(/nazwa/i)).toHaveValue("orig");
    fireEvent.change(screen.getByLabelText(/nazwa/i), { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));
    await waitFor(() =>
      expect(api.updateLocation).toHaveBeenCalledWith(5, { name: "renamed" })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });
});
```

- [ ] **Step 2: Write modal (GREEN — adjust visuals to owner design export)**

Create `apps/web/app/(admin)/admin/settings/miejsca/_components/LocationFormModal.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { createLocation, updateLocation } from "@/lib/locations";
import type { StorageLocation } from "@/lib/types";
import { mkLogger } from "@/lib/log";

const log = mkLogger("LocationFormModal");

type Props = {
  target?: StorageLocation;
  onClose: (didSave: boolean) => void;
};

export function LocationFormModal({ target, onClose }: Props) {
  const [name, setName] = useState(target?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mode = target ? "edit" : "add";

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    log.debug("op=submit mode=%s name=%s", mode, name);
    try {
      if (target) {
        await updateLocation(target.id, { name });
      } else {
        await createLocation(name);
      }
      onClose(true);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "location_name_conflict") {
        setError("Miejsce o tej nazwie już istnieje.");
      } else {
        setError("Nie udało się zapisać. Spróbuj ponownie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-paper border-2 border-ink p-6 w-full max-w-md shadow-pop"
        >
          <Dialog.Title className="t-display text-[22px] mb-4">
            {mode === "add" ? "Nowe miejsce" : `Edytuj: ${target?.name}`}
          </Dialog.Title>
          <div className="field mb-3">
            <label htmlFor="loc-name">Nazwa</label>
            <input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
          </div>
          {error && <div className="text-red text-sm mb-3">{error}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-clean" onClick={() => onClose(false)} disabled={submitting}>
              anuluj
            </button>
            <button
              className="btn-clean primary"
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
            >
              {submitting ? "zapisuję..." : "zapisz"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Wire modal in page.tsx (uncomment placeholders, add state)**

Open `apps/web/app/(admin)/admin/settings/miejsca/page.tsx` and replace the placeholder section with:

```tsx
import { LocationFormModal } from "./_components/LocationFormModal";

// inside MiejscaPage component, replace placeholder lines with:
{showAdd && (
  <LocationFormModal onClose={(saved) => { setShowAdd(false); if (saved) reload(); }} />
)}
{editing && (
  <LocationFormModal
    target={editing}
    onClose={(saved) => { setEditing(null); if (saved) reload(); }}
  />
)}
```

- [ ] **Step 4: Run tests (GREEN)**

Run: `cd apps/web && pnpm exec vitest run app/\\(admin\\)/admin/settings/miejsca/`
Expected: 8/8 PASS (5 from 10-7 + 3 from 10-8).

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/app/(admin)/admin/settings/miejsca/_components/LocationFormModal.tsx' \
        'apps/web/app/(admin)/admin/settings/miejsca/_components/__tests__/LocationFormModal.test.tsx' \
        'apps/web/app/(admin)/admin/settings/miejsca/page.tsx'
git commit -m "feat(admin): wire LocationFormModal for add/edit on /admin/settings/miejsca [milestone:10][task:10-8]

Radix Dialog modal with name field, max 64 chars. On 409 conflict surfaces
Polish error 'Miejsce o tej nazwie już istnieje.'. Page wires showAdd /
editing state into the modal; onClose(saved) triggers reload.

3 vitest cases cover add-mode happy path + 409 conflict + edit-mode pre-fill.

Refs: docs/dispatch-log/10-8-<UTC>.md"
```

---

## Task 10-9: AdminSidebarNav — KONFIGURACJA section + Miejsca link

**Review:** combined single-stage

**Files:**
- Modify: `apps/web/components/admin/AdminSidebarNav.tsx`
- Modify: `apps/web/components/admin/__tests__/AdminSidebarNav.test.tsx` (or sibling)

- [ ] **Step 1: Inspect current sidebar structure**

Run: `grep -n 'PULPIT\\|OPERACJE\\|KOMUNIKACJA\\|SKLEP' apps/web/components/admin/AdminSidebarNav.tsx`

Subagent: read the file fully to understand the section-emit pattern before editing. Typical pattern: an array of `{ section: string; items: NavItem[] }`.

- [ ] **Step 2: Update test (add expectation for KONFIGURACJA section)**

Find `AdminSidebarNav.test.tsx`. Add:

```tsx
it("renders KONFIGURACJA section with Miejsca link", () => {
  render(<AdminSidebarNav pathname="/admin/settings/miejsca" />);
  expect(screen.getByText("KONFIGURACJA")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /miejsca/i })).toHaveAttribute(
    "href",
    "/admin/settings/miejsca"
  );
});

it("marks Miejsca active when on the route", () => {
  render(<AdminSidebarNav pathname="/admin/settings/miejsca" />);
  expect(screen.getByRole("link", { name: /miejsca/i })).toHaveClass("active");
});
```

(The "active" class assertion follows the existing pattern — match what other section tests assert.)

- [ ] **Step 3: Run test (RED — section doesn't exist yet)**

Run: `cd apps/web && pnpm exec vitest run components/admin/__tests__/AdminSidebarNav.test.tsx`
Expected: 2 new tests FAIL.

- [ ] **Step 4: Add KONFIGURACJA section to AdminSidebarNav (GREEN)**

In `apps/web/components/admin/AdminSidebarNav.tsx`, find the sections array and add a new entry AFTER SKLEP:

```tsx
{
  section: "KONFIGURACJA",
  items: [
    { label: "Miejsca", href: "/admin/settings/miejsca" as Route },
  ],
},
```

The `as Route` cast follows the project's typed-routes hygiene fix from M7 (memory `project_session_2026_05_11_part3`).

- [ ] **Step 5: Run vitest (GREEN)**

Run: `cd apps/web && pnpm exec vitest run components/admin/__tests__/AdminSidebarNav.test.tsx`
Expected: all section tests PASS (including 2 new).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/AdminSidebarNav.tsx \
        apps/web/components/admin/__tests__/AdminSidebarNav.test.tsx
git commit -m "feat(admin): add KONFIGURACJA section to sidebar with Miejsca link [milestone:10][task:10-9]

Sidebar now exposes /admin/settings/miejsca under a new KONFIGURACJA section
after SKLEP. Future settings pages can join this section without nav rework.

2 vitest cases verify section render + active state.

Refs: docs/dispatch-log/10-9-<UTC>.md"
```

---

## Wave 2 closure

After 10-9:
- Update `tasks.json` 10-7..10-9 → completed.
- Run full frontend vitest: target ~540 GREEN.
- Smoke: start dev server, navigate to `/admin/settings/miejsca`, add 3 lokacje, deactivate one, edit one — verify CRUD flow end-to-end against running backend.

---

# Wave 3 — Frontend drawer integration (10-10 .. 10-12)

> **Blocked: requires owner-provided visual exports for OrderDrawerNoteComposer + _LocationMoveChip + header pill.** When unblocked, dispatch one task at a time.

---

## Task 10-10: `OrderDrawerNoteComposer` + wire into `OrderDrawer`

**Review:** combined single-stage

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNoteComposer.test.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx` (wire composer above OrderDrawerNotes)

- [ ] **Step 1: Write composer test (RED)**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNoteComposer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderDrawerNoteComposer } from "../OrderDrawerNoteComposer";
import * as api from "@/lib/locations";

vi.mock("@/lib/locations", () => ({
  listLocations: vi.fn().mockResolvedValue([
    { id: 1, name: "półka 1", position: 0, active: true },
    { id: 2, name: "suszarka", position: 1, active: true },
  ]),
  addOrderNote: vi.fn().mockResolvedValue({
    auditEntryId: "x", note: "ok", locationFrom: null, locationTo: "suszarka", createdAt: "now",
  }),
}));

const baseProps = {
  orderId: "ord-1",
  currentLocation: "półka 1" as string | null,
  onSaved: vi.fn(),
};

describe("OrderDrawerNoteComposer", () => {
  it("submit button disabled when note empty AND location unchanged", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "suszarka" })).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /dodaj wpis/i });
    expect(btn).toBeDisabled();
  });

  it("enables submit when only note is filled", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "elo" } });
    expect(screen.getByRole("button", { name: /dodaj wpis/i })).toBeEnabled();
  });

  it("enables submit when only location changed", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/miejsce/i), { target: { value: "suszarka" } });
    expect(screen.getByRole("button", { name: /dodaj wpis/i })).toBeEnabled();
  });

  it("calls addOrderNote with the payload and onSaved on success", async () => {
    const onSaved = vi.fn();
    render(<OrderDrawerNoteComposer {...baseProps} onSaved={onSaved} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "po cleaningu" } });
    fireEvent.change(screen.getByLabelText(/miejsce/i), { target: { value: "suszarka" } });
    fireEvent.click(screen.getByRole("button", { name: /dodaj wpis/i }));
    await waitFor(() =>
      expect(api.addOrderNote).toHaveBeenCalledWith("ord-1", {
        note: "po cleaningu",
        location: "suszarka",
      })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("shows error when at_least_one_required is returned", async () => {
    (api.addOrderNote as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error(), { code: "at_least_one_required" })
    );
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "elo" } });
    fireEvent.click(screen.getByRole("button", { name: /dodaj wpis/i }));
    // The button click triggers the rejected mock; ensure UI surfaces something.
    await waitFor(() => {
      expect(screen.getByText(/podaj notatkę/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test (RED)**

Run: `cd apps/web && pnpm exec vitest run 'app/(admin)/admin/orders/_components/__tests__/OrderDrawerNoteComposer.test.tsx'`
Expected: FAIL — component missing.

- [ ] **Step 3: Write composer (GREEN — adapt visuals to owner design export)**

Create `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listLocations, addOrderNote } from "@/lib/locations";
import type { StorageLocation } from "@/lib/types";
import { mkLogger } from "@/lib/log";

const log = mkLogger("OrderDrawerNoteComposer");

type Props = {
  orderId: string;
  currentLocation: string | null;
  onSaved: () => void;
};

export function OrderDrawerNoteComposer({ orderId, currentLocation, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [location, setLocation] = useState<string>(currentLocation ?? "");
  const [available, setAvailable] = useState<StorageLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listLocations().then(setAvailable).catch((e) => {
      log.warn("op=loadLocations err=%s", (e as Error).message);
      setError("Nie udało się załadować listy miejsc.");
    });
  }, []);

  const noteTrim = note.trim();
  const locationChanged = location && location !== (currentLocation ?? "");
  const canSubmit = !submitting && (noteTrim.length > 0 || locationChanged);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    log.debug("op=submit orderId=%s hasNote=%s locationChange=%s",
      orderId, !!noteTrim, locationChanged);
    try {
      const payload: { note?: string; location?: string } = {};
      if (noteTrim) payload.note = noteTrim;
      if (locationChanged) payload.location = location;
      await addOrderNote(orderId, payload);
      setNote("");
      onSaved();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "at_least_one_required") {
        setError("Podaj notatkę albo zmień miejsce.");
      } else if (code === "no_op_change") {
        setError("Nic nie zmieniłeś.");
      } else if (code === "unknown_location") {
        setError("To miejsce nie istnieje albo zostało wyłączone.");
      } else {
        setError("Nie udało się zapisać. Spróbuj ponownie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="px-6 py-4 border-t border-admin-line">
      <p className="text-xs font-medium text-admin-mute uppercase tracking-wide mb-3">
        Dodaj wpis do historii
      </p>
      <div className="field mb-2">
        <label htmlFor={`note-${orderId}`}>Co się stało? (opcjonalne)</label>
        <textarea
          id={`note-${orderId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="field flex-1">
          <label htmlFor={`loc-${orderId}`}>Miejsce</label>
          <select
            id={`loc-${orderId}`}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">— bez miejsca —</option>
            {available.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        </div>
        <button
          className="btn-clean primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          dodaj wpis
        </button>
      </div>
      {error && <div className="text-red text-sm mt-2">{error}</div>}
    </section>
  );
}
```

- [ ] **Step 4: Wire into `OrderDrawer.tsx`**

Open `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`. Just before `<OrderDrawerNotes orderId={order.id} refreshKey={refreshKey} />` add:

```tsx
<OrderDrawerNoteComposer
  orderId={order.id}
  currentLocation={order.location ?? null}
  onSaved={handleOrderUpdated}
/>
```

Also add the import:

```tsx
import { OrderDrawerNoteComposer } from "./OrderDrawerNoteComposer";
```

Ensure `handleOrderUpdated` triggers a `refreshKey` bump so `OrderDrawerNotes` re-fetches the audit timeline (this should already be wired from existing pattern).

- [ ] **Step 5: Run vitest**

Run: `cd apps/web && pnpm exec vitest run 'app/(admin)/admin/orders/_components/'`
Expected: existing OrderDrawer tests + 5 new composer tests all GREEN.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNoteComposer.test.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx'
git commit -m "feat(orders): add OrderDrawerNoteComposer + wire into OrderDrawer [milestone:10][task:10-10]

Textarea + location select + dodaj-wpis button. Submit button disabled until at
least one of (note, location-change) is dirty. Loads active locations via
lib/locations.listLocations on mount. Surfaces Polish error copy for backend
codes at_least_one_required / no_op_change / unknown_location.

5 vitest cases cover submit-disabled rules, submit-payload, error mapping.

Refs: docs/dispatch-log/10-10-<UTC>.md"
```

---

## Task 10-11: `OrderDrawerNotes` filter extension + `_LocationMoveChip`

**Review:** combined single-stage

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/_LocationMoveChip.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx` (extend filter + render chip)
- Modify: existing `OrderDrawerNotes.test.tsx` to cover the new case
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/_LocationMoveChip.test.tsx`

- [ ] **Step 1: Read existing `OrderDrawerNotes.tsx` to understand its data shape**

Run: `grep -n 'STATUS_CHANGED\\|note\\|TimelineEvent\\|action' apps/web/app/\\(admin\\)/admin/orders/_components/OrderDrawerNotes.tsx`

Subagent: read the file. The audit timeline DTO returned from backend (TimelineEvent) currently exposes fields like `id, method, path, note, parentEntityId, createdAt`. After 10-5, the DTO ALSO exposes `locationFrom` and `locationTo`. Confirm in `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEvent.java` — if those fields are not exposed yet, extend `TimelineEvent` and the timeline mapper to surface them. This is a hidden subtask of 10-11 — call it out in the dispatch log.

- [ ] **Step 2: Extend `TimelineEvent` if needed**

In `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEvent.java`, add `locationFrom` and `locationTo` fields if absent. Update mapper:

```java
public record TimelineEvent(
    UUID id,
    String method,
    String path,
    int status,
    String actorName,
    Instant createdAt,
    String note,
    String locationFrom,   // NEW
    String locationTo,     // NEW
    UUID parentEntityId
) {
    public static TimelineEvent from(AuditLog a) {
        return new TimelineEvent(
            a.getId(), a.getMethod(), a.getPath(), a.getStatus(),
            null /* actor name resolved separately */,
            a.getCreatedAt(),
            a.getNote(),
            a.getLocationFrom(),
            a.getLocationTo(),
            a.getParentEntityId()
        );
    }
}
```

(The actorName resolution stays whatever pattern existing TimelineEventCurator uses — do not refactor that.)

- [ ] **Step 3: Write `_LocationMoveChip` test (RED)**

Create `apps/web/app/(admin)/admin/orders/_components/__tests__/_LocationMoveChip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationMoveChip } from "../_LocationMoveChip";

describe("LocationMoveChip", () => {
  it("renders from → to when both present", () => {
    render(<LocationMoveChip from="półka 1" to="suszarka" />);
    expect(screen.getByText(/półka 1/)).toBeInTheDocument();
    expect(screen.getByText(/suszarka/)).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it("renders only 'do X' when from is null", () => {
    render(<LocationMoveChip from={null} to="suszarka" />);
    expect(screen.getByText(/suszarka/)).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("renders nothing when both null", () => {
    const { container } = render(<LocationMoveChip from={null} to={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 4: Write `_LocationMoveChip` (GREEN)**

Create `apps/web/app/(admin)/admin/orders/_components/_LocationMoveChip.tsx`:

```tsx
type Props = { from: string | null; to: string | null };

export function LocationMoveChip({ from, to }: Props) {
  if (!from && !to) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] t-mono"
      style={{
        border: "1.5px solid var(--ink, #0a0a0a)",
        background: "var(--paper-2, #ebe4d4)",
      }}
    >
      <span aria-hidden>📍</span>
      {from && <span className="font-medium">{from}</span>}
      {from && to && <span aria-hidden>→</span>}
      {to && <span className="font-bold">{to}</span>}
    </span>
  );
}
```

- [ ] **Step 5: Extend `OrderDrawerNotes.tsx` filter + render**

Open `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx`. Locate the filter that selects which audit rows render as notes. Update predicate to also include rows where `method === "POST"` AND `path.endsWith("/notes")` (these are ORDER_NOTE events).

Where each sticky-note item renders, add (after the note body) a chip if `event.locationFrom || event.locationTo`:

```tsx
import { LocationMoveChip } from "./_LocationMoveChip";

// inside the map of audit events:
{(event.locationFrom || event.locationTo) && (
  <div className="mt-1">
    <LocationMoveChip from={event.locationFrom ?? null} to={event.locationTo ?? null} />
  </div>
)}
```

Update or add a test in `OrderDrawerNotes.test.tsx`:

```tsx
it("renders ORDER_NOTE rows with location move chip", async () => {
  // Mock the timeline fetch to return a POST .../notes event with locationTo
  // and assert both the note body and the chip render.
});
```

(Subagent: mirror the existing mock pattern in OrderDrawerNotes.test.tsx — do not invent a new mock framework.)

- [ ] **Step 6: Run vitest (GREEN)**

Run: `cd apps/web && pnpm exec vitest run 'app/(admin)/admin/orders/_components/__tests__/_LocationMoveChip.test.tsx' 'app/(admin)/admin/orders/_components/__tests__/OrderDrawerNotes.test.tsx'`
Expected: all PASS.

Also run backend if TimelineEvent was extended: `cd backend && mvn -pl app test -Dtest=AuditTimelineServiceTest` (or whatever existing test covers TimelineEvent serialization).

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/(admin)/admin/orders/_components/_LocationMoveChip.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/__tests__/_LocationMoveChip.test.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNotes.test.tsx' \
        backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEvent.java
# Also add the timeline mapper file if touched.
git commit -m "feat(orders): render ORDER_NOTE rows + location-move chip in OrderDrawerNotes [milestone:10][task:10-11]

Extends OrderDrawerNotes audit filter to include POST .../notes events
(ORDER_NOTE action identity). Each note row optionally renders a
LocationMoveChip showing 'from → to' (or just 'to' when from is null).
TimelineEvent DTO surfaces locationFrom + locationTo from V020 columns.

3 vitest cases for chip + 1 extended OrderDrawerNotes case for chip render.

Refs: docs/dispatch-log/10-11-<UTC>.md"
```

---

## Task 10-12: `OrderDrawerHeader` location pill

**Review:** combined single-stage

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerHeader.test.tsx`

- [ ] **Step 1: Update header test (RED)**

Open the existing `OrderDrawerHeader.test.tsx` and add:

```tsx
it("renders location pill when order has a location", () => {
  render(
    <OrderDrawerHeader
      code="DR-2026-0042"
      status="W_REALIZACJI"
      clientName="X"
      receivedAt="2026-05-09T00:00:00Z"
      location="suszarka"
    />
  );
  expect(screen.getByText("suszarka")).toBeInTheDocument();
  expect(screen.getByLabelText(/aktualne miejsce/i)).toBeInTheDocument();
});

it("does not render location pill when order has no location", () => {
  render(
    <OrderDrawerHeader
      code="DR-2026-0042"
      status="W_REALIZACJI"
      clientName="X"
      receivedAt="2026-05-09T00:00:00Z"
      location={null}
    />
  );
  expect(screen.queryByLabelText(/aktualne miejsce/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect compile fail (header doesn't accept `location` prop yet)**

Run: `cd apps/web && pnpm exec vitest run 'app/(admin)/admin/orders/_components/__tests__/OrderDrawerHeader.test.tsx'`
Expected: TS error or runtime error on missing `location` prop.

- [ ] **Step 3: Extend `OrderDrawerHeader`**

Open `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx`. Add `location` to the Props type:

```tsx
type Props = {
  code: string;
  status: OrderStatus;
  clientName: string;
  receivedAt: string;
  location?: string | null;
};
```

In the JSX, after the existing status pill, add (if location is non-null):

```tsx
{location && (
  <span
    aria-label="Aktualne miejsce"
    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] t-mono"
    style={{
      border: "1.5px solid var(--ink, #0a0a0a)",
      background: "var(--acid, #d8ff3a)",
    }}
  >
    <span aria-hidden>📍</span>{location}
  </span>
)}
```

- [ ] **Step 4: Pass `location` from `OrderDrawer` to header**

In `OrderDrawer.tsx`:

```tsx
<OrderDrawerHeader
  code={order.code}
  status={order.status}
  clientName={order.clientName}
  receivedAt={order.receivedAt}
  location={order.location ?? null}
/>
```

(This requires `order.location` to exist on the Order type — added in 10-6.)

- [ ] **Step 5: Run vitest (GREEN)**

Run: `cd apps/web && pnpm exec vitest run 'app/(admin)/admin/orders/_components/__tests__/OrderDrawerHeader.test.tsx' 'app/(admin)/admin/orders/_components/__tests__/OrderDrawer.test.tsx'`
Expected: all existing + 2 new PASS.

- [ ] **Step 6: Run full frontend vitest**

Run: `cd apps/web && pnpm exec vitest run`
Expected: target ~545 GREEN (521 baseline + ~24 new across 10-6/10-7/10-8/10-10/10-11/10-12).

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerHeader.test.tsx' \
        'apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx'
git commit -m "feat(orders): render current-location pill in OrderDrawerHeader [milestone:10][task:10-12]

Acid-colored monospace pill next to the status pill when order.location is set.
Pill carries aria-label='Aktualne miejsce' for a11y.

2 vitest cases (with-location + without-location).

Refs: docs/dispatch-log/10-12-<UTC>.md"
```

---

## Wave 3 closure + M10 wave-1 milestone tag

After 10-12:
- [ ] Update `tasks.json` 10-10..10-12 → completed.
- [ ] Run full backend suite: `cd backend && mvn -pl app verify -B` — target ~430 GREEN.
- [ ] Run full frontend suite: `cd apps/web && pnpm exec vitest run` — target ~545 GREEN.
- [ ] Smoke: live dev — create lokację, dodaj zlecenie, dodaj notatkę + move w drawer, sprawdź że pojawia się w history z chipem i header pill aktualizuje.
- [ ] Update `docs/superpowers/ROADMAP.md` — mark "M10 wave 1 (Custom Notes + Storage Locations) Done" with HEAD SHA + suite counts.
- [ ] Optional: `git tag milestone-10-wave-1` (tu już nie czekamy na owner sign-off; M10 jest seria mniejszych wave'ów).

---

## Self-review checklist (run after the plan is committed)

1. **Spec coverage:** każda sekcja spec'u ma swój task? (✓ all)
2. **Placeholder scan:** brak "TBD/TODO/implement later" w kodzie planu (✓ — wszystkie kod-blocks pełne; helper-y wyróżnione jako "Subagent note: replace with existing project factory" są świadome, plan instruuje konkretnie żeby wziąć existing helper).
3. **Type consistency:** `StorageLocation` shape same w types.ts + entity + DTO (id Long w backendzie, number w frontendzie — std JSON serialization). `AddOrderNoteRequest` field names match controller body. `LocationMoveChip` props match where it's consumed.
4. **Hygiene:** tests `*IntegrationTest.java` not `*IT.java` (✓), audit aspect not re-annotated (✓), `as Route` typed-routes cast (✓ in 10-9).
