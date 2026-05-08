# Milestone 2 — Messaging + Triggers (design spec)

**Date:** 2026-05-08
**Author:** Opus + owner brainstorm
**Status:** Approved for planning
**Successor of:** [`2026-05-08-milestone-01-orders-design.md`](./2026-05-08-milestone-01-orders-design.md)

## 1. Objective

After M2, the owner can:

- Edit the message-template library (full CRUD).
- Enable / disable any of the four seeded triggers, and read their detail (no editor in M2).
- Send a manual message to a client from inside the OrderDrawer (template picker + channel + body preview).
- Watch immediate triggers fire automatically when an order's status enters `PRZYJETE` or `GOTOWE_DO_ODBIORU`.
- Watch scheduled triggers fire daily — `BEFORE_PICKUP_X_DAYS=1` at 09:00 Europe/Warsaw, `AFTER_HANDOVER_Y_DAYS=3` at 11:00 Europe/Warsaw.
- Read every sent message in the per-order thread inside the drawer; see `MESSAGE_SENT` events alongside `STATUS_CHANGED` and `ITEM_*` in the timeline.

Real provider integration (Postmark, SMSAPI), inbound messages, webhooks, WhatsApp, photos, calendar/kanban, and the cross-client top-nav Wiadomości view are deferred. M2 ships on `LoggingEmailGateway` + `LoggingSmsGateway` only.

## 2. Locked decisions (from brainstorm)

| # | Decision | Rationale |
|---|---|---|
| 1 | Logging gateways only; real providers → M3 | Demoable end-to-end without secrets / webhooks / tunneling. WireMock infra still goes in so swap is bolt-on. |
| 2 | Sync send + post-commit triggers (no DB outbox) | Logging gateway can't fail in practice; outbox is unnecessary durability for M2. M3 (real providers) is the right time to introduce it. |
| 3 | Scheduled triggers IN with `@Scheduled` cron | 2 of the 4 seeded triggers are scheduled — without them, M2 ships only half the trigger demo. |
| 4 | Per-order messaging thread only (inside OrderDrawer) | Cross-client top-nav view's value is mostly inbound replies, which require real providers. |
| 5 | Templates: full CRUD. Triggers: list + on/off + read-only detail | Owner edits copy daily (templates) but rarely retunes triggers after the 4 seeds. Dynamic `event_params` editor → M3. |

## 3. Architecture

### 3.1 Single send pipeline

Three call sites funnel through one `MessageRouter`:

```
Manual composer  ─┐
Status change    ─┼─→ MessageRouter.route(...)
Scheduled cron   ─┘          │
                             ▼
                  1. Resolve template (from trigger or manual)
                  2. Resolve channel(s) (per Client.preferredChannel ∩ trigger.channels)
                  3. Render placeholders
                  4. Find-or-create message_thread (one per client; see §4.4)
                  5. Persist message row, status=QUEUED
                  6. Invoke gateway sync → SENT or FAILED + provider_message_id
                  7. Update message row + bump message_thread.last_message_at
                  8. Audit row written automatically by AuditLogAspect (service path)

The QUEUED → SENT/FAILED transition happens inside the same `@Transactional` boundary
as the persistence. The transient QUEUED state isn't an outbox queue (no separate
dispatcher polls it) — it exists so M3's real-provider work can split steps 5 and 6
across transactions without a schema change.
```

Triggers wrap their `MessageRouter.route(...)` call inside
`TransactionSynchronizationManager.registerSynchronization(... afterCommit ...)`
so a status-change rollback cannot leak a trigger fire. Manual sends and the scheduled job invoke the router in a fresh transactional method (no synchronization required).

### 3.2 Idempotency

Every trigger fire claims an `idempotency_key` row keyed:

```
trg:{triggerId}:order:{orderId}:disc:{discriminator}
```

Discriminator depends on the event:

| Event | Discriminator |
|---|---|
| STATUS_CHANGE / STATUS_CHANGE_FROM | `to:{newStatus}` (one fire per status entry) |
| BEFORE_PICKUP_X_DAYS | `before:{plannedPickupDate}` (one fire per planned pickup) |
| AFTER_HANDOVER_Y_DAYS | `after:{handoverDate+Yd}` (one fire per derived target date) |
| ORDER_RECEIVED | `created` (one fire ever) |

`IdempotencyService.claim(key)` is a single insert that returns false on `ON CONFLICT DO NOTHING`. Existing key → router skips + INFO log (`op=trigger.skip reason=idempotent`).

### 3.3 Templating

Plain regex `\{[a-zA-Z_]+\}` substitution — no Handlebars/Velocity. Placeholder set for M2:

| Placeholder | Source | Notes |
|---|---|---|
| `{imie_klienta}` | `Client.firstName` | |
| `{numer_zlecenia}` | `Order.code` | e.g. `DR-2026-0001` |
| `{typ_pracy}` | comma-joined `OrderItem.kind` labels (PL) | e.g. `naprawa, custom buty` |
| `{data_odbioru}` | `Order.plannedPickupAt` | PL format `dd.MM.yyyy 'o' HH:mm`, or `—` if null |
| `{nazwa_warsztatu}` | constant `"Dr Shoes"` | |

`{link_do_zdjec}` is **deferred** to M3 (depends on photos). If a template body still references it, render it as `—` and log WARN (`op=template.render placeholder=link_do_zdjec reason=deferred`).

`PlaceholderResolver` is a strategy map `Map<String, Function<TemplateContext, String>>` — adding a placeholder = adding one entry.

### 3.4 Scheduled triggers

Two cron jobs in `ScheduledTriggerJob`:

```java
@Scheduled(cron = "0 0 9 * * *", zone = "Europe/Warsaw")  // BEFORE_PICKUP_X_DAYS
@Scheduled(cron = "0 0 11 * * *", zone = "Europe/Warsaw") // AFTER_HANDOVER_Y_DAYS
```

Each job:

1. Loads enabled triggers for the matching event.
2. For each trigger, computes the target date set (`today + X` for BEFORE; `today − Y` for AFTER).
3. Queries orders whose relevant date column matches the target set.
4. Routes each match through `MessageRouter` with the appropriate idempotency discriminator.

A `Clock` bean is exposed via `MessagingClockConfig` so integration tests can fast-forward the clock and assert deterministic behavior.

### 3.5 Audit + timeline integration

- All M2 controllers live under `com.drshoes.app.messaging.api.*Controller` so the existing `AuditLogAspect` pointcut catches them automatically. Two-row audit semantics from task 1-8 still apply.
- `MessageRouter#send` is `@Audited` so service-row audit fires once per send.
- `TimelineEventCurator` (from 1-9) gets ONE new event kind: `MESSAGE_SENT`.
  - Path pattern matches `MessageRouter#send` service rows.
  - Emits a timeline event with structured `labels`: `{ messageId, channel, templateName, triggerId? }`.
- Frontend `KIND_LABELS_PL` map (the M1 client-side composition we ratified — see §6) gets `MESSAGE_SENT: "Wysłano wiadomość ({channel})"`.
- Status-change-fired triggers run post-commit, so timeline ordering is naturally `STATUS_CHANGED` → `MESSAGE_SENT`.

## 4. Module layout

### 4.1 Backend (`backend/app/`)

```
com.drshoes.app.messaging/
  domain/
    MessageEntity, MessageThreadEntity, MessageTemplateEntity, TriggerEntity
    enums: MessageDirection, DeliveryStatus, Channel, TriggerEvent
  repository/
    MessageRepository, MessageThreadRepository, MessageTemplateRepository, TriggerRepository
  dto/
    Template/Trigger/Message request + response DTOs (records)
  api/
    TemplatesController        /api/admin/templates                          GET/POST/PATCH/DELETE
    TriggersController         /api/admin/triggers                           GET (list + detail), PATCH /{id}/enabled
    MessagesController         /api/admin/orders/{orderId}/messages          GET (thread), POST (send)
    + per-controller @RestControllerAdvice exception handlers
  service/
    MessageRouter              — single send pipeline (THE cross-cutting class — two-stage reviewed)
    TemplateRenderer
    PlaceholderResolver
    IdempotencyService
    TriggerEngine              — STATUS_CHANGE post-commit hook + scheduled-trigger entry
    ScheduledTriggerJob        — @Scheduled methods (separate class for granularity)
    MessageThreadService       — find-or-create thread per clientId (see §4.4)
  config/
    MessagingClockConfig       — Clock bean

db/migration/
  V006__seed_templates_and_triggers.sql
```

All controllers honour the `.api.` package convention from M1 errata (line 50–53 of milestone-01 plan) so `AuditLogAspect` covers them.

### 4.4 Threading model

`message_thread` (V001 schema) has only `(client_id)` indexed, no uniqueness on
`(client_id, channel)`. M2 ships **one thread per client** — every outbound
message for a given client lands in the same thread row regardless of channel.
The OrderDrawer messages view filters by `message.order_id`; the thread row is
mostly bookkeeping (carries `last_message_at`, `subject` for future email
threading, `unread_count` reserved for inbound in M3). `MessageThreadService`
performs `findFirstByClientIdOrderByCreatedAtAsc` then INSERT-if-absent — no DB
unique constraint added in M2 (race-free under single-admin outbound-only).

### 4.2 Frontend (`apps/web/`)

```
lib/messaging/
  api.ts          — getTemplates, createTemplate, updateTemplate, deleteTemplate,
                    getTriggers, getTrigger, toggleTrigger,
                    getOrderMessages, sendMessage
  api-server.ts   — server-side fetch wrappers (mirrors orders pattern from 1-12)
  types.ts        — TS DTO types

app/(admin)/admin/templates/
  page.tsx                                — list + "Nowy szablon"
  new/page.tsx                            — create
  [id]/page.tsx                           — edit
  _components/TemplateForm.tsx            — name, channel, subject (EMAIL only), body, active

app/(admin)/admin/triggers/
  page.tsx                                — list with on/off toggle column
  [id]/page.tsx                           — read-only detail (event, params, channels, template link, delay, requires-confirmation)

app/(admin)/admin/orders/_components/
  OrderDrawerMessages.tsx                 — thread view (refreshKey-driven; same pattern as timeline 1-19)
  MessageComposerModal.tsx                — Radix Dialog: template picker, channel, body preview, send
  MessageRow.tsx                          — channel pill, sent_at PL, body, delivery status
```

`OrderDrawer.tsx` gains a 5th stacked section after timeline. `OrderDrawerStatusChanger` (from 1-17) loses its trigger placeholder — replaced with real preview text computed from the matching enabled trigger for the target status:

- Match found: `Wyśle: <templateName> kanałem <channel>` (or `kanałami` if multiple).
- No matching enabled trigger: `Brak skonfigurowanego wyzwalacza dla tego statusu.`
- Match exists but trigger disabled: `Wyzwalacz <triggerName> wyłączony — nic nie wyśle.`

### 4.3 API contracts

```
GET    /api/admin/templates                              → TemplateDto[]
POST   /api/admin/templates                              { name, channel, subject?, body, active } → TemplateDto
PATCH  /api/admin/templates/{id}                         partial → TemplateDto
DELETE /api/admin/templates/{id}                         204     (soft delete: active=false)

GET    /api/admin/triggers                               → TriggerDto[] (joined with template name)
GET    /api/admin/triggers/{id}                          → TriggerDto
PATCH  /api/admin/triggers/{id}/enabled                  { enabled: boolean } → TriggerDto

GET    /api/admin/orders/{orderId}/messages              → MessageDto[] (chronological)
POST   /api/admin/orders/{orderId}/messages              { templateId | body, channel, subject? } → MessageDto
```

State-change requests require CSRF (existing pattern from M1).

## 5. Wave plan

```
Wave 1 — Backend domain                                  (~5 tasks)
  2-1   tasks.json bootstrap + plan errata header
  2-2   V006 migration: seed 4 templates + 4 triggers
  2-3   Entities + enums + repos + repo integration tests
  2-4   IdempotencyService + tests
  2-5   PlaceholderResolver + TemplateRenderer + tests

Wave 2 — Send pipeline + trigger engine                  (~5 tasks)
  2-6   MessageThreadService (find-or-create per client; see §4.4)
  2-7   MessageRouter (sync send through gateway, audit-decorated)   ← TWO-STAGE REVIEW
  2-8   TriggerEngine: STATUS_CHANGE post-commit hook + integration test
  2-9   ScheduledTriggerJob: 09:00 BEFORE_PICKUP / 11:00 AFTER_HANDOVER + Clock-injected tests
  2-10  TimelineEventCurator extension: MESSAGE_SENT path pattern + tests

Wave 3 — Controllers                                     (~3 tasks)
  2-11  TemplatesController (full CRUD) + integration tests
  2-12  TriggersController (list, detail, toggle) + integration tests
  2-13  MessagesController (thread GET + send POST) + integration tests

Wave 4 — Frontend                                        (~6 tasks)
  2-14  lib/messaging API client + server wrappers + types
  2-15  /admin/templates list + new + edit pages + form component
  2-16  /admin/triggers list (with toggle) + detail page
  2-17  OrderDrawerMessages (thread view) + MessageRow + KIND_LABELS_PL update
  2-18  MessageComposerModal (Radix Dialog) + wire OrderDrawer refreshKey
  2-19  OrderDrawerStatusChanger trigger preview: replace placeholder with real text

Wave 5 — Closure                                         (~2 tasks)
  2-20  /api/health endpoint + plan errata note (timeline labels client-side ratified)
  2-21  E2E compose smoke + milestone-2 tag + CLAUDE.md flip
```

≈ 21 tasks total. Single two-stage review (2-7 — cross-cutting); rest single-stage combined per dispatch protocol §4.

## 6. M1 closure items rolled into M2

- `/api/health` endpoint — single tiny `@RestController` (or alias to actuator) returning `{status:"UP", version, timestamp}`. Folded into 2-20.
- Timeline label composition decision — **ratify client-side** (current shipped state from 1-19). Backend ships structured `labels` map; client composes Polish strings via `KIND_LABELS_PL`. Defensible because copy belongs in the presentation layer and i18n stays bolt-on. No migration. One paragraph added to plan errata. Folded into 2-20.

## 7. Out of scope (defer / track for later milestones)

- Real Postmark + SMSAPI providers (the implementations behind `EmailGateway` / `SmsGateway`)
- HMAC-verified inbound webhook receivers + delivery status reconciliation (provider → `DELIVERED` / `FAILED` / `READ`)
- Inbound messages (`direction=INBOUND`) — needs real provider inbound parsing
- WhatsApp channel — no microlib stub exists; not in seeded triggers
- `{link_do_zdjec}` placeholder — depends on M3 photos
- `requires_manual_confirmation` queue UI — schema column stays; no seeded trigger uses it; full "do wysłania" inbox view → M3
- Top-nav `/admin/messages` two-pane Wiadomości view (cross-client conversation list)
- Trigger create/edit form with dynamic `event_params` editor (event-type-driven conditional fields)
- Photos (M3)
- Calendar / Kanban views (M4)
- Order soft-delete restore UI (M1 carry-over)

## 8. Testing strategy

- **Unit:** `TemplateRenderer`, `IdempotencyService`, `MessageRouter` routing logic, `TriggerEngine` event matching, `PlaceholderResolver` per-placeholder strategies.
- **Integration (Testcontainers):** controller round-trips per controller. Status-change → trigger fires → message row + audit row + timeline event written. Scheduled job with injected `Clock` advanced to 09:00 / 11:00 Europe/Warsaw — assert correct orders selected and routed.
- **Frontend:** typecheck + build per existing pattern; E2E compose smoke at 2-21 (login → create order → status change → assert message row appears in thread + timeline).

## 9. Granularity & logging (reaffirmed from dispatch protocol)

- Java classes < 120 LOC; service classes split when bigger.
- TS modules < 80 LOC (soft cap; split when meaningful, per the 1-19 ratification).
- Structured INFO logs at every service boundary: `op=`, `actor=`, `orderId=`, `triggerId?=`, `messageId?=`, `outcome=`.
- Frontend modules use `lib/log.ts` named loggers — `"messaging.composer"`, `"messaging.thread"`, `"templates"`, `"triggers"`.

## 10. Acceptance demo (end of M2)

Owner-driven happy path against `docker compose up`:

1. Log in as admin.
2. Edit a template — change body copy, save, see updated_at bump.
3. Toggle the "Przypomnienie o odbiorze" trigger off then back on.
4. Create a client + order. Status auto-fires "Zlecenie przyjęte" trigger → message row visible in OrderDrawer thread → timeline shows STATUS_CHANGED + MESSAGE_SENT.
5. Click "Wyślij wiadomość" in the drawer → composer with template picker → preview → send → row in thread immediately.
6. Manually invoke the scheduled-trigger endpoint (or wait until 09:00 PL with a fast clock) → reminder message fires for orders with `planned_pickup_at = today + 1 day`.
7. Idempotency: re-fire the same status change → no duplicate message row.

All of this works on logging gateways — INFO log lines in `docker compose logs api` substitute for real provider calls.
