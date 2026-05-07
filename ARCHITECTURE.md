# Dr Shoes — Architecture (v1, for sign-off)

**Status:** draft for owner sign-off. Locked decisions in `handoff/DECISIONS.md`. Functional spec in `handoff/BRIEF.md`. Visual contract in `handoff/design/`. After sign-off: `superpowers:writing-plans` → bite-sized tasks → Sonnet-dispatched implementation with TDD.

## Guiding principles

1. **Admin is the product.** Every architectural choice optimizes admin polish, density, and reliability. Public site is shippable but minimal.
2. **Boring monolith.** One Spring Boot service, one Postgres, one Next app. No microservices, no event sourcing, no GraphQL, no Kafka.
3. **Microlibraries where reuse is real.** Email gateway and SMS gateway extracted as standalone Maven artifacts so Misza can drop them into future projects unchanged.
4. **Audit everything.** Every write to an order produces an `OrderEvent`. Status, storage, photos, notes, messages — all traceable, all visible in the drawer timeline.
5. **Free transitions, gated sends.** Status moves are unrestricted; outbound customer messages always go through a confirmation modal with preview.
6. **Polish UX > English code.** All UI strings in `pl.json`. Code, identifiers, comments, commits in English.

---

## Repository layout

```
misza_madafaka/
├── ARCHITECTURE.md
├── CLAUDE.md
├── README.md                       (top-level run instructions)
├── DEMO.md                         (added at end — click-through script)
├── docker-compose.yml              (local dev: postgres + minio + backend + web)
├── .env.example
├── .superpowers/                   (bound methodology, v5.1.0)
├── handoff/                        (original brief, design, decisions)
│
├── backend/
│   ├── pom.xml                     (parent POM, multi-module)
│   ├── app/                        (Spring Boot application — the deployable)
│   │   ├── pom.xml
│   │   └── src/{main,test}/...
│   └── libs/
│       ├── messaging-core/         (interfaces, no Spring deps)
│       ├── email-gateway/          (Postmark + SMTP + no-op + Spring Boot autoconfig)
│       ├── sms-gateway/            (SMSAPI.pl + Twilio + no-op + Spring Boot autoconfig)
│       └── storage/                (S3-compatible blob storage + Spring Boot autoconfig)
│
├── apps/
│   └── web/                        (Next.js 16, public + admin in route groups)
│       ├── app/
│       │   ├── (public)/           (landing, news, shop, contact, intake)
│       │   └── (admin)/admin/      (auth-gated SPA-style admin)
│       ├── components/
│       ├── lib/
│       └── ...
│
├── packages/
│   ├── ui/                         (shared design-system primitives + Tailwind preset)
│   └── api-types/                  (TypeScript types generated from backend OpenAPI)
│
└── infra/
    ├── cloudflare/                 (wrangler.toml per service, container manifests)
    ├── ci/                         (.github/workflows/ build + test + deploy)
    └── seeds/                      (SQL + photo fixtures)
```

**Why monorepo:** shared types between BE and FE, single CI pipeline, atomic cross-cutting changes (e.g. add a field on an entity → migration + DTO + UI all in one PR).

**Build orchestration:**
- Maven for `backend/**` (parent POM with `<modules>`).
- Turborepo + pnpm for `apps/**` and `packages/**`.
- Top-level `Makefile` exposes `make up`, `make test`, `make build` so devs don't need to memorize.

---

## Backend modules (Maven)

### `backend/app` — the deployable Spring Boot application

Inside `app`, code is organized by **feature package**, not by layer:

```
com.drshoes.app
├── config/                 (security, web, jackson, openapi, scheduler)
├── auth/                   (login, session, csrf, rbac)
├── users/                  (User entity + admin user CRUD)
├── clients/
├── orders/
│   ├── api/                (controllers + DTOs)
│   ├── domain/             (Order, OrderItem, OrderEvent, OrderStatus enum)
│   ├── service/            (OrderService, StatusTransitionService, OrderEventLogger)
│   └── persistence/        (JPA repositories, Specifications for filters)
├── photos/
├── storage_locations/
├── messaging/              (threads, messages, templates — wires messaging-core)
├── triggers/               (trigger engine, scheduler, manual-confirm queue)
├── reservations/
├── products/               (sklep)
├── news/
├── contact/
├── dashboard/              (read-side aggregates)
└── audit/                  (OrderEvent + cross-entity audit hooks)
```

**Persistence:** Spring Data JPA + Hibernate. **Migrations:** Flyway. **Validation:** Bean Validation (Jakarta). **Mapping:** MapStruct for entity↔DTO. **OpenAPI:** springdoc-openapi → spec at `/v3/api-docs` → consumed by `packages/api-types` codegen.

### `backend/libs/messaging-core`

Pure Java interfaces and value types. Zero Spring deps so it's reusable from any Java context.

```java
package com.drshoes.lib.messaging;

public interface MessageGateway {
    DeliveryReceipt send(OutboundMessage message);
}

public record OutboundMessage(
    Channel channel,           // EMAIL | SMS | WHATSAPP
    String recipient,          // email or E.164 phone
    String subject,            // null for SMS
    String body,
    List<Attachment> attachments,
    String idempotencyKey
) {}

public record DeliveryReceipt(
    String providerMessageId,
    DeliveryStatus initialStatus,  // QUEUED | SENT | FAILED
    Instant acceptedAt,
    String errorCode,
    String errorMessage
) {}

public enum DeliveryStatus { QUEUED, SENT, DELIVERED, FAILED, READ }
public enum Channel { EMAIL, SMS, WHATSAPP }
```

Webhook payload normalizer interface for inbound delivery + reply events also lives here.

### `backend/libs/email-gateway`

Implements `MessageGateway` for `Channel.EMAIL`. Exports `EmailGateway` marker subtype. Spring Boot autoconfiguration:

```yaml
drshoes:
  email:
    provider: postmark        # postmark | smtp | noop
    from: "studio@drshoes.pl"
    postmark:
      server-token: ${POSTMARK_TOKEN}
    smtp:
      host: ...
```

Implementations: `PostmarkEmailGateway`, `SmtpEmailGateway` (Spring Mail), `LoggingEmailGateway` (logs + skips, used in tests + dev). Webhooks normalized to `DeliveryReceipt` updates.

### `backend/libs/sms-gateway`

Same shape, for `Channel.SMS`. Implementations: `SmsApiPlGateway`, `TwilioSmsGateway`, `LoggingSmsGateway`. Auto-segmentation (warns above 160 chars; preserves UTF-8 GSM-7 detection). Inbound webhook normalizer.

### `backend/libs/storage`

S3-compatible blob storage abstraction. AWS SDK v2 client targeting any S3-compatible endpoint (R2, MinIO, Hetzner OS, AWS).

```java
public interface BlobStorage {
    String put(BlobKey key, InputStream stream, BlobMetadata meta);
    PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected);
    PresignedUrl presignGet(BlobKey key, Duration ttl);
    void delete(BlobKey key);
    boolean exists(BlobKey key);
}
```

Used for order photos, product photos, news images, contact-inquiry attachments.

---

## Domain model (refined ERD)

```
User ─────────────────────┐
  ├─ assigned_craftsman_id├──> Order
  └─ actor_id              │       │
                           │       ├─ OrderItem
Client ────────────────┐   │       ├─ Photo
  ├─> Order ───────────┤   │       ├─ InternalNote
  ├─> Reservation      │   │       ├─ Message (also via MessageThread)
  └─> MessageThread    │   │       ├─ OrderEvent (audit timeline)
        └─> Message ───┤   │       ├─ assigned_craftsman_id ─> User
                       │   │       └─ current_storage_location_id ─> StorageLocation
Product ──> ProductPhoto                                          │
   └─> Reservation                                                │
                                                       StorageLocation
NewsPost ──> NewsPhoto

Trigger ──> MessageTemplate
Message  ──> MessageTemplate (optional)
Message  ──> Trigger          (optional)

ContactInquiry  (standalone)
SavedFilter     (per User)
ScheduledMessage (trigger engine durable queue)
```

### Changes from `handoff/DATA_MODEL.md`

**Status enum** adds `WSTEPNIE_PRZYJETE` as the public-intake initial state:

```
WSTEPNIE_PRZYJETE → PRZYJETE → W_REALIZACJI → CZEKA_NA_KLIENTA →
GOTOWE_DO_ODBIORU → WYDANE
                       ANULOWANE  (terminal, reachable from anywhere)
```

Transitions are unrestricted. The status transition service performs four jobs on every change:
1. update `Order.status`
2. write an `OrderEvent` row (`type=STATUS_CHANGED`, before/after, actor, note)
3. find matching enabled `Trigger` rows (`event=STATUS_CHANGE`, `event_params.to_status=<new>`)
4. **return** the matched trigger + a rendered preview to the caller; the caller (UI) decides whether to send

The status change is **persisted immediately**; the message is **never auto-sent without confirmation** unless the trigger has `requires_manual_confirmation=false` AND `delay_minutes=0`. Even then, the API response includes the rendered message so the UI can show "wysłano: …".

### New entity — `OrderEvent` (the audit timeline)

```sql
CREATE TABLE order_event (
  id           UUID PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES order_(id),
  actor_id     UUID REFERENCES user_(id),       -- nullable for system actions
  type         VARCHAR(40) NOT NULL,            -- enum below
  payload      JSONB NOT NULL DEFAULT '{}',     -- typed by `type`
  message      TEXT,                            -- optional human note
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_event_order_idx ON order_event(order_id, created_at DESC);
```

`type` values:
`ORDER_CREATED`, `STATUS_CHANGED`, `STORAGE_MOVED`, `ASSIGNEE_CHANGED`, `SCHEDULE_CHANGED`, `ITEM_ADDED`, `ITEM_UPDATED`, `ITEM_REMOVED`, `PHOTO_ADDED`, `PHOTO_LABELED`, `PHOTO_REMOVED`, `NOTE_ADDED`, `MESSAGE_SENT`, `MESSAGE_RECEIVED`, `TAG_ADDED`, `TAG_REMOVED`, `CANCELLED`, `RESTORED`.

Append-only — no UPDATE or DELETE. Future: extend to `client_event`, `product_event` if needed; for v1 only orders carry an event log.

### New entity — `StorageLocation`

```sql
CREATE TABLE storage_location (
  id          UUID PRIMARY KEY,
  code        VARCHAR(32) UNIQUE NOT NULL,    -- e.g. "REGAL_A", "POLKA_3"
  name        VARCHAR(100) NOT NULL,           -- "Regał A — naprawy"
  description TEXT,
  color       VARCHAR(16),                     -- optional hex for chip
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE order_ ADD COLUMN current_storage_location_id UUID
  REFERENCES storage_location(id);
```

Admin manages locations under Ustawienia → Lokalizacje. Order detail drawer shows current location chip + dropdown to move; move writes `OrderEvent(type=STORAGE_MOVED, payload={from_id, to_id})`.

### New entity — `ScheduledMessage` (trigger engine queue)

```sql
CREATE TABLE scheduled_message (
  id              UUID PRIMARY KEY,
  trigger_id      UUID REFERENCES trigger_(id),
  order_id        UUID REFERENCES order_(id),
  client_id       UUID NOT NULL REFERENCES client(id),
  channel         VARCHAR(16) NOT NULL,
  template_id     UUID NOT NULL REFERENCES message_template(id),
  rendered_subject TEXT,
  rendered_body   TEXT NOT NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  state           VARCHAR(16) NOT NULL,    -- PENDING | AWAITING_CONFIRM | SENT | DISCARDED | FAILED
  requires_manual_confirmation BOOLEAN NOT NULL,
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scheduled_message_due_idx
  ON scheduled_message(state, scheduled_for) WHERE state IN ('PENDING','AWAITING_CONFIRM');
```

Why a durable table instead of in-memory scheduler: restart-safe, observable, replayable, no Quartz/Redis dep.

### Naming note
`order` is reserved in SQL — table name is `order_` (trailing underscore). Same for `user_`. JPA entity remains `Order` / `User`.

---

## REST API surface (refined)

Base: `/api`. Public under `/api/public`, admin under `/api/admin` (auth required, RBAC enforced). All datetimes ISO-8601 UTC. All money as `{ amount: 4250, currency: "PLN" }` (cents). Pagination `?page=0&size=25` → `{ content, page, size, totalPages, totalElements }`.

### Auth
```
POST   /api/admin/auth/login          -> 204 + Set-Cookie session, X-CSRF-Token in header
POST   /api/admin/auth/logout         -> 204
GET    /api/admin/auth/me             -> { id, email, fullName, role, lastLoginAt }
```

### Public
```
GET    /api/public/products?brand&size&minPrice&maxPrice&status
GET    /api/public/products/{id}
POST   /api/public/products/{id}/reservations          (idempotency key required)
GET    /api/public/news?page&size
GET    /api/public/news/{slug}
POST   /api/public/contact                              (multipart, optional photo)
POST   /api/public/service-requests                     (NEW — public service intake → WSTEPNIE_PRZYJETE order)
```

`POST /api/public/service-requests` body:
```json
{
  "kind": "NAPRAWA | CUSTOM_BUTY | CUSTOM_KURTKA",
  "description": "...",
  "client": { "firstName", "lastName", "phone", "email", "preferredChannel" },
  "preferredPickupDate": "2026-05-15",
  "photos": ["<presigned-uploaded-key>", ...]
}
```
Server creates a `Client` (or reuses by phone+email match), creates an `Order` with status `WSTEPNIE_PRZYJETE`, links uploaded photos. Returns `{ orderCode, message: "Dziękujemy, skontaktujemy się wkrótce." }`.

### Admin — Orders
```
GET    /api/admin/orders                  filters: status, kind, craftsmanId, from, to,
                                                   clientId, tag, q, preset, storageId
POST   /api/admin/orders
GET    /api/admin/orders/{id}             includes items, photos, notes, events, messages
PATCH  /api/admin/orders/{id}             body: any subset of mutable fields
DELETE /api/admin/orders/{id}             OWNER only — soft delete
POST   /api/admin/orders/{id}/items
PATCH  /api/admin/orders/{id}/items/{itemId}
DELETE /api/admin/orders/{id}/items/{itemId}
POST   /api/admin/orders/{id}/photos      multipart OR presigned-url completion
PATCH  /api/admin/orders/{id}/photos/{photoId}    label, position
DELETE /api/admin/orders/{id}/photos/{photoId}
POST   /api/admin/orders/{id}/notes
GET    /api/admin/orders/{id}/events      (paginated event timeline)

POST   /api/admin/orders/{id}/status      body: { toStatus, note? }
                                          -> { order, matchedTrigger?, renderedMessage?, scheduledMessageId? }

POST   /api/admin/orders/{id}/storage     body: { storageLocationId | null, note? }
POST   /api/admin/orders/{id}/schedule    body: { plannedPickupAt }
POST   /api/admin/orders/{id}/assign      body: { craftsmanId | null }
POST   /api/admin/orders/{id}/messages    body: { channel, templateId?, body, subject?, attachments }
POST   /api/admin/orders/{id}/restore     OWNER only — un-cancel
```

### Admin — Calendar / Kanban
```
GET    /api/admin/orders/calendar?from&to
PATCH  /api/admin/orders/{id}/schedule
GET    /api/admin/orders/kanban
```

### Admin — Storage Locations (NEW)
```
GET    /api/admin/storage-locations
POST   /api/admin/storage-locations         OWNER only
PATCH  /api/admin/storage-locations/{id}    OWNER only
DELETE /api/admin/storage-locations/{id}    OWNER only — soft, only if no orders reference
```

### Admin — RBAC / Users
```
GET    /api/admin/users                     OWNER only
POST   /api/admin/users                     OWNER only
PATCH  /api/admin/users/{id}                OWNER only (password reset, role, deactivate)
```

### Admin — Clients, Products, News
Per `handoff/API_SURFACE.md`. DELETE on any of these = OWNER only. EMPLOYEE may PATCH.

### Admin — Messaging
```
GET    /api/admin/threads?filter&channel
GET    /api/admin/threads/{id}
POST   /api/admin/threads/{id}/messages
POST   /api/admin/messages/preview          (NEW — render a template against an order without sending)
```

### Admin — Templates / Triggers
Per spec. EMPLOYEE = read-only. OWNER = full CRUD + enable/disable.

```
GET    /api/admin/scheduled-messages                  (manual-confirm queue + upcoming)
                  ?state=AWAITING_CONFIRM|PENDING|...
POST   /api/admin/scheduled-messages/{id}/send        confirm + send now
POST   /api/admin/scheduled-messages/{id}/discard
POST   /api/admin/scheduled-messages/{id}/edit-and-send
                                          body: { channel?, subject?, body? }
```

### Webhooks (inbound)
```
POST   /api/webhooks/email/postmark        verified via signature header
POST   /api/webhooks/sms/smsapi-pl
POST   /api/webhooks/sms/twilio
```
Normalizer maps to `DeliveryReceipt` updates + creates inbound `Message` rows on reply.

### Errors
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [...] } }
```
HTTP statuses: `400` malformed, `401` unauth, `403` RBAC, `404` not found, `409` conflict (e.g. reservation race), `422` validation, `429` rate-limit, `500` server.

### Idempotency
`POST /api/public/products/{id}/reservations`, `POST /api/public/service-requests`, `POST /api/admin/orders/{id}/messages`, `POST /api/admin/scheduled-messages/{id}/send` accept `Idempotency-Key` header. Backend stores key + response hash for 24h.

---

## Auth & RBAC

### Sessions
- Spring Session JDBC with `spring_session` + `spring_session_attributes` tables.
- Cookie: `dr_session`, HTTP-only, `SameSite=Lax`, `Secure`, 7-day expiry, sliding 30min idle timeout.
- CSRF: double-submit cookie. On login response, server sets `XSRF-TOKEN` (readable cookie) and Spring Security verifies the `X-XSRF-TOKEN` header on every non-GET. Frontend auto-attaches via fetch wrapper.
- BCrypt for password hashes (cost 12).
- Login throttle: 5 attempts / 15min / IP via Bucket4j.

### RBAC enforcement
- Method-level `@PreAuthorize("hasRole('OWNER')")` on DELETE handlers + admin-management endpoints.
- Service-layer `@PreAuthorize("@rbac.canEditTriggers(authentication)")` for finer-grained checks.
- `RbacService` central policy class — single place to read/audit policy. EMPLOYEE policy:
  - **Allowed:** GET *, POST/PATCH on orders/items/photos/notes/messages, POST status, POST storage move, POST schedule, POST assign, POST/PATCH on clients (no delete), POST/PATCH on products/news (no delete), GET threads + POST messages, GET triggers + GET scheduled-messages, POST scheduled-messages/{id}/send|discard|edit-and-send.
  - **Forbidden:** DELETE *, POST/PATCH/DELETE on triggers, message-templates, storage-locations, users.

### Audit log
Every admin write logged at controller layer via Spring AOP → `audit_log` table (id, actor_id, method, path, body_hash, response_status, ip, user_agent, created_at). Order-specific writes additionally produce `OrderEvent`.

---

## File upload flow

Two paths:

### Small files (< 5 MB) — direct multipart
Used for: photos from order drawer, news cover, contact inquiry photo. Backend streams to `BlobStorage.put(...)`, persists `Photo` row with `s3_key`, returns metadata.

### Large files (≥ 5 MB) or batch upload — presigned PUT
1. FE calls `POST /api/admin/photos/presign` with `{ orderId, count, mimeTypes }` → `[{ key, presignedUrl, expiresAt }, ...]`.
2. FE PUTs each blob directly to R2/MinIO.
3. FE calls `POST /api/admin/orders/{id}/photos/finalize` with `[{ key, label, mime, width, height }]` → backend HEADs each key, persists rows.

Public service-request photos use the same flow with a public-scoped presign endpoint. Presigned URLs expire in 10min.

Image variants generated on-demand via on-the-fly resize (Lambda not needed — Spring service does it on first GET via image proxy, cached via `Cache-Control: public, max-age=31536000, immutable` keyed by `(s3_key, w, h, fit)`).

---

## Messaging architecture

```
          ┌────────────────────────┐
          │    OrderService etc.   │  emits domain events
          └──────────┬─────────────┘
                     │
                     ▼
          ┌────────────────────────┐
          │     TriggerEngine      │  matches event → Trigger
          └──────────┬─────────────┘
                     │  enqueues
                     ▼
          ┌────────────────────────┐
          │  scheduled_message     │  durable queue
          │      (Postgres)        │
          └──────────┬─────────────┘
                     │  every 30s
                     ▼
          ┌────────────────────────┐         ┌──────────────┐
          │  MessageDispatcher     │ ──────> │ MessageGateway│ ──> Postmark / SMSAPI
          │ (@Scheduled poller)    │         │  (per-channel)│
          └────────────────────────┘         └──────┬───────┘
                                                     │  webhook
                                                     ▼
                                            ┌────────────────────┐
                                            │ DeliveryReceiptHook│
                                            └────────────────────┘
```

### TriggerEngine
- Listens to Spring `ApplicationEvent`s: `OrderCreatedEvent`, `OrderStatusChangedEvent`, `OrderScheduledEvent`, daily cron `DailyTickEvent`.
- For each event, queries enabled `Trigger` rows whose `event` + `event_params` match.
- Renders `MessageTemplate` against the order context (placeholder map: `{imie_klienta}`, `{numer_zlecenia}`, `{typ_pracy}`, `{data_odbioru}`, `{link_do_zdjec}`, `{firma}`).
- Computes `scheduled_for = max(now, anchor + delay)`.
- Inserts `ScheduledMessage` with state `AWAITING_CONFIRM` if `requires_manual_confirmation`, else `PENDING`.
- `STATUS_CHANGED` triggers also surface synchronously to the API caller so the UI can show the confirmation modal immediately (even if `requires_manual_confirmation=false`, the response carries the rendered preview so the user sees what was sent).

### MessageDispatcher
- `@Scheduled(fixedDelay=30s)` poller, holds advisory lock so HA-safe.
- Selects `state IN ('PENDING') AND scheduled_for <= now()` rows, marks `IN_PROGRESS` (state column), dispatches via `MessageGateway`, persists `Message` row + `DeliveryReceipt`, transitions state to `SENT` or `FAILED`.
- Exponential backoff on failure: attempts 0..5, retry-after `2^n minutes`.

### Confirmation queue UI
`/admin/wiadomosci/kolejka` — list of `state=AWAITING_CONFIRM` rows. Each: client, channel, scheduled_for, rendered preview, [Wyślij teraz] [Edytuj i wyślij] [Odrzuć]. Owner + Employee can act; action logged.

### Inbound messages
- Postmark inbound webhook (reply-by-email) → match by `In-Reply-To` header → append to `MessageThread` as `direction=INBOUND`.
- SMSAPI inbound webhook → match by phone E.164 → append.
- Unmatched → "Niezidentyfikowane" inbox; admin can manually link to a thread.

---

## Order status state machine

Per decisions: **free transitions**, audit-only enforcement.

- Service layer accepts `transition(orderId, toStatus, note, actor)`.
- Validates only that `toStatus ∈ enum` and `order` exists.
- If `toStatus == ANULOWANE` and order has terminal-state implications, captures `note` (UI requires reason).
- If `order.status == WYDANE` and `toStatus != WYDANE`, requires explicit `restore=true` flag (UI uses dedicated "Wznów zlecenie" action).
- Writes `OrderEvent(type=STATUS_CHANGED, payload={from, to, note})`.
- Publishes `OrderStatusChangedEvent` → TriggerEngine.
- Returns `{ order, matchedTrigger?, renderedPreview? }`.

UI flow: drawer status dropdown → click → if response includes `matchedTrigger` + `renderedPreview`, show confirmation modal: subject + body + recipient + channel, with [Wyślij] [Wyślij później] [Tylko zmień status]. "Wyślij" → `POST /scheduled-messages/{id}/send`. "Wyślij później" → leave in queue (default behavior). "Tylko zmień status" → `POST /scheduled-messages/{id}/discard`.

---

## Frontend architecture

### Routing (Next.js App Router)
```
app/
├── (public)/
│   ├── page.tsx                    landing (hero, services, news preview, shop preview, contact)
│   ├── aktualnosci/page.tsx
│   ├── aktualnosci/[slug]/page.tsx
│   ├── sklep/page.tsx              shop list with filters
│   ├── sklep/[id]/page.tsx
│   ├── zamow/page.tsx              service intake form
│   └── kontakt/page.tsx
├── (admin)/
│   └── admin/
│       ├── layout.tsx              auth guard + sidebar
│       ├── page.tsx                dashboard
│       ├── zamowienia/page.tsx     orders list + drawer
│       ├── zamowienia/kanban/page.tsx
│       ├── zamowienia/kalendarz/page.tsx
│       ├── klienci/page.tsx
│       ├── sklep/page.tsx
│       ├── aktualnosci/page.tsx
│       ├── wiadomosci/page.tsx
│       ├── wiadomosci/kolejka/page.tsx
│       ├── triggery/page.tsx
│       └── ustawienia/{lokalizacje,uzytkownicy,szablony,profil}/page.tsx
└── api/                            Next route handlers — proxy + auth helpers only
```

### Rendering strategy
- **Public landing, news, shop list/detail:** statically rendered + ISR with 60s revalidate. Server fetches from backend during build/revalidate.
- **Public service intake / reservation submit:** client component → `POST /api/public/...` directly (CORS allow same origin via reverse proxy).
- **Admin:** auth-gated `(admin)` layout client-side. Heavy use of React Server Components for read-side (orders list, dashboard). Client components for interactive surfaces (drawer, kanban DnD, calendar, composer).

### State / data layer
- **TanStack Query** (`@tanstack/react-query`) for server state, with optimistic updates on drawer mutations and kanban drag.
- **Zustand** for UI-local state (drawer open, filter state, current view tab).
- **API client:** generated from backend OpenAPI by `openapi-typescript` → `packages/api-types`. Wrapper auto-attaches CSRF.
- **Forms:** React Hook Form + Zod (Zod schemas mirror backend Bean Validation).

### Design system
- Tailwind preset in `packages/ui` exporting tokens from `DESIGN_SYSTEM.md`.
- Headless primitives via Radix UI (Drawer, Dialog, Dropdown, Tabs, Select).
- Custom: `<StatusBadge>`, `<TapeChip>` (landing filter), `<SprayedBorder>`, `<Drawer>`, `<KanbanColumn>`, `<EventTimeline>`, `<MessageComposer>`, `<TemplateRenderer>` (for previews).
- Fonts: Bungee (display), Permanent Marker (accent), Inter (body), JetBrains Mono (timestamps/IDs). All via `next/font` with self-host.

### i18n
`next-intl` with `messages/pl.json` only at launch. Strings extracted from prototype verbatim.

### Auth UX
- `/admin/login` → POST → cookie set → redirect to `/admin`.
- 401 from any admin API → global interceptor redirects to `/admin/login?next=...`.
- Idle timeout: 30min — show modal "Sesja wygasa za 60s" with [Pozostań zalogowany].

---

## Deployment

### Topology
- **Cloudflare Containers** runs three containers: `web` (Next.js), `api` (Spring Boot), `db` (Postgres 16).
- **R2** bucket for media.
- **Cloudflare DNS + TLS** in front of `web` and `api`.
- Routes:
  - `drshoes.pl/*` → `web` container
  - `drshoes.pl/api/*` → `api` container (configured via Cloudflare route rules; same-origin avoids CORS)
  - `drshoes.pl/r2/*` → optional R2 public bucket binding for image variants

### Container images
- **api:** multi-stage Dockerfile, Maven build → `eclipse-temurin:21-jre`, `app.jar` at `/app/app.jar`. Health: `/actuator/health`. Port `8080`.
- **web:** multi-stage, `node:20-alpine` build → standalone Next output → `node:20-alpine` runtime. Port `3000`.
- **db:** `postgres:16-alpine`, persistent volume mounted. Init script seeds extensions (`uuid-ossp`, `pg_trgm`).

### Postgres on Cloudflare Containers — caveat (locked but flagged)
Cloudflare Containers persistent storage works, but ops story is thinner than managed Postgres:
- Backups must be done by us — `pg_dumpall` cron container → R2, 30-day retention.
- Restore-test in CI weekly.
- No managed PITR. If we need PITR or read replicas, swap path: provision **Neon** (EU region, free tier sufficient for v1), update `JDBC_URL` env var, restore latest dump. Documented as a 2-hour swap, no code change.

### CI/CD (GitHub Actions)
- `ci.yml` on every PR: maven test (Testcontainers), pnpm test, playwright smoke against compose.
- `deploy.yml` on `main` push:
  1. build images with cache
  2. push to GHCR (or Cloudflare's container registry)
  3. `wrangler containers deploy` per service
  4. run Flyway via one-off job before swapping `api` traffic
  5. smoke health check on `/api/actuator/health`
  6. on failure → rollback to previous image tag

### Environments
- **local:** `docker-compose up` → all four services + MinIO, hot reload via `mvn spring-boot:run` and `pnpm dev`.
- **preview** (PR): not provisioned in v1 (Cloudflare Containers preview environments TBD; revisit).
- **production:** `drshoes.pl`.

### Observability
- Structured JSON logs (Logback) → Cloudflare Logs.
- Spring Actuator endpoints (`/actuator/health`, `/actuator/metrics`, `/actuator/info`) — only `health` public.
- Sentry skipped per decisions; revisit if error volume warrants. Errors visible via Logs initially.
- Uptime: Cloudflare Health Checks (free).

---

## Trigger engine details

### Event types
| `event` enum                | `event_params` JSON                       | When fires                                  |
|----------------------------|-------------------------------------------|---------------------------------------------|
| `STATUS_CHANGE`            | `{ "to_status": "GOTOWE_DO_ODBIORU" }`   | After successful transition                 |
| `STATUS_CHANGE_FROM`       | `{ "from": "PRZYJETE", "to": "..." }`    | Specific transition pair                    |
| `ORDER_RECEIVED`           | `{}`                                      | New order created (any source)              |
| `BEFORE_PICKUP_X_DAYS`     | `{ "days": 1, "hour": 9 }`               | Daily tick at hour, X days before pickup    |
| `AFTER_HANDOVER_Y_DAYS`    | `{ "days": 3, "hour": 11 }`              | Daily tick, Y days after `WYDANE`          |
| `RESERVATION_EXPIRING`     | `{ "hours": 6 }`                          | Reservation 6h before `expires_at`          |

### Daily tick
`@Scheduled(cron = "0 0 * * * *")` (every hour) — checks if any `BEFORE_PICKUP_X_DAYS` / `AFTER_HANDOVER_Y_DAYS` triggers should fire this hour, scans orders, enqueues `ScheduledMessage`s. Idempotent via `(trigger_id, order_id, scheduled_for_date)` uniqueness.

### Template rendering
Mustache-flavored single-pass: `{imie_klienta}`, `{numer_zlecenia}`, `{typ_pracy}`, `{data_odbioru}`, `{link_do_zdjec}` → resolved against order context. Missing placeholders render as empty string + log warning. `{link_do_zdjec}` = signed URL valid 7 days, points to `/p/order-photos/<token>`.

---

## Reservation expiration

`ReservationExpirator` `@Scheduled(fixedDelay=5min)`:
1. find reservations with `state=PENDING` and `expires_at < now()`.
2. transition to `EXPIRED`.
3. flip product status `ZAREZERWOWANE` → `DOSTEPNE`.
4. emit dashboard signal (decrement counter).
5. enqueue admin notification.

Plus `RESERVATION_EXPIRING` trigger gives admin a 6h heads-up.

---

## Testing strategy

### Backend
- **Unit:** services with mocked repos. ~100% on `StatusTransitionService`, `TriggerEngine`, `TemplateRenderer`, `RbacService`, `ReservationExpirator`.
- **Integration:** Spring Boot Test + Testcontainers (Postgres + MinIO). Every controller + repo path. WireMock for Postmark + SMSAPI.
- **Contract:** OpenAPI schema validated against runtime via `springdoc` + tests assert no breaking changes per PR.

### Frontend
- **Unit:** Vitest for utility functions and Zod schemas.
- **Component:** Playwright Component Testing for `<Drawer>`, `<KanbanColumn>`, `<MessageComposer>`.
- **E2E smoke (Playwright):**
  1. login → create order → add item → upload photo → change status (with trigger confirmation) → send message
  2. kanban drag W_REALIZACJI → GOTOWE → trigger preview → confirm
  3. public reservation submit (modal) → admin sees in queue
  4. public service intake → admin sees `WSTEPNIE_PRZYJETE` order
  5. employee tries DELETE → 403

### CI gates
- Backend: `mvn verify` → must pass.
- Frontend: `pnpm test`, `pnpm build`, `pnpm playwright test --project=smoke`.
- Lighthouse on landing in CI: TTI < 2.5s, perf score ≥ 90.

---

## Seed data

`infra/seeds/` contains:
- 1 OWNER user (Misza), 1 EMPLOYEE user.
- 5 storage locations.
- 8 clients with PL names + phones.
- 12 orders spanning every status, with 2–4 items each, before/after photo placeholders, internal notes, message threads.
- 6 products (mix of dostępne / zarezerwowane / sprzedane).
- 3 news posts.
- 4 default triggers (per decisions).
- ~10 message templates (PL).

If Misza supplies real photos / copy, swap placeholders. Otherwise clearly marked `[seed]` images.

---

## Migration / data import

If existing data exists (spreadsheet, IG DM export):
- Write a one-shot `mvn exec:java -Dexec.mainClass=com.drshoes.app.tools.LegacyImporter -Dexec.args=...` reading CSV/JSON.
- Imports clients first, then orders, then events.
- Backfills `OrderEvent(type=ORDER_CREATED)` with `actor=null, message="Imported from <source>"`.
- Idempotent — re-run safe via natural keys (phone+email for client, legacy_id for order).

Awaiting source data from Misza.

---

## Implementation milestones (drives `superpowers:writing-plans`)

Each milestone ends with a working, demo-able state. Subsequent plan-phase-execute cycle uses Sonnet subagents for atomic tasks; Opus reviews between waves.

| # | Milestone | Demo at end |
|---|-----------|-------------|
| 0 | Repo skeleton + docker-compose + Maven parent + libs scaffolds + Next app + auth | login screen renders, health checks green |
| 1 | Domain core: Client, Order, OrderItem, OrderEvent, StorageLocation, User + RBAC + admin orders list+drawer | create order from admin, see drawer + event log |
| 2 | Photos (presign + upload), notes, status transitions w/ event log | full order lifecycle without messaging |
| 3 | Messaging libs (`messaging-core`, `email-gateway`, `sms-gateway`) + manual send composer | send email + SMS to client from order drawer |
| 4 | Trigger engine + scheduled_message + confirmation modal + 4 seed triggers | status change surfaces preview modal; daily tick fires reminder |
| 5 | Public landing — hero/services/contact + service intake form + reservation flow | misza_madafaka.preview.com deploys, public form lands order in WSTEPNIE_PRZYJETE |
| 6 | Sklep (admin CRUD + public list/detail + reservations + expirator) | reservations work end-to-end |
| 7 | Aktualności (admin Tiptap + public render) | news live |
| 8 | Kanban + Calendar views | drag rescheduling |
| 9 | Dashboard + saved filters + storage location admin UI | dashboard tiles populated |
| 10 | Polish/perf pass + Playwright smoke + Lighthouse + DEMO.md | green CI, deployed to drshoes.pl |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Postgres ops on CF Containers thinner than managed | Nightly dump → R2; documented Neon swap path; restore-test in CI |
| Postmark/SMSAPI outage delays customer messages | Durable `scheduled_message` queue; retry with backoff; fallback to alert email to owner |
| Inbound webhook spoofing | Provider signature verification on every webhook; reject unsigned |
| Photo storage cost runaway | R2 free egress; auto-expire orphan presigned PUTs; max 50 photos per order soft cap |
| RBAC bypass via missed `@PreAuthorize` | Centralized `RbacService` + integration tests for each forbidden action × EMPLOYEE |
| Polish microcopy drift across docs/UI | Single `pl.json`; UI imports — no string literals in components |
| Cloudflare Containers product immaturity | Compose-equivalent locally; Hetzner VPS escape hatch documented (one-day swap) |

---

## Open items requiring final owner sign-off

1. **Confirm storage location entity scope** — is `code/name/description/color/active` enough, or do you want capacity, sub-location (regał → półka), or per-location photo? Default scope above unless changed.
2. **Confirm employee permissions list** above (§Auth & RBAC). Especially: should employees be able to create new clients (default: yes) and new orders (default: yes)?
3. **Migration source** — any existing data to import?
4. **Hard deadline?** Affects milestone parallelism.
5. **Misza will provide DNS access for `drshoes.pl`** to set Postmark SPF/DKIM and Cloudflare nameservers. Confirm.

After your sign-off (or marked-up edits) I switch to `superpowers:writing-plans` and start producing milestone-0 plan.
