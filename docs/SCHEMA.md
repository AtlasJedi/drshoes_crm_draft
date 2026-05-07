# Dr Shoes — DB Schema (proto)

Companion to `SCHEMA.sql` (the runnable Flyway V001). This doc is the human map.

## Top-level entity diagram

```
                              user_                          storage_location
                              (admins)                       (workshop racks)
                                  ▲                                ▲
                                  │ assigned_craftsman             │ current_storage
                                  │                                │
client ───── 1:n ───── order_ ───┼──── 1:n ──── order_item ─── 1:n ── photo
   │            │       │ (code  │
   │            │       │  status│       1:n ── internal_note
   │            │       │  …)    │       1:n ── message
   │            │       │        │       1:n ── order_event   (audit timeline)
   │            │       │        │
   │            │       └────────┴─── 1:n ── scheduled_message
   │            │
   │            └──── 1:n ──── reservation ── n:1 ── product ── 1:n ── product_photo
   │
   └── 1:n ── message_thread ── 1:n ── message
                                       ▲
                                       │ trigger_id, template_id
                                       │
                              trigger_ ──── n:1 ──── message_template

news_post ── 1:n ── news_photo
contact_inquiry (standalone)
saved_filter (per user)
audit_log (per request)
idempotency_key (24h TTL)
spring_session, spring_session_attributes (Spring Session JDBC)
```

## Status enums (CHECK-constrained VARCHAR)

| Domain           | Values                                                                                                                                  |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| User role        | `OWNER`, `EMPLOYEE`, `CRAFTSMAN`, `OFFICE`                                                                                              |
| Order status     | `WSTEPNIE_PRZYJETE`, `PRZYJETE`, `W_REALIZACJI`, `CZEKA_NA_KLIENTA`, `GOTOWE_DO_ODBIORU`, `WYDANE`, `ANULOWANE`                         |
| Order source     | `ADMIN`, `PUBLIC_INTAKE`, `IMPORT`                                                                                                      |
| Order item kind  | `NAPRAWA`, `CUSTOM_BUTY`, `CUSTOM_KURTKA`                                                                                               |
| Photo label      | `BEFORE`, `IN_PROGRESS`, `AFTER`, `OTHER`                                                                                               |
| Channel          | `EMAIL`, `SMS`, `WHATSAPP`                                                                                                              |
| Message direction| `OUTBOUND`, `INBOUND`                                                                                                                   |
| Delivery status  | `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `READ`                                                                                         |
| Trigger event    | `STATUS_CHANGE`, `STATUS_CHANGE_FROM`, `ORDER_RECEIVED`, `BEFORE_PICKUP_X_DAYS`, `AFTER_HANDOVER_Y_DAYS`, `RESERVATION_EXPIRING`        |
| Scheduled msg    | `PENDING`, `AWAITING_CONFIRM`, `IN_PROGRESS`, `SENT`, `DISCARDED`, `FAILED`                                                             |
| Product status   | `DOSTEPNE`, `ZAREZERWOWANE`, `SPRZEDANE`                                                                                                |
| Reservation      | `PENDING`, `CONFIRMED`, `EXPIRED`, `CANCELLED`, `FULFILLED`                                                                             |
| News             | `DRAFT`, `PUBLISHED`                                                                                                                    |
| Order event type | `ORDER_CREATED`, `STATUS_CHANGED`, `STORAGE_MOVED`, `ASSIGNEE_CHANGED`, `SCHEDULE_CHANGED`, `ITEM_ADDED`, `ITEM_UPDATED`, `ITEM_REMOVED`, `PHOTO_ADDED`, `PHOTO_LABELED`, `PHOTO_REMOVED`, `NOTE_ADDED`, `MESSAGE_SENT`, `MESSAGE_RECEIVED`, `TAG_ADDED`, `TAG_REMOVED`, `CANCELLED`, `RESTORED`, `PRICE_CHANGED`, `TOTAL_RECOMPUTED` |

**Why VARCHAR + CHECK instead of native enum:** evolving enums in Postgres native types requires `ALTER TYPE` which is slow and locks. CHECK constraints can be replaced by a migration with no downtime. JPA handles either, but VARCHAR keeps DDL portable to other dialects (sqlite for prototyping, etc.).

## Per-table notes

### `user_`, `client`, `order_`, `news_post` — soft delete via `deleted_at`
All read paths add `WHERE deleted_at IS NULL`. Hard delete reserved for RODO data-deletion requests via a privileged service method that also nulls referenced PII.

### `client` — fuzzy search
`client_search_idx` uses `pg_trgm` on a concatenated string (first+last+phone+email). Backed by `q=` query in admin API. ~100ms on 50k clients without further tuning.

### `order_.code` — year-resetting human ID
Generated via `next_order_code(year)` — atomic insert/update on `order_code_counter`. Application invokes inside the same transaction as order insert so the code is gapless within a year even under concurrency.

### `order_event` — append-only
DB-level trigger blocks UPDATE and DELETE. Service layer never tries to mutate. Exception: data deletion on RODO request happens via the privileged path and bypasses the trigger via `SET LOCAL session_replication_role = replica` for the duration of the deletion.

### `scheduled_message` — durable trigger queue
- Idempotency: `scheduled_message_dedup_idx` ensures a given trigger fires at most once per order per day. `BEFORE_PICKUP_X_DAYS` etc. depend on this.
- Polling: dispatcher selects `(state IN ('PENDING') AND scheduled_for <= now())` with `FOR UPDATE SKIP LOCKED LIMIT 50`. HA-safe; multiple replicas would not double-dispatch.
- Linkage: when sent, `message_id` set to the resulting `message` row; `message.scheduled_message_id` mirrors back.

### `message` — supports both directions
Inbound messages have `direction='INBOUND'`, `sent_by=null`. Threading is by `client_id` + `In-Reply-To` header / phone match (handled in service layer).

### `reservation` — anonymous allowed
`client_id` nullable; submission collects `name/phone/email` directly. If a matching `client` exists by phone or email, reservation can later be linked admin-side.

### `audit_log` vs `order_event`
- `order_event` — domain audit, visible in UI, structured payload, timeline.
- `audit_log` — operational, request-level, every admin write. Used for security forensics, not shown in product.

### `idempotency_key` — TTL via cleanup job
Daily `@Scheduled` job deletes rows older than 24h. Spring Session cleanup runs similarly via Spring's scheduled job.

## Indexes — coverage rationale

| Query                                    | Index used                              |
|------------------------------------------|-----------------------------------------|
| Orders list filtered by status + due     | `order_status_pickup_idx`               |
| Orders for a client                      | `order_client_idx`                       |
| Orders by craftsman + status (kanban)    | `order_craftsman_idx` + filter          |
| Orders by storage location               | `order_storage_idx`                      |
| Fuzzy `q=` on orders                     | `order_search_idx` (gin trgm)            |
| Client lookup by phone                   | `client_phone_idx`                       |
| Client fuzzy                             | `client_search_idx` (gin trgm)           |
| Reservations expiring                    | `reservation_expires_idx`                |
| Scheduled msgs due                       | `scheduled_message_due_idx`              |
| Trigger lookup by event                  | `trigger_event_idx` (enabled-only)       |
| Photo display order                      | `photo_order_idx`                        |
| Inbound webhook idempotency              | `message_provider_idx`                   |

No indexes on `tags` JSONB initially — filter happens via `?tag=` and Postgres scans `WHERE tags @> '["pilne"]'`. If real volume needs it, add a `gin (tags jsonb_ops)` index later.

## Constraints worth reading

- `client_contact_present` — phone OR email required.
- `reservation_contact_present` — same on reservations.
- `contact_contact_present` — same on contact inquiries.
- `scheduled_message_dedup_idx` — partial unique index, prevents duplicate scheduling.
- All FKs to `user_` use `ON DELETE` default (RESTRICT) so we never accidentally orphan audit data when a user is removed; deactivation is preferred.

## Things deliberately not in V001

- No `audit_log` for non-admin (public form submissions tracked by `source_ip` on the entity itself).
- No `tag` table — tags are a JSONB array on `order_`. Promote to a real table only if we need per-tag color, description, or stats.
- No fiscal/payment tables — payments deferred per decisions.
- No `client_event` / `product_event` — only orders carry an event timeline in v1.
- No event sourcing on the rest of the domain — `OrderEvent` is the audit log, not a write-store. Source of truth remains the row.

## Migration strategy

- **V001** = this baseline. Run on first deploy.
- Subsequent migrations add features/columns via additive Vnnn migrations (`V002__add_loyalty.sql`, etc.). Never modify a shipped migration.
- Destructive changes (`DROP COLUMN`) wrapped in two-step migrations: V_n adds nullable replacement, V_n+1 drops old after deploy.
- `flyway_schema_history` lives in the same DB.

## Local dev

`docker-compose.yml` brings up `postgres:16-alpine` with volume `db_data`, env `POSTGRES_USER=drshoes / POSTGRES_PASSWORD=drshoes / POSTGRES_DB=drshoes`. Backend `application-local.yaml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/drshoes
    username: drshoes
    password: drshoes
  flyway:
    enabled: true
    locations: classpath:db/migration
  jpa:
    hibernate:
      ddl-auto: validate         # never let Hibernate touch schema
```

`mvn spring-boot:run` → Flyway applies V001 → app starts → `/actuator/health` green.
