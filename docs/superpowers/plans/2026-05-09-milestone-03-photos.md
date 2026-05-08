# Milestone 3 — Photos + Actor Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin-only photo gallery (upload / list / view / relabel / delete) inside `OrderDrawer`, plus the long-deferred actor-resolution fix that makes `audit_event.actor_id` and `message.sent_by` carry real user UUIDs across all post-M2 mutations.

**Architecture:** Photos use the existing `backend/libs/storage` microlib (S3-compatible: MinIO local / R2 prod). One `Photo` entity per file. Multipart upload through Spring Boot proxies bytes into MinIO/R2; download streams back through `/api/admin/photos/{id}/file` for the same proxy symmetry. Audit events for every photo op, surfaced in the existing M1 timeline. Actor resolution wraps the email principal into a typed `AdminPrincipal` record at login time so `@AuthenticationPrincipal AdminPrincipal actor` works in every controller — no per-request DB hit.

**Tech Stack:** Java 21 / Spring Boot 3.4 (Maven multi-module), Spring Data JPA, Spring Security session-based auth (NOT JWT — see ERRATA #2), Postgres 16 (Flyway V009), AWS SDK v2 + MinIO Testcontainers, JUnit 5 / AssertJ / MockMvc, Next.js 16 App Router + TS + Tailwind + Radix, existing `apps/web/lib/log.ts` named loggers, existing `apps/web/lib/api.ts` ApiClient pattern, existing `backend/libs/storage` microlib.

**Spec:** [`docs/superpowers/specs/2026-05-09-milestone-03-photos-design.md`](../specs/2026-05-09-milestone-03-photos-design.md) (commit `9098fd0`).

---

## ERRATA — pre-execution clarifications

These reconcile the spec with codebase ground truth. **Read this before authoring any task.**

**1. Storage microlib already exists — do NOT create from scratch.**
`backend/libs/storage/` was scaffolded in M0A and currently exposes:
- `BlobStorage` interface: `put(BlobKey, InputStream, BlobMetadata)`, `exists(BlobKey)`, `presignGet(BlobKey, Duration)`, `presignPut(...)`, `delete(BlobKey)`. **No `get(BlobKey) → InputStream`.**
- `S3BlobStorage` impl using AWS SDK v2 `S3Client` + `S3Presigner`.
- `StorageProperties` bound to `drshoes.storage` (NOT `storage`).
- `StorageAutoConfiguration` registering `S3Client`, `S3Presigner`, and `BlobStorage` beans.
- `S3BlobStorageIntegrationTest` against Testcontainers MinIO — already passing.
- Records: `BlobKey(String value)` (rejects blank or leading `/`), `BlobMetadata(String contentType, Long contentLength)`, `PresignedUrl(String url, Instant expiresAt)`.

Task 3-2 extends the interface with one method (`InputStream get(BlobKey)`). No new microlib creation. The `app/` module's `pom.xml` already declares `<dependency><artifactId>storage</artifactId>...</dependency>` — confirm at task 3-2.

**2. Auth model is session-based, NOT JWT.** The spec mentioned "Tighten `JwtAuthenticationFilter`" — that filter does not exist. Reality:
- `SecurityConfig` (`backend/app/src/main/java/com/drshoes/app/config/SecurityConfig.java`) configures session policy `IF_REQUIRED`, double-submit CSRF cookie (`XSRF-TOKEN`), formLogin disabled, basicAuth disabled.
- `AuthService.login(email, password, ip)` (`backend/app/src/main/java/com/drshoes/app/auth/service/AuthService.java:76-79`) constructs `new UsernamePasswordAuthenticationToken(u.getEmail(), null, [ROLE_*])` — **principal is a String (email)**, not a User object — and pushes it into `SecurityContextHolder`.
- `AuthController.login` then explicitly calls `HttpSessionSecurityContextRepository.saveContext(...)` (Spring 6 stopped auto-saving).
- All controllers currently pull username via `Authentication.getName()`.

**Resolution:** task 3-3 introduces a new `AdminPrincipal(UUID userId, String email, String role)` record. AuthService changes one line: principal arg becomes `new AdminPrincipal(u.getId(), u.getEmail(), u.getRole().name())` instead of `u.getEmail()`. Then `@AuthenticationPrincipal AdminPrincipal actor` works in any controller. This is the simplest path with zero per-request DB lookups.

**3. User entity is `User`, not `AdminUser`.** Lives at `com.drshoes.app.auth.domain.User`, table `user_` (trailing underscore — `user` is reserved in Postgres). Fields: `UUID id`, `String email` (citext, unique), `String passwordHash`, `String fullName`, `UserRole role`, `boolean active`, `Instant lastLoginAt`, `createdAt`, `updatedAt`. `UserRepository` is the JPA repo. Throughout the plan we always say `User` / `AdminPrincipal`, never `AdminUser`.

**4. MinIO already in `docker-compose.yml`.** No new docker work. Existing services (root `docker-compose.yml`):
- `minio` service with healthcheck (`curl http://localhost:9000/minio/health/ready`).
- `minio-init` one-shot container that runs `mc mb -p local/${MINIO_BUCKET:-drshoes-dev}` AND `mc anonymous set download local/${MINIO_BUCKET}` (anon-read in dev). Bucket name: env `MINIO_BUCKET` (default `drshoes-dev`).
- `api` service env: `DRSHOES_STORAGE_ENDPOINT=http://minio:9000`, `DRSHOES_STORAGE_BUCKET=${MINIO_BUCKET}`, plus access/secret keys.

Task 3-2 verifies bucket-on-startup is fine; no new container needed.

**Note:** the dev bucket has `anonymous download` set, meaning `http://localhost:9000/drshoes-dev/{key}` is publicly readable. That is dev-only. Prod uses R2 with no anonymous policy. M3 file streaming goes through the proxy regardless (no per-env divergence).

**5. Frontend root is `apps/web/`, not `web/`.** All paths in the plan use `apps/web/...`. The existing OrderDrawer family lives at `apps/web/app/(admin)/admin/orders/_components/`:
```
OrderDrawer.tsx
OrderDrawerHeader.tsx
OrderDrawerCoreFields.tsx
OrderDrawerStatusChanger.tsx
OrderDrawerItems.tsx
OrderDrawerTimeline.tsx
OrderDrawerMessages.tsx
MessageComposerModal.tsx
```
New M3 photo components join this folder.

**6. Frontend lib pattern.** Per-domain folders under `apps/web/lib/`:
```
apps/web/lib/api.ts                — base ApiClient
apps/web/lib/log.ts                — createLogger("name")
apps/web/lib/orders/{api,types}.ts
apps/web/lib/clients/{api,types}.ts
apps/web/lib/users/{api,types}.ts
apps/web/lib/timeline/{api,types}.ts
apps/web/lib/messaging/{api,types}.ts  (M2)
```
M3 adds `apps/web/lib/photos/{api,types}.ts` following exactly this pattern.

**7. `audit_event` schema is single `parent_entity_id UUID` column** (M1 V005). Path-pattern dispatch handles entity disambiguation per M2 ERRATA #2. Photo events use `parent_entity_id = orderId` so the existing curator can group them under the order timeline.

**8. `AuditLogAspect` pointcut** is `execution(public * com.drshoes.app..api..*Controller.*(..))` per M2 ERRATA #3. PhotoController MUST live at `com.drshoes.app.photo.api.PhotoController` (note `.api.` segment). Service-method audit rows are written via the `@Audited` annotation per M2 ERRATA #4. PhotoService methods that produce audit timeline events get `@Audited(parentEntityId = "#orderId")`.

**9. Test base classes.** Per M1+M2 ERRATA:
- Repo + service integration tests extend `com.drshoes.app.AbstractIntegrationTest` (Testcontainers Postgres only — no MinIO).
- Controller integration tests extend `com.drshoes.app.AdminWebTestBase` (MockMvc + `loginAsOwner()` / `loginAsEmployee()` + `.with(csrf())` for state-changing requests).
- Photo controller integration tests need MinIO too — task 3-7 introduces a small `AdminWebTestBaseWithMinio` extension OR uses `@DynamicPropertySource` to wire a Testcontainers MinIO into the existing base. Plan picks `@DynamicPropertySource` injection inside `PhotoControllerIT` itself (no new base class).

**10. `BlobKey` constraint.** Constructor rejects values that are blank or start with `/`. Photo keys MUST start with a letter (e.g. `orders/{orderId}/{photoId}-{filename}`). Keys also include exactly one `BlobKey` allocation per photo.

**11. Frontend logger signature.** Per M2 ratification: `log.info("op=foo outcome=success", { fieldA, fieldB })` — string-first, fields-as-object second arg. NOT object-first. PhotoUploader / PhotoGrid / etc. follow this pattern.

**12. Polish copy in UI; English in code/comments.** Project rule. UI strings table is in spec §4.5; the plan lifts strings verbatim into the relevant tasks.

**13. Granularity caps.** Java classes < 120 LOC (entities exempt). TS modules < 80 LOC soft. Splits called out in tasks where projected size approaches the cap.

**14. Commit message format.** Conventional commits + dispatch protocol tags. Example:
```
feat(photo): Photo entity + repo

[milestone:3][task:3-5]

Refs: docs/dispatch-log/3-5-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
Each subagent dispatch writes its own dispatch log; the plan does NOT pre-author dispatch-log entries.

**15. `docker compose` smoke is ALWAYS the closure step, even if owner skipped it for M2.** Task 3-13 default is "run smoke; if owner says skip, document in tag annotation".

**16. `PhotoService.delete` returns `UUID` (the deleted photo's `orderId`), not `void`.** Spec §3.5 listed `void delete(...)`; implementation returns `UUID` so `@Audited(parentEntityId = "#result")` resolves to the orderId for the audit row's parent. Callers (`PhotoController.delete`) discard the return.

---

## File Structure

### Backend — `backend/libs/storage/` (extend existing)

```
backend/libs/storage/src/main/java/com/drshoes/lib/storage/
├── BlobStorage.java                # MODIFY — add: InputStream get(BlobKey key);
└── S3BlobStorage.java              # MODIFY — implement get() via S3Client.getObject

backend/libs/storage/src/test/java/com/drshoes/lib/storage/
└── S3BlobStorageIntegrationTest.java   # MODIFY — add round-trip test for get()
```

### Backend — `backend/app/` (new + modify)

**New package** `com.drshoes.app.auth.principal`:
```
auth/principal/
└── AdminPrincipal.java             # NEW   — record(UUID userId, String email, String role)
```

**Modify `com.drshoes.app.auth.service.AuthService`:**
```
auth/service/AuthService.java       # MODIFY — wrap principal in AdminPrincipal record
auth/api/AuthController.java        # MODIFY — /me reads from AdminPrincipal not String
auth/api/UsersController.java       # MODIFY (if needed) — same
```

**New package** `com.drshoes.app.photo`:
```
photo/
├── domain/
│   ├── Photo.java                  # NEW   — JPA entity, soft cap 120 LOC
│   ├── PhotoLabel.java             # NEW   — enum BEFORE / IN_PROGRESS / AFTER / OTHER
│   └── PhotoRepository.java        # NEW   — JpaRepository<Photo, UUID>
├── service/
│   └── PhotoService.java           # NEW   — upload/list/stream/relabel/delete + @Audited
├── dto/
│   ├── PhotoDto.java               # NEW   — record returned by controller
│   └── RelabelPhotoRequest.java    # NEW   — record(PhotoLabel label)
└── api/
    └── PhotoController.java        # NEW   — REST endpoints
```

**Modify `com.drshoes.app.messaging.api.MessagesController`:**
```
messaging/api/MessagesController.java   # MODIFY — accept @AuthenticationPrincipal AdminPrincipal,
                                                   pass actor.userId() to MessageRouter.sendManual
messaging/service/MessageRouter.java    # NO CHANGE — already accepts UUID actorId
```

**Audit kind catalog (existing M1 path-pattern curator extension):**
```
audit/TimelineEventCurator.java     # MODIFY — register patterns for PhotoService#upload,
                                                PhotoService#delete, PhotoService#relabel
                                                → emit MESSAGE_SENT-equivalent kinds
                                                  PHOTO_UPLOADED / PHOTO_DELETED / PHOTO_RELABELED
```

**Migration:**
```
backend/app/src/main/resources/db/migration/
└── V009__photo.sql                 # NEW
```

### Frontend — `apps/web/`

**New domain lib:**
```
apps/web/lib/photos/
├── api.ts                          # NEW   — listPhotos / uploadPhoto / relabelPhoto / deletePhoto
└── types.ts                        # NEW   — Photo, PhotoLabel, PHOTO_LABEL_PL
```

**New drawer components:**
```
apps/web/app/(admin)/admin/orders/_components/
├── OrderDrawerPhotos.tsx           # NEW   — tab body, fetches + renders grid + uploader
├── PhotoGrid.tsx                   # NEW   — responsive grid container
├── PhotoCard.tsx                   # NEW   — single photo + label + actions
├── PhotoUploader.tsx               # NEW   — file input + label picker + submit
└── PhotoLightbox.tsx               # NEW   — Radix Dialog for full-size view
```

**Modify existing drawer:**
```
apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx
                                    # MODIFY — add Zdjęcia tab between metadata and Wiadomości
apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx
                                    # MODIFY — extend KIND_LABELS_PL with PHOTO_* kinds
```

### Tests

```
backend/app/src/test/java/com/drshoes/app/photo/
├── domain/PhotoRepositoryTest.java         # NEW   — Testcontainers Postgres
├── service/PhotoServiceTest.java           # NEW   — mock BlobStorage, assert ordering + audit
└── api/PhotoControllerIT.java              # NEW   — MockMvc + Testcontainers Postgres + MinIO

backend/app/src/test/java/com/drshoes/app/auth/principal/
└── AdminPrincipalLoginTest.java            # NEW   — login → principal type assertion

backend/app/src/test/java/com/drshoes/app/messaging/api/
└── MessagesControllerActorTest.java        # NEW   — assert audit_event.actor_id non-null
```

---

## Wave map

| Wave | Tasks | Theme | Review style |
|---|---|---|---|
| 1 — Storage + schema | 3-1, 3-2 | Foundation | combined |
| 2 — Actor resolution | 3-3, 3-4 | Companion fix | two-stage on 3-3 (security-sensitive); combined on 3-4 |
| 3 — Photo backend | 3-5, 3-6, 3-7 | Domain + endpoints | two-stage on 3-6 (PhotoService logic); combined on 3-5, 3-7 |
| 4 — Photo frontend | 3-8, 3-9, 3-10, 3-11, 3-12 | UI vertical | combined |
| 5 — Closure | 3-13 | Smoke + tag + docs | combined |

---

## Wave 1 — Storage extension + schema

### Task 3-1: V009 photo migration

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V009__photo.sql`
- Test: `backend/app/src/test/java/com/drshoes/app/photo/domain/PhotoRepositoryTest.java`

- [ ] **Step 1: Write the failing repository test**

`backend/app/src/test/java/com/drshoes/app/photo/domain/PhotoRepositoryTest.java`:

```java
package com.drshoes.app.photo.domain;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PhotoRepositoryTest extends AbstractIntegrationTest {

    @Autowired PhotoRepository photos;
    @Autowired OrderRepository orders;
    @Autowired ClientRepository clients;
    @Autowired UserRepository users;

    @Test
    void findByOrderIdOrderByUploadedAtDesc_returnsNewestFirst() {
        var user = users.findAll().iterator().next();           // seeded admin user
        var client = clients.save(newClient());
        var order  = orders.save(newOrder(client.getId()));

        var p1 = save(photos, order.getId(), user.getId(), PhotoLabel.BEFORE, Instant.parse("2026-05-09T10:00:00Z"));
        var p2 = save(photos, order.getId(), user.getId(), PhotoLabel.AFTER,  Instant.parse("2026-05-09T11:00:00Z"));
        var p3 = save(photos, order.getId(), user.getId(), PhotoLabel.OTHER,  Instant.parse("2026-05-09T12:00:00Z"));

        List<Photo> found = photos.findByOrderIdOrderByUploadedAtDesc(order.getId());

        assertThat(found).extracting(Photo::getId).containsExactly(p3.getId(), p2.getId(), p1.getId());
    }

    private Photo save(PhotoRepository repo, java.util.UUID orderId, java.util.UUID actor,
                       PhotoLabel label, Instant when) {
        var p = new Photo();
        p.setOrderId(orderId);
        p.setUploadedBy(actor);
        p.setUploadedAt(when);
        p.setS3Key("orders/" + orderId + "/" + java.util.UUID.randomUUID() + "-test.jpg");
        p.setMime("image/jpeg");
        p.setSizeBytes(1234L);
        p.setLabel(label);
        p.setOriginalFilename("test.jpg");
        return repo.save(p);
    }

    private Client newClient() {
        var c = new Client();
        c.setFullName("Klient Testowy");
        c.setPhone("+48 600 100 200");
        return c;
    }

    private Order newOrder(java.util.UUID clientId) {
        var o = new Order();
        o.setClientId(clientId);
        o.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        o.setOrderType(OrderType.NAPRAWA);
        return o;
    }
}
```

- [ ] **Step 2: Run test — should fail (compile error: Photo / PhotoLabel / PhotoRepository don't exist)**

Run: `cd backend && mvn -pl app test -Dtest=PhotoRepositoryTest`
Expected: compilation failure on `Photo`, `PhotoLabel`, `PhotoRepository`. We're authoring V009 in this task; the JPA classes land in task 3-5. **Step 2 only verifies the migration applies cleanly via a Flyway-only check.**

Replace the runtime test for this task with a Flyway smoke. Add a temporary throwaway test in the same file body or use:

```bash
cd backend && mvn -pl app spring-boot:start -Dspring-boot.run.profiles=test
# then stop; or run mvn flyway:migrate equivalent
```

Simpler: just write the migration in step 3 and confirm `mvn -pl app verify` still green. The repo test stays disabled (`@Disabled("Photo entity ships in task 3-5")`) — task 3-5 removes the disable.

Update `PhotoRepositoryTest` top:

```java
@org.junit.jupiter.api.Disabled("Photo entity arrives in task 3-5; this test enables there")
class PhotoRepositoryTest extends AbstractIntegrationTest {
    // ... unchanged ...
}
```

- [ ] **Step 3: Write the migration**

`backend/app/src/main/resources/db/migration/V009__photo.sql`:

```sql
-- M3 photo gallery (admin-only)
CREATE TYPE photo_label AS ENUM ('BEFORE','IN_PROGRESS','AFTER','OTHER');

CREATE TABLE photo (
  id                UUID PRIMARY KEY,
  order_id          UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  order_item_id     UUID REFERENCES order_item(id) ON DELETE SET NULL,
  uploaded_by       UUID NOT NULL REFERENCES user_(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  s3_key            TEXT NOT NULL UNIQUE,
  mime              TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL CHECK (size_bytes > 0),
  label             photo_label NOT NULL DEFAULT 'OTHER',
  original_filename TEXT NOT NULL
);

CREATE INDEX idx_photo_order ON photo(order_id, uploaded_at DESC);
CREATE INDEX idx_photo_order_item ON photo(order_item_id) WHERE order_item_id IS NOT NULL;

COMMENT ON TABLE  photo IS 'Per-order photo gallery. Hard delete; audit log is forensic record.';
COMMENT ON COLUMN photo.s3_key IS 'Format: orders/{orderId}/{photoId}-{slugifiedFilename}. Unique.';
COMMENT ON COLUMN photo.label  IS 'BEFORE | IN_PROGRESS | AFTER | OTHER. Default OTHER on upload.';
```

Note table refs: `order_(id)`, `order_item(id)`, `user_(id)`. Trailing-underscore is the existing house style for tables that collide with Postgres reserved keywords (see V001). `order_item` does not collide so no underscore.

- [ ] **Step 4: Verify migration applies**

Run: `cd backend && mvn -pl app verify`
Expected: BUILD SUCCESS. Existing tests still 150/0/0/0. PhotoRepositoryTest reports as `Skipped` (disabled).

Optional manual check (not required to pass):
```bash
docker compose up -d db
PGPASSWORD=drshoes psql -h localhost -p 5433 -U drshoes -d drshoes -c '\d photo'
# Should show all 10 columns, photo_label enum type, both indexes.
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V009__photo.sql \
        backend/app/src/test/java/com/drshoes/app/photo/domain/PhotoRepositoryTest.java
git commit -m "$(cat <<'EOF'
feat(db): V009 photo schema + photo_label enum

[milestone:3][task:3-1]

Adds photo table (UUID PK, order_id FK CASCADE, order_item_id FK SET NULL,
uploaded_by FK, uploaded_at, s3_key UNIQUE, mime, size_bytes CHECK > 0,
label DEFAULT 'OTHER', original_filename) plus two indexes (order_id desc;
order_item_id partial). PhotoRepositoryTest authored alongside but @Disabled
until task 3-5 lands the Photo entity.

Refs: docs/dispatch-log/3-1-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-2: Extend `BlobStorage` with `get(BlobKey) → InputStream`

**Files:**
- Modify: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobStorage.java`
- Modify: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/S3BlobStorage.java`
- Modify: `backend/libs/storage/src/test/java/com/drshoes/lib/storage/S3BlobStorageIntegrationTest.java`

- [ ] **Step 1: Write the failing test** — extend the existing integration test

Append to `S3BlobStorageIntegrationTest`:

```java
@Test
void get_streamsBackTheBytesWeWrote() throws Exception {
    var key   = new BlobKey("orders/test-get/" + java.util.UUID.randomUUID() + "-cat.jpg");
    var bytes = "fake jpeg bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8);

    storage.put(key, new java.io.ByteArrayInputStream(bytes),
                new BlobMetadata("image/jpeg", (long) bytes.length));

    try (java.io.InputStream got = storage.get(key)) {
        byte[] roundTripped = got.readAllBytes();
        org.assertj.core.api.Assertions.assertThat(roundTripped).isEqualTo(bytes);
    }
}

@Test
void get_throwsWhenMissing() {
    var key = new BlobKey("does/not/exist-" + java.util.UUID.randomUUID());
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> storage.get(key).close())
        .isInstanceOf(software.amazon.awssdk.services.s3.model.NoSuchKeyException.class);
}
```

- [ ] **Step 2: Run test — fails (`get` method does not exist)**

```bash
cd backend && mvn -pl libs/storage test -Dtest=S3BlobStorageIntegrationTest
```
Expected: compile error `cannot find symbol: method get(BlobKey)`.

- [ ] **Step 3: Add the interface method**

Modify `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobStorage.java`:

```java
package com.drshoes.lib.storage;

import java.io.InputStream;
import java.time.Duration;

public interface BlobStorage {
    void put(BlobKey key, InputStream stream, BlobMetadata metadata);
    InputStream get(BlobKey key);                 // throws NoSuchKeyException if missing; caller closes
    boolean exists(BlobKey key);
    PresignedUrl presignGet(BlobKey key, Duration ttl);
    PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected);
    void delete(BlobKey key);
}
```

- [ ] **Step 4: Implement in `S3BlobStorage`**

Add to `S3BlobStorage` (after `put`, before `exists`):

```java
@Override
public InputStream get(BlobKey key) {
    return client.getObject(software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
        .bucket(bucket).key(key.value()).build());
}
```

The returned stream is an `software.amazon.awssdk.core.ResponseInputStream<GetObjectResponse>` which **is** an `InputStream`. Caller closes via try-with-resources.

- [ ] **Step 5: Run tests — should pass**

```bash
cd backend && mvn -pl libs/storage test -Dtest=S3BlobStorageIntegrationTest
```
Expected: all tests green. Two new ones added.

Then full suite:
```bash
cd backend && mvn verify
```
Expected: 150/0/0/0 → 152/0/0/0 (microlib gains 2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobStorage.java \
        backend/libs/storage/src/main/java/com/drshoes/lib/storage/S3BlobStorage.java \
        backend/libs/storage/src/test/java/com/drshoes/lib/storage/S3BlobStorageIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(storage): add BlobStorage.get(BlobKey) for download streaming

[milestone:3][task:3-2]

PhotoController will stream bytes back via /api/admin/photos/{id}/file. We
proxy through Spring Boot for upload symmetry (multipart in, stream out)
rather than mixing in presigned GET URLs. Caller is responsible for closing
the returned InputStream (try-with-resources).

Refs: docs/dispatch-log/3-2-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 2 — Actor resolution

### Task 3-3: `AdminPrincipal` record + `AuthService` wrap [TWO-STAGE REVIEW]

**Why two-stage:** security-sensitive (touches login, principal type, downstream `@PreAuthorize` semantics). Spec review FIRST (does the design meet the security bar), then quality review (does the code implement what was specified).

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/principal/AdminPrincipal.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/auth/service/AuthService.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/auth/api/AuthController.java` (read principal from `AdminPrincipal` for `/me`)
- Test: `backend/app/src/test/java/com/drshoes/app/auth/principal/AdminPrincipalLoginTest.java`

- [ ] **Step 1: Write the failing test**

`backend/app/src/test/java/com/drshoes/app/auth/principal/AdminPrincipalLoginTest.java`:

```java
package com.drshoes.app.auth.principal;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

class AdminPrincipalLoginTest extends AdminWebTestBase {

    @Test
    void afterLogin_principalIsAdminPrincipalRecordCarryingUserUuid() throws Exception {
        loginAsOwner();   // existing helper; performs login flow + populates SecurityContext

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isInstanceOf(AdminPrincipal.class);

        var principal = (AdminPrincipal) auth.getPrincipal();
        assertThat(principal.userId()).isNotNull();
        assertThat(principal.email()).isEqualTo("owner@drshoes.pl");
        assertThat(principal.role()).isEqualTo("OWNER");

        // Backwards-compat: getName() should still return the email so existing
        // code (e.g. MessagesController#actor()) continues to work pre-retrofit.
        assertThat(auth.getName()).isEqualTo("owner@drshoes.pl");
    }
}
```

- [ ] **Step 2: Run test — fails (`AdminPrincipal` does not exist)**

```bash
cd backend && mvn -pl app test -Dtest=AdminPrincipalLoginTest
```
Expected: compile error `cannot find symbol: class AdminPrincipal`.

- [ ] **Step 3: Create `AdminPrincipal` record**

`backend/app/src/main/java/com/drshoes/app/auth/principal/AdminPrincipal.java`:

```java
package com.drshoes.app.auth.principal;

import java.util.UUID;

/**
 * Typed wrapper around the authenticated admin user, stored as the principal
 * inside Spring Security's Authentication. Allows controllers to receive the
 * full identity (userId, email, role) via @AuthenticationPrincipal without a
 * per-request DB lookup.
 *
 * Backwards compat: AuthenticationToken#getName() still returns email because
 * we register email as the token's name (UsernamePasswordAuthenticationToken
 * delegates getName() to principal.toString() ONLY when principal is a String;
 * for other types it returns principal.toString(). We override toString() to
 * return email so legacy auth.getName() callers keep working unchanged.
 */
public record AdminPrincipal(UUID userId, String email, String role) {

    public AdminPrincipal {
        java.util.Objects.requireNonNull(userId, "userId");
        java.util.Objects.requireNonNull(email, "email");
        java.util.Objects.requireNonNull(role, "role");
    }

    @Override
    public String toString() {
        return email;
    }
}
```

- [ ] **Step 4: Modify `AuthService` to wrap principal**

Locate in `backend/app/src/main/java/com/drshoes/app/auth/service/AuthService.java`:

```java
        var auth = new UsernamePasswordAuthenticationToken(
            u.getEmail(), null,
            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
```

Replace with:

```java
        var principal = new com.drshoes.app.auth.principal.AdminPrincipal(
            u.getId(), u.getEmail(), u.getRole().name());
        var auth = new UsernamePasswordAuthenticationToken(
            principal, null,
            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
```

Add the import at top: `import com.drshoes.app.auth.principal.AdminPrincipal;` (or use the FQN above; up to subagent).

The `getName()` backwards-compat works because `UsernamePasswordAuthenticationToken#getName()` falls back to `getPrincipal().toString()` when principal is not a `UserDetails` or `Principal` — and `AdminPrincipal#toString()` returns the email. Verified by step 1's test assertion `auth.getName().isEqualTo("owner@drshoes.pl")`.

- [ ] **Step 5: Update `AuthController#me` to read from new principal**

Locate in `backend/app/src/main/java/com/drshoes/app/auth/api/AuthController.java` (around line 100+) the `/me` endpoint that currently does `auth.getName()`. Adjust:

```java
@GetMapping("/me")
public ResponseEntity<MeResponse> me() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() instanceof String) {
        return ResponseEntity.status(401).build();
    }
    if (auth.getPrincipal() instanceof com.drshoes.app.auth.principal.AdminPrincipal p) {
        return ResponseEntity.ok(new MeResponse(p.userId(), p.email(), p.role()));
    }
    return ResponseEntity.status(401).build();
}
```

You may need to adjust `MeResponse` to take `(UUID id, String email, String role)` if it currently takes only `(String email, String role)`. **Subagent:** read the current `MeResponse` record and only change the controller body to fit. If MeResponse already has all three fields, just substitute. If shape changes, update both `MeResponse` and the dispatch log entry.

- [ ] **Step 6: Run tests**

```bash
cd backend && mvn -pl app test
```
Expected: `AdminPrincipalLoginTest` passes. Existing auth tests should still pass — the principal swap is type-changing but `getName()` semantics are preserved. **If any existing test breaks**, do NOT just adjust the test to match — first verify the behavior change is intended (it isn't); the breakage indicates a hidden coupling to `principal instanceof String`. Fix the production code, not the test.

Run full suite:
```bash
cd backend && mvn verify
```
Expected: 152/0/0/0 → 153/0/0/0 (this task's new test).

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/auth/principal/AdminPrincipal.java \
        backend/app/src/main/java/com/drshoes/app/auth/service/AuthService.java \
        backend/app/src/main/java/com/drshoes/app/auth/api/AuthController.java \
        backend/app/src/test/java/com/drshoes/app/auth/principal/AdminPrincipalLoginTest.java
# also stage MeResponse if shape changed:
git add backend/app/src/main/java/com/drshoes/app/auth/api/dto/MeResponse.java || true

git commit -m "$(cat <<'EOF'
feat(auth): typed AdminPrincipal record carries userId via Authentication

[milestone:3][task:3-3]

Replaces String-email principal with AdminPrincipal(userId, email, role) so
@AuthenticationPrincipal AdminPrincipal works in any controller without a
per-request DB lookup. Backwards compat: toString() returns email so existing
auth.getName() callers (MessagesController, etc.) keep working until task 3-4
retrofits them to read userId() directly. /me endpoint now serves the UUID.

Refs: docs/dispatch-log/3-3-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-4: Retrofit `MessagesController` to use `AdminPrincipal.userId()`

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/api/MessagesControllerActorTest.java`

- [ ] **Step 1: Write the failing test**

`backend/app/src/test/java/com/drshoes/app/messaging/api/MessagesControllerActorTest.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.domain.AuditEventRepository;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageRepository;
import com.drshoes.app.messaging.domain.MessageTemplateRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MessagesControllerActorTest extends AdminWebTestBase {

    @Autowired MessageRepository messages;
    @Autowired MessageTemplateRepository templates;
    @Autowired ClientRepository clients;
    @Autowired OrderRepository orders;
    @Autowired AuditEventRepository auditEvents;

    @Test
    void send_messageSentByCarriesAuthenticatedUserId() throws Exception {
        var ownerId = loginAsOwner();   // returns UUID of seeded owner
        var clientId = createClientAndReturnId("Anna Nowak", "+48600100200", "anna@example.com");
        var orderId  = createOrderAndReturnId(clientId);
        var templateId = templates.findAll().iterator().next().getId();

        mockMvc.perform(post("/api/admin/orders/{orderId}/messages", orderId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"templateId\":\"" + templateId + "\",\"channel\":\"EMAIL\"}"))
            .andExpect(status().isCreated());

        var sent = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).getSentBy())
            .as("sent_by should carry the logged-in owner's UUID, not null")
            .isEqualTo(ownerId);

        // Audit row also non-null (M2 ratification: every controller method audits).
        var audits = auditEvents.findAll().stream()
            .filter(a -> "POST".equals(a.getMethod()) && a.getPath().contains("/messages"))
            .toList();
        assertThat(audits).isNotEmpty();
        assertThat(audits.get(audits.size() - 1).getActorId()).isEqualTo(ownerId);
    }
}
```

If `loginAsOwner()` doesn't already return a UUID, **augment the helper in this task** (`AdminWebTestBase`) — change return type from `void` to `UUID` and have it look up the seeded owner's id by email and return it. Single small refactor; existing callers that ignore the return value compile unchanged.

- [ ] **Step 2: Run test — fails**

```bash
cd backend && mvn -pl app test -Dtest=MessagesControllerActorTest
```
Expected: assertion fail on `sent[0].getSentBy()` — currently null (M2 debt), test expects ownerId.

- [ ] **Step 3: Retrofit `MessagesController`**

Modify `backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java`:

Replace the existing `send` method signature + body. Locate:

```java
    @PostMapping
    public ResponseEntity<MessageDto> send(@PathVariable UUID orderId,
                                           @RequestBody SendMessageRequest req,
                                           Authentication auth) {
```

Replace with:

```java
    @PostMapping
    public ResponseEntity<MessageDto> send(@PathVariable UUID orderId,
                                           @RequestBody SendMessageRequest req,
                                           @org.springframework.security.core.annotation.AuthenticationPrincipal
                                               com.drshoes.app.auth.principal.AdminPrincipal actor) {
```

In the body, find the call site (was around line ~80):

```java
        // actorId is null — M2 deferred. sentBy is nullable per V001 schema.
        // TODO(M3): resolve Authentication → UserEntity UUID and pass real actorId.
        var msgId = router.sendManual(orderId, ord.getClientId(), req.templateId(), null, channel, null);
```

Replace with:

```java
        var msgId = router.sendManual(orderId, ord.getClientId(), req.templateId(), null, channel, actor.userId());
```

Update the existing INFO log line that reads `actor(auth)`:

```java
        log.info("op=messages.send actor={} orderId={} templateId={} channel={} outcome=ok",
            actor.email(), orderId, req.templateId(), channel);
```

Remove now-unused private helper `private static String actor(Authentication auth)` and the `Authentication` import. Also remove the `// TODO(M3)` comment. The `list` GET method may still use `Authentication auth` for the log — no harm in leaving it OR also retrofitting it for consistency. Subagent's call: retrofit both endpoints if the structural change is one line.

- [ ] **Step 4: Run test — should pass**

```bash
cd backend && mvn -pl app test -Dtest=MessagesControllerActorTest
```
Expected: green.

Run full suite:
```bash
cd backend && mvn verify
```
Expected: 153/0/0/0 → 154/0/0/0.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/MessagesControllerActorTest.java
# possibly:
git add backend/app/src/test/java/com/drshoes/app/AdminWebTestBase.java || true

git commit -m "$(cat <<'EOF'
fix(messaging): MessagesController.send carries real actorId

[milestone:3][task:3-4]

Resolves M2 debt: send() now extracts the authenticated user's UUID via
@AuthenticationPrincipal AdminPrincipal and passes it through to
MessageRouter.sendManual, so message.sent_by and audit_event.actor_id are
both populated. Removes the now-unused actor(auth) helper.

Refs: docs/dispatch-log/3-4-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 3 — Photo backend

### Task 3-5: `Photo` JPA entity + `PhotoRepository` (enable disabled test from 3-1)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/photo/domain/Photo.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/domain/PhotoLabel.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/domain/PhotoRepository.java`
- Modify: `backend/app/src/test/java/com/drshoes/app/photo/domain/PhotoRepositoryTest.java` (remove `@Disabled`)

- [ ] **Step 1: Re-confirm the test fails for the right reason**

```bash
cd backend && mvn -pl app test -Dtest=PhotoRepositoryTest
```
Expected: `0 tests, 0 skipped` because the `@Disabled` is at class level. Open the test file and remove the `@Disabled(...)` annotation now to make it run.

After removal, run again:
```bash
cd backend && mvn -pl app test -Dtest=PhotoRepositoryTest
```
Expected: compile failure on `Photo`, `PhotoLabel`, `PhotoRepository`.

- [ ] **Step 2: Create `PhotoLabel` enum**

`backend/app/src/main/java/com/drshoes/app/photo/domain/PhotoLabel.java`:

```java
package com.drshoes.app.photo.domain;

public enum PhotoLabel { BEFORE, IN_PROGRESS, AFTER, OTHER }
```

- [ ] **Step 3: Create `Photo` entity**

`backend/app/src/main/java/com/drshoes/app/photo/domain/Photo.java`:

```java
package com.drshoes.app.photo.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "photo")
public class Photo {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "order_item_id", columnDefinition = "uuid")
    private UUID orderItemId;       // nullable — order-level photos use null

    @Column(name = "uploaded_by", nullable = false, columnDefinition = "uuid")
    private UUID uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();

    @Column(name = "s3_key", nullable = false, unique = true)
    private String s3Key;

    @Column(nullable = false)
    private String mime;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "photo_label")
    private PhotoLabel label = PhotoLabel.OTHER;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public UUID getOrderItemId() { return orderItemId; }
    public void setOrderItemId(UUID orderItemId) { this.orderItemId = orderItemId; }
    public UUID getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(UUID uploadedBy) { this.uploadedBy = uploadedBy; }
    public Instant getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(Instant uploadedAt) { this.uploadedAt = uploadedAt; }
    public String getS3Key() { return s3Key; }
    public void setS3Key(String s3Key) { this.s3Key = s3Key; }
    public String getMime() { return mime; }
    public void setMime(String mime) { this.mime = mime; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public PhotoLabel getLabel() { return label; }
    public void setLabel(PhotoLabel label) { this.label = label; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
}
```

(Entities are exempt from the 120 LOC cap per ERRATA #13. This one is ~75 LOC.)

The `@Column(columnDefinition = "photo_label")` instructs Hibernate to bind the JPA `@Enumerated(STRING)` to the Postgres enum type defined in V009. If Hibernate complains at runtime about the cast, register a custom type — but with the existing M2 `Channel` enum we did NOT need a custom type, so the simple `columnDefinition` route should work. Reconcile in errata if wrong.

- [ ] **Step 4: Create the repository**

`backend/app/src/main/java/com/drshoes/app/photo/domain/PhotoRepository.java`:

```java
package com.drshoes.app.photo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByOrderIdOrderByUploadedAtDesc(UUID orderId);
}
```

- [ ] **Step 5: Run repository test — passes**

```bash
cd backend && mvn -pl app test -Dtest=PhotoRepositoryTest
```
Expected: 1 test, 1 passed.

Full suite:
```bash
cd backend && mvn verify
```
Expected: 154/0/0/0 → 155/0/0/0.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/photo/domain/ \
        backend/app/src/test/java/com/drshoes/app/photo/domain/PhotoRepositoryTest.java
git commit -m "$(cat <<'EOF'
feat(photo): Photo entity + PhotoLabel enum + PhotoRepository

[milestone:3][task:3-5]

Maps the V009 photo table to a JPA entity with the 4-value photo_label enum.
Repository exposes one finder: findByOrderIdOrderByUploadedAtDesc — used by
PhotoController.list and PhotoService.delete cleanup.

Refs: docs/dispatch-log/3-5-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-6: `PhotoService` + `@Audited` + `TimelineEventCurator` extension [TWO-STAGE REVIEW]

**Why two-stage:** substantive logic — validation, mime allowlist, storage-vs-DB ordering, audit semantics. Spec review on the storage/DB ordering invariant first; quality review after.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/photo/service/PhotoService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/service/UnsupportedPhotoMimeException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/service/PhotoTooLargeException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/service/PhotoNotFoundException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/service/OrderItemNotInOrderException.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java` (register PHOTO_* path patterns)
- Test: `backend/app/src/test/java/com/drshoes/app/photo/service/PhotoServiceTest.java`

- [ ] **Step 1: Write the failing test (covers happy path + ordering + mime + size + audit)**

`backend/app/src/test/java/com/drshoes/app/photo/service/PhotoServiceTest.java`:

```java
package com.drshoes.app.photo.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.domain.AuditEventRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import com.drshoes.app.photo.domain.Photo;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobMetadata;
import com.drshoes.lib.storage.BlobStorage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PhotoServiceTest extends AbstractIntegrationTest {

    @Autowired PhotoService photoService;
    @Autowired PhotoRepository photos;
    @Autowired OrderRepository orders;
    @Autowired ClientRepository clients;
    @Autowired UserRepository users;
    @Autowired AuditEventRepository audits;
    @MockBean BlobStorage blobStorage;     // mocked: no real MinIO in this test

    @Test
    void upload_storesRowAfterStoragePut_emitsAudit() {
        var actor = users.findAll().iterator().next();
        var order = givenOrder();
        var bytes = "fake".getBytes();
        var file  = new MockMultipartFile("file", "cat.jpg", "image/jpeg", bytes);

        var saved = photoService.upload(order.getId(), null, file, PhotoLabel.BEFORE, actor.getId());

        // 1. Storage put happened with the right metadata.
        ArgumentCaptor<BlobKey> keyCap   = ArgumentCaptor.forClass(BlobKey.class);
        ArgumentCaptor<BlobMetadata> mdCap = ArgumentCaptor.forClass(BlobMetadata.class);
        verify(blobStorage).put(keyCap.capture(), any(), mdCap.capture());
        assertThat(keyCap.getValue().value()).startsWith("orders/" + order.getId() + "/" + saved.getId() + "-");
        assertThat(mdCap.getValue().contentType()).isEqualTo("image/jpeg");
        assertThat(mdCap.getValue().contentLength()).isEqualTo((long) bytes.length);

        // 2. DB row persisted with correct fields.
        var found = photos.findById(saved.getId()).orElseThrow();
        assertThat(found.getOrderId()).isEqualTo(order.getId());
        assertThat(found.getLabel()).isEqualTo(PhotoLabel.BEFORE);
        assertThat(found.getUploadedBy()).isEqualTo(actor.getId());
        assertThat(found.getOriginalFilename()).isEqualTo("cat.jpg");
        assertThat(found.getMime()).isEqualTo("image/jpeg");

        // 3. Audit event created with actor_id and parent_entity_id=orderId.
        var photoAudits = audits.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().endsWith("PhotoService#upload"))
            .toList();
        assertThat(photoAudits).hasSize(1);
        assertThat(photoAudits.get(0).getActorId()).isEqualTo(actor.getId());
        assertThat(photoAudits.get(0).getParentEntityId()).isEqualTo(order.getId());
    }

    @Test
    void upload_rejectsUnsupportedMime() {
        var actor = users.findAll().iterator().next();
        var order = givenOrder();
        var file  = new MockMultipartFile("file", "doc.pdf", "application/pdf", "x".getBytes());

        assertThatThrownBy(() -> photoService.upload(order.getId(), null, file, PhotoLabel.OTHER, actor.getId()))
            .isInstanceOf(UnsupportedPhotoMimeException.class);

        verifyNoInteractions(blobStorage);
        assertThat(photos.findAll()).isEmpty();
    }

    @Test
    void upload_rejectsTooLarge() {
        var actor = users.findAll().iterator().next();
        var order = givenOrder();
        var big   = new byte[20 * 1024 * 1024 + 1];   // 20MB + 1 byte
        var file  = new MockMultipartFile("file", "big.jpg", "image/jpeg", big);

        assertThatThrownBy(() -> photoService.upload(order.getId(), null, file, PhotoLabel.OTHER, actor.getId()))
            .isInstanceOf(PhotoTooLargeException.class);

        verifyNoInteractions(blobStorage);
    }

    @Test
    void delete_removesRowAndStorageObject() {
        var actor = users.findAll().iterator().next();
        var order = givenOrder();
        var photo = photoService.upload(order.getId(), null,
            new MockMultipartFile("file", "x.jpg", "image/jpeg", "y".getBytes()),
            PhotoLabel.OTHER, actor.getId());
        reset(blobStorage);

        photoService.delete(photo.getId(), actor.getId());

        verify(blobStorage).delete(argThat(k -> k.value().equals(photo.getS3Key())));
        assertThat(photos.findById(photo.getId())).isEmpty();
    }

    @Test
    void relabel_updatesLabel_emitsAudit() {
        var actor = users.findAll().iterator().next();
        var order = givenOrder();
        var photo = photoService.upload(order.getId(), null,
            new MockMultipartFile("file", "x.jpg", "image/jpeg", "y".getBytes()),
            PhotoLabel.OTHER, actor.getId());

        var updated = photoService.relabel(photo.getId(), PhotoLabel.AFTER, actor.getId());

        assertThat(updated.getLabel()).isEqualTo(PhotoLabel.AFTER);
        var audited = audits.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().endsWith("PhotoService#relabel"))
            .toList();
        assertThat(audited).hasSize(1);
        assertThat(audited.get(0).getParentEntityId()).isEqualTo(order.getId());
    }

    private Order givenOrder() {
        var c = new Client(); c.setFullName("X"); c.setPhone("+48 600 000 000");
        var saved = clients.save(c);
        var o = new Order();
        o.setClientId(saved.getId());
        o.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        o.setOrderType(OrderType.NAPRAWA);
        return orders.save(o);
    }
}
```

- [ ] **Step 2: Run test — fails (PhotoService does not exist)**

```bash
cd backend && mvn -pl app test -Dtest=PhotoServiceTest
```
Expected: compile errors on `PhotoService`, `UnsupportedPhotoMimeException`, `PhotoTooLargeException`.

- [ ] **Step 3: Author exception classes**

`backend/app/src/main/java/com/drshoes/app/photo/service/UnsupportedPhotoMimeException.java`:

```java
package com.drshoes.app.photo.service;

public class UnsupportedPhotoMimeException extends RuntimeException {
    public UnsupportedPhotoMimeException(String mime) {
        super("Unsupported photo mime: " + mime);
    }
}
```

`backend/app/src/main/java/com/drshoes/app/photo/service/PhotoTooLargeException.java`:

```java
package com.drshoes.app.photo.service;

public class PhotoTooLargeException extends RuntimeException {
    public PhotoTooLargeException(long size, long max) {
        super("Photo too large: " + size + " bytes (max " + max + ")");
    }
}
```

`backend/app/src/main/java/com/drshoes/app/photo/service/PhotoNotFoundException.java`:

```java
package com.drshoes.app.photo.service;

import java.util.UUID;

public class PhotoNotFoundException extends RuntimeException {
    public PhotoNotFoundException(UUID id) { super("Photo not found: " + id); }
}
```

`backend/app/src/main/java/com/drshoes/app/photo/service/OrderItemNotInOrderException.java`:

```java
package com.drshoes.app.photo.service;

import java.util.UUID;

public class OrderItemNotInOrderException extends RuntimeException {
    public OrderItemNotInOrderException(UUID itemId, UUID orderId) {
        super("OrderItem " + itemId + " does not belong to order " + orderId);
    }
}
```

- [ ] **Step 4: Author `PhotoService`**

`backend/app/src/main/java/com/drshoes/app/photo/service/PhotoService.java`:

```java
package com.drshoes.app.photo.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.photo.domain.Photo;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobMetadata;
import com.drshoes.lib.storage.BlobStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    static final Set<String> ALLOWED_MIMES = Set.of(
        "image/jpeg", "image/png", "image/webp", "image/heic"
    );
    static final long MAX_BYTES = 20L * 1024 * 1024;

    private final PhotoRepository photos;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final BlobStorage storage;

    public PhotoService(PhotoRepository photos, OrderRepository orders,
                        OrderItemRepository orderItems, BlobStorage storage) {
        this.photos = photos;
        this.orders = orders;
        this.orderItems = orderItems;
        this.storage = storage;
    }

    @Audited(parentEntityId = "#orderId")
    @Transactional
    public Photo upload(UUID orderId, UUID itemId, MultipartFile file,
                        PhotoLabel label, UUID actorId) {
        validateOrderExists(orderId);
        validateItemBelongsToOrder(orderId, itemId);
        validateMime(file.getContentType());
        validateSize(file.getSize());

        var photoId = UUID.randomUUID();
        var key = new BlobKey(buildKey(orderId, photoId, file.getOriginalFilename()));

        try (InputStream in = file.getInputStream()) {
            storage.put(key, in, new BlobMetadata(file.getContentType(), file.getSize()));
        } catch (IOException e) {
            log.warn("op=photo.upload outcome=storage_failed orderId={} actorId={} mime={} size={}",
                orderId, actorId, file.getContentType(), file.getSize(), e);
            throw new RuntimeException("photo upload to storage failed", e);
        }

        var photo = new Photo();
        photo.setId(photoId);
        photo.setOrderId(orderId);
        photo.setOrderItemId(itemId);
        photo.setUploadedBy(actorId);
        photo.setS3Key(key.value());
        photo.setMime(file.getContentType());
        photo.setSizeBytes(file.getSize());
        photo.setLabel(label);
        photo.setOriginalFilename(safeFilename(file.getOriginalFilename()));
        var saved = photos.save(photo);

        log.info("op=photo.upload outcome=success photoId={} orderId={} actorId={} sizeBytes={} mime={} label={}",
            saved.getId(), orderId, actorId, saved.getSizeBytes(), saved.getMime(), saved.getLabel());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Photo> listForOrder(UUID orderId) {
        return photos.findByOrderIdOrderByUploadedAtDesc(orderId);
    }

    @Transactional(readOnly = true)
    public StreamHandle stream(UUID photoId) {
        var photo = photos.findById(photoId).orElseThrow(() -> new PhotoNotFoundException(photoId));
        var bytes = storage.get(new BlobKey(photo.getS3Key()));
        return new StreamHandle(bytes, photo.getMime(), photo.getOriginalFilename());
    }

    @Audited(parentEntityId = "#result.orderId")
    @Transactional
    public Photo relabel(UUID photoId, PhotoLabel newLabel, UUID actorId) {
        var photo = photos.findById(photoId).orElseThrow(() -> new PhotoNotFoundException(photoId));
        var oldLabel = photo.getLabel();
        photo.setLabel(newLabel);
        var saved = photos.save(photo);
        log.info("op=photo.relabel outcome=success photoId={} orderId={} actorId={} oldLabel={} newLabel={}",
            saved.getId(), saved.getOrderId(), actorId, oldLabel, newLabel);
        return saved;
    }

    @Audited(parentEntityId = "#result")
    @Transactional
    public UUID delete(UUID photoId, UUID actorId) {
        var photo = photos.findById(photoId).orElseThrow(() -> new PhotoNotFoundException(photoId));
        var orderId = photo.getOrderId();
        var s3Key = photo.getS3Key();
        photos.delete(photo);
        try {
            storage.delete(new BlobKey(s3Key));
        } catch (RuntimeException e) {
            log.warn("op=photo.delete outcome=storage_orphan_failed photoId={} s3Key={} actorId={}",
                photoId, s3Key, actorId, e);
            // DB row already deleted; orphan object remains. Not user-visible.
        }
        log.info("op=photo.delete outcome=success photoId={} orderId={} actorId={} s3Key={}",
            photoId, orderId, actorId, s3Key);
        return orderId;
    }

    // ---------- helpers ----------

    private void validateOrderExists(UUID orderId) {
        if (!orders.existsById(orderId)) {
            throw new com.drshoes.app.order.service.OrderNotFoundException(orderId);
        }
    }

    private void validateItemBelongsToOrder(UUID orderId, UUID itemId) {
        if (itemId == null) return;
        var item = orderItems.findById(itemId).orElseThrow(() -> new OrderItemNotInOrderException(itemId, orderId));
        if (!item.getOrderId().equals(orderId)) {
            throw new OrderItemNotInOrderException(itemId, orderId);
        }
    }

    private void validateMime(String mime) {
        if (mime == null || !ALLOWED_MIMES.contains(mime)) {
            throw new UnsupportedPhotoMimeException(mime);
        }
    }

    private void validateSize(long size) {
        if (size > MAX_BYTES) throw new PhotoTooLargeException(size, MAX_BYTES);
    }

    private String buildKey(UUID orderId, UUID photoId, String originalFilename) {
        return "orders/" + orderId + "/" + photoId + "-" + slug(originalFilename);
    }

    private String safeFilename(String original) {
        return (original == null || original.isBlank()) ? "unknown.bin" : original;
    }

    private String slug(String input) {
        if (input == null || input.isBlank()) return "file";
        return input.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    public record StreamHandle(InputStream inputStream, String mime, String filename) {}
}
```

LOC: ~150 (over the 120 cap). Acceptable here because it's mostly small private validators. If subagent finds it cleaner, factor `PhotoValidators` into a separate class. Otherwise ship as-is and document in dispatch log.

- [ ] **Step 5: Extend `TimelineEventCurator` with PHOTO_* path patterns**

Locate `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java`. The M1 1-9 pattern dispatches by audit-row path strings. Add three cases (mirroring the M2 `MESSAGE_SENT` precedent at file location confirmed by subagent):

```java
        // ---- Wave 3 / M3 photos ----
        if (path.endsWith("PhotoService#upload")) {
            return new TimelineEvent(
                event.getId(),
                event.getCreatedAt(),
                "PHOTO_UPLOADED",
                java.util.Map.of(
                    "label", strField(event.getPayloadJson(), "label"),
                    "originalFilename", strField(event.getPayloadJson(), "originalFilename")
                ),
                event.getActorId());
        }
        if (path.endsWith("PhotoService#delete")) {
            return new TimelineEvent(
                event.getId(),
                event.getCreatedAt(),
                "PHOTO_DELETED",
                java.util.Map.of(
                    "label", strField(event.getPayloadJson(), "label"),
                    "originalFilename", strField(event.getPayloadJson(), "originalFilename")
                ),
                event.getActorId());
        }
        if (path.endsWith("PhotoService#relabel")) {
            return new TimelineEvent(
                event.getId(),
                event.getCreatedAt(),
                "PHOTO_RELABELED",
                java.util.Map.of(
                    "oldLabel", strField(event.getPayloadJson(), "oldLabel"),
                    "newLabel", strField(event.getPayloadJson(), "newLabel")
                ),
                event.getActorId());
        }
```

**Subagent:** read the curator file first; mirror the existing case style. The exact field-extraction helpers (`strField`, `payload`) are project-specific — use whatever the existing M2 `MESSAGE_SENT` case uses. If the audit payload structure doesn't carry `label` / `originalFilename` automatically (because @Audited only captures `parentEntityId` per M2 ERRATA #4), document that and ship without those labels — the timeline will still render the kind correctly, just without the Polish detail. The `KIND_LABELS_PL` string (added in task 3-12) handles top-level kind→label mapping; per-row params are best-effort polish.

- [ ] **Step 6: Run tests**

```bash
cd backend && mvn -pl app test -Dtest=PhotoServiceTest
```
Expected: 5 tests, all pass.

Full suite:
```bash
cd backend && mvn verify
```
Expected: 155/0/0/0 → 160/0/0/0.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/photo/service/ \
        backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java \
        backend/app/src/test/java/com/drshoes/app/photo/service/PhotoServiceTest.java
git commit -m "$(cat <<'EOF'
feat(photo): PhotoService — upload/list/stream/relabel/delete + audit

[milestone:3][task:3-6]

Storage-before-DB ordering on upload (BlobStorage.put then photos.save) so
a DB rollback never strands a half-persisted photo. On delete, DB-first then
BlobStorage.delete; storage failure is logged as orphan_failed and not
user-visible. Mime allowlist (jpeg/png/webp/heic), 20MB size cap.

@Audited(parentEntityId="#orderId") on upload, "#result.orderId" on relabel,
"#result" on delete (which returns the orderId for that purpose).

TimelineEventCurator extended with PHOTO_UPLOADED / PHOTO_DELETED /
PHOTO_RELABELED dispatch by PhotoService#<method> path patterns.

Refs: docs/dispatch-log/3-6-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-7: `PhotoController` + integration tests (with Testcontainers MinIO)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/photo/api/PhotoController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/dto/PhotoDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/photo/dto/RelabelPhotoRequest.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/config/SecurityConfig.java` (multipart limits if needed via `application.yml`)
- Modify: `backend/app/src/main/resources/application.yml` (multipart size)
- Test: `backend/app/src/test/java/com/drshoes/app/photo/api/PhotoControllerIT.java`

- [ ] **Step 1: Write the failing controller integration test**

`backend/app/src/test/java/com/drshoes/app/photo/api/PhotoControllerIT.java`:

```java
package com.drshoes.app.photo.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
class PhotoControllerIT extends AdminWebTestBase {

    @Container
    static MinIOContainer minio = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z")
        .withUserName("test").withPassword("testpassword");

    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        r.add("drshoes.storage.endpoint",   minio::getS3URL);
        r.add("drshoes.storage.region",     () -> "us-east-1");
        r.add("drshoes.storage.bucket",     () -> "photos-it");
        r.add("drshoes.storage.access-key", minio::getUserName);
        r.add("drshoes.storage.secret-key", minio::getPassword);
        r.add("drshoes.storage.path-style-access", () -> "true");
    }

    @org.junit.jupiter.api.BeforeAll
    static void mkBucket() {
        var s3 = software.amazon.awssdk.services.s3.S3Client.builder()
            .endpointOverride(java.net.URI.create(minio.getS3URL()))
            .region(software.amazon.awssdk.regions.Region.of("us-east-1"))
            .credentialsProvider(software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
                software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create("test", "testpassword")))
            .serviceConfiguration(software.amazon.awssdk.services.s3.S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .build();
        s3.createBucket(b -> b.bucket("photos-it"));
        s3.close();
    }

    @Autowired PhotoRepository photos;

    @Test
    void uploadListStreamDeleteRelabel_roundTrip() throws Exception {
        var ownerId = loginAsOwner();
        var clientId = createClientAndReturnId("Anna", "+48600100200", "anna@example.com");
        var orderId  = createOrderAndReturnId(clientId);

        var bytes = "fakejpegdata".getBytes();
        var file  = new MockMultipartFile("file", "cat.jpg", "image/jpeg", bytes);

        // POST upload
        var uploadResult = mockMvc.perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(file)
                .param("label", "BEFORE")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.label").value("BEFORE"))
            .andExpect(jsonPath("$.mime").value("image/jpeg"))
            .andExpect(jsonPath("$.uploadedBy").value(ownerId.toString()))
            .andExpect(jsonPath("$.fileUrl").exists())
            .andReturn();

        var photoId = UUID.fromString(
            objectMapper.readTree(uploadResult.getResponse().getContentAsString()).get("id").asText());

        // GET list
        mockMvc.perform(get("/api/admin/orders/{id}/photos", orderId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(photoId.toString()));

        // GET file streams correct bytes + mime
        var streamed = mockMvc.perform(get("/api/admin/photos/{id}/file", photoId))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "image/jpeg"))
            .andReturn().getResponse().getContentAsByteArray();
        assertThat(streamed).isEqualTo(bytes);

        // PATCH relabel
        mockMvc.perform(patch("/api/admin/photos/{id}", photoId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"AFTER\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.label").value("AFTER"));

        // DELETE
        mockMvc.perform(delete("/api/admin/photos/{id}", photoId).with(csrf()))
            .andExpect(status().isNoContent());
        assertThat(photos.findById(photoId)).isEmpty();
    }

    @Test
    void upload_unsupportedMime_returns400() throws Exception {
        loginAsOwner();
        var clientId = createClientAndReturnId("X", "+48600000000", "x@example.com");
        var orderId  = createOrderAndReturnId(clientId);
        var pdf = new MockMultipartFile("file", "doc.pdf", "application/pdf", "x".getBytes());

        mockMvc.perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(pdf).param("label", "OTHER").with(csrf()))
            .andExpect(status().isBadRequest());
    }
}
```

(Subagent: verify `objectMapper` is already a field in `AdminWebTestBase`; if not, autowire `ObjectMapper` here.)

- [ ] **Step 2: Run test — fails (PhotoController does not exist)**

```bash
cd backend && mvn -pl app test -Dtest=PhotoControllerIT
```
Expected: compile error.

- [ ] **Step 3: Author DTOs**

`backend/app/src/main/java/com/drshoes/app/photo/dto/PhotoDto.java`:

```java
package com.drshoes.app.photo.dto;

import com.drshoes.app.photo.domain.Photo;
import com.drshoes.app.photo.domain.PhotoLabel;

import java.time.Instant;
import java.util.UUID;

public record PhotoDto(
    UUID id,
    UUID orderId,
    UUID orderItemId,
    UUID uploadedBy,
    Instant uploadedAt,
    String mime,
    long sizeBytes,
    PhotoLabel label,
    String originalFilename,
    String fileUrl
) {
    public static PhotoDto from(Photo p) {
        return new PhotoDto(
            p.getId(), p.getOrderId(), p.getOrderItemId(), p.getUploadedBy(),
            p.getUploadedAt(), p.getMime(), p.getSizeBytes(), p.getLabel(),
            p.getOriginalFilename(), "/api/admin/photos/" + p.getId() + "/file");
    }
}
```

`backend/app/src/main/java/com/drshoes/app/photo/dto/RelabelPhotoRequest.java`:

```java
package com.drshoes.app.photo.dto;

import com.drshoes.app.photo.domain.PhotoLabel;

public record RelabelPhotoRequest(PhotoLabel label) {}
```

- [ ] **Step 4: Author `PhotoController`**

`backend/app/src/main/java/com/drshoes/app/photo/api/PhotoController.java`:

```java
package com.drshoes.app.photo.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.dto.PhotoDto;
import com.drshoes.app.photo.dto.RelabelPhotoRequest;
import com.drshoes.app.photo.service.OrderItemNotInOrderException;
import com.drshoes.app.photo.service.PhotoNotFoundException;
import com.drshoes.app.photo.service.PhotoService;
import com.drshoes.app.photo.service.PhotoTooLargeException;
import com.drshoes.app.photo.service.UnsupportedPhotoMimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class PhotoController {

    private static final Logger log = LoggerFactory.getLogger(PhotoController.class);

    private final PhotoService photos;

    public PhotoController(PhotoService photos) { this.photos = photos; }

    @PostMapping(path = "/api/admin/orders/{orderId}/photos",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoDto> upload(@PathVariable UUID orderId,
                                           @RequestParam("file") MultipartFile file,
                                           @RequestParam("label") PhotoLabel label,
                                           @RequestParam(value = "orderItemId", required = false) UUID orderItemId,
                                           @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.upload.recv orderId={} actorId={} label={} mime={} size={}",
            orderId, actor.userId(), label, file.getContentType(), file.getSize());
        var saved = photos.upload(orderId, orderItemId, file, label, actor.userId());
        return ResponseEntity.status(201).body(PhotoDto.from(saved));
    }

    @GetMapping("/api/admin/orders/{orderId}/photos")
    public List<PhotoDto> list(@PathVariable UUID orderId,
                               @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.list orderId={} actorId={}", orderId, actor.userId());
        return photos.listForOrder(orderId).stream().map(PhotoDto::from).toList();
    }

    @GetMapping("/api/admin/photos/{id}/file")
    public ResponseEntity<InputStreamResource> file(@PathVariable UUID id,
                                                    @AuthenticationPrincipal AdminPrincipal actor) {
        var handle = photos.stream(id);
        log.info("op=photo.stream photoId={} actorId={} mime={}", id, actor.userId(), handle.mime());
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
            .contentType(MediaType.parseMediaType(handle.mime()))
            .body(new InputStreamResource(handle.inputStream()));
    }

    @PatchMapping("/api/admin/photos/{id}")
    public PhotoDto relabel(@PathVariable UUID id,
                            @RequestBody RelabelPhotoRequest req,
                            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.relabel.recv photoId={} actorId={} newLabel={}", id, actor.userId(), req.label());
        return PhotoDto.from(photos.relabel(id, req.label(), actor.userId()));
    }

    @DeleteMapping("/api/admin/photos/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.delete.recv photoId={} actorId={}", id, actor.userId());
        photos.delete(id, actor.userId());
        return ResponseEntity.noContent().build();
    }

    // ---------- exception → status mapping ----------

    @ExceptionHandler(UnsupportedPhotoMimeException.class)
    public ResponseEntity<String> mime(UnsupportedPhotoMimeException e) {
        return ResponseEntity.badRequest().body("Nieobsługiwany format pliku");
    }

    @ExceptionHandler(PhotoTooLargeException.class)
    public ResponseEntity<String> tooLarge(PhotoTooLargeException e) {
        return ResponseEntity.status(413).body("Plik jest zbyt duży (max 20MB)");
    }

    @ExceptionHandler(PhotoNotFoundException.class)
    public ResponseEntity<String> notFound(PhotoNotFoundException e) {
        return ResponseEntity.status(404).build();
    }

    @ExceptionHandler(OrderItemNotInOrderException.class)
    public ResponseEntity<String> badItem(OrderItemNotInOrderException e) {
        return ResponseEntity.badRequest().body("OrderItem nie należy do tego zamówienia");
    }
}
```

LOC: ~95. Under cap.

- [ ] **Step 5: Set multipart limits**

Modify `backend/app/src/main/resources/application.yml` — under `spring.servlet.multipart` (create the key if missing):

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 20MB
      max-request-size: 200MB
```

- [ ] **Step 6: Run tests**

```bash
cd backend && mvn -pl app test -Dtest=PhotoControllerIT
```
Expected: 2 tests, both pass.

Full suite:
```bash
cd backend && mvn verify
```
Expected: 160/0/0/0 → 162/0/0/0.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/photo/api/PhotoController.java \
        backend/app/src/main/java/com/drshoes/app/photo/dto/ \
        backend/app/src/main/resources/application.yml \
        backend/app/src/test/java/com/drshoes/app/photo/api/PhotoControllerIT.java
git commit -m "$(cat <<'EOF'
feat(photo): PhotoController — 5 admin endpoints + multipart limits

[milestone:3][task:3-7]

POST  /api/admin/orders/{id}/photos     (multipart upload)
GET   /api/admin/orders/{id}/photos     (list)
GET   /api/admin/photos/{id}/file       (stream binary)
PATCH /api/admin/photos/{id}            (relabel)
DELETE /api/admin/photos/{id}           (hard delete)

Stream endpoint sets Cache-Control: private, max-age=3600 and the original
mime. Exception handlers map service exceptions to 400/404/413 with Polish
messages. Multipart limits: 20MB per file, 200MB per request (~10 photos).

Refs: docs/dispatch-log/3-7-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 4 — Photo frontend

### Task 3-8: `apps/web/lib/photos/{api,types}.ts`

**Files:**
- Create: `apps/web/lib/photos/types.ts`
- Create: `apps/web/lib/photos/api.ts`

- [ ] **Step 1: Create types**

`apps/web/lib/photos/types.ts`:

```ts
export type PhotoLabel = "BEFORE" | "IN_PROGRESS" | "AFTER" | "OTHER";

export interface Photo {
  id: string;
  orderId: string;
  orderItemId: string | null;
  uploadedBy: string;
  uploadedAt: string;          // ISO-8601
  mime: string;
  sizeBytes: number;
  label: PhotoLabel;
  originalFilename: string;
  fileUrl: string;             // /api/admin/photos/{id}/file
}

export const PHOTO_LABEL_PL: Record<PhotoLabel, string> = {
  BEFORE: "Przed",
  IN_PROGRESS: "W trakcie",
  AFTER: "Po",
  OTHER: "Inne",
};

export const PHOTO_LABELS: PhotoLabel[] = ["BEFORE", "IN_PROGRESS", "AFTER", "OTHER"];
```

- [ ] **Step 2: Create api wrappers**

`apps/web/lib/photos/api.ts`:

```ts
import { apiClient } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type { Photo, PhotoLabel } from "./types";

const log = createLogger("photos-api");

export async function listPhotos(orderId: string): Promise<Photo[]> {
  log.info("op=photos.list", { orderId });
  return apiClient.get<Photo[]>(`/api/admin/orders/${orderId}/photos`);
}

export async function uploadPhoto(orderId: string, file: File,
                                  label: PhotoLabel,
                                  orderItemId: string | null = null): Promise<Photo> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  if (orderItemId) fd.append("orderItemId", orderItemId);
  log.info("op=photos.upload.start", { orderId, name: file.name, sizeBytes: file.size, label });
  return apiClient.postFormData<Photo>(`/api/admin/orders/${orderId}/photos`, fd);
}

export async function relabelPhoto(photoId: string, label: PhotoLabel): Promise<Photo> {
  log.info("op=photos.relabel", { photoId, label });
  return apiClient.patch<Photo>(`/api/admin/photos/${photoId}`, { label });
}

export async function deletePhoto(photoId: string): Promise<void> {
  log.info("op=photos.delete", { photoId });
  await apiClient.delete(`/api/admin/photos/${photoId}`);
}
```

**Subagent:** read `apps/web/lib/api.ts` to confirm `postFormData` exists. If it doesn't, add a small wrapper there (FormData posts skip JSON content-type so the browser sets the multipart boundary). Pattern:

```ts
async postFormData<T>(path: string, fd: FormData): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: this.csrfHeaders(),    // or whatever pattern the file already uses for CSRF
    credentials: "same-origin",
    body: fd,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/photos/ apps/web/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(web): apps/web/lib/photos types + api client

[milestone:3][task:3-8]

Photo + PhotoLabel + PHOTO_LABEL_PL + PHOTO_LABELS following the M1 1-12
domain-lib pattern. listPhotos / uploadPhoto / relabelPhoto / deletePhoto
wrap apiClient. uploadPhoto uses postFormData (added if missing) so the
browser sets the multipart boundary correctly.

Refs: docs/dispatch-log/3-8-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-9: `OrderDrawerPhotos` tab + `PhotoGrid` + `PhotoCard`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerPhotos.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/PhotoGrid.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/PhotoCard.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx` (add `Zdjęcia` tab)

- [ ] **Step 1: Author `PhotoCard` first (smallest unit)**

`apps/web/app/(admin)/admin/orders/_components/PhotoCard.tsx`:

```tsx
"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PHOTO_LABEL_PL, PHOTO_LABELS } from "@/lib/photos/types";

interface Props {
  photo: Photo;
  onClick: () => void;
  onRelabel: (label: PhotoLabel) => void;
  onDelete: () => void;
}

export function PhotoCard({ photo, onClick, onRelabel, onDelete }: Props) {
  return (
    <div className="relative aspect-square overflow-hidden rounded border bg-neutral-100">
      <img
        src={photo.fileUrl}
        alt={photo.originalFilename}
        loading="lazy"
        className="h-full w-full cursor-zoom-in object-cover"
        onClick={onClick}
      />
      <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
        {PHOTO_LABEL_PL[photo.label]}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90">
          ⋯
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[160px] rounded border bg-white p-1 shadow-lg">
            {PHOTO_LABELS.map((l) => (
              <DropdownMenu.Item
                key={l}
                disabled={l === photo.label}
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-neutral-100 data-[disabled]:opacity-40"
                onSelect={() => onRelabel(l)}
              >
                {PHOTO_LABEL_PL[l]}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
            <DropdownMenu.Item
              className="cursor-pointer rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
              onSelect={onDelete}
            >
              Usuń
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
```

LOC: ~50.

- [ ] **Step 2: Author `PhotoGrid`**

`apps/web/app/(admin)/admin/orders/_components/PhotoGrid.tsx`:

```tsx
"use client";

import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { PhotoCard } from "./PhotoCard";

interface Props {
  photos: Photo[];
  onCardClick: (p: Photo) => void;
  onRelabel: (p: Photo, label: PhotoLabel) => void;
  onDelete: (p: Photo) => void;
}

export function PhotoGrid({ photos, onCardClick, onRelabel, onDelete }: Props) {
  if (photos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        Brak zdjęć. Prześlij pierwsze zdjęcie.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {photos.map((p) => (
        <PhotoCard
          key={p.id}
          photo={p}
          onClick={() => onCardClick(p)}
          onRelabel={(label) => onRelabel(p, label)}
          onDelete={() => onDelete(p)}
        />
      ))}
    </div>
  );
}
```

LOC: ~30.

- [ ] **Step 3: Author `OrderDrawerPhotos` (orchestrator)**

`apps/web/app/(admin)/admin/orders/_components/OrderDrawerPhotos.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import type { Photo, PhotoLabel } from "@/lib/photos/types";
import { listPhotos, relabelPhoto, deletePhoto } from "@/lib/photos/api";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoUploader } from "./PhotoUploader";
import { PhotoLightbox } from "./PhotoLightbox";

const log = createLogger("order-drawer-photos");

export function OrderDrawerPhotos({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);

  async function refresh() {
    try {
      const list = await listPhotos(orderId);
      setPhotos(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się pobrać zdjęć.";
      log.warn("op=photos.list outcome=failed", { orderId, msg });
      setError(msg);
    }
  }

  useEffect(() => {
    refresh();
  }, [orderId]);

  async function onRelabel(p: Photo, label: PhotoLabel) {
    try {
      await relabelPhoto(p.id, label);
      await refresh();
    } catch (e) {
      log.warn("op=photos.relabel outcome=failed", { photoId: p.id });
      setError(e instanceof Error ? e.message : "Zmiana etykiety nie powiodła się.");
    }
  }

  async function onDelete(p: Photo) {
    if (!confirm("Usunąć zdjęcie? Tej akcji nie da się cofnąć.")) return;
    try {
      await deletePhoto(p.id);
      await refresh();
    } catch (e) {
      log.warn("op=photos.delete outcome=failed", { photoId: p.id });
      setError(e instanceof Error ? e.message : "Usunięcie nie powiodło się.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoUploader orderId={orderId} onUploaded={refresh} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {photos === null
        ? <p className="text-sm text-neutral-500">Ładowanie…</p>
        : <PhotoGrid photos={photos} onCardClick={setOpen} onRelabel={onRelabel} onDelete={onDelete} />}
      <PhotoLightbox photo={open} onClose={() => setOpen(null)} />
    </div>
  );
}
```

LOC: ~70.

- [ ] **Step 4: Wire `Zdjęcia` tab into `OrderDrawer`**

Modify `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`:

The drawer already has a tab strip. Find where tabs are declared (look for `Wiadomości` and `Audyt` strings or a `<Tabs>` component). Add a new tab `Zdjęcia` between body metadata and Wiadomości. Example pattern (subagent: read existing structure first and mirror it):

```tsx
// near the top, with other imports
import { OrderDrawerPhotos } from "./OrderDrawerPhotos";

// inside the tabs body, between metadata and Wiadomości:
{tab === "photos" && <OrderDrawerPhotos orderId={order.id} />}
```

If the existing tabs use a strict union type (e.g. `type DrawerTab = "messages" | "timeline"`), extend it: `"photos" | "messages" | "timeline"`. Add a tab button:

```tsx
<button
  onClick={() => setTab("photos")}
  className={tab === "photos" ? "tab-active" : "tab-inactive"}
>
  Zdjęcia
</button>
```

Match the existing className convention; replace `tab-active` / `tab-inactive` with whatever the file already uses.

- [ ] **Step 5: Typecheck + manual smoke**

```bash
cd apps/web && pnpm typecheck && pnpm lint
```
Expected: zero errors.

Manual smoke (defer to task 3-13 final smoke; do NOT block this commit on it).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerPhotos.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/PhotoGrid.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/PhotoCard.tsx \
        apps/web/app/\(admin\)/admin/orders/_components/OrderDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(web): OrderDrawerPhotos tab + grid + card

[milestone:3][task:3-9]

Adds Zdjęcia tab to OrderDrawer between metadata and Wiadomości. Tab body
fetches via listPhotos(orderId), renders PhotoGrid with PhotoCards. Each
card has a Radix DropdownMenu for relabel and delete; click image opens
PhotoLightbox (added in 3-11). Empty state: 'Brak zdjęć. Prześlij pierwsze
zdjęcie.' Polish copy throughout.

Refs: docs/dispatch-log/3-9-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-10: `PhotoUploader`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/PhotoUploader.tsx`

- [ ] **Step 1: Author the uploader**

`apps/web/app/(admin)/admin/orders/_components/PhotoUploader.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { createLogger } from "@/lib/log";
import type { PhotoLabel } from "@/lib/photos/types";
import { PHOTO_LABEL_PL, PHOTO_LABELS } from "@/lib/photos/types";
import { uploadPhoto } from "@/lib/photos/api";

const log = createLogger("photo-uploader");

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

interface Props {
  orderId: string;
  onUploaded: () => void;
}

interface ProgressItem { name: string; status: "pending" | "ok" | "err"; reason?: string; }

export function PhotoUploader({ orderId, onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<PhotoLabel>("OTHER");
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    const arr = Array.from(files);
    const next: ProgressItem[] = arr.map((f) => ({ name: f.name, status: "pending" }));
    setItems(next);

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      try {
        await uploadPhoto(orderId, f, label);
        next[i] = { name: f.name, status: "ok" };
      } catch (e) {
        const reason = e instanceof Error ? e.message : "unknown";
        log.warn("op=photo.upload outcome=failed", { name: f.name, reason });
        next[i] = { name: f.name, status: "err", reason };
      }
      setItems([...next]);
    }
    setBusy(false);
    onUploaded();
    if (next.every((i) => i.status === "ok")) {
      setOpen(false);
      setItems([]);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
      >
        Prześlij zdjęcia
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 p-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        Etykieta:
        <select
          value={label}
          onChange={(e) => setLabel(e.target.value as PhotoLabel)}
          className="rounded border px-2 py-1"
        >
          {PHOTO_LABELS.map((l) => (
            <option key={l} value={l}>{PHOTO_LABEL_PL[l]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Przesyłanie…" : "Prześlij"}
        </button>
        <button
          onClick={() => { setOpen(false); setItems([]); }}
          disabled={busy}
          className="rounded border px-3 py-1 text-sm"
        >
          Anuluj
        </button>
      </div>
      {items.length > 0 && (
        <ul className="text-xs">
          {items.map((it, i) => (
            <li key={i} className={it.status === "err" ? "text-red-600" : it.status === "ok" ? "text-green-700" : "text-neutral-500"}>
              {it.status === "ok" ? "✓ " : it.status === "err" ? "✗ " : "… "}
              {it.name}
              {it.reason && `: ${it.reason}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

LOC: ~95. Slightly over 80-LOC soft cap; documented in dispatch log.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/PhotoUploader.tsx
git commit -m "$(cat <<'EOF'
feat(web): PhotoUploader component

[milestone:3][task:3-10]

Multi-file upload via native <input multiple accept=image/...> with label
picker. Serial uploads (one POST per file); per-file progress shown in a
status list. Errors don't block remaining files. On all-ok, uploader auto-
closes and parent refresh is triggered via onUploaded callback. Polish copy.

Refs: docs/dispatch-log/3-10-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-11: `PhotoLightbox`

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/PhotoLightbox.tsx`

- [ ] **Step 1: Author the lightbox**

`apps/web/app/(admin)/admin/orders/_components/PhotoLightbox.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { Photo } from "@/lib/photos/types";
import { PHOTO_LABEL_PL } from "@/lib/photos/types";

interface Props {
  photo: Photo | null;
  onClose: () => void;
}

export function PhotoLightbox({ photo, onClose }: Props) {
  return (
    <Dialog.Root open={photo !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 outline-none">
          <Dialog.Title className="sr-only">{photo?.originalFilename ?? "Zdjęcie"}</Dialog.Title>
          {photo && (
            <>
              <img
                src={photo.fileUrl}
                alt={photo.originalFilename}
                className="max-h-[85vh] max-w-[90vw] object-contain"
              />
              <div className="mt-4 rounded bg-white/10 px-3 py-1.5 text-xs text-white">
                {photo.originalFilename} • {PHOTO_LABEL_PL[photo.label]} • {(photo.sizeBytes / 1024).toFixed(0)} KB
              </div>
            </>
          )}
          <Dialog.Close className="absolute right-4 top-4 rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20">
            Zamknij
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

LOC: ~35.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/PhotoLightbox.tsx
git commit -m "$(cat <<'EOF'
feat(web): PhotoLightbox — Radix Dialog full-size view

[milestone:3][task:3-11]

Click any photo card → full-size view in a modal. Esc / click overlay /
'Zamknij' button to close. Metadata strip shows filename, Polish label, KB.

Refs: docs/dispatch-log/3-11-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3-12: `KIND_LABELS_PL` extension for PHOTO_* timeline kinds

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`

- [ ] **Step 1: Read the file to find `KIND_LABELS_PL`**

```bash
grep -n "KIND_LABELS_PL\|MESSAGE_SENT\|STATUS_CHANGED" apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerTimeline.tsx
```

- [ ] **Step 2: Extend the map**

Find the `KIND_LABELS_PL: Record<TimelineEventKind, ...>` declaration. Add three entries:

```tsx
  PHOTO_UPLOADED: "Przesłano zdjęcie",
  PHOTO_DELETED: "Usunięto zdjęcie",
  PHOTO_RELABELED: "Zmieniono etykietę zdjęcia",
```

If `TimelineEventKind` is a discriminated union type imported from `@/lib/timeline/types`, extend it there too:

```ts
export type TimelineEventKind =
  | "STATUS_CHANGED"
  | "ITEM_ADDED"
  | "ITEM_UPDATED"
  | "ITEM_REMOVED"
  | "MESSAGE_SENT"
  | "PHOTO_UPLOADED"
  | "PHOTO_DELETED"
  | "PHOTO_RELABELED";
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors. If a `Record<TimelineEventKind, string>` lints because some kind is missing a label, that's the type system catching the gap — fill in any missing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerTimeline.tsx \
        apps/web/lib/timeline/types.ts
git commit -m "$(cat <<'EOF'
feat(web): timeline labels for PHOTO_UPLOADED / PHOTO_DELETED / PHOTO_RELABELED

[milestone:3][task:3-12]

Extends TimelineEventKind union and KIND_LABELS_PL map so photo events
surface as Polish strings ('Przesłano zdjęcie', 'Usunięto zdjęcie',
'Zmieniono etykietę zdjęcia') in the existing Audyt tab.

Refs: docs/dispatch-log/3-12-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 5 — Closure

### Task 3-13: Smoke + milestone-3 tag + CLAUDE.md flip

**Files:**
- Modify: `CLAUDE.md` (status block)

- [ ] **Step 1: Run full backend suite**

```bash
cd backend && mvn verify
```
Expected: all green, ~162/0/0/0.

- [ ] **Step 2: Run frontend typecheck + lint + build**

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm build
```
Expected: zero errors, build succeeds.

- [ ] **Step 3: Smoke (docker compose)**

```bash
docker compose down -v
docker compose up -d --build
docker compose logs -f api &
LOGS_PID=$!
sleep 30
# Hit /api/health (added in 2-20) — should return 200 with status:UP
curl -fsS http://localhost:8080/api/health | jq .
# Manual UI smoke: log in as owner@drshoes.pl, open any order, click Zdjęcia tab,
# upload one image, verify it appears in grid, click to open lightbox, relabel,
# delete. Verify Audyt tab shows Przesłano/Zmieniono/Usunięto rows.
kill $LOGS_PID || true
docker compose down
```

If owner directs to skip smoke (per M2 precedent), record the deviation in the tag annotation message in step 4. Otherwise full smoke is required.

- [ ] **Step 4: Tag the milestone (local, NOT pushed)**

```bash
git tag -a milestone-3 -m "$(cat <<'EOF'
Milestone 3 — Photos + Actor Resolution

13 tasks across 5 waves. Suite: 150 → 162/0/0/0.

What shipped:
- Photos vertical (admin-only): upload via multipart, list, stream,
  relabel, delete. Hard delete (DB row + R2/MinIO object).
- backend/libs/storage extended with InputStream get(BlobKey).
- AdminPrincipal record carries userId/email/role through Spring Security
  Authentication; MessagesController retrofitted to use it.
  Audit rows now record real actor_id throughout.
- TimelineEventCurator dispatches PHOTO_UPLOADED / PHOTO_DELETED /
  PHOTO_RELABELED into the existing Audyt tab via path-pattern matching.
- OrderDrawer gained a Zdjęcia tab with grid, uploader, and lightbox.

Smoke: <green | skipped at owner direction>.

Deferred to later milestones: real providers (Postmark/SMSAPI), inbound
parsing, {link_do_zdjec} public gallery, trigger create/edit form,
manual-confirmation queue, calendar/kanban.
EOF
)"
```

- [ ] **Step 5: Flip status in CLAUDE.md**

In `CLAUDE.md`, find the `## Status` block and update:

```diff
- [x] Milestone 0A: foundation skeleton boots — health green, V001 applied, web renders
- [x] Milestone 0B: auth + RBAC + audit log + login UI + admin guard
- [x] Milestone 1: Order domain + drawer + audit timeline
- [x] Milestone 2: Messaging + triggers
-- [ ] Milestone 3: Real providers + photos
+- [x] Milestone 3: Photos + actor resolution
+- [ ] Milestone 4: Real email/SMS providers + inbound + manual-confirmation queue
```

- [ ] **Step 6: Commit and verify**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: mark Milestone 3 complete

[milestone:3][task:3-13]

Photos vertical + actor-resolution debt closed; M4 named (real providers +
inbound + manual-confirmation queue). Local tag milestone-3 created.

Refs: docs/dispatch-log/3-13-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git log --oneline -5
git tag --list 'milestone-*'
```
Expected: tag `milestone-3` listed, commit on `main`.

---

## Errata reservation (filled during execution)

| # | Source | Resolution |
|---|---|---|
| _e.g. JPA enum cast — actually need `@Type` for photo_label?_ | task 3-5 |   |
| _e.g. ApiClient.postFormData missing — added inline_ | task 3-8 |   |
| _e.g. AdminWebTestBase.loginAsOwner returns void — extended to UUID_ | task 3-4 |   |
