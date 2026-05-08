# Milestone 3 — Photos + Actor Resolution (design spec)

**Date:** 2026-05-09
**Author:** Opus + owner brainstorm
**Status:** Approved for planning
**Successor of:** [`2026-05-08-milestone-02-messaging-design.md`](./2026-05-08-milestone-02-messaging-design.md)

## 1. Objective

After M3, the craftsman can:

- Upload one or more photos to an order from inside the OrderDrawer (`Zdjęcia` tab).
- Tag each photo as `BEFORE`, `IN_PROGRESS`, `AFTER`, or `OTHER`; optionally tie to a specific `OrderItem`.
- View photos as a responsive grid; click any photo for a full-size lightbox.
- Relabel and delete photos (hard delete; audited).
- See photo events (`PHOTO_UPLOADED`, `PHOTO_DELETED`, `PHOTO_RELABELED`) in the existing `Audyt` timeline alongside `STATUS_CHANGED`, `ITEM_*`, and `MESSAGE_SENT`.

Companion fix landing in the same milestone:

- All audit and message rows now record the **real** authenticated `actorId` instead of `null`. Retrofits `MessagesController` and any other post-M2 controller that hardcoded `null`.

Deferred to later milestones (out of scope for M3):

- `{link_do_zdjec}` placeholder + public token gallery page.
- Real email/SMS providers (Postmark, SMSAPI), webhook receivers, inbound parsing.
- Trigger create/edit form with dynamic `event_params` editor.
- Manual-confirmation queue for triggers with `requires_manual_confirmation=true`.
- Server-side image processing (thumbnails, EXIF rotation).
- Drag-and-drop photo reordering.
- Calendar / kanban views.

## 2. Locked decisions (from brainstorm)

| # | Decision | Rationale |
|---|---|---|
| 1 | Multipart upload through Spring Boot proxy | One endpoint, one round-trip. No presigned URL choreography, no bucket CORS surgery. Phone-camera photos at 2–10MB are fine to proxy through the JVM. |
| 2 | No server-side thumbnails / image processing | Browser scales originals via CSS `object-fit`. Eliminates an entire class of complexity (ImageMagick / Imgscalr / async pipeline) for negligible UX cost in admin. |
| 3 | Hard delete (DB row + storage object) | Simple, no orphan storage costs. Audit log records the delete (photo id, label, s3_key, original_filename) so forensic recovery is possible from logs even though the bytes are gone. |
| 4 | Skip `{link_do_zdjec}` placeholder for M3 | Photos are admin-only. Public token-gallery page is a separate vertical (frontend public site, token issuance, scoping to `AFTER` label). Punted to a later milestone — unblocks M3. |
| 5 | Photos live in OrderDrawer as `Zdjęcia` tab | Keeps the order-centric workflow craftsmen know. No separate page to navigate to. |
| 6 | No drag-and-drop reorder; sort by `uploaded_at DESC` | Reorder requires a `position int` column + drag UI + reorder endpoint. None of this matters for a workshop with <30 photos per order. |
| 7 | New microlib `backend/libs/storage` (S3-compatible) | Pluggable across MinIO (local) and R2 (prod) via Spring profiles. Reusable in future projects per the messaging-core / email-gateway / sms-gateway pattern from M2. |
| 8 | Actor resolution piggybacks on M3 | One small change retrofits `@AuthenticationPrincipal` into post-M2 controllers. Not big enough to be its own milestone; rides along while we're touching auth-adjacent controllers anyway. |

## 3. Architecture

### 3.1 Photo lifecycle

```
Browser file input → multipart POST /api/admin/orders/{id}/photos
                          │
                          ▼
                  PhotoController.upload(@AuthenticationPrincipal AdminUser actor)
                          │
                          ▼
                  PhotoService.upload(orderId, itemId?, file, label, actorId)
                          │
                          ▼
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   StorageClient     PhotoRepo         AuditLogAspect
   .put(s3Key,       .save(photo)      writes PHOTO_UPLOADED
        bytes,                          row keyed to order
        size,
        mime)
```

`StorageClient.put` happens BEFORE `photoRepo.save`. If put fails, we never persist a row. If save fails after put, `@Transactional` rollback is logged with the orphan `s3_key` (the orphan is a one-line follow-up cleanup, not a system failure). This ordering avoids the worse alternative (DB row pointing at non-existent storage object).

### 3.2 Read path

`GET /api/admin/orders/{id}/photos` → list of `PhotoDto` (metadata only, no bytes). UI renders `<img src="/api/admin/photos/{id}/file" />` per card. The file endpoint streams from `StorageClient.get(s3Key)` with `Cache-Control: private, max-age=3600` and the original mime. No conditional GETs in M3 (no ETag); revisit if photos start coming up slow.

### 3.3 Storage microlib

```java
package pl.drshoes.storage;

public interface StorageClient {
    StoredObject put(String key, InputStream bytes, long size, String mime);
    InputStream get(String key);              // throws StorageNotFound if missing
    void delete(String key);                  // idempotent, swallows NotFound
    record StoredObject(String key, long size, String mime) {}
}

@AutoConfiguration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageAutoConfiguration {
    @Bean S3Client s3Client(StorageProperties p);
    @Bean StorageClient storageClient(S3Client s3, StorageProperties p);
}

@ConfigurationProperties("storage")
public record StorageProperties(
    String endpoint,        // local: http://minio:9000;  prod: https://<acct>.r2.cloudflarestorage.com
    String region,          // local: us-east-1;          prod: auto
    String bucket,          // drshoes-photos
    String accessKey,
    String secretKey,
    boolean pathStyle       // local: true (MinIO);       prod: false (R2 supports virtual-host)
) {}
```

Single dependency: `software.amazon.awssdk:s3:2.x`. No region concerns (R2 ignores it, MinIO accepts `us-east-1`). The `pathStyle` flag is the only meaningful per-environment knob.

Tests live under the microlib module (`backend/libs/storage/src/test`) — Testcontainers `MinIOContainer` (3rd-party but well-maintained) or a hand-rolled MinIO container via `GenericContainer`. Plan time will pick one.

### 3.4 Photo entity + repo

```sql
CREATE TYPE photo_label AS ENUM ('BEFORE','IN_PROGRESS','AFTER','OTHER');

CREATE TABLE photo (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_item(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES admin_user(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  s3_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  label photo_label NOT NULL DEFAULT 'OTHER',
  original_filename TEXT NOT NULL
);

CREATE INDEX idx_photo_order ON photo(order_id, uploaded_at DESC);
```

`s3_key` format: `orders/{orderId}/{photoId}-{slugified-original-filename}`. The `photoId` segment guarantees uniqueness even if the same filename is uploaded twice. `slugified-original-filename` is for human inspection in MinIO console; not used by the app.

`ON DELETE CASCADE` on `order_id` matches the OrderItem cascade pattern from M1 — deleting an order removes its photos. `ON DELETE SET NULL` on `order_item_id` so item-level photos survive item deletion (rare; falls back to order-level grouping).

### 3.5 PhotoService API

```java
@Service
public class PhotoService {
    Photo upload(UUID orderId, @Nullable UUID itemId, MultipartFile file,
                 PhotoLabel label, UUID actorId);
    List<Photo> listForOrder(UUID orderId);
    InputStream stream(UUID photoId);          // for /file endpoint
    Photo relabel(UUID photoId, PhotoLabel newLabel, UUID actorId);
    void delete(UUID photoId, UUID actorId);
}
```

- `upload` validates mime allowlist + size, generates s3Key, calls `StorageClient.put`, persists row, fires audit `PHOTO_UPLOADED`.
- `delete` deletes row first (transactional), then `StorageClient.delete(s3Key)` post-commit. Storage delete failures log at WARN with the orphan key — not user-visible.
- `relabel` updates row, fires audit `PHOTO_RELABELED` with old/new labels.

Granularity target: PhotoService ~80 LOC, PhotoController ~70 LOC, S3StorageClient ~60 LOC.

### 3.6 PhotoController endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/admin/orders/{id}/photos` | multipart: `file`, `label`, optional `orderItemId` | `201 PhotoDto` |
| GET | `/api/admin/orders/{id}/photos` | — | `200 PhotoDto[]` |
| GET | `/api/admin/photos/{id}/file` | — | `200` binary stream + correct mime + `Cache-Control: private, max-age=3600` |
| PATCH | `/api/admin/photos/{id}` | `{label}` | `200 PhotoDto` |
| DELETE | `/api/admin/photos/{id}` | — | `204` |

`PhotoDto` shape:

```json
{
  "id": "uuid",
  "orderId": "uuid",
  "orderItemId": "uuid|null",
  "uploadedBy": "uuid",
  "uploadedAt": "iso8601",
  "mime": "image/jpeg",
  "sizeBytes": 1234567,
  "label": "BEFORE|IN_PROGRESS|AFTER|OTHER",
  "originalFilename": "IMG_1234.jpg",
  "fileUrl": "/api/admin/photos/{id}/file"
}
```

`fileUrl` is server-rendered (computed in DTO mapper). UI uses it directly in `<img src>`.

### 3.7 Validation + limits

| Constraint | Value | Error code |
|---|---|---|
| Allowed mime types | `image/jpeg`, `image/png`, `image/webp`, `image/heic` | 400 `Nieobsługiwany format pliku` |
| Max file size | 20MB (per file) | 413 `Plik jest zbyt duży (max 20MB)` |
| Order must exist | — | 404 |
| Order item (if provided) must belong to order | — | 400 `OrderItem nie należy do tego zamówienia` |
| Photo must exist | — | 404 |
| Bucket unreachable | — | 503 (read endpoint) / 500 + rollback (write endpoints) |

Spring's `MultipartProperties` set globally: `max-file-size=20MB`, `max-request-size=200MB` (allows ~10 photos per request — fine for craftsman picking a batch).

## 4. Frontend

### 4.1 Directory layout

```
web/lib/photos.ts                                — types + Polish labels (PHOTO_LABEL_PL)
web/lib/api/photos.ts                            — apiFetch wrappers
web/app/(admin)/orders/_drawer/
  ├ OrderDrawerPhotos.tsx                        — tab body
  ├ PhotoUploader.tsx                            — file input + label picker + submit
  ├ PhotoGrid.tsx                                — responsive grid
  ├ PhotoCard.tsx                                — img + label + actions
  └ PhotoLightbox.tsx                            — Radix Dialog full-size view
```

### 4.2 Tab integration

`OrderDrawer` already has a tab strip. Order:

1. Metadata (existing)
2. **Zdjęcia** *(new)*
3. Wiadomości (existing, M2)
4. Audyt (existing, M1)

Tab switching is local state (`useState<DrawerTab>`); content is lazy — `OrderDrawerPhotos` only fetches when tab is active.

### 4.3 Upload UX

- Single button: `Prześlij zdjęcia`
- Click → reveals an inline section: `<input type=file multiple accept=...>` + label dropdown + optional item dropdown + submit (`Prześlij`) / cancel (`Anuluj`)
- On submit: serial multipart POSTs (one per file). Per-file progress text: `Przesyłanie: 3 z 5 (IMG_1234.jpg)`.
- Per-file errors don't block remaining files. Toast at end summarizes: `Przesłano 4 z 5 zdjęć. Błędy: 1.` Click → expand details.
- On any successful upload, mutate the SWR cache for `photos(orderId)` to refetch list.

### 4.4 Grid + lightbox

- `PhotoGrid` is `display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));`
- Each `PhotoCard` is fixed-aspect (1:1) using `aspect-ratio: 1`, `object-fit: cover`. Label badge top-left, action menu top-right (Radix DropdownMenu with `Zmień etykietę` and `Usuń`).
- Click photo body → `PhotoLightbox` (Radix Dialog) with full-size image and metadata strip below (filename, size, uploaded by + when, label).

### 4.5 Polish copy (UI strings)

| Key | Polish |
|---|---|
| Tab label | `Zdjęcia` |
| Empty state | `Brak zdjęć. Prześlij pierwsze zdjęcie.` |
| Upload trigger | `Prześlij zdjęcia` |
| Upload submit | `Prześlij` |
| Upload cancel | `Anuluj` |
| Upload progress | `Przesyłanie: {n} z {total} ({filename})` |
| Upload summary success | `Przesłano {n} z {total} zdjęć.` |
| Upload summary mixed | `Przesłano {ok} z {total} zdjęć. Błędy: {err}.` |
| Per-file error | `Nie udało się przesłać {filename}: {reason}` |
| Label picker | `Etykieta` |
| Item picker | `Powiąż z elementem (opcjonalnie)` |
| Item picker default | `Całe zamówienie` |
| Label PL — BEFORE | `Przed` |
| Label PL — IN_PROGRESS | `W trakcie` |
| Label PL — AFTER | `Po` |
| Label PL — OTHER | `Inne` |
| Delete confirm title | `Usunąć zdjęcie?` |
| Delete confirm body | `Tej akcji nie da się cofnąć.` |
| Delete confirm submit | `Usuń` |
| Delete confirm cancel | `Anuluj` |

### 4.6 Audit timeline labels

Extend `KIND_LABELS_PL` in `web/lib/timeline.ts`:

| Kind | Polish |
|---|---|
| `PHOTO_UPLOADED` | `Przesłano zdjęcie` |
| `PHOTO_DELETED` | `Usunięto zdjęcie` |
| `PHOTO_RELABELED` | `Zmieniono etykietę zdjęcia` |

Each timeline row's body composes from `payload` (e.g. `{originalFilename} ({label})`).

## 5. Actor resolution (companion fix)

### 5.1 Today (M2 debt)

`MessagesController.send` and likely a few other places hardcode `actorId=null` because `JwtAuthenticationFilter` puts a String subject in the principal slot, not an `AdminUser`. Audit and message rows then record null actor — forensically useless.

### 5.2 Fix

Two-step:

1. **Tighten `JwtAuthenticationFilter`** to load the full `AdminUser` once per request and put it in `Authentication.getPrincipal()`. Existing M0B test coverage gets an assertion: `principal instanceof AdminUser`. Token claim `sub` (UUID) → `AdminUserRepo.findById`. If user not found / disabled → 401.

2. **Retrofit controllers** that need actor:

   ```java
   @PostMapping
   public PhotoDto upload(@PathVariable UUID orderId,
                          @AuthenticationPrincipal AdminUser actor,
                          ...) {
       return mapper.toDto(photoService.upload(orderId, null, file, label, actor.getId()));
   }
   ```

3. **Sweep step:** at plan time, grep `api/` for `actorId = null`, `null /* actor */`, `UUID actorId = null`, etc. Every hit gets converted. Test for each retrofit: integration test asserts `audit_event.actor_id IS NOT NULL` after the mutation.

### 5.3 Scope of sweep

Confirmed targets (will verify at plan time):

- `MessagesController.send` (M2 debt)
- New `PhotoController` (M3)

Likely targets (will verify at plan time):

- Anywhere in M2 trigger machinery currently using a system actor — if scheduled triggers fire from a daemon thread without auth context, that's still legitimately null (system action). Plan task will distinguish "user-initiated null is a bug" vs "system-initiated null is correct" and tag the latter explicitly with `actorId = SYSTEM_ACTOR_ID` constant.

## 6. Audit + observability

| Audit kind | Payload |
|---|---|
| `PHOTO_UPLOADED` | `{photoId, orderId, orderItemId?, label, mime, sizeBytes, originalFilename}` |
| `PHOTO_DELETED` | `{photoId, orderId, label, originalFilename, s3Key}` |
| `PHOTO_RELABELED` | `{photoId, orderId, oldLabel, newLabel}` |

Logging — every PhotoService method emits at least one INFO line per call:

```
log.info("op=photo.upload outcome=success", "photoId", id, "orderId", oid, "actorId", aid, "sizeBytes", n, "mime", m);
log.info("op=photo.delete outcome=success", "photoId", id, "orderId", oid, "actorId", aid);
log.info("op=photo.delete outcome=storage_orphan_failed", "photoId", id, "s3Key", k, "exception", ex);
log.warn("op=photo.upload outcome=storage_failed", "orderId", oid, "actorId", aid, "exception", ex);
```

## 7. Local dev wiring

`docker-compose.yml`:

```yaml
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: drshoes
      MINIO_ROOT_PASSWORD: drshoes-dev
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio-data:/data]
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      retries: 3

  minio-init:
    image: minio/mc:latest
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: >
      sh -c "
      mc alias set local http://minio:9000 drshoes drshoes-dev &&
      mc mb -p local/drshoes-photos
      "
volumes:
  minio-data:
```

`application-local.yml`:

```yaml
storage:
  endpoint: http://minio:9000
  region: us-east-1
  bucket: drshoes-photos
  access-key: drshoes
  secret-key: drshoes-dev
  path-style: true
```

`application-prod.yml.example`:

```yaml
storage:
  endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
  region: auto
  bucket: drshoes-photos
  access-key: ${R2_ACCESS_KEY_ID}
  secret-key: ${R2_SECRET_ACCESS_KEY}
  path-style: false
```

Secrets are env vars at runtime, not committed.

## 8. Testing strategy

| Layer | Coverage |
|---|---|
| `backend/libs/storage` unit/integration | Spin a MinIO Testcontainers; round-trip put/get/delete; assert NotFound on missing; assert idempotent delete |
| `PhotoService` unit | Mock `StorageClient`; assert validation rejects bad mime/size; assert audit emit; assert ordering (storage put before db save; db delete before storage delete) |
| `PhotoControllerTest extends AbstractIntegrationTest` | Real Postgres + MinIO containers; round-trip all 5 endpoints; assert PhotoDto.fileUrl format; assert mime preserved through `/file` endpoint; assert audit row created with non-null actor_id |
| Actor-resolution integration | Hit `MessagesController.send` and `PhotoController.upload` with a JWT; assert `audit_event.actor_id` matches user id |
| Frontend | No unit tests (existing project pattern); manual smoke covers golden path. Playwright is post-M3 follow-up if desired. |

Final suite target: 150 → ~170+ tests across M3.

## 9. Errata reservation

Plan will include an `# Errata` section that gets appended during implementation. Known reconciliations expected:

- AWS SDK v2 vs v1 choice — v2 is current; spec assumes v2.
- Audit-event payload JSON structure may need a discriminator if existing M1/M2 events don't include one.
- Whether HEIC is universally browser-displayable (Safari yes; Chrome/Firefox partial). If renders fail, accept HEIC for upload but flag as "view in another app" — not a blocker for M3.

## 10. Task breakdown (preview — locks in writing-plans phase)

| Wave | ~Tasks | Theme |
|---|---|---|
| 1 — Infra | 3-1 V009 photo migration · 3-2 storage microlib + autoconfig · 3-3 docker-compose MinIO + bucket init | Foundation |
| 2 — Backend domain | 3-4 Photo entity + repo · 3-5 PhotoService + audit · 3-6 PhotoController + integration tests | Vertical: backend |
| 3 — Actor resolution | 3-7 `@AuthenticationPrincipal AdminUser` retrofit + grep sweep + tests | Companion fix |
| 4 — Frontend | 3-8 lib/photos types + api · 3-9 OrderDrawerPhotos tab + grid · 3-10 PhotoUploader · 3-11 delete + relabel + lightbox · 3-12 audit timeline labels | Vertical: frontend |
| 5 — Closure | 3-13 smoke + milestone-3 tag + CLAUDE.md flip | — |

~13 tasks, 5 waves, two-stage review reserved for tasks with substantive logic (3-2 storage microlib, 3-5 PhotoService, 3-7 actor retrofit). All others get combined spec+quality review per dispatch protocol rule 4.
