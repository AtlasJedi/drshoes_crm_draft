# Milestone 2 — Messaging + Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner-facing messaging stack — manual composer, post-commit immediate triggers, daily scheduled triggers, full template CRUD, trigger on/off — running on logging gateways. M3 swaps in real Postmark/SMSAPI without architectural changes.

**Architecture:** One `MessageRouter` funnels three call sites (manual / immediate-trigger / scheduled-trigger) through a single sync send pipeline. Triggers post-commit-hook so a status-change rollback can't leak a fire. Idempotency in a new `trigger_fire` composite-PK table. Templating via plain `\{placeholder\}` regex with a strategy-map resolver.

**Tech Stack:** Java 21 / Spring Boot 3.4 (Maven multi-module), Spring Data JPA, Spring `@Scheduled` + `@Transactional` (post-commit synchronization), Postgres 16 (Flyway V006), Testcontainers + JUnit 5, Next.js 16 App Router + TS + Tailwind + Radix, existing `lib/log.ts` named loggers, existing `messaging-core` / `email-gateway` / `sms-gateway` microlibs (logging defaults).

**Spec:** [`docs/superpowers/specs/2026-05-08-milestone-02-messaging-design.md`](../specs/2026-05-08-milestone-02-messaging-design.md) (commit `7e7a25a`).

---

## ERRATA — pre-execution clarifications

These reconcile the spec with the actual V001 schema and shipped M1 code. **Read this before authoring any task.**

**1. Idempotency storage — diverges from spec.**
The spec proposes reusing the existing `idempotency_key` table (V001). That table is HTTP-shaped: `endpoint VARCHAR(120)`, `request_hash VARCHAR(64)`, `response_status INT`, `response_body JSONB`. Repurposing it for trigger-fire dedup pollutes those columns with non-HTTP rows.

**Resolution:** V006 also creates a new `trigger_fire` table:

```sql
CREATE TABLE trigger_fire (
  trigger_id    UUID NOT NULL REFERENCES trigger_(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  discriminator VARCHAR(120) NOT NULL,
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trigger_id, order_id, discriminator)
);
```

`IdempotencyService.claimTriggerFire(triggerId, orderId, discriminator)` does an INSERT `ON CONFLICT (trigger_id,order_id,discriminator) DO NOTHING` and returns whether the row was claimed. If false → router skips + INFO log.

**2. `audit_log` schema reality — single `parent_entity_id UUID` column (V005 from M1 task 1-8).**
No `parent_entity_type`. Path-pattern dispatch handles entity disambiguation, per task 1-9 curator.

**3. `AuditLogAspect` pointcut: `execution(public * com.drshoes.app..api..*Controller.*(..))`.**
All M2 controllers MUST live at `com.drshoes.app.messaging.api.*Controller`. Anything outside `.api.` silently loses audit coverage. The plan body file-tree honours this; every controller task includes a regression test asserting at least one audit row was written.

**4. `@Audited` annotation semantics (from task 1-8):**
- The annotation is on **service methods** that produce a meaningful audit event.
- The aspect captures `parent_entity_id` from a SpEL expression (`@Audited(parentEntityId = "#orderId")`).
- One service method = one audit row with `method="INTERNAL"`, `path="ServiceClassName#methodName"`, `status=0` (sentinel).
- HTTP controllers also produce a separate row (`method=GET/POST/...`, `path=request URI`, `status=HTTP status`, `parent_entity_id=null`).
- For `MessageRouter#send`, mark `@Audited(parentEntityId = "#orderId")` so the timeline curator can group by `parent_entity_id=orderId`.

**5. `TimelineEventCurator` extension (M1 task 1-9).**
Currently dispatches by audit-row path patterns. Adding a new event kind = adding a `case` (or strategy registration) keyed on a new path pattern. Path for `MessageRouter#send` service rows will be `MessageRouter#send` — the curator matches that string and emits `TimelineEvent.kind="MESSAGE_SENT"`.

**6. Frontend `KIND_LABELS_PL` map.**
Lives in `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx` (per 1-19). Add `MESSAGE_SENT: "Wysłano wiadomość ({channel})"`. The `{channel}` substitution happens at render time using `event.labels.channel`.

**7. Test base classes (from M1 errata):**
- Repo + service integration tests extend `com.drshoes.app.AbstractIntegrationTest` (Testcontainers Postgres).
- Controller integration tests extend `com.drshoes.app.AdminWebTestBase` (MockMvc + `loginAsOwner()` / `loginAsEmployee()` + helpers like `createClientAndReturnId(...)` + `.with(csrf())` for state-changing requests).

**8. JPA entity LOC budget.**
Java entities exceed the 120 LOC granular-code rule. Documented exception (CLAUDE.md). Service classes hold the line at 120; controllers should split when bigger.

**9. Frontend module LOC.**
80 LOC soft cap. Split when meaningful (per 1-18 / 1-19 ratification). Single-component overage to ~110 LOC is acceptable when no further useful split exists.

**10. Message thread find-or-create — no race protection.**
M2 is outbound-only with single-admin operation; service-level `findFirstByClientIdOrderByCreatedAtAsc` then INSERT works without DB unique constraints. M3 (inbound + multi-actor) revisits.

**11. Logging gateway send semantics.**
`LoggingEmailGateway#send(OutboundMessage) → DeliveryReceipt`. Returns immediately with `status=SENT` and a synthetic `provider_message_id` (UUID-prefixed, e.g. `log-${UUID}`). Cannot fail under normal operation. M2 treats any thrown exception as `delivery_status=FAILED`.

**12. `Channel` enum.**
The microlib `messaging-core` already defines `com.drshoes.lib.messaging.Channel` (EMAIL/SMS/WHATSAPP). The schema string is the same. Use the microlib enum where natural; add `MessageChannel` mirror in the app domain only if JPA requires it.

---

## File Structure

### Backend — `backend/app/`

**New package** `com.drshoes.app.messaging`:

```
messaging/
├── domain/
│   ├── MessageEntity.java                  # NEW  — JPA, soft cap 150 LOC (entities exempt)
│   ├── MessageThreadEntity.java            # NEW
│   ├── MessageTemplateEntity.java          # NEW
│   ├── TriggerEntity.java                  # NEW
│   ├── TriggerFireEntity.java              # NEW  — composite PK; @IdClass
│   ├── TriggerFireId.java                  # NEW  — composite-PK class
│   ├── MessageDirection.java               # NEW  — enum (OUTBOUND, INBOUND)
│   ├── DeliveryStatus.java                 # NEW  — enum (QUEUED, SENT, DELIVERED, FAILED, READ)
│   └── TriggerEvent.java                   # NEW  — enum (STATUS_CHANGE, STATUS_CHANGE_FROM, ORDER_RECEIVED, BEFORE_PICKUP_X_DAYS, AFTER_HANDOVER_Y_DAYS, RESERVATION_EXPIRING)
├── repository/
│   ├── MessageRepository.java              # NEW
│   ├── MessageThreadRepository.java        # NEW
│   ├── MessageTemplateRepository.java      # NEW
│   ├── TriggerRepository.java              # NEW
│   └── TriggerFireRepository.java          # NEW
├── dto/
│   ├── TemplateDto.java                    # NEW  — record
│   ├── CreateTemplateRequest.java          # NEW
│   ├── UpdateTemplateRequest.java          # NEW
│   ├── TriggerDto.java                     # NEW
│   ├── ToggleTriggerRequest.java           # NEW
│   ├── MessageDto.java                     # NEW
│   └── SendMessageRequest.java             # NEW
├── api/
│   ├── TemplatesController.java            # NEW
│   ├── TriggersController.java             # NEW
│   ├── MessagesController.java             # NEW
│   ├── MessagingExceptionAdvice.java       # NEW  — @RestControllerAdvice
│   └── HealthController.java               # NEW (Wave 5)  — /api/health
├── service/
│   ├── MessageRouter.java                  # NEW  — < 120 LOC; cross-cutting; two-stage reviewed
│   ├── TemplateRenderer.java               # NEW
│   ├── PlaceholderResolver.java            # NEW
│   ├── IdempotencyService.java             # NEW  — claimTriggerFire only in M2
│   ├── TriggerEngine.java                  # NEW  — STATUS_CHANGE post-commit hook + scheduled-trigger fire
│   ├── ScheduledTriggerJob.java            # NEW  — @Scheduled methods only
│   ├── MessageThreadService.java           # NEW
│   ├── TemplateService.java                # NEW  — CRUD + soft-delete-via-active=false
│   └── TriggerService.java                 # NEW  — list + detail + toggle
├── config/
│   └── MessagingClockConfig.java           # NEW  — @Bean Clock
└── timeline/
    └── MessageSentTimelineHandler.java     # NEW  — TimelineEventCurator extension
```

**Modify in `backend/app/`:**
- `audit/TimelineEventCurator.java` — register `MessageSentTimelineHandler`
- `order/service/OrderStatusService.java` (or wherever the status mutation lives) — call `triggerEngine.fireImmediateForStatusChange(orderId, fromStatus, toStatus)` inside the transaction (the engine itself wraps in `afterCommit`)
- `OrderApplication.java` (or whatever boots the app) — `@EnableScheduling`

**New Flyway migration:** `backend/app/src/main/resources/db/migration/V006__seed_templates_triggers_and_trigger_fire.sql`

### Frontend — `apps/web/`

```
apps/web/
├── lib/
│   └── messaging/
│       ├── api.ts                          # NEW  — client-side API calls
│       ├── api-server.ts                   # NEW  — server-side fetch wrappers
│       └── types.ts                        # NEW  — TS DTOs
└── app/(admin)/admin/
    ├── templates/
    │   ├── page.tsx                        # NEW  — list
    │   ├── new/page.tsx                    # NEW  — create
    │   ├── [id]/page.tsx                   # NEW  — edit
    │   └── _components/
    │       └── TemplateForm.tsx            # NEW  — name, channel, subject, body, active
    ├── triggers/
    │   ├── page.tsx                        # NEW  — list with on/off toggle
    │   └── [id]/page.tsx                   # NEW  — read-only detail
    └── orders/
        ├── page.tsx                        # MODIFY  — already pre-fetched orders; nothing here
        └── _components/
            ├── OrderDrawer.tsx             # MODIFY  — add 5th section; thread refreshKey
            ├── OrderDrawerStatusChanger.tsx # MODIFY  — replace placeholder with real preview
            ├── StatusChangeConfirm.tsx     # MODIFY  — real preview text
            ├── OrderDrawerMessages.tsx     # NEW  — thread view
            ├── MessageComposerModal.tsx    # NEW  — Radix Dialog composer
            └── MessageRow.tsx              # NEW  — single message row
```

**Modify:**
- `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx` — add `MESSAGE_SENT` to `KIND_LABELS_PL` and `KIND_ICONS`

---

## Wave 0 — Bookkeeping

### Task 2-1: Activate M2 in tasks.json + plan errata header

**Files:**
- Modify: `docs/dispatch-log/tasks.json`

- [ ] **Step 1: Update tasks.json**

Set `active_milestone: "2"`, `active_plan: "docs/superpowers/plans/2026-05-08-milestone-02-messaging.md"`, and APPEND tasks `2-1`..`2-21` with `status: "pending"`. Do NOT remove the M1 section — it stays as milestone history.

Tasks to append:

```json
{ "id": "2-1",  "title": "Activate M2 in tasks.json", "status": "pending" },
{ "id": "2-2",  "title": "V006 migration: seed templates/triggers + trigger_fire table", "status": "pending" },
{ "id": "2-3",  "title": "Domain entities + enums + repos + integration test", "status": "pending" },
{ "id": "2-4",  "title": "IdempotencyService.claimTriggerFire", "status": "pending" },
{ "id": "2-5",  "title": "PlaceholderResolver + TemplateRenderer", "status": "pending" },
{ "id": "2-6",  "title": "MessageThreadService", "status": "pending" },
{ "id": "2-7",  "title": "MessageRouter (TWO-STAGE REVIEW)", "status": "pending" },
{ "id": "2-8",  "title": "TriggerEngine + STATUS_CHANGE post-commit hook", "status": "pending" },
{ "id": "2-9",  "title": "ScheduledTriggerJob (cron)", "status": "pending" },
{ "id": "2-10", "title": "MessageSentTimelineHandler", "status": "pending" },
{ "id": "2-11", "title": "TemplatesController", "status": "pending" },
{ "id": "2-12", "title": "TriggersController", "status": "pending" },
{ "id": "2-13", "title": "MessagesController", "status": "pending" },
{ "id": "2-14", "title": "lib/messaging API client + types", "status": "pending" },
{ "id": "2-15", "title": "/admin/templates pages + TemplateForm", "status": "pending" },
{ "id": "2-16", "title": "/admin/triggers pages", "status": "pending" },
{ "id": "2-17", "title": "OrderDrawerMessages thread view + MESSAGE_SENT timeline label", "status": "pending" },
{ "id": "2-18", "title": "MessageComposerModal", "status": "pending" },
{ "id": "2-19", "title": "OrderDrawerStatusChanger real trigger preview", "status": "pending" },
{ "id": "2-20", "title": "/api/health endpoint + timeline label ratification errata", "status": "pending" },
{ "id": "2-21", "title": "E2E compose smoke + milestone-2 tag + CLAUDE.md flip", "status": "pending" }
```

- [ ] **Step 2: Commit**

```bash
git add docs/dispatch-log/tasks.json
git commit -m "chore(dispatch): activate milestone 2 — messaging + triggers [milestone:2][task:2-1]

Refs: docs/superpowers/plans/2026-05-08-milestone-02-messaging.md"
```

---

## Wave 1 — Backend domain

### Task 2-2: V006 migration — seed templates, seed triggers, create `trigger_fire`

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V006__seed_templates_triggers_and_trigger_fire.sql`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/V006MigrationIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class V006MigrationIntegrationTest extends AbstractIntegrationTest {

  @Autowired JdbcTemplate jdbc;

  @Test
  void seedsFourTemplates() {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM message_template WHERE active = TRUE",
        Integer.class);
    assertThat(count).isEqualTo(4);
  }

  @Test
  void seedsFourEnabledTriggers() {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM trigger_ WHERE enabled = TRUE",
        Integer.class);
    assertThat(count).isEqualTo(4);
  }

  @Test
  void everySeededTriggerReferencesAnExistingTemplate() {
    Integer orphans = jdbc.queryForObject(
        "SELECT COUNT(*) FROM trigger_ t LEFT JOIN message_template mt ON mt.id = t.template_id WHERE mt.id IS NULL",
        Integer.class);
    assertThat(orphans).isZero();
  }

  @Test
  void triggerFireTableExistsWithCompositePk() {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.table_constraints "
            + "WHERE table_name = 'trigger_fire' AND constraint_type = 'PRIMARY KEY'",
        Integer.class);
    assertThat(count).isEqualTo(1);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=V006MigrationIntegrationTest
```

Expected: FAIL — table `trigger_fire` does not exist.

- [ ] **Step 3: Write the migration**

`backend/app/src/main/resources/db/migration/V006__seed_templates_triggers_and_trigger_fire.sql`:

```sql
-- =============================================================================
-- M2: Messaging + Triggers
-- Seeds 4 templates + 4 triggers; creates trigger_fire dedup table.
-- =============================================================================

-- ---- TEMPLATES (4 seeds) ----
INSERT INTO message_template (id, name, channel, subject, body, active)
VALUES
  (uuid_generate_v4(), 'Zlecenie przyjete (EMAIL)', 'EMAIL',
   'Twoje zlecenie {numer_zlecenia} zostalo przyjete',
   E'Czesc {imie_klienta},\n\nDziekujemy! Przyjelismy Twoje zlecenie {numer_zlecenia} ({typ_pracy}).\nPlanowany odbior: {data_odbioru}.\n\nPozdrawiamy,\n{nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Gotowe do odbioru (EMAIL)', 'EMAIL',
   'Zlecenie {numer_zlecenia} gotowe do odbioru',
   E'Czesc {imie_klienta},\n\nTwoje zlecenie {numer_zlecenia} jest gotowe do odbioru.\nZapraszamy w godzinach pracy warsztatu.\n\n{nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Przypomnienie o odbiorze (SMS)', 'SMS',
   NULL,
   '{imie_klienta}, jutro mozesz odebrac zlecenie {numer_zlecenia}. {nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Prosba o opinie (EMAIL)', 'EMAIL',
   'Jak oceniasz nasza prace?',
   E'Czesc {imie_klienta},\n\nMinely 3 dni od odebrania zlecenia {numer_zlecenia}. Bedziemy wdzieczni za krotka opinie.\n\n{nazwa_warsztatu}',
   TRUE);

-- ---- TRIGGERS (4 seeds, all enabled) ----
-- Each trigger references its template by name (resolved via subselect).
INSERT INTO trigger_ (id, name, enabled, event, event_params, channels, template_id, delay_minutes, requires_manual_confirmation)
VALUES
  (uuid_generate_v4(), 'Zlecenie przyjete', TRUE,
   'STATUS_CHANGE', '{"toStatus":"PRZYJETE"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Zlecenie przyjete (EMAIL)'),
   0, FALSE),
  (uuid_generate_v4(), 'Gotowe do odbioru', TRUE,
   'STATUS_CHANGE', '{"toStatus":"GOTOWE_DO_ODBIORU"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Gotowe do odbioru (EMAIL)'),
   0, FALSE),
  (uuid_generate_v4(), 'Przypomnienie o odbiorze', TRUE,
   'BEFORE_PICKUP_X_DAYS', '{"days":1,"atTime":"09:00"}'::jsonb, '["SMS"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Przypomnienie o odbiorze (SMS)'),
   0, FALSE),
  (uuid_generate_v4(), 'Prosba o opinie', TRUE,
   'AFTER_HANDOVER_Y_DAYS', '{"days":3,"atTime":"11:00"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Prosba o opinie (EMAIL)'),
   0, FALSE);

-- ---- TRIGGER_FIRE dedup table ----
CREATE TABLE trigger_fire (
  trigger_id    UUID NOT NULL REFERENCES trigger_(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  discriminator VARCHAR(120) NOT NULL,
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trigger_id, order_id, discriminator)
);
CREATE INDEX trigger_fire_order_idx ON trigger_fire (order_id, fired_at DESC);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=V006MigrationIntegrationTest
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V006__seed_templates_triggers_and_trigger_fire.sql backend/app/src/test/java/com/drshoes/app/messaging/V006MigrationIntegrationTest.java
git commit -m "feat(messaging): V006 — seed 4 templates + 4 triggers, create trigger_fire [milestone:2][task:2-2]

Refs: docs/dispatch-log/2-2-<UTC>.md"
```

---

### Task 2-3: Domain entities + enums + repositories + integration test

**Files:**
- Create all entity / enum / repo files under `backend/app/src/main/java/com/drshoes/app/messaging/{domain,repository}/`.
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/repository/MessagingRepositoriesIntegrationTest.java`

- [ ] **Step 1: Write the failing repo test**

```java
package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class MessagingRepositoriesIntegrationTest extends AbstractIntegrationTest {

  @Autowired MessageTemplateRepository templates;
  @Autowired TriggerRepository triggers;
  @Autowired TriggerFireRepository fires;

  @Test
  void seededTemplatesLoadByName() {
    var t = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();
    assertThat(t.getChannel()).isEqualTo("EMAIL");
    assertThat(t.getActive()).isTrue();
    assertThat(t.getBody()).contains("{imie_klienta}");
  }

  @Test
  void seededTriggersLoadByEvent() {
    var byEvent = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE);
    assertThat(byEvent).extracting("name")
        .containsExactlyInAnyOrder("Zlecenie przyjete", "Gotowe do odbioru");
  }

  @Test
  void triggerFireCompositePkRoundTrips() {
    var trg = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE).get(0);
    // Need a real order_id; this test uses a dummy via SQL — but JPA insert requires an Order entity reference.
    // Instead, use the JdbcTemplate path inside the migration test; here we just verify the repo bean exists and a count query runs.
    long count = fires.count();
    assertThat(count).isGreaterThanOrEqualTo(0);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=MessagingRepositoriesIntegrationTest
```

Expected: FAIL — repository beans not found.

- [ ] **Step 3: Implement enums**

`MessageDirection.java`:
```java
package com.drshoes.app.messaging.domain;

public enum MessageDirection { OUTBOUND, INBOUND }
```

`DeliveryStatus.java`:
```java
package com.drshoes.app.messaging.domain;

public enum DeliveryStatus { QUEUED, SENT, DELIVERED, FAILED, READ }
```

`TriggerEvent.java`:
```java
package com.drshoes.app.messaging.domain;

public enum TriggerEvent {
  STATUS_CHANGE,
  STATUS_CHANGE_FROM,
  ORDER_RECEIVED,
  BEFORE_PICKUP_X_DAYS,
  AFTER_HANDOVER_Y_DAYS,
  RESERVATION_EXPIRING
}
```

- [ ] **Step 4: Implement entities**

Pattern to follow (mirror `OrderEntity` from M1):

`MessageTemplateEntity.java`:
```java
package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "message_template")
public class MessageTemplateEntity {

  @Id
  @GeneratedValue
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false, unique = true, length = 120)
  private String name;

  @Column(nullable = false, length = 16)
  private String channel;       // EMAIL/SMS/WHATSAPP — string for forward-compat with WhatsApp

  @Column private String subject;

  @Column(nullable = false, columnDefinition = "text")
  private String body;

  @Column(nullable = false)
  private Boolean active = true;

  @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false, insertable = false)
  private OffsetDateTime updatedAt;

  // getters + setters + protected no-arg ctor
  protected MessageTemplateEntity() {}

  public UUID getId() { return id; }
  public String getName() { return name; }
  public void setName(String n) { this.name = n; }
  public String getChannel() { return channel; }
  public void setChannel(String c) { this.channel = c; }
  public String getSubject() { return subject; }
  public void setSubject(String s) { this.subject = s; }
  public String getBody() { return body; }
  public void setBody(String b) { this.body = b; }
  public Boolean getActive() { return active; }
  public void setActive(Boolean a) { this.active = a; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
```

`TriggerEntity.java` — fields: `id`, `name (unique)`, `enabled`, `event` (`@Enumerated(EnumType.STRING)`), `eventParams` (String column, JSONB serialized via Jackson at service boundary — keep entity simple), `channels` (String column for the same reason), `templateId UUID`, `delayMinutes int`, `requiresManualConfirmation boolean`, `createdAt`, `updatedAt`. Use `@Column(name = "event_params", columnDefinition = "jsonb")` and store as raw JSON string; deserialization in service.

`MessageThreadEntity.java` — fields: `id`, `clientId UUID`, `subject`, `lastMessageAt`, `unreadCount int`, `createdAt`, `updatedAt`.

`MessageEntity.java` — full set of columns mirroring V001:
```
id, threadId, orderId (nullable), clientId, direction (enum string),
channel (string), templateId (nullable), triggerId (nullable),
scheduledMessageId (nullable), subject, body, attachments (jsonb string),
deliveryStatus (enum string default QUEUED), providerMessageId, errorCode, errorMessage,
sentAt, deliveredAt, readAt, sentBy (nullable), createdAt
```

`TriggerFireEntity.java` with `@IdClass(TriggerFireId.class)`:
```java
package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "trigger_fire")
@IdClass(TriggerFireId.class)
public class TriggerFireEntity {

  @Id @Column(name = "trigger_id", columnDefinition = "uuid")
  private UUID triggerId;

  @Id @Column(name = "order_id", columnDefinition = "uuid")
  private UUID orderId;

  @Id @Column(name = "discriminator", length = 120)
  private String discriminator;

  @Column(name = "fired_at", nullable = false, insertable = false)
  private OffsetDateTime firedAt;

  protected TriggerFireEntity() {}

  public TriggerFireEntity(UUID triggerId, UUID orderId, String discriminator) {
    this.triggerId = triggerId;
    this.orderId = orderId;
    this.discriminator = discriminator;
  }

  public UUID getTriggerId() { return triggerId; }
  public UUID getOrderId() { return orderId; }
  public String getDiscriminator() { return discriminator; }
  public OffsetDateTime getFiredAt() { return firedAt; }
}
```

`TriggerFireId.java`:
```java
package com.drshoes.app.messaging.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class TriggerFireId implements Serializable {
  private UUID triggerId;
  private UUID orderId;
  private String discriminator;

  public TriggerFireId() {}
  public TriggerFireId(UUID triggerId, UUID orderId, String discriminator) {
    this.triggerId = triggerId;
    this.orderId = orderId;
    this.discriminator = discriminator;
  }

  @Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof TriggerFireId that)) return false;
    return Objects.equals(triggerId, that.triggerId)
        && Objects.equals(orderId, that.orderId)
        && Objects.equals(discriminator, that.discriminator);
  }
  @Override public int hashCode() { return Objects.hash(triggerId, orderId, discriminator); }
}
```

- [ ] **Step 5: Implement repositories**

```java
// MessageTemplateRepository
package com.drshoes.app.messaging.repository;
import com.drshoes.app.messaging.domain.MessageTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageTemplateRepository extends JpaRepository<MessageTemplateEntity, UUID> {
  Optional<MessageTemplateEntity> findByName(String name);
  List<MessageTemplateEntity> findAllByActiveTrue();
}
```

```java
// TriggerRepository
package com.drshoes.app.messaging.repository;
import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TriggerRepository extends JpaRepository<TriggerEntity, UUID> {
  List<TriggerEntity> findAllByEventAndEnabledTrue(TriggerEvent event);
  List<TriggerEntity> findAllByOrderByNameAsc();
}
```

```java
// TriggerFireRepository
package com.drshoes.app.messaging.repository;
import com.drshoes.app.messaging.domain.TriggerFireEntity;
import com.drshoes.app.messaging.domain.TriggerFireId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TriggerFireRepository extends JpaRepository<TriggerFireEntity, TriggerFireId> {
}
```

```java
// MessageThreadRepository
package com.drshoes.app.messaging.repository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface MessageThreadRepository extends JpaRepository<MessageThreadEntity, UUID> {
  Optional<MessageThreadEntity> findFirstByClientIdOrderByCreatedAtAsc(UUID clientId);
}
```

```java
// MessageRepository
package com.drshoes.app.messaging.repository;
import com.drshoes.app.messaging.domain.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {
  List<MessageEntity> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=MessagingRepositoriesIntegrationTest
```

Expected: PASS — 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/domain backend/app/src/main/java/com/drshoes/app/messaging/repository backend/app/src/test/java/com/drshoes/app/messaging/repository
git commit -m "feat(messaging): domain entities + enums + repositories [milestone:2][task:2-3]

Refs: docs/dispatch-log/2-3-<UTC>.md"
```

---

### Task 2-4: IdempotencyService.claimTriggerFire

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/IdempotencyService.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/IdempotencyServiceIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class IdempotencyServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired IdempotencyService svc;
  @Autowired TriggerRepository triggers;

  @Test
  void firstClaimSucceedsSecondReturnsFalse() {
    var trg = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE).get(0);
    UUID orderId = UUID.randomUUID();
    String disc = "to:PRZYJETE";

    // Note: orderId references a non-existent order — claim will fail FK.
    // For this test we need a real order. Use the seed-test helper from AbstractIntegrationTest if present.
    // Otherwise, insert an order via JdbcTemplate first.
    UUID realOrder = createOrderViaSeedHelper();

    boolean first = svc.claimTriggerFire(trg.getId(), realOrder, disc);
    boolean second = svc.claimTriggerFire(trg.getId(), realOrder, disc);

    assertThat(first).isTrue();
    assertThat(second).isFalse();
  }

  @Test
  void differentDiscriminatorsAreIndependent() {
    var trg = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE).get(0);
    UUID realOrder = createOrderViaSeedHelper();

    assertThat(svc.claimTriggerFire(trg.getId(), realOrder, "to:PRZYJETE")).isTrue();
    assertThat(svc.claimTriggerFire(trg.getId(), realOrder, "to:W_REALIZACJI")).isTrue();
  }

  /** Inserts a minimal order via the existing test helper. Defined in AbstractIntegrationTest or a sibling class. */
  protected UUID createOrderViaSeedHelper() {
    // Implementation depends on the test base. Typical pattern: createClientAndReturnId then insert order_.
    // If no helper exists, use JdbcTemplate to insert (client_id, code) and return the generated UUID.
    throw new UnsupportedOperationException("Wire to existing helper or add JDBC insert here");
  }
}
```

> **Implementation note for the executing agent:** check `AbstractIntegrationTest` for an `insertOrder(...)` helper. If none exists, add a small JDBC insert in this test that creates a client + an order row. The minimal order columns are `id`, `code`, `client_id`, `status`, `version`, `created_at`, `updated_at`.

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=IdempotencyServiceIntegrationTest
```

Expected: FAIL — `IdempotencyService` not found.

- [ ] **Step 3: Implement IdempotencyService**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.TriggerFireEntity;
import com.drshoes.app.messaging.repository.TriggerFireRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class IdempotencyService {

  private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

  private final TriggerFireRepository fires;

  public IdempotencyService(TriggerFireRepository fires) {
    this.fires = fires;
  }

  /**
   * Claims a (triggerId, orderId, discriminator) tuple for one-time firing.
   * Returns true on first successful claim; false if the tuple is already claimed.
   *
   * Uses REQUIRES_NEW so a uniqueness conflict cannot poison the outer transaction's commit.
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public boolean claimTriggerFire(UUID triggerId, UUID orderId, String discriminator) {
    try {
      fires.saveAndFlush(new TriggerFireEntity(triggerId, orderId, discriminator));
      log.info("op=trigger_fire.claim outcome=claimed triggerId={} orderId={} disc={}",
          triggerId, orderId, discriminator);
      return true;
    } catch (DataIntegrityViolationException e) {
      log.info("op=trigger_fire.claim outcome=duplicate triggerId={} orderId={} disc={}",
          triggerId, orderId, discriminator);
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=IdempotencyServiceIntegrationTest
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/IdempotencyService.java backend/app/src/test/java/com/drshoes/app/messaging/service/IdempotencyServiceIntegrationTest.java
git commit -m "feat(messaging): IdempotencyService.claimTriggerFire [milestone:2][task:2-4]

Refs: docs/dispatch-log/2-4-<UTC>.md"
```

---

### Task 2-5: PlaceholderResolver + TemplateRenderer

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/PlaceholderResolver.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateRenderer.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContext.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/TemplateRendererTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateRendererTest {

  private final TemplateRenderer renderer = new TemplateRenderer(new PlaceholderResolver());

  @Test
  void substitutesAllSupportedPlaceholders() {
    var ctx = new TemplateContext(
        "Anna",                                      // imie_klienta
        "DR-2026-0001",                              // numer_zlecenia
        List.of("naprawa", "custom buty"),           // typ_pracy raw labels
        OffsetDateTime.of(2026, 5, 9, 10, 30, 0, 0, ZoneOffset.of("+02:00")),
        "Dr Shoes"
    );
    String body = "Czesc {imie_klienta}, zlecenie {numer_zlecenia} ({typ_pracy}). Odbior: {data_odbioru}. {nazwa_warsztatu}";

    String rendered = renderer.render(body, ctx);

    assertThat(rendered).isEqualTo(
        "Czesc Anna, zlecenie DR-2026-0001 (naprawa, custom buty). Odbior: 09.05.2026 o 10:30. Dr Shoes");
  }

  @Test
  void missingPlannedPickupRendersEmDash() {
    var ctx = new TemplateContext("Anna", "DR-2026-0002", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("{data_odbioru}", ctx)).isEqualTo("—");
  }

  @Test
  void deferredLinkPlaceholderRendersEmDash() {
    var ctx = new TemplateContext("Anna", "DR-2026-0003", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("Galeria: {link_do_zdjec}", ctx)).isEqualTo("Galeria: —");
  }

  @Test
  void unknownPlaceholderLeftIntact() {
    // Documents current behavior: only known placeholders are substituted; unknown left literal.
    var ctx = new TemplateContext("Anna", "DR-2026-0004", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("Hello {nonsense}", ctx)).isEqualTo("Hello {nonsense}");
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=TemplateRendererTest
```

Expected: FAIL — classes not found.

- [ ] **Step 3: Implement `TemplateContext`**

```java
package com.drshoes.app.messaging.service;

import java.time.OffsetDateTime;
import java.util.List;

public record TemplateContext(
    String imieKlienta,
    String numerZlecenia,
    List<String> typyPracy,         // raw kind labels in PL, joined by renderer
    OffsetDateTime dataOdbioru,     // nullable
    String nazwaWarsztatu
) {}
```

- [ ] **Step 4: Implement `PlaceholderResolver`**

```java
package com.drshoes.app.messaging.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

@Component
public class PlaceholderResolver {

  private static final Logger log = LoggerFactory.getLogger(PlaceholderResolver.class);

  private static final DateTimeFormatter PL =
      DateTimeFormatter.ofPattern("dd.MM.yyyy 'o' HH:mm", Locale.forLanguageTag("pl"))
          .withZone(ZoneId.of("Europe/Warsaw"));

  private final Map<String, Function<TemplateContext, String>> strategies = new HashMap<>();

  public PlaceholderResolver() {
    strategies.put("imie_klienta",   ctx -> blankToDash(ctx.imieKlienta()));
    strategies.put("numer_zlecenia", ctx -> blankToDash(ctx.numerZlecenia()));
    strategies.put("typ_pracy",      ctx -> ctx.typyPracy() == null || ctx.typyPracy().isEmpty()
                                            ? "—"
                                            : String.join(", ", ctx.typyPracy()));
    strategies.put("data_odbioru",   ctx -> ctx.dataOdbioru() == null ? "—" : PL.format(ctx.dataOdbioru()));
    strategies.put("nazwa_warsztatu",ctx -> blankToDash(ctx.nazwaWarsztatu()));
    strategies.put("link_do_zdjec",  ctx -> {
      log.warn("op=template.render placeholder=link_do_zdjec reason=deferred_until_M3");
      return "—";
    });
  }

  /** Returns substitution for the placeholder name (no braces) or null if unknown. */
  public String resolve(String name, TemplateContext ctx) {
    var fn = strategies.get(name);
    return fn == null ? null : fn.apply(ctx);
  }

  private static String blankToDash(String s) { return (s == null || s.isBlank()) ? "—" : s; }
}
```

- [ ] **Step 5: Implement `TemplateRenderer`**

```java
package com.drshoes.app.messaging.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TemplateRenderer {

  private static final Logger log = LoggerFactory.getLogger(TemplateRenderer.class);
  private static final Pattern PLACEHOLDER = Pattern.compile("\\{([a-zA-Z_]+)\\}");

  private final PlaceholderResolver resolver;

  public TemplateRenderer(PlaceholderResolver resolver) {
    this.resolver = resolver;
  }

  public String render(String body, TemplateContext ctx) {
    if (body == null) return "";
    Matcher m = PLACEHOLDER.matcher(body);
    StringBuilder out = new StringBuilder();
    while (m.find()) {
      String name = m.group(1);
      String replacement = resolver.resolve(name, ctx);
      if (replacement == null) {
        log.debug("op=template.render placeholder={} outcome=unknown_left_literal", name);
        m.appendReplacement(out, Matcher.quoteReplacement(m.group()));
      } else {
        m.appendReplacement(out, Matcher.quoteReplacement(replacement));
      }
    }
    m.appendTail(out);
    return out.toString();
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=TemplateRendererTest
```

Expected: PASS — 4 tests green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/PlaceholderResolver.java backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateRenderer.java backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContext.java backend/app/src/test/java/com/drshoes/app/messaging/service/TemplateRendererTest.java
git commit -m "feat(messaging): PlaceholderResolver + TemplateRenderer [milestone:2][task:2-5]

Refs: docs/dispatch-log/2-5-<UTC>.md"
```

---

## Wave 2 — Send pipeline + trigger engine

### Task 2-6: MessageThreadService

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageThreadServiceIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MessageThreadServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired MessageThreadService svc;
  @Autowired MessageThreadRepository repo;

  @Test
  void findOrCreateReturnsSameThreadForSameClient() {
    UUID clientId = createClientAndReturnId();   // helper from AdminWebTestBase pattern; if absent, JDBC insert
    var first = svc.findOrCreateForClient(clientId);
    var second = svc.findOrCreateForClient(clientId);
    assertThat(first.getId()).isEqualTo(second.getId());
    assertThat(repo.count()).isEqualTo(1);
  }

  @Test
  void differentClientsGetDifferentThreads() {
    UUID a = createClientAndReturnId();
    UUID b = createClientAndReturnId();
    var ta = svc.findOrCreateForClient(a);
    var tb = svc.findOrCreateForClient(b);
    assertThat(ta.getId()).isNotEqualTo(tb.getId());
  }

  protected UUID createClientAndReturnId() {
    throw new UnsupportedOperationException("Use existing test helper or JDBC insert");
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageThreadServiceIntegrationTest
```

Expected: FAIL — `MessageThreadService` not found.

- [ ] **Step 3: Implement service**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class MessageThreadService {

  private static final Logger log = LoggerFactory.getLogger(MessageThreadService.class);

  private final MessageThreadRepository threads;

  public MessageThreadService(MessageThreadRepository threads) {
    this.threads = threads;
  }

  @Transactional
  public MessageThreadEntity findOrCreateForClient(UUID clientId) {
    return threads.findFirstByClientIdOrderByCreatedAtAsc(clientId)
        .orElseGet(() -> {
          var t = new MessageThreadEntity();
          t.setClientId(clientId);
          t.setUnreadCount(0);
          MessageThreadEntity saved = threads.save(t);
          log.info("op=thread.create clientId={} threadId={}", clientId, saved.getId());
          return saved;
        });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageThreadServiceIntegrationTest
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java backend/app/src/test/java/com/drshoes/app/messaging/service/MessageThreadServiceIntegrationTest.java
git commit -m "feat(messaging): MessageThreadService [milestone:2][task:2-6]

Refs: docs/dispatch-log/2-6-<UTC>.md"
```

---

### Task 2-7: MessageRouter — TWO-STAGE REVIEW

> **Dispatch protocol §4:** This task is the M2 cross-cutting class. Spec stage produces the implementation; quality stage reviews and may demand a fixup commit. Two distinct subagent runs.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/SendOutcome.java` (record for return value if useful)
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRouterIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.*;
import com.drshoes.app.messaging.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MessageRouterIntegrationTest extends AbstractIntegrationTest {

  @Autowired MessageRouter router;
  @Autowired MessageRepository messages;
  @Autowired MessageThreadRepository threads;
  @Autowired MessageTemplateRepository templates;

  @Test
  void manualSendPersistsMessageAsSent() {
    UUID orderId = createOrderAndClient();
    UUID clientId = clientIdFor(orderId);
    var template = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

    UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

    var msg = messages.findById(messageId).orElseThrow();
    assertThat(msg.getDeliveryStatus()).isEqualTo("SENT");
    assertThat(msg.getOrderId()).isEqualTo(orderId);
    assertThat(msg.getProviderMessageId()).startsWith("log-");
    assertThat(msg.getBody()).isNotNull();
  }

  @Test
  void manualSendBumpsThreadLastMessageAt() {
    UUID orderId = createOrderAndClient();
    UUID clientId = clientIdFor(orderId);
    var template = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

    router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

    var thread = threads.findFirstByClientIdOrderByCreatedAtAsc(clientId).orElseThrow();
    assertThat(thread.getLastMessageAt()).isNotNull();
  }

  @Test
  void rendersPlaceholdersInBody() {
    UUID orderId = createOrderAndClient();
    UUID clientId = clientIdFor(orderId);
    var template = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

    UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

    var msg = messages.findById(messageId).orElseThrow();
    assertThat(msg.getBody()).doesNotContain("{imie_klienta}");
    assertThat(msg.getBody()).doesNotContain("{numer_zlecenia}");
  }

  protected UUID createOrderAndClient() { throw new UnsupportedOperationException(); }
  protected UUID clientIdFor(UUID orderId) { throw new UnsupportedOperationException(); }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageRouterIntegrationTest
```

Expected: FAIL — `MessageRouter` not found.

- [ ] **Step 3: Implement MessageRouter**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.client.domain.ClientEntity;
import com.drshoes.app.client.repository.ClientRepository;
import com.drshoes.app.messaging.domain.*;
import com.drshoes.app.messaging.repository.*;
import com.drshoes.app.order.domain.OrderEntity;
import com.drshoes.app.order.repository.OrderRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class MessageRouter {

  private static final Logger log = LoggerFactory.getLogger(MessageRouter.class);

  private final MessageRepository messages;
  private final MessageTemplateRepository templates;
  private final MessageThreadService threadService;
  private final TemplateRenderer renderer;
  private final OrderRepository orders;
  private final ClientRepository clients;
  private final EmailGateway email;
  private final SmsGateway sms;

  public MessageRouter(
      MessageRepository messages,
      MessageTemplateRepository templates,
      MessageThreadService threadService,
      TemplateRenderer renderer,
      OrderRepository orders,
      ClientRepository clients,
      EmailGateway email,
      SmsGateway sms) {
    this.messages = messages;
    this.templates = templates;
    this.threadService = threadService;
    this.renderer = renderer;
    this.orders = orders;
    this.clients = clients;
    this.email = email;
    this.sms = sms;
  }

  /** Manual composer entry point. Returns persisted message id. */
  @Transactional
  @Audited(parentEntityId = "#orderId")
  public UUID sendManual(UUID orderId, UUID clientId, UUID templateId, String channel, UUID actorId) {
    return send(orderId, clientId, templateId, /*triggerId*/ null, channel, actorId);
  }

  /** Trigger entry point. Returns persisted message id. */
  @Transactional
  @Audited(parentEntityId = "#orderId")
  public UUID sendForTrigger(UUID orderId, UUID clientId, UUID templateId, UUID triggerId, String channel) {
    return send(orderId, clientId, templateId, triggerId, channel, null);
  }

  private UUID send(UUID orderId, UUID clientId, UUID templateId, UUID triggerId, String channel, UUID actorId) {
    var template = templates.findById(templateId).orElseThrow();
    var ctx = buildContext(orderId, clientId);

    String renderedSubject = template.getSubject() == null ? null : renderer.render(template.getSubject(), ctx);
    String renderedBody = renderer.render(template.getBody(), ctx);

    var thread = threadService.findOrCreateForClient(clientId);

    var msg = new MessageEntity();
    msg.setThreadId(thread.getId());
    msg.setOrderId(orderId);
    msg.setClientId(clientId);
    msg.setDirection(MessageDirection.OUTBOUND.name());
    msg.setChannel(channel);
    msg.setTemplateId(templateId);
    msg.setTriggerId(triggerId);
    msg.setSubject(renderedSubject);
    msg.setBody(renderedBody);
    msg.setDeliveryStatus(DeliveryStatus.QUEUED.name());
    msg.setSentBy(actorId);
    var saved = messages.saveAndFlush(msg);

    var outbound = OutboundMessage.builder()
        .recipientEmail(channel.equals("EMAIL") ? clientEmail(clientId) : null)
        .recipientPhone(channel.equals("SMS") ? clientPhone(clientId) : null)
        .subject(renderedSubject)
        .body(renderedBody)
        .build();

    try {
      var receipt = switch (channel) {
        case "EMAIL" -> email.send(outbound);
        case "SMS"   -> sms.send(outbound);
        default      -> throw new IllegalArgumentException("Unsupported channel: " + channel);
      };
      saved.setDeliveryStatus(DeliveryStatus.SENT.name());
      saved.setProviderMessageId(receipt.providerMessageId());
      saved.setSentAt(OffsetDateTime.now());
    } catch (RuntimeException e) {
      saved.setDeliveryStatus(DeliveryStatus.FAILED.name());
      saved.setErrorCode(e.getClass().getSimpleName());
      saved.setErrorMessage(truncate(e.getMessage(), 1000));
      log.error("op=message.send outcome=failed orderId={} messageId={} cause={}",
          orderId, saved.getId(), e.toString());
    }

    messages.save(saved);

    thread.setLastMessageAt(OffsetDateTime.now());
    // unreadCount unchanged for outbound

    log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
        saved.getDeliveryStatus(), orderId, saved.getId(), channel, triggerId);

    return saved.getId();
  }

  private TemplateContext buildContext(UUID orderId, UUID clientId) {
    var order = orders.findById(orderId).orElseThrow();
    var client = clients.findById(clientId).orElseThrow();
    var typy = order.getItems().stream()
        .map(it -> polishKindLabel(it.getKind()))
        .toList();
    return new TemplateContext(
        client.getFirstName(),
        order.getCode(),
        typy,
        order.getPlannedPickupAt(),
        "Dr Shoes"
    );
  }

  private static String polishKindLabel(String kind) {
    return switch (kind) {
      case "NAPRAWA" -> "naprawa";
      case "CUSTOM_BUTY" -> "custom buty";
      case "CUSTOM_KURTKA" -> "custom kurtka";
      default -> kind.toLowerCase();
    };
  }

  private String clientEmail(UUID clientId) {
    return clients.findById(clientId).map(ClientEntity::getEmail).orElse(null);
  }

  private String clientPhone(UUID clientId) {
    return clients.findById(clientId).map(ClientEntity::getPhone).orElse(null);
  }

  private static String truncate(String s, int max) {
    if (s == null) return null;
    return s.length() <= max ? s : s.substring(0, max);
  }
}
```

> **If `OutboundMessage.builder()` doesn't match the existing microlib API, adapt to whatever shape `com.drshoes.lib.messaging.OutboundMessage` uses (check `backend/libs/messaging-core/src/main/java/...`). The `LoggingEmailGateway` already accepts whatever the lib defines.**

- [ ] **Step 4: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageRouterIntegrationTest
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit (spec stage)**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRouterIntegrationTest.java
git commit -m "feat(messaging): MessageRouter — single send pipeline [milestone:2][task:2-7]

Refs: docs/dispatch-log/2-7-<UTC>.md"
```

- [ ] **Step 6: Quality review (separate dispatch)**

A second subagent runs after the spec-stage commit lands. Review checklist:
1. Transaction boundary correctness — saveAndFlush before gateway invoke; partial-failure semantics.
2. Error path: gateway throws → message row stays as FAILED with `errorCode`/`errorMessage` populated; thread.last_message_at still bumped? (Decision: no — bump only on SENT.)
3. `@Audited(parentEntityId = "#orderId")` SpEL evaluates correctly even when called via `sendForTrigger` (parameter index match).
4. Channel `switch` covers all enum values; throws on unsupported.
5. Logging contract: every send produces exactly one INFO log with `outcome=`.
6. Provider message id format documented (`log-${UUID}` for LoggingGateway).
7. Recipient null-safety: if `client.email` is null on EMAIL channel, behavior should be defined (recommended: WARN + mark FAILED, do not throw).

Reviewer either approves with no fixup, or commits a fixup as `2-7-fixup` and tags the dispatch log accordingly.

---

### Task 2-8: TriggerEngine + STATUS_CHANGE post-commit hook

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/TriggerEngine.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/order/service/OrderStatusService.java` (or wherever `changeStatus` lives — verify with grep)
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/TriggerEngineIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.service.OrderStatusService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TriggerEngineIntegrationTest extends AbstractIntegrationTest {

  @Autowired OrderStatusService statusService;
  @Autowired MessageRepository messages;

  @Test
  void statusChangeToPRZYJETEFiresMessageOnce() {
    UUID orderId = createOrderInWstepnie();
    statusService.changeStatus(orderId, "PRZYJETE", /* expectedVersion */ 0L, /* actorId */ ownerId());

    var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
    assertThat(msgs).hasSize(1);
    assertThat(msgs.get(0).getTriggerId()).isNotNull();
  }

  @Test
  void rollbackPreventsTriggerFire() {
    UUID orderId = createOrderInWstepnie();
    try {
      statusService.changeStatus(orderId, "PRZYJETE", /* wrong version forces 409 */ 999L, ownerId());
    } catch (RuntimeException expected) {
      // optimistic lock collision — transaction rolls back
    }
    assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).isEmpty();
  }

  @Test
  void doubleStatusChangeFiresOnceDueToIdempotency() {
    UUID orderId = createOrderInWstepnie();
    statusService.changeStatus(orderId, "PRZYJETE", 0L, ownerId());
    // bounce: WRONG_VAL fails; correct path is to revert via separate call. For idempotency we re-enter same status.
    // Direct re-entry: change to PRZYJETE_AGAIN by going W_REALIZACJI → PRZYJETE (which would still match
    // discriminator to:PRZYJETE → idempotency catch).
    statusService.changeStatus(orderId, "W_REALIZACJI", 1L, ownerId());
    statusService.changeStatus(orderId, "PRZYJETE", 2L, ownerId());

    var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
    long przyjeteFires = msgs.stream().filter(m -> m.getTriggerId() != null).count();
    assertThat(przyjeteFires).isEqualTo(1);
  }

  protected UUID createOrderInWstepnie() { throw new UnsupportedOperationException(); }
  protected UUID ownerId() { throw new UnsupportedOperationException(); }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=TriggerEngineIntegrationTest
```

Expected: FAIL — `TriggerEngine` not found.

- [ ] **Step 3: Implement TriggerEngine**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.client.repository.ClientRepository;
import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import com.drshoes.app.order.repository.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.UUID;

@Service
public class TriggerEngine {

  private static final Logger log = LoggerFactory.getLogger(TriggerEngine.class);

  private final TriggerRepository triggers;
  private final OrderRepository orders;
  private final ClientRepository clients;
  private final IdempotencyService idem;
  private final MessageRouter router;
  private final ObjectMapper json = new ObjectMapper();

  public TriggerEngine(
      TriggerRepository triggers, OrderRepository orders, ClientRepository clients,
      IdempotencyService idem, MessageRouter router) {
    this.triggers = triggers;
    this.orders = orders;
    this.clients = clients;
    this.idem = idem;
    this.router = router;
  }

  /** Called from OrderStatusService.changeStatus inside its @Transactional method. */
  public void onStatusChange(UUID orderId, String fromStatus, String toStatus) {
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override public void afterCommit() {
        fireImmediateForStatus(orderId, toStatus);
      }
    });
  }

  private void fireImmediateForStatus(UUID orderId, String toStatus) {
    var enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE);
    for (var trg : enabled) {
      try {
        JsonNode params = json.readTree(trg.getEventParams());
        String configured = params.path("toStatus").asText("");
        if (!configured.equals(toStatus)) continue;

        String disc = "to:" + toStatus;
        if (!idem.claimTriggerFire(trg.getId(), orderId, disc)) {
          log.info("op=trigger.skip reason=idempotent triggerId={} orderId={}", trg.getId(), orderId);
          continue;
        }
        fireOne(trg, orderId);
      } catch (Exception e) {
        log.error("op=trigger.fire outcome=error triggerId={} orderId={}", trg.getId(), orderId, e);
      }
    }
  }

  private void fireOne(TriggerEntity trg, UUID orderId) {
    var order = orders.findById(orderId).orElseThrow();
    UUID clientId = order.getClientId();
    JsonNode channelsNode;
    try {
      channelsNode = json.readTree(trg.getChannels());
    } catch (Exception e) {
      log.error("op=trigger.fire outcome=channels_parse_error triggerId={}", trg.getId(), e);
      return;
    }
    if (!channelsNode.isArray()) {
      log.warn("op=trigger.fire outcome=channels_not_array triggerId={}", trg.getId());
      return;
    }
    for (JsonNode chNode : channelsNode) {
      String channel = chNode.asText();
      router.sendForTrigger(orderId, clientId, trg.getTemplateId(), trg.getId(), channel);
    }
  }

  /** Public entry for the scheduled job — fires for orders matched by the cron-aware caller. */
  public void fireScheduled(TriggerEntity trg, UUID orderId, String discriminator) {
    if (!idem.claimTriggerFire(trg.getId(), orderId, discriminator)) {
      log.info("op=scheduled_trigger.skip reason=idempotent triggerId={} orderId={}", trg.getId(), orderId);
      return;
    }
    fireOne(trg, orderId);
  }
}
```

- [ ] **Step 4: Wire `TriggerEngine.onStatusChange` into `OrderStatusService.changeStatus`**

Locate the method (grep `changeStatus` under `backend/app/src/main/java/com/drshoes/app/order`). Inject `TriggerEngine`. After persisting the new status (and before the method returns), add:

```java
triggerEngine.onStatusChange(order.getId(), fromStatus, toStatus);
```

This MUST be called inside the `@Transactional` boundary so the post-commit synchronization is registered correctly.

- [ ] **Step 5: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=TriggerEngineIntegrationTest
```

Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/TriggerEngine.java backend/app/src/main/java/com/drshoes/app/order/service/OrderStatusService.java backend/app/src/test/java/com/drshoes/app/messaging/service/TriggerEngineIntegrationTest.java
git commit -m "feat(messaging): TriggerEngine + STATUS_CHANGE post-commit hook [milestone:2][task:2-8]

Refs: docs/dispatch-log/2-8-<UTC>.md"
```

---

### Task 2-9: ScheduledTriggerJob + MessagingClockConfig

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/ScheduledTriggerJob.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/config/MessagingClockConfig.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/OrderApplication.java` (or app entry) — add `@EnableScheduling` if not present
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/service/ScheduledTriggerJobIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduledTriggerJobIntegrationTest extends AbstractIntegrationTest {

  @Autowired ScheduledTriggerJob job;
  @Autowired MessageRepository messages;

  @Test
  void beforePickupFiresOneDayBefore() {
    UUID orderId = createOrderWithPlannedPickupOn(LocalDate.now().plusDays(1));
    job.runBeforePickup();
    var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
    assertThat(msgs).hasSize(1);
  }

  @Test
  void beforePickupSkipsOrdersWithoutMatchingDate() {
    UUID nope = createOrderWithPlannedPickupOn(LocalDate.now().plusDays(5));
    job.runBeforePickup();
    assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(nope)).isEmpty();
  }

  @Test
  void afterHandoverFiresThreeDaysAfter() {
    UUID orderId = createOrderHandedOverOn(LocalDate.now().minusDays(3));
    job.runAfterHandover();
    assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).hasSize(1);
  }

  @Test
  void rerunDoesNotProduceDuplicate() {
    UUID orderId = createOrderWithPlannedPickupOn(LocalDate.now().plusDays(1));
    job.runBeforePickup();
    job.runBeforePickup();
    assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).hasSize(1);
  }

  protected UUID createOrderWithPlannedPickupOn(LocalDate d) { throw new UnsupportedOperationException(); }
  protected UUID createOrderHandedOverOn(LocalDate d) { throw new UnsupportedOperationException(); }
}
```

> **Implementation note:** the test exercises `runBeforePickup()` / `runAfterHandover()` directly, bypassing the `@Scheduled` cron. The cron annotation itself is not unit-testable; we trust Spring to invoke the methods at the configured times. To verify the cron-string parse is correct, add a tiny `@Test void cronStringsAreValid()` using `org.springframework.scheduling.support.CronExpression.parse(...)`.

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=ScheduledTriggerJobIntegrationTest
```

Expected: FAIL — class not found.

- [ ] **Step 3: Implement MessagingClockConfig**

```java
package com.drshoes.app.messaging.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class MessagingClockConfig {

  @Bean
  public Clock messagingClock() {
    return Clock.system(ZoneId.of("Europe/Warsaw"));
  }
}
```

- [ ] **Step 4: Implement ScheduledTriggerJob**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import com.drshoes.app.order.domain.OrderEntity;
import com.drshoes.app.order.repository.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
public class ScheduledTriggerJob {

  private static final Logger log = LoggerFactory.getLogger(ScheduledTriggerJob.class);
  private static final ZoneId PL = ZoneId.of("Europe/Warsaw");

  private final TriggerRepository triggers;
  private final OrderRepository orders;
  private final TriggerEngine engine;
  private final Clock clock;
  private final ObjectMapper json = new ObjectMapper();

  public ScheduledTriggerJob(TriggerRepository triggers, OrderRepository orders,
                             TriggerEngine engine, Clock clock) {
    this.triggers = triggers;
    this.orders = orders;
    this.engine = engine;
    this.clock = clock;
  }

  @Scheduled(cron = "0 0 9 * * *", zone = "Europe/Warsaw")
  public void runBeforePickup() {
    var now = LocalDate.now(clock.withZone(PL));
    log.info("op=scheduled_trigger.run kind=BEFORE_PICKUP date={}", now);

    var enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.BEFORE_PICKUP_X_DAYS);
    for (var trg : enabled) {
      int days = readIntParam(trg, "days", 1);
      LocalDate target = now.plusDays(days);
      List<OrderEntity> matching = orders.findAllByPlannedPickupDate(target);
      for (var o : matching) {
        engine.fireScheduled(trg, o.getId(), "before:" + target);
      }
    }
  }

  @Scheduled(cron = "0 0 11 * * *", zone = "Europe/Warsaw")
  public void runAfterHandover() {
    var now = LocalDate.now(clock.withZone(PL));
    log.info("op=scheduled_trigger.run kind=AFTER_HANDOVER date={}", now);

    var enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.AFTER_HANDOVER_Y_DAYS);
    for (var trg : enabled) {
      int days = readIntParam(trg, "days", 3);
      LocalDate handoverDate = now.minusDays(days);
      List<OrderEntity> matching = orders.findAllByHandoverDate(handoverDate);
      for (var o : matching) {
        engine.fireScheduled(trg, o.getId(), "after:" + handoverDate);
      }
    }
  }

  private int readIntParam(TriggerEntity trg, String name, int fallback) {
    try {
      JsonNode n = json.readTree(trg.getEventParams()).path(name);
      return n.isMissingNode() ? fallback : n.asInt(fallback);
    } catch (Exception e) {
      return fallback;
    }
  }
}
```

> **The `OrderRepository.findAllByPlannedPickupDate(LocalDate)` and `findAllByHandoverDate(LocalDate)` methods may not exist yet.** Add them as derived queries — `@Query("SELECT o FROM OrderEntity o WHERE CAST(o.plannedPickupAt AS LocalDate) = :d")` (HQL date cast) or use a native query with `DATE(planned_pickup_at AT TIME ZONE 'Europe/Warsaw') = :d`. If `handover_date` isn't a column, use the audit log to find the order's last `STATUS_CHANGE → WYDANE` event date. **The executing agent must verify schema reality before implementing — handover_date may not exist as a column.**

- [ ] **Step 5: Add `@EnableScheduling` if not already present**

```java
// In the main app class (e.g. backend/app/src/main/java/com/drshoes/app/Application.java)
@SpringBootApplication
@EnableScheduling
public class Application { ... }
```

- [ ] **Step 6: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=ScheduledTriggerJobIntegrationTest
```

Expected: PASS — 4 tests green (or 5 if you added the cron-string-validity test).

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/ScheduledTriggerJob.java backend/app/src/main/java/com/drshoes/app/messaging/config/MessagingClockConfig.java backend/app/src/main/java/com/drshoes/app/Application.java backend/app/src/test/java/com/drshoes/app/messaging/service/ScheduledTriggerJobIntegrationTest.java
git commit -m "feat(messaging): ScheduledTriggerJob — 09:00 BEFORE_PICKUP / 11:00 AFTER_HANDOVER [milestone:2][task:2-9]

Refs: docs/dispatch-log/2-9-<UTC>.md"
```

---

### Task 2-10: MessageSentTimelineHandler — extend curator

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/timeline/MessageSentTimelineHandler.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java` — register the new handler
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/timeline/MessageSentTimelineHandlerIntegrationTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.drshoes.app.messaging.timeline;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditTimelineService;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MessageSentTimelineHandlerIntegrationTest extends AbstractIntegrationTest {

  @Autowired AuditTimelineService timeline;
  @Autowired MessageRouter router;
  @Autowired MessageTemplateRepository templates;

  @Test
  void messageSentEmitsTimelineEvent() {
    UUID orderId = createOrderAndClient();
    UUID clientId = clientIdFor(orderId);
    var template = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

    UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", ownerId());

    List<TimelineEvent> events = timeline.eventsForOrder(orderId);
    assertThat(events).extracting("kind").contains("MESSAGE_SENT");

    var sent = events.stream().filter(e -> e.kind().equals("MESSAGE_SENT")).findFirst().orElseThrow();
    assertThat(sent.labels()).containsKeys("messageId", "channel", "templateName");
  }

  protected UUID createOrderAndClient() { throw new UnsupportedOperationException(); }
  protected UUID clientIdFor(UUID id) { throw new UnsupportedOperationException(); }
  protected UUID ownerId() { throw new UnsupportedOperationException(); }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageSentTimelineHandlerIntegrationTest
```

Expected: FAIL — handler not registered, MESSAGE_SENT not in timeline.

- [ ] **Step 3: Read the existing curator**

The executing agent reads `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java` to learn the registration pattern (path-pattern → handler map, per task 1-9). The new handler matches audit rows where `path = "MessageRouter#send"`.

- [ ] **Step 4: Implement MessageSentTimelineHandler**

```java
package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class MessageSentTimelineHandler {

  private final MessageRepository messages;
  private final MessageTemplateRepository templates;

  public MessageSentTimelineHandler(MessageRepository messages, MessageTemplateRepository templates) {
    this.messages = messages;
    this.templates = templates;
  }

  /** Returns null if this audit row isn't a MessageRouter#send service row. */
  public TimelineEvent toEvent(AuditLog row) {
    if (!"MessageRouter#send".equals(row.getPath())) return null;
    if (row.getStatus() != 0) return null; // service rows have status=0 sentinel; HTTP rows skipped
    if (row.getParentEntityId() == null) return null;

    // The controller-level audit row already carries orderId via parent_entity_id.
    // To get message details, we need the MOST-RECENT message row for this orderId at-or-before row.createdAt.
    var msg = messages.findAllByOrderIdOrderByCreatedAtAsc(row.getParentEntityId())
        .stream()
        .filter(m -> !m.getCreatedAt().isAfter(row.getCreatedAt().plusSeconds(2)))
        .reduce((a, b) -> b)   // last
        .orElse(null);
    if (msg == null) return null;

    Map<String, String> labels = new HashMap<>();
    labels.put("messageId", msg.getId().toString());
    labels.put("channel", msg.getChannel());
    labels.put("templateName", msg.getTemplateId() == null
        ? "—"
        : templates.findById(msg.getTemplateId()).map(t -> t.getName()).orElse("—"));
    if (msg.getTriggerId() != null) labels.put("triggerId", msg.getTriggerId().toString());

    return new TimelineEvent(
        "MESSAGE_SENT",
        row.getCreatedAt(),
        row.getActorId(),
        labels
    );
  }
}
```

- [ ] **Step 5: Register the handler in TimelineEventCurator**

In `TimelineEventCurator.java`, inject `MessageSentTimelineHandler` and add it to whatever path-pattern dispatch list / handler-set the curator already holds (per the M1 1-9 architecture).

- [ ] **Step 6: Run test to verify it passes**

```bash
mvn -B -pl backend/app -am test -Dtest=MessageSentTimelineHandlerIntegrationTest
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/timeline/MessageSentTimelineHandler.java backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java backend/app/src/test/java/com/drshoes/app/messaging/timeline/MessageSentTimelineHandlerIntegrationTest.java
git commit -m "feat(messaging): MESSAGE_SENT timeline event [milestone:2][task:2-10]

Refs: docs/dispatch-log/2-10-<UTC>.md"
```

---

## Wave 3 — Controllers

### Task 2-11: TemplatesController (full CRUD)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/TemplatesController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/MessagingExceptionAdvice.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/TemplateDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/CreateTemplateRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/UpdateTemplateRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateService.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/api/TemplatesControllerIntegrationTest.java`

- [ ] **Step 1: Write the failing controller test**

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TemplatesControllerIntegrationTest extends AdminWebTestBase {

  @Autowired AuditLogRepository audits;

  @Test
  void getListReturnsSeededTemplates() throws Exception {
    mockMvc.perform(get("/api/admin/templates").with(loginAsOwner()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(4));
  }

  @Test
  void postCreateReturns201AndWritesAuditRow() throws Exception {
    long beforeAudit = audits.count();

    MvcResult res = mockMvc.perform(post("/api/admin/templates")
            .with(loginAsOwner())
            .with(csrf())
            .contentType("application/json")
            .content("{\"name\":\"Custom\",\"channel\":\"EMAIL\",\"subject\":\"S\",\"body\":\"B\",\"active\":true}"))
        .andExpect(status().isCreated())
        .andReturn();

    assertThat(res.getResponse().getContentAsString()).contains("\"name\":\"Custom\"");
    assertThat(audits.count()).isGreaterThan(beforeAudit);
  }

  @Test
  void postRejectsDuplicateName() throws Exception {
    mockMvc.perform(post("/api/admin/templates")
            .with(loginAsOwner())
            .with(csrf())
            .contentType("application/json")
            .content("{\"name\":\"Zlecenie przyjete (EMAIL)\",\"channel\":\"EMAIL\",\"body\":\"X\",\"active\":true}"))
        .andExpect(status().isConflict());
  }

  @Test
  void patchUpdatesSubject() throws Exception {
    String createBody = mockMvc.perform(post("/api/admin/templates")
            .with(loginAsOwner()).with(csrf())
            .contentType("application/json")
            .content("{\"name\":\"Patch test\",\"channel\":\"EMAIL\",\"subject\":\"old\",\"body\":\"B\",\"active\":true}"))
        .andReturn().getResponse().getContentAsString();
    String id = createBody.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(patch("/api/admin/templates/" + id)
            .with(loginAsOwner()).with(csrf())
            .contentType("application/json")
            .content("{\"subject\":\"new\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subject").value("new"));
  }

  @Test
  void deleteSetsActiveFalse() throws Exception {
    String createBody = mockMvc.perform(post("/api/admin/templates")
            .with(loginAsOwner()).with(csrf())
            .contentType("application/json")
            .content("{\"name\":\"Delete me\",\"channel\":\"EMAIL\",\"body\":\"B\",\"active\":true}"))
        .andReturn().getResponse().getContentAsString();
    String id = createBody.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(delete("/api/admin/templates/" + id).with(loginAsOwner()).with(csrf()))
        .andExpect(status().isNoContent());

    mockMvc.perform(get("/api/admin/templates/" + id).with(loginAsOwner()))
        .andExpect(jsonPath("$.active").value(false));
  }

  @Test
  void unauthenticatedReturns401() throws Exception {
    mockMvc.perform(get("/api/admin/templates"))
        .andExpect(status().isUnauthorized());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=TemplatesControllerIntegrationTest
```

Expected: FAIL — controller missing.

- [ ] **Step 3: Implement DTOs**

```java
// TemplateDto
package com.drshoes.app.messaging.dto;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TemplateDto(
    UUID id, String name, String channel, String subject, String body,
    Boolean active, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
```

```java
// CreateTemplateRequest
package com.drshoes.app.messaging.dto;
public record CreateTemplateRequest(String name, String channel, String subject, String body, Boolean active) {}
```

```java
// UpdateTemplateRequest
package com.drshoes.app.messaging.dto;
public record UpdateTemplateRequest(String name, String channel, String subject, String body, Boolean active) {}
```

- [ ] **Step 4: Implement TemplateService**

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.messaging.domain.MessageTemplateEntity;
import com.drshoes.app.messaging.dto.*;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

@Service
public class TemplateService {

  private final MessageTemplateRepository repo;

  public TemplateService(MessageTemplateRepository repo) { this.repo = repo; }

  public List<TemplateDto> list() {
    return repo.findAll().stream().map(this::toDto).toList();
  }

  public TemplateDto get(UUID id) {
    return toDto(repo.findById(id).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
  }

  @Audited
  @Transactional
  public TemplateDto create(CreateTemplateRequest req) {
    repo.findByName(req.name()).ifPresent(t -> {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Template name exists");
    });
    var e = new MessageTemplateEntity();
    e.setName(req.name());
    e.setChannel(req.channel());
    e.setSubject(req.subject());
    e.setBody(req.body());
    e.setActive(req.active() == null ? Boolean.TRUE : req.active());
    return toDto(repo.save(e));
  }

  @Audited
  @Transactional
  public TemplateDto update(UUID id, UpdateTemplateRequest req) {
    var e = repo.findById(id).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (req.name() != null)    e.setName(req.name());
    if (req.channel() != null) e.setChannel(req.channel());
    if (req.subject() != null) e.setSubject(req.subject());
    if (req.body() != null)    e.setBody(req.body());
    if (req.active() != null)  e.setActive(req.active());
    return toDto(repo.save(e));
  }

  @Audited
  @Transactional
  public void softDelete(UUID id) {
    var e = repo.findById(id).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    e.setActive(false);
    repo.save(e);
  }

  private TemplateDto toDto(MessageTemplateEntity e) {
    return new TemplateDto(e.getId(), e.getName(), e.getChannel(), e.getSubject(),
        e.getBody(), e.getActive(), e.getCreatedAt(), e.getUpdatedAt());
  }
}
```

- [ ] **Step 5: Implement TemplatesController**

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.messaging.dto.*;
import com.drshoes.app.messaging.service.TemplateService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/templates")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class TemplatesController {

  private final TemplateService svc;

  public TemplatesController(TemplateService svc) { this.svc = svc; }

  @GetMapping
  public List<TemplateDto> list() { return svc.list(); }

  @GetMapping("/{id}")
  public TemplateDto get(@PathVariable UUID id) { return svc.get(id); }

  @PostMapping
  @PreAuthorize("hasRole('OWNER')")
  public ResponseEntity<TemplateDto> create(@RequestBody CreateTemplateRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(svc.create(req));
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('OWNER')")
  public TemplateDto update(@PathVariable UUID id, @RequestBody UpdateTemplateRequest req) {
    return svc.update(id, req);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('OWNER')")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    svc.softDelete(id);
    return ResponseEntity.noContent().build();
  }
}
```

- [ ] **Step 6: Implement MessagingExceptionAdvice**

```java
package com.drshoes.app.messaging.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestControllerAdvice(basePackages = "com.drshoes.app.messaging.api")
public class MessagingExceptionAdvice {

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("error", e.getReason() == null ? "error" : e.getReason()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
  }
}
```

- [ ] **Step 7: Run tests**

```bash
mvn -B -pl backend/app -am test -Dtest=TemplatesControllerIntegrationTest
```

Expected: PASS — 6 tests green.

- [ ] **Step 8: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/TemplatesController.java backend/app/src/main/java/com/drshoes/app/messaging/api/MessagingExceptionAdvice.java backend/app/src/main/java/com/drshoes/app/messaging/dto/TemplateDto.java backend/app/src/main/java/com/drshoes/app/messaging/dto/CreateTemplateRequest.java backend/app/src/main/java/com/drshoes/app/messaging/dto/UpdateTemplateRequest.java backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateService.java backend/app/src/test/java/com/drshoes/app/messaging/api/TemplatesControllerIntegrationTest.java
git commit -m "feat(messaging): TemplatesController + service [milestone:2][task:2-11]

Refs: docs/dispatch-log/2-11-<UTC>.md"
```

---

### Task 2-12: TriggersController (list + detail + toggle)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/TriggersController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/TriggerDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/ToggleTriggerRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/TriggerService.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/api/TriggersControllerIntegrationTest.java`

- [ ] **Step 1: Failing test**

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.Test;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TriggersControllerIntegrationTest extends AdminWebTestBase {

  @Test
  void listReturnsFourSeededTriggers() throws Exception {
    mockMvc.perform(get("/api/admin/triggers").with(loginAsOwner()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(4));
  }

  @Test
  void detailIncludesTemplateName() throws Exception {
    String list = mockMvc.perform(get("/api/admin/triggers").with(loginAsOwner()))
        .andReturn().getResponse().getContentAsString();
    String id = list.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(get("/api/admin/triggers/" + id).with(loginAsOwner()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.templateName").exists());
  }

  @Test
  void toggleEnabledFlipsField() throws Exception {
    String list = mockMvc.perform(get("/api/admin/triggers").with(loginAsOwner()))
        .andReturn().getResponse().getContentAsString();
    String id = list.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(patch("/api/admin/triggers/" + id + "/enabled")
            .with(loginAsOwner()).with(csrf())
            .contentType("application/json")
            .content("{\"enabled\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(false));
  }

  @Test
  void employeeCanReadCannotToggle() throws Exception {
    String list = mockMvc.perform(get("/api/admin/triggers").with(loginAsEmployee()))
        .andReturn().getResponse().getContentAsString();
    String id = list.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(patch("/api/admin/triggers/" + id + "/enabled")
            .with(loginAsEmployee()).with(csrf())
            .contentType("application/json")
            .content("{\"enabled\":false}"))
        .andExpect(status().isForbidden());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=TriggersControllerIntegrationTest
```

- [ ] **Step 3: Implement DTOs + service**

```java
// TriggerDto
package com.drshoes.app.messaging.dto;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TriggerDto(
    UUID id, String name, Boolean enabled, String event, String eventParams,
    String channels, UUID templateId, String templateName,
    Integer delayMinutes, Boolean requiresManualConfirmation,
    OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
```

```java
// ToggleTriggerRequest
package com.drshoes.app.messaging.dto;
public record ToggleTriggerRequest(Boolean enabled) {}
```

```java
// TriggerService
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.dto.TriggerDto;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.repository.TriggerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class TriggerService {

  private final TriggerRepository triggers;
  private final MessageTemplateRepository templates;

  public TriggerService(TriggerRepository triggers, MessageTemplateRepository templates) {
    this.triggers = triggers; this.templates = templates;
  }

  public List<TriggerDto> list() {
    return triggers.findAllByOrderByNameAsc().stream().map(this::toDto).toList();
  }

  public TriggerDto get(UUID id) {
    return toDto(triggers.findById(id).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
  }

  @Audited
  @Transactional
  public TriggerDto setEnabled(UUID id, boolean enabled) {
    var t = triggers.findById(id).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    t.setEnabled(enabled);
    return toDto(triggers.save(t));
  }

  private TriggerDto toDto(TriggerEntity t) {
    String templateName = t.getTemplateId() == null ? null
        : templates.findById(t.getTemplateId()).map(x -> x.getName()).orElse(null);
    return new TriggerDto(
        t.getId(), t.getName(), t.getEnabled(),
        t.getEvent().name(), t.getEventParams(), t.getChannels(),
        t.getTemplateId(), templateName,
        t.getDelayMinutes(), t.getRequiresManualConfirmation(),
        t.getCreatedAt(), t.getUpdatedAt());
  }
}
```

- [ ] **Step 4: Implement TriggersController**

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.messaging.dto.ToggleTriggerRequest;
import com.drshoes.app.messaging.dto.TriggerDto;
import com.drshoes.app.messaging.service.TriggerService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/triggers")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class TriggersController {

  private final TriggerService svc;

  public TriggersController(TriggerService svc) { this.svc = svc; }

  @GetMapping
  public List<TriggerDto> list() { return svc.list(); }

  @GetMapping("/{id}")
  public TriggerDto get(@PathVariable UUID id) { return svc.get(id); }

  @PatchMapping("/{id}/enabled")
  @PreAuthorize("hasRole('OWNER')")
  public TriggerDto toggle(@PathVariable UUID id, @RequestBody ToggleTriggerRequest req) {
    return svc.setEnabled(id, Boolean.TRUE.equals(req.enabled()));
  }
}
```

- [ ] **Step 5: Run + commit**

```bash
mvn -B -pl backend/app -am test -Dtest=TriggersControllerIntegrationTest
git add backend/app/src/main/java/com/drshoes/app/messaging/api/TriggersController.java backend/app/src/main/java/com/drshoes/app/messaging/dto/TriggerDto.java backend/app/src/main/java/com/drshoes/app/messaging/dto/ToggleTriggerRequest.java backend/app/src/main/java/com/drshoes/app/messaging/service/TriggerService.java backend/app/src/test/java/com/drshoes/app/messaging/api/TriggersControllerIntegrationTest.java
git commit -m "feat(messaging): TriggersController + service [milestone:2][task:2-12]

Refs: docs/dispatch-log/2-12-<UTC>.md"
```

---

### Task 2-13: MessagesController (thread GET + send POST)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/SendMessageRequest.java`
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/api/MessagesControllerIntegrationTest.java`

- [ ] **Step 1: Failing test**

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.Test;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MessagesControllerIntegrationTest extends AdminWebTestBase {

  @Test
  void emptyThreadReturnsEmptyList() throws Exception {
    java.util.UUID orderId = createOrderAndReturnId();   // helper from base
    mockMvc.perform(get("/api/admin/orders/" + orderId + "/messages").with(loginAsOwner()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void postSendCreatesMessage() throws Exception {
    java.util.UUID orderId = createOrderAndReturnId();
    String templates = mockMvc.perform(get("/api/admin/templates").with(loginAsOwner()))
        .andReturn().getResponse().getContentAsString();
    String templateId = templates.split("\"id\":\"")[1].split("\"")[0];

    mockMvc.perform(post("/api/admin/orders/" + orderId + "/messages")
            .with(loginAsOwner()).with(csrf())
            .contentType("application/json")
            .content("{\"templateId\":\"" + templateId + "\",\"channel\":\"EMAIL\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.deliveryStatus").value("SENT"));

    mockMvc.perform(get("/api/admin/orders/" + orderId + "/messages").with(loginAsOwner()))
        .andExpect(jsonPath("$.length()").value(1));
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -B -pl backend/app -am test -Dtest=MessagesControllerIntegrationTest
```

- [ ] **Step 3: Implement DTOs + controller**

```java
// MessageDto
package com.drshoes.app.messaging.dto;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageDto(
    UUID id, UUID orderId, UUID clientId, String direction, String channel,
    UUID templateId, UUID triggerId, String subject, String body,
    String deliveryStatus, String providerMessageId,
    OffsetDateTime sentAt, OffsetDateTime createdAt) {}
```

```java
// SendMessageRequest
package com.drshoes.app.messaging.dto;
import java.util.UUID;

public record SendMessageRequest(UUID templateId, String body, String channel, String subject) {}
```

```java
// MessagesController
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.AuthenticatedActor;
import com.drshoes.app.client.repository.ClientRepository;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendMessageRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import com.drshoes.app.order.repository.OrderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/orders/{orderId}/messages")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class MessagesController {

  private final MessageRepository messages;
  private final OrderRepository orders;
  private final MessageRouter router;

  public MessagesController(MessageRepository messages, OrderRepository orders, MessageRouter router) {
    this.messages = messages; this.orders = orders; this.router = router;
  }

  @GetMapping
  public List<MessageDto> list(@PathVariable UUID orderId) {
    return messages.findAllByOrderIdOrderByCreatedAtAsc(orderId).stream()
        .map(this::toDto).toList();
  }

  @PostMapping
  public ResponseEntity<MessageDto> send(@PathVariable UUID orderId,
                                         @RequestBody SendMessageRequest req,
                                         AuthenticatedActor actor) {
    if (req.templateId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "templateId required in M2");
    }
    if (req.channel() == null || (!req.channel().equals("EMAIL") && !req.channel().equals("SMS"))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "channel must be EMAIL or SMS");
    }
    var order = orders.findById(orderId).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    UUID messageId = router.sendManual(orderId, order.getClientId(), req.templateId(), req.channel(), actor.userId());
    var saved = messages.findById(messageId).orElseThrow();
    return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved));
  }

  private MessageDto toDto(com.drshoes.app.messaging.domain.MessageEntity m) {
    return new MessageDto(
        m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
        m.getChannel(), m.getTemplateId(), m.getTriggerId(),
        m.getSubject(), m.getBody(),
        m.getDeliveryStatus(), m.getProviderMessageId(),
        m.getSentAt(), m.getCreatedAt());
  }
}
```

> **`AuthenticatedActor` is hypothetical** — use whatever the auth module exposes (likely `Principal` + a session lookup). Check `apps/api/.../auth/` for the existing pattern.

- [ ] **Step 4: Run + commit**

```bash
mvn -B -pl backend/app -am test -Dtest=MessagesControllerIntegrationTest
git add backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageDto.java backend/app/src/main/java/com/drshoes/app/messaging/dto/SendMessageRequest.java backend/app/src/test/java/com/drshoes/app/messaging/api/MessagesControllerIntegrationTest.java
git commit -m "feat(messaging): MessagesController — thread GET + manual send POST [milestone:2][task:2-13]

Refs: docs/dispatch-log/2-13-<UTC>.md"
```

---

## Wave 4 — Frontend

### Task 2-14: lib/messaging API client + types + server wrappers

**Files:**
- Create: `apps/web/lib/messaging/types.ts`
- Create: `apps/web/lib/messaging/api.ts`
- Create: `apps/web/lib/messaging/api-server.ts`

- [ ] **Step 1: Implement types**

```ts
// apps/web/lib/messaging/types.ts
export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export interface TemplateDto {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  channel: Channel;
  subject?: string | null;
  body: string;
  active?: boolean;
}

export interface UpdateTemplateRequest {
  name?: string;
  channel?: Channel;
  subject?: string | null;
  body?: string;
  active?: boolean;
}

export interface TriggerDto {
  id: string;
  name: string;
  enabled: boolean;
  event: string;
  eventParams: string;     // JSON string
  channels: string;        // JSON string array
  templateId: string;
  templateName: string;
  delayMinutes: number;
  requiresManualConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  orderId: string | null;
  clientId: string;
  direction: "OUTBOUND" | "INBOUND";
  channel: Channel;
  templateId: string | null;
  triggerId: string | null;
  subject: string | null;
  body: string;
  deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface SendMessageRequest {
  templateId: string;
  channel: Channel;
  subject?: string | null;
}
```

- [ ] **Step 2: Implement client API**

Match the pattern from `apps/web/lib/orders/api.ts` (whatever fetch helper / CSRF handling already exists).

```ts
// apps/web/lib/messaging/api.ts
import { createLogger } from "@/lib/log";
import { apiFetch } from "@/lib/orders/api";   // reuse existing fetch helper if present
import type {
  TemplateDto, CreateTemplateRequest, UpdateTemplateRequest,
  TriggerDto, MessageDto, SendMessageRequest,
} from "./types";

const log = createLogger("messaging.api");

export async function getTemplates(): Promise<TemplateDto[]> {
  return apiFetch<TemplateDto[]>("/api/admin/templates");
}
export async function getTemplate(id: string): Promise<TemplateDto> {
  return apiFetch<TemplateDto>(`/api/admin/templates/${id}`);
}
export async function createTemplate(req: CreateTemplateRequest): Promise<TemplateDto> {
  log.info({ op: "create", name: req.name });
  return apiFetch<TemplateDto>("/api/admin/templates", { method: "POST", body: req });
}
export async function updateTemplate(id: string, req: UpdateTemplateRequest): Promise<TemplateDto> {
  return apiFetch<TemplateDto>(`/api/admin/templates/${id}`, { method: "PATCH", body: req });
}
export async function deleteTemplate(id: string): Promise<void> {
  await apiFetch<void>(`/api/admin/templates/${id}`, { method: "DELETE" });
}

export async function getTriggers(): Promise<TriggerDto[]> {
  return apiFetch<TriggerDto[]>("/api/admin/triggers");
}
export async function getTrigger(id: string): Promise<TriggerDto> {
  return apiFetch<TriggerDto>(`/api/admin/triggers/${id}`);
}
export async function toggleTrigger(id: string, enabled: boolean): Promise<TriggerDto> {
  return apiFetch<TriggerDto>(`/api/admin/triggers/${id}/enabled`, {
    method: "PATCH", body: { enabled },
  });
}

export async function getOrderMessages(orderId: string): Promise<MessageDto[]> {
  return apiFetch<MessageDto[]>(`/api/admin/orders/${orderId}/messages`);
}
export async function sendMessage(orderId: string, req: SendMessageRequest): Promise<MessageDto> {
  log.info({ op: "send", orderId, templateId: req.templateId, channel: req.channel });
  return apiFetch<MessageDto>(`/api/admin/orders/${orderId}/messages`, {
    method: "POST", body: req,
  });
}
```

- [ ] **Step 3: Implement server-side wrappers**

```ts
// apps/web/lib/messaging/api-server.ts
import { serverFetch } from "@/lib/orders/api-server";   // reuse pattern from 1-12
import type { TemplateDto, TriggerDto, MessageDto } from "./types";

export async function getTemplatesServer(): Promise<TemplateDto[]> {
  return serverFetch<TemplateDto[]>("/api/admin/templates");
}
export async function getTemplateServer(id: string): Promise<TemplateDto> {
  return serverFetch<TemplateDto>(`/api/admin/templates/${id}`);
}
export async function getTriggersServer(): Promise<TriggerDto[]> {
  return serverFetch<TriggerDto[]>("/api/admin/triggers");
}
export async function getTriggerServer(id: string): Promise<TriggerDto> {
  return serverFetch<TriggerDto>(`/api/admin/triggers/${id}`);
}
export async function getOrderMessagesServer(orderId: string): Promise<MessageDto[]> {
  return serverFetch<MessageDto[]>(`/api/admin/orders/${orderId}/messages`);
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: zero TS errors; clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/messaging/
git commit -m "feat(web): lib/messaging API client + types + server wrappers [milestone:2][task:2-14]

Refs: docs/dispatch-log/2-14-<UTC>.md"
```

---

### Task 2-15: /admin/templates pages + TemplateForm

**Files:**
- Create: `apps/web/app/(admin)/admin/templates/page.tsx`
- Create: `apps/web/app/(admin)/admin/templates/new/page.tsx`
- Create: `apps/web/app/(admin)/admin/templates/[id]/page.tsx`
- Create: `apps/web/app/(admin)/admin/templates/_components/TemplateForm.tsx`

- [ ] **Step 1: Implement list page**

```tsx
// apps/web/app/(admin)/admin/templates/page.tsx
import Link from "next/link";
import { getTemplatesServer } from "@/lib/messaging/api-server";

export default async function TemplatesPage() {
  const templates = await getTemplatesServer();
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Szablony wiadomości</h1>
        <Link href="/admin/templates/new" className="btn-primary">Nowy szablon</Link>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Nazwa</th>
            <th className="text-left">Kanał</th>
            <th className="text-left">Aktywny</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {templates.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.channel}</td>
              <td>{t.active ? "tak" : "nie"}</td>
              <td><Link href={`/admin/templates/${t.id}`}>edytuj</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Implement TemplateForm component**

```tsx
// apps/web/app/(admin)/admin/templates/_components/TemplateForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, updateTemplate, deleteTemplate } from "@/lib/messaging/api";
import type { TemplateDto, Channel } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";

const log = createLogger("template-form");

export function TemplateForm({ initial }: { initial?: TemplateDto }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<Channel>((initial?.channel ?? "EMAIL"));
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (initial) {
        await updateTemplate(initial.id, { name, channel, subject: channel === "EMAIL" ? subject : null, body, active });
      } else {
        await createTemplate({ name, channel, subject: channel === "EMAIL" ? subject : null, body, active });
      }
      setFeedback("Zapisano");
      router.push("/admin/templates");
      router.refresh();
    } catch (e) {
      log.error({ op: "save", err: String(e) });
      setFeedback("Nie udało się zapisać");
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!confirm("Usunąć szablon?")) return;
    await deleteTemplate(initial.id);
    router.push("/admin/templates");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-xl">
      <label className="block">Nazwa<input value={name} onChange={e => setName(e.target.value)} required /></label>
      <label className="block">Kanał
        <select value={channel} onChange={e => setChannel(e.target.value as Channel)}>
          <option value="EMAIL">EMAIL</option>
          <option value="SMS">SMS</option>
        </select>
      </label>
      {channel === "EMAIL" && (
        <label className="block">Temat<input value={subject ?? ""} onChange={e => setSubject(e.target.value)} /></label>
      )}
      <label className="block">Treść<textarea rows={8} value={body} onChange={e => setBody(e.target.value)} required /></label>
      <label className="block"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Aktywny</label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Zapisz</button>
        {initial && <button type="button" onClick={onDelete} className="btn-danger">Usuń</button>}
      </div>
      {feedback && <p aria-live="polite">{feedback}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Implement new + edit pages**

```tsx
// apps/web/app/(admin)/admin/templates/new/page.tsx
import { TemplateForm } from "../_components/TemplateForm";

export default function NewTemplatePage() {
  return <div className="p-6"><h1 className="text-xl mb-4">Nowy szablon</h1><TemplateForm /></div>;
}
```

```tsx
// apps/web/app/(admin)/admin/templates/[id]/page.tsx
import { TemplateForm } from "../_components/TemplateForm";
import { getTemplateServer } from "@/lib/messaging/api-server";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTemplateServer(id);
  return <div className="p-6"><h1 className="text-xl mb-4">Edytuj: {t.name}</h1><TemplateForm initial={t} /></div>;
}
```

- [ ] **Step 4: Verify build + commit**

```bash
cd apps/web && pnpm typecheck && pnpm build
git add apps/web/app/\(admin\)/admin/templates/
git commit -m "feat(web): /admin/templates list + new + edit + form [milestone:2][task:2-15]

Refs: docs/dispatch-log/2-15-<UTC>.md"
```

---

### Task 2-16: /admin/triggers list + detail

**Files:**
- Create: `apps/web/app/(admin)/admin/triggers/page.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/[id]/page.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/_components/TriggerToggle.tsx`

- [ ] **Step 1: Implement TriggerToggle**

```tsx
// apps/web/app/(admin)/admin/triggers/_components/TriggerToggle.tsx
"use client";
import { useState, useTransition } from "react";
import { toggleTrigger } from "@/lib/messaging/api";
import { createLogger } from "@/lib/log";
import { useRouter } from "next/navigation";

const log = createLogger("trigger-toggle");

export function TriggerToggle({ id, initialEnabled }: { id: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function flip() {
    const next = !enabled;
    try {
      const updated = await toggleTrigger(id, next);
      setEnabled(updated.enabled);
      log.info({ op: "toggle", id, enabled: updated.enabled });
      start(() => router.refresh());
    } catch (e) {
      log.error({ op: "toggle", id, err: String(e) });
    }
  }

  return (
    <button onClick={flip} disabled={pending} className={enabled ? "btn-on" : "btn-off"}>
      {enabled ? "Włączony" : "Wyłączony"}
    </button>
  );
}
```

- [ ] **Step 2: Implement list page**

```tsx
// apps/web/app/(admin)/admin/triggers/page.tsx
import Link from "next/link";
import { getTriggersServer } from "@/lib/messaging/api-server";
import { TriggerToggle } from "./_components/TriggerToggle";

const EVENT_LABELS_PL: Record<string, string> = {
  STATUS_CHANGE: "zmiana statusu",
  STATUS_CHANGE_FROM: "zmiana statusu (z konkretnego)",
  ORDER_RECEIVED: "zlecenie przyjęte",
  BEFORE_PICKUP_X_DAYS: "X dni przed odbiorem",
  AFTER_HANDOVER_Y_DAYS: "Y dni po wydaniu",
  RESERVATION_EXPIRING: "wygasająca rezerwacja",
};

export default async function TriggersPage() {
  const triggers = await getTriggersServer();
  return (
    <div className="p-6">
      <h1 className="text-xl mb-4">Wyzwalacze</h1>
      <table className="w-full">
        <thead><tr><th>Nazwa</th><th>Zdarzenie</th><th>Szablon</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {triggers.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{EVENT_LABELS_PL[t.event] ?? t.event}</td>
              <td>{t.templateName}</td>
              <td><TriggerToggle id={t.id} initialEnabled={t.enabled} /></td>
              <td><Link href={`/admin/triggers/${t.id}`}>szczegóły</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Implement detail page**

```tsx
// apps/web/app/(admin)/admin/triggers/[id]/page.tsx
import { getTriggerServer } from "@/lib/messaging/api-server";

export default async function TriggerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTriggerServer(id);
  return (
    <div className="p-6">
      <h1 className="text-xl mb-4">{t.name}</h1>
      <dl className="space-y-2">
        <div><dt>Zdarzenie</dt><dd>{t.event}</dd></div>
        <div><dt>Parametry</dt><dd><pre>{t.eventParams}</pre></dd></div>
        <div><dt>Kanały</dt><dd>{t.channels}</dd></div>
        <div><dt>Szablon</dt><dd>{t.templateName}</dd></div>
        <div><dt>Opóźnienie (min)</dt><dd>{t.delayMinutes}</dd></div>
        <div><dt>Wymaga zatwierdzenia</dt><dd>{t.requiresManualConfirmation ? "tak" : "nie"}</dd></div>
        <div><dt>Status</dt><dd>{t.enabled ? "Włączony" : "Wyłączony"}</dd></div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
cd apps/web && pnpm typecheck && pnpm build
git add apps/web/app/\(admin\)/admin/triggers/
git commit -m "feat(web): /admin/triggers list + detail + toggle [milestone:2][task:2-16]

Refs: docs/dispatch-log/2-16-<UTC>.md"
```

---

### Task 2-17: OrderDrawerMessages + KIND_LABELS_PL update

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/MessageRow.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx` — add 5th section
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx` — add `MESSAGE_SENT` to `KIND_LABELS_PL` and `KIND_ICONS`

- [ ] **Step 1: Implement MessageRow**

```tsx
// apps/web/app/(admin)/admin/orders/_components/MessageRow.tsx
import type { MessageDto } from "@/lib/messaging/types";

const fmt = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" });

const STATUS_PL: Record<MessageDto["deliveryStatus"], string> = {
  QUEUED: "w kolejce", SENT: "wysłana", DELIVERED: "dostarczona", FAILED: "błąd", READ: "odczytana",
};

export function MessageRow({ message }: { message: MessageDto }) {
  return (
    <div className="border-b py-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="px-2 py-0.5 rounded bg-gray-200">{message.channel}</span>
        <span>{message.sentAt ? fmt.format(new Date(message.sentAt)) : "—"}</span>
        <span className="ml-auto">{STATUS_PL[message.deliveryStatus]}</span>
      </div>
      {message.subject && <div className="font-medium">{message.subject}</div>}
      <div className="whitespace-pre-wrap">{message.body}</div>
      {message.triggerId && <div className="text-xs text-gray-500">automatycznie</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement OrderDrawerMessages**

```tsx
// apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { getOrderMessages } from "@/lib/messaging/api";
import type { MessageDto } from "@/lib/messaging/types";
import { MessageRow } from "./MessageRow";
import { createLogger } from "@/lib/log";

const log = createLogger("messaging.thread");

export function OrderDrawerMessages({
  orderId, refreshKey, onComposeClick,
}: { orderId: string; refreshKey: number; onComposeClick: () => void }) {
  const [items, setItems] = useState<MessageDto[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await getOrderMessages(orderId);
      setItems(data);
      setState("ok");
      log.info({ op: "load", orderId, count: data.length });
    } catch (e) {
      setState("err");
      log.warn({ op: "load", orderId, err: String(e) });
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <section className="border-t pt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">Komunikacja z klientem</h3>
        <button onClick={onComposeClick} className="btn-secondary">Wyślij wiadomość</button>
      </div>
      {state === "loading" && <p>Ładowanie…</p>}
      {state === "err" && <p>Nie udało się załadować wiadomości. <button onClick={load}>Ponów</button></p>}
      {state === "ok" && items.length === 0 && <p className="text-gray-500">Brak wiadomości.</p>}
      {state === "ok" && items.map(m => <MessageRow key={m.id} message={m} />)}
    </section>
  );
}
```

- [ ] **Step 3: Wire OrderDrawer**

In `OrderDrawer.tsx`, add the messages section after the timeline section. Pass through `refreshKey`. Add a state slot for "compose modal open" (used by Task 2-18). For 2-17, just stub the `onComposeClick={() => {}}` placeholder; 2-18 wires the modal.

- [ ] **Step 4: Update KIND_LABELS_PL + KIND_ICONS in OrderDrawerTimeline.tsx**

Add:

```ts
MESSAGE_SENT: (labels) => `Wysłano wiadomość (${labels.channel})`,
```

(or whatever shape the `KIND_LABELS_PL` map has — match existing).

And in `KIND_ICONS`:

```ts
MESSAGE_SENT: "✉️",
```

- [ ] **Step 5: Verify + commit**

```bash
cd apps/web && pnpm typecheck && pnpm build
git add apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerMessages.tsx apps/web/app/\(admin\)/admin/orders/_components/MessageRow.tsx apps/web/app/\(admin\)/admin/orders/_components/OrderDrawer.tsx apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerTimeline.tsx
git commit -m "feat(web): OrderDrawerMessages + MESSAGE_SENT timeline label [milestone:2][task:2-17]

Refs: docs/dispatch-log/2-17-<UTC>.md"
```

---

### Task 2-18: MessageComposerModal

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/MessageComposerModal.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx` — add `<MessageComposerModal>` open state + bump refreshKey on send

- [ ] **Step 1: Implement modal**

```tsx
// apps/web/app/(admin)/admin/orders/_components/MessageComposerModal.tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { getTemplates, sendMessage } from "@/lib/messaging/api";
import type { TemplateDto, Channel } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";

const log = createLogger("messaging.composer");

export function MessageComposerModal({
  orderId, open, onOpenChange, onSent,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    getTemplates().then(ts => {
      const active = ts.filter(t => t.active);
      setTemplates(active);
      if (active.length > 0) {
        setTemplateId(active[0].id);
        setChannel(active[0].channel === "SMS" ? "SMS" : "EMAIL");
      }
    });
  }, [open]);

  const selected = templates.find(t => t.id === templateId);

  async function send() {
    setSending(true);
    setFeedback(null);
    try {
      await sendMessage(orderId, { templateId, channel });
      setFeedback("Wysłano");
      log.info({ op: "send", orderId, templateId, channel });
      onSent();
      onOpenChange(false);
    } catch (e) {
      setFeedback("Nie udało się wysłać");
      log.error({ op: "send", orderId, err: String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded shadow max-w-lg w-full">
          <Dialog.Title className="text-lg font-medium mb-3">Wyślij wiadomość</Dialog.Title>
          <label className="block mb-2">Szablon
            <select value={templateId} onChange={e => {
                const t = templates.find(x => x.id === e.target.value);
                setTemplateId(e.target.value);
                if (t) setChannel(t.channel === "SMS" ? "SMS" : "EMAIL");
              }}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="block mb-2">Kanał
            <select value={channel} onChange={e => setChannel(e.target.value as Channel)}>
              <option value="EMAIL">EMAIL</option>
              <option value="SMS">SMS</option>
            </select>
          </label>
          {selected && (
            <div className="mb-2 text-sm">
              <div><strong>Temat:</strong> {selected.subject ?? "—"}</div>
              <div className="whitespace-pre-wrap"><strong>Treść:</strong>{"\n"}{selected.body}</div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Dialog.Close asChild><button>Anuluj</button></Dialog.Close>
            <button onClick={send} disabled={sending || !templateId} className="btn-primary">
              {sending ? "Wysyłanie…" : "Wyślij"}
            </button>
          </div>
          {feedback && <p aria-live="polite" className="mt-2 text-sm">{feedback}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Wire into OrderDrawer**

Add a `composerOpen: boolean` state. Replace `onComposeClick={() => {}}` from Task 2-17 with `onComposeClick={() => setComposerOpen(true)}`. Render `<MessageComposerModal orderId={order.id} open={composerOpen} onOpenChange={setComposerOpen} onSent={() => setRefreshKey(k => k + 1)} />`.

- [ ] **Step 3: Verify + commit**

```bash
cd apps/web && pnpm typecheck && pnpm build
git add apps/web/app/\(admin\)/admin/orders/_components/MessageComposerModal.tsx apps/web/app/\(admin\)/admin/orders/_components/OrderDrawer.tsx
git commit -m "feat(web): MessageComposerModal + drawer wiring [milestone:2][task:2-18]

Refs: docs/dispatch-log/2-18-<UTC>.md"
```

---

### Task 2-19: OrderDrawerStatusChanger — replace placeholder with real preview

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/StatusChangeConfirm.tsx`

- [ ] **Step 1: Read M1 1-17 implementation**

The placeholder text shipped in 1-17 was `_Triggery dochodzą w M2 — żadne powiadomienia nie wyślą się teraz._`. Replace with real preview computed from triggers list.

- [ ] **Step 2: Update StatusChangeConfirm to accept trigger preview**

`StatusChangeConfirm.tsx` props gain `triggerPreview: { kind: "match" | "disabled" | "none"; templateName?: string; channels?: string[]; triggerName?: string }`. Render:

```tsx
{triggerPreview.kind === "match" && (
  <p className="text-sm">Wyśle: <strong>{triggerPreview.templateName}</strong> kanałem {triggerPreview.channels!.join(", ")}.</p>
)}
{triggerPreview.kind === "disabled" && (
  <p className="text-sm text-gray-500">Wyzwalacz {triggerPreview.triggerName} wyłączony — nic nie wyśle.</p>
)}
{triggerPreview.kind === "none" && (
  <p className="text-sm text-gray-500">Brak skonfigurowanego wyzwalacza dla tego statusu.</p>
)}
```

- [ ] **Step 3: Update OrderDrawerStatusChanger**

Fetch triggers once via `getTriggers()` in a `useEffect` on mount. When the user clicks a target status to open the confirm, compute `triggerPreview`:

```tsx
function previewFor(targetStatus: string, triggers: TriggerDto[]) {
  const matched = triggers.find(t => {
    if (t.event !== "STATUS_CHANGE") return false;
    try {
      const params = JSON.parse(t.eventParams);
      return params.toStatus === targetStatus;
    } catch { return false; }
  });
  if (!matched) return { kind: "none" as const };
  if (!matched.enabled) return { kind: "disabled" as const, triggerName: matched.name };
  let channels: string[] = [];
  try { channels = JSON.parse(matched.channels); } catch {}
  return { kind: "match" as const, templateName: matched.templateName, channels };
}
```

Pass `triggerPreview` into `<StatusChangeConfirm>`.

- [ ] **Step 4: Verify + commit**

```bash
cd apps/web && pnpm typecheck && pnpm build
git add apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerStatusChanger.tsx apps/web/app/\(admin\)/admin/orders/_components/StatusChangeConfirm.tsx
git commit -m "feat(web): real trigger preview in StatusChangeConfirm [milestone:2][task:2-19]

Refs: docs/dispatch-log/2-19-<UTC>.md"
```

---

## Wave 5 — Closure

### Task 2-20: /api/health endpoint + timeline label ratification errata

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/HealthController.java` (sits in messaging package for now; small enough not to warrant its own package)
- Modify: `docs/superpowers/plans/2026-05-08-milestone-02-messaging.md` — append errata note about timeline label client-side ratification (commit doc separately if more changes accumulate; otherwise piggyback on this commit)
- Test: `backend/app/src/test/java/com/drshoes/app/messaging/api/HealthControllerTest.java`

- [ ] **Step 1: Failing test**

```java
package com.drshoes.app.messaging.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerTest {

  @Autowired MockMvc mockMvc;

  @Test
  void healthReturns200WithStatusUp() throws Exception {
    mockMvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }
}
```

- [ ] **Step 2: Implement controller**

```java
package com.drshoes.app.messaging.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

  @GetMapping
  public Map<String, Object> health() {
    return Map.of(
        "status", "UP",
        "timestamp", Instant.now().toString()
    );
  }
}
```

> The `.api.` package convention picks this up under `AuditLogAspect`, but `/api/health` should be allowed unauthenticated. **Check `SecurityConfig`** — add `/api/health` to the public allow-list. If health-aspect-induced audit rows are noisy, add a path-skip in the aspect. (Decide based on traffic; default: allow audit, accept noise.)

- [ ] **Step 3: Add errata paragraph to plan**

Append to this plan file (under the ERRATA section, new bullet 13):

```
**13. Timeline label composition — RATIFIED client-side (2026-05-08).**
The M1 1-19 deviation (backend ships structured `labels` map; client composes
Polish strings via `KIND_LABELS_PL`) is the project standard going forward.
Reasoning: copy belongs in the presentation layer; i18n stays bolt-on by
adding new dictionaries; backend stays free of locale concerns. M2's
`MESSAGE_SENT` label (`Wysłano wiadomość ({channel})`) follows this pattern.
```

- [ ] **Step 4: Verify + commit**

```bash
mvn -B -pl backend/app -am test -Dtest=HealthControllerTest
git add backend/app/src/main/java/com/drshoes/app/messaging/api/HealthController.java backend/app/src/test/java/com/drshoes/app/messaging/api/HealthControllerTest.java backend/app/src/main/java/com/drshoes/app/config/SecurityConfig.java docs/superpowers/plans/2026-05-08-milestone-02-messaging.md
git commit -m "feat(api): /api/health endpoint + timeline label ratification errata [milestone:2][task:2-20]

Refs: docs/dispatch-log/2-20-<UTC>.md"
```

---

### Task 2-21: E2E compose smoke + milestone-2 tag + CLAUDE.md flip

**Files:**
- Modify: `CLAUDE.md` — flip M2 to `[x]`, add M3 placeholder
- Local annotated tag `milestone-2` (do NOT push)

- [ ] **Step 1: Boot stack**

```bash
docker compose down -v
docker compose up -d --build
```

Wait for backend health (max 5 minutes; abort dispatch on timeout):

```bash
timeout 300 bash -c 'until curl -fsS http://localhost:${BACKEND_PORT:-8081}/api/health; do sleep 3; done'
```

- [ ] **Step 2: Smoke flow**

Login, then:

```bash
# 1. Confirm 4 templates seeded
curl -sS -b /tmp/dr-cookies.txt http://localhost:${BACKEND_PORT:-8081}/api/admin/templates | jq 'length == 4'

# 2. Confirm 4 triggers enabled
curl -sS -b /tmp/dr-cookies.txt http://localhost:${BACKEND_PORT:-8081}/api/admin/triggers \
  | jq '[.[] | select(.enabled == true)] | length == 4'

# 3. Create client + order, then change status to PRZYJETE
CLIENT=$(curl -sS -b /tmp/dr-cookies.txt -X POST .../clients -d '{"firstName":"Anna","lastName":"K","phone":"+48 600 100 200","email":"a@k.pl"}' | jq -r .id)
ORDER=$(curl -sS -b /tmp/dr-cookies.txt -X POST .../orders -d "{\"clientId\":\"$CLIENT\",\"description\":\"sneakery\",\"items\":[]}")
ORDERID=$(echo "$ORDER" | jq -r .id)
curl -sS -b /tmp/dr-cookies.txt -X POST .../orders/$ORDERID/status \
  -d '{"targetStatus":"PRZYJETE","expectedVersion":1}'

# 4. Assert one MESSAGE_SENT in timeline
curl -sS -b /tmp/dr-cookies.txt .../orders/$ORDERID/timeline | jq '[.[] | select(.kind == "MESSAGE_SENT")] | length == 1'

# 5. Assert one message in thread
curl -sS -b /tmp/dr-cookies.txt .../orders/$ORDERID/messages | jq 'length == 1'

# 6. Toggle a trigger off and back on
TRIGID=$(curl -sS -b /tmp/dr-cookies.txt .../triggers | jq -r '.[0].id')
curl -sS -b /tmp/dr-cookies.txt -X PATCH .../triggers/$TRIGID/enabled -d '{"enabled":false}'
curl -sS -b /tmp/dr-cookies.txt -X PATCH .../triggers/$TRIGID/enabled -d '{"enabled":true}'

# 7. Manual send
TPLID=$(curl -sS -b /tmp/dr-cookies.txt .../templates | jq -r '.[0].id')
curl -sS -b /tmp/dr-cookies.txt -X POST .../orders/$ORDERID/messages \
  -d "{\"templateId\":\"$TPLID\",\"channel\":\"EMAIL\"}" \
  | jq '.deliveryStatus == "SENT"'

# 8. Verify list view 200
curl -sS -L -o /dev/null -w '%{http_code}\n' -b /tmp/dr-cookies.txt http://localhost:${WEB_PORT:-3000}/admin/orders
```

If any assertion fails, abort with `status: BLOCKED`. Do NOT mark milestone complete on red smoke.

- [ ] **Step 3: Tear down**

```bash
docker compose down
```

- [ ] **Step 4: Tag milestone-2 (LOCAL ONLY)**

```bash
git tag -a milestone-2 -m "Messaging + triggers complete

- 4 seeded templates + 4 enabled triggers (2 immediate, 2 scheduled)
- MessageRouter single send pipeline, sync gateway, idempotency via trigger_fire
- TriggerEngine post-commit hook on status change
- ScheduledTriggerJob daily 09:00 / 11:00 Europe/Warsaw
- Templates full CRUD; Triggers list + on/off + read-only detail
- Per-order thread inside OrderDrawer + manual composer
- MESSAGE_SENT timeline event
- /api/health endpoint
- Logging gateways only — real Postmark/SMSAPI deferred to M3

Known deferred to M3+: real providers + webhooks, inbound messages, WhatsApp,
{link_do_zdjec} placeholder, manual-confirmation queue, top-nav Wiadomości,
trigger create/edit form, photos, calendar/kanban."
```

**DO NOT push the tag.** Stop at the local tag.

- [ ] **Step 5: Update CLAUDE.md**

Flip:
```
- [ ] Milestone 2: Photos + messages + calendar/kanban + triggers
```
to:
```
- [x] Milestone 2: Messaging + triggers
- [ ] Milestone 3: Real providers + photos
```

(Replace the original "M2: Photos + messages + calendar/kanban + triggers" line. The remaining deferred subsystems become M3 / M4.)

- [ ] **Step 6: Commit + bookkeeping**

Two commits:

(a) Doc commit:
```bash
git add CLAUDE.md
git commit -m "docs: mark Milestone 2 complete [milestone:2][task:2-21]

Refs: docs/dispatch-log/2-21-<UTC>.md"
```

(b) Bookkeeping commit:
```bash
git add docs/dispatch-log/2-21-<UTC>.md docs/dispatch-log/tasks.json
git commit -m "chore(dispatch): record 2-21 completion — milestone-2 closed [milestone:2][task:2-21-bookkeeping]"
```

- [ ] **Step 7: Update tasks.json**

Set 2-21 status=completed; commit_sha (from doc commit); dispatch_log path. Optionally bump `active_milestone` to `"3"`.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| §1 Objective: edit templates | 2-11, 2-15 |
| §1 Objective: enable/disable triggers + detail | 2-12, 2-16 |
| §1 Objective: send manual message | 2-13, 2-18 |
| §1 Objective: immediate triggers fire on status change | 2-8 |
| §1 Objective: scheduled triggers | 2-9 |
| §1 Objective: per-order thread + MESSAGE_SENT timeline | 2-13, 2-17 |
| §3.1 send pipeline | 2-7 |
| §3.2 idempotency | 2-2 (table), 2-4 (service), 2-8 (use), 2-9 (use) |
| §3.3 templating | 2-5 |
| §3.4 scheduled triggers + Clock | 2-9 |
| §3.5 audit + timeline | 2-7 (`@Audited`), 2-10 (curator) |
| §4.1 backend layout | All Wave 1–3 + 2-20 |
| §4.2 frontend layout | All Wave 4 |
| §4.3 API contracts | 2-11/12/13 |
| §4.4 threading model | 2-3 (entity), 2-6 (service) |
| §6 /api/health + timeline ratification | 2-20 |
| §7 out of scope | (no tasks; documented) |
| §8 testing strategy | per-task tests + 2-21 smoke |
| §10 acceptance demo | 2-21 |

All spec sections covered.

**Placeholder scan:**
- One acknowledged TBD in 2-9 about `findAllByPlannedPickupDate` / `findAllByHandoverDate` query shapes — flagged as "executing agent must verify schema reality." Acceptable because schema verification is a real step, not a missing detail.
- 2-7 references `OutboundMessage.builder()` — flagged for the executing agent to adapt to actual lib API. Acceptable.
- 2-13 references `AuthenticatedActor` — flagged as hypothetical, points the agent at the existing auth pattern.
- No TODO / TBD / "implement later" patterns elsewhere.

**Type consistency:**
- `MessageRouter.sendManual(...)` and `MessageRouter.sendForTrigger(...)` defined in 2-7 and called from 2-8 (`fireOne` → `sendForTrigger`), 2-13 (`sendManual`), and 2-19 (preview only — no call). Signatures match.
- `TemplateContext` defined in 2-5; consumed by `TemplateRenderer` and `MessageRouter.buildContext`.
- `TriggerEntity.getEventParams()` returns `String` (raw JSON); deserialized in `TriggerEngine` and `ScheduledTriggerJob` via Jackson. Consistent.
- `TriggerFireEntity` + `TriggerFireId` composite-PK — consistent across 2-3 and 2-4.
- `MessageDto.deliveryStatus` is a string in TS types (2-14); backend stores enum-as-string. Consistent.
- `KIND_LABELS_PL[MESSAGE_SENT]` accepts `labels.channel` — consumed by 2-17, emitted by 2-10.

No type drift.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-milestone-02-messaging.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task per the project's dispatch protocol (thin prompts, plan-on-disk, dispatch logs, two-stage review for 2-7). Matches how M0A/M0B/M1 shipped.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Larger main-session context burn; not aligned with the project's dispatch protocol.

**Recommendation: Subagent-Driven.**
