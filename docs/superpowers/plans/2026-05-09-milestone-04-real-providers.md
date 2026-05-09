# Milestone 4 — Real Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LoggingEmailGateway/LoggingSmsGateway with real Postmark + SMSAPI providers; add HMAC-/IP-verified webhook receivers that reconcile delivery_status from SENT to DELIVERED/FAILED; add operator-initiated manual retry creating new chained outbound rows.

**Architecture:** Profile-gated provider selection via `@ConditionalOnProperty` (Logging stays default in dev/test). Sync send + manual retry — no DB outbox, no `@Scheduled` retry. Webhook receivers (Postmark POST + Basic Auth, SMSAPI GET + IP allowlist) delegate to a single `WebhookStatusReconciler` service that applies state-guarded UPDATEs and emits `MESSAGE_DELIVERED`/`MESSAGE_FAILED` audit timeline events.

**Tech Stack:** Java 21 / Spring Boot 3.4 / Spring `RestClient` / Postgres 16 / Flyway / Testcontainers / WireMock / Next.js 16 / TypeScript / Tailwind / Radix.

**Spec:** [`docs/superpowers/specs/2026-05-09-milestone-04-real-providers-design.md`](../specs/2026-05-09-milestone-04-real-providers-design.md).

---

## ERRATA — pre-execution clarifications

**1. `applied_outcome` CHECK includes `PROCESSING` (plan amendment to spec §3.5).** The spec lists `('APPLIED','DEDUP','NO_MESSAGE','NO_TRANSITION','DROPPED')`. The plan adds `PROCESSING` so the reconciler can INSERT a provisional row before attempting the state-guarded UPDATE without a CHECK constraint violation mid-transaction. If the reconciler does not use a two-phase INSERT approach, `PROCESSING` is never written and the value stays inert — but the schema accepts it cleanly either way. The executor MUST use the amended CHECK shown in task 4-1 Step 1. Spec §3.5 is superseded by this plan's V010 SQL.

**2. SMSAPI webhook uses GET, not POST.** Spec §3.6.1 pins this: `GET /api/webhooks/smsapi`. Response body MUST be the literal text `OK`. `@GetMapping` returning `String "OK"` with `produces = MediaType.TEXT_PLAIN_VALUE`.

**3. `providerEventId` is null for both Postmark and SMSAPI in practice.** Postmark supplies no per-event unique ID; SMSAPI's `MsgId` identifies the *message*, not the *event*. Dedupe falls back to the state-guarded UPDATE for both providers. The `UNIQUE(provider, provider_event_id) WHERE provider_event_id IS NOT NULL` index applies only if a future provider supplies per-event IDs.

**4. `WebhookEvent` record already exists with 4 fields.** Current signature in `messaging-core`:
```java
public record WebhookEvent(
        String providerMessageId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload)
```
Task 4-2 extends it to 6 fields by adding `provider` (first) and `providerEventId` (third). All existing callers must be updated at task 4-2 time — check `MessageRouter` and any test that constructs `WebhookEvent` directly.

---

## File Structure

```
# Backend — messaging-core microlib (extend existing)
backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/
├── Provider.java                              # NEW   — enum POSTMARK, SMSAPI
├── WebhookEvent.java                          # MODIFY — add provider + providerEventId fields
└── WebhookSignatureVerifier.java              # NEW   — provider-agnostic interface (~20 LOC)

backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/
└── WebhookEventTest.java                      # NEW   — validates required-field guards + null providerEventId

# Backend — email-gateway microlib (new postmark/ subpackage)
backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/
├── PostmarkEmailGateway.java                  # NEW   — implements EmailGateway (~110 LOC)
├── PostmarkPayloadMapper.java                 # NEW   — OutboundMessage → JSON (~70 LOC)
├── PostmarkResponseMapper.java                # NEW   — HTTP response → DeliveryReceipt (~50 LOC)
├── PostmarkProperties.java                    # NEW   — @ConfigurationProperties (~30 LOC)
└── PostmarkAutoConfiguration.java             # NEW   — @ConditionalOnProperty(..."postmark") (~40 LOC)

backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/
├── PostmarkPayloadMapperTest.java             # NEW   — unit
├── PostmarkResponseMapperTest.java            # NEW   — unit
└── PostmarkEmailGatewayIT.java                # NEW   — WireMock integration test

# Backend — sms-gateway microlib (new smsapi/ subpackage)
backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/
├── SmsApiSmsGateway.java                      # NEW   — implements SmsGateway (~100 LOC)
├── SmsApiPayloadMapper.java                   # NEW   — (~50 LOC)
├── SmsApiResponseMapper.java                  # NEW   — (~50 LOC)
├── SmsApiProperties.java                      # NEW   — @ConfigurationProperties (~30 LOC)
└── SmsApiAutoConfiguration.java               # NEW   — @ConditionalOnProperty(..."smsapi") (~40 LOC)

backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/
├── SmsApiPayloadMapperTest.java               # NEW   — unit
├── SmsApiResponseMapperTest.java              # NEW   — unit
└── SmsApiSmsGatewayIT.java                    # NEW   — WireMock integration test

# Backend — app module (new packages + modifications)
backend/app/src/main/resources/db/migration/
└── V010__messaging_providers.sql              # NEW   — webhook_event table + retry chain columns

backend/app/src/main/java/com/drshoes/app/messaging/domain/
├── WebhookEventEntity.java                    # NEW   — JPA entity for webhook_event (~70 LOC)
└── WebhookEventRepository.java               # NEW   — JpaRepository + findByProviderAndProviderEventId

backend/app/src/main/java/com/drshoes/app/webhooks/
├── PostmarkWebhookController.java             # NEW   — POST /api/webhooks/postmark (~80 LOC)
├── SmsApiWebhookController.java               # NEW   — GET /api/webhooks/smsapi (~80 LOC)
└── WebhookEventMapper.java                    # NEW   — raw payload → normalized WebhookEvent (~70 LOC)

backend/app/src/main/java/com/drshoes/app/messaging/service/
├── WebhookStatusReconciler.java               # NEW   — domain logic + @Audited (~70 LOC)
└── MessageRetryService.java                   # NEW   — manual retry + @Audited (~60 LOC)

backend/app/src/main/java/com/drshoes/app/messaging/api/
└── MessagesController.java                    # MODIFY — +1 endpoint: POST /retry

backend/app/src/main/java/com/drshoes/app/audit/dto/
└── TimelineEventKind.java                     # MODIFY — +MESSAGE_DELIVERED, +MESSAGE_FAILED

# Backend — app module tests
backend/app/src/test/java/com/drshoes/app/messaging/domain/
└── WebhookEventRepositoryTest.java            # NEW   — @DataJpaTest + Testcontainers (3 cases)

backend/app/src/test/java/com/drshoes/app/webhooks/
├── PostmarkWebhookControllerIT.java           # NEW   — full matrix (8 cases)
└── SmsApiWebhookControllerIT.java             # NEW   — full matrix

backend/app/src/test/java/com/drshoes/app/messaging/service/
└── MessageRetryServiceTest.java               # NEW   — idempotency key, state guard, chain link

backend/app/src/test/java/com/drshoes/app/messaging/api/
└── MessageRetryControllerIT.java              # NEW   — round-trip retry IT

backend/app/src/test/resources/fixtures/postmark/
├── delivery.json                              # NEW   — WireMock fixture
├── bounce.json                                # NEW   — WireMock fixture
├── spam-complaint.json                        # NEW   — WireMock fixture
├── click.json                                 # NEW   — WireMock fixture (DROPPED path)
├── error-422.json                             # NEW   — WireMock fixture
└── success.json                               # NEW   — WireMock fixture

backend/app/src/test/resources/fixtures/smsapi/
├── delivered-callback.txt                     # NEW   — WireMock fixture
├── undelivered-callback.txt                   # NEW   — WireMock fixture
├── success.json                               # NEW   — WireMock fixture
└── error.json                                 # NEW   — WireMock fixture

# Frontend
apps/web/lib/messaging/types.ts                # MODIFY — extend MessageDto (deliveryStatus, retryOfMessageId, retryAttempt, errorCode, errorMessage)
apps/web/lib/messaging/api.ts                  # MODIFY — +retryMessage(id)

apps/web/app/(admin)/admin/orders/_components/
├── MessageStatusBadge.tsx                     # NEW   — status badge ~30 LOC
└── OrderDrawerMessages.tsx                    # MODIFY — badge + retry button + 10s polling + retry chain indicator

apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx
                                               # MODIFY — KIND_LABELS_PL +MESSAGE_DELIVERED/FAILED
```

---

## Wave map

| Wave | Tasks | Theme | Review style |
|---|---|---|---|
| 1 — Schema + microlib scaffolding | 4-1, 4-2 | Foundation | combined |
| 2 — Real outbound providers | 4-3, 4-4, 4-5, 4-6 | Provider impls | two-stage on 4-4, 4-6 |
| 3 — Webhook receivers | 4-7, 4-8, 4-9 | Inbound webhooks | two-stage on 4-9 |
| 4 — Retry path | 4-10, 4-11 | Operator retry | combined |
| 5 — Frontend | 4-12, 4-13, 4-14, 4-15 | UI vertical | combined |
| 6 — Closure | 4-16 | Smoke + tag + docs | combined |

---

## Wave 1 — Schema + microlib scaffolding

### Task 4-1: V010 messaging providers migration + WebhookEventEntity + Repository

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V010__messaging_providers.sql`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventEntity.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/domain/WebhookEventRepositoryTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write V010 migration SQL**

Create `backend/app/src/main/resources/db/migration/V010__messaging_providers.sql`:

```sql
-- V010: webhook_event forensics table + retry chain columns on message.
-- NOTE: applied_outcome CHECK includes PROCESSING (plan amendment to spec §3.5).
-- PROCESSING allows a two-phase INSERT-then-UPDATE pattern in WebhookStatusReconciler
-- without a mid-transaction CHECK violation. Value is never persisted at commit.

CREATE TABLE webhook_event (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider             VARCHAR(20) NOT NULL CHECK (provider IN ('POSTMARK','SMSAPI')),
  provider_event_id    VARCHAR(120),
  provider_message_id  VARCHAR(120),
  message_id           UUID REFERENCES message(id) ON DELETE SET NULL,
  event_type           VARCHAR(40) NOT NULL,
  applied_status       VARCHAR(16) CHECK (applied_status IN ('DELIVERED','FAILED')),
  applied_outcome      VARCHAR(20) NOT NULL CHECK (applied_outcome IN
                         ('APPLIED','DEDUP','NO_MESSAGE','NO_TRANSITION','DROPPED','PROCESSING')),
  raw_payload          JSONB NOT NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ
);

CREATE UNIQUE INDEX webhook_event_provider_eventid_uq
  ON webhook_event (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX webhook_event_provider_msgid_idx
  ON webhook_event (provider, provider_message_id);

-- Retry chain on message: preserves full send history for the operator thread view.
ALTER TABLE message
  ADD COLUMN retry_of_message_id UUID REFERENCES message(id),
  ADD COLUMN retry_attempt        INTEGER NOT NULL DEFAULT 1;

CREATE INDEX message_retry_chain_idx ON message (retry_of_message_id)
  WHERE retry_of_message_id IS NOT NULL;
```

---

- [ ] **Step 2: Write failing repository test**

Create `backend/app/src/test/java/com/drshoes/app/messaging/domain/WebhookEventRepositoryTest.java`:

```java
package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@Testcontainers
class WebhookEventRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
    }

    @Autowired
    WebhookEventRepository repo;

    @Test
    @DisplayName("save and retrieve roundtrip preserves all columns")
    void saveAndRetrieve() {
        WebhookEventEntity entity = new WebhookEventEntity();
        entity.setProvider(Provider.POSTMARK);
        entity.setProviderEventId(null);
        entity.setProviderMessageId("pm-msg-abc123");
        entity.setEventType("Delivery");
        entity.setAppliedStatus(WebhookEventEntity.AppliedStatus.DELIVERED);
        entity.setAppliedOutcome(WebhookEventEntity.AppliedOutcome.APPLIED);
        entity.setRawPayload(JsonNodeFactory.instance.objectNode().put("RecordType", "Delivery"));
        entity.setReceivedAt(Instant.now());
        entity.setAppliedAt(Instant.now());

        WebhookEventEntity saved = repo.save(entity);
        repo.flush();

        Optional<WebhookEventEntity> found = repo.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getProvider()).isEqualTo(Provider.POSTMARK);
        assertThat(found.get().getProviderMessageId()).isEqualTo("pm-msg-abc123");
        assertThat(found.get().getEventType()).isEqualTo("Delivery");
        assertThat(found.get().getAppliedStatus()).isEqualTo(WebhookEventEntity.AppliedStatus.DELIVERED);
        assertThat(found.get().getAppliedOutcome()).isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(found.get().getAppliedAt()).isNotNull();
    }

    @Test
    @DisplayName("UNIQUE(provider, provider_event_id) raises DataIntegrityViolationException on conflict")
    void uniqueConstraintOnProviderEventId() {
        String eventId = "smsapi-event-xyz";

        WebhookEventEntity first = buildEntity(Provider.SMSAPI, eventId, "DELIVERED");
        repo.saveAndFlush(first);

        WebhookEventEntity duplicate = buildEntity(Provider.SMSAPI, eventId, "DELIVERED");

        assertThatThrownBy(() -> repo.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("multiple rows with NULL provider_event_id are allowed (partial unique index)")
    void nullProviderEventIdAllowsMultipleRows() {
        WebhookEventEntity e1 = buildEntity(Provider.POSTMARK, null, "Delivery");
        WebhookEventEntity e2 = buildEntity(Provider.POSTMARK, null, "Delivery");

        repo.saveAndFlush(e1);
        repo.saveAndFlush(e2);

        assertThat(repo.findAll()).hasSizeGreaterThanOrEqualTo(2);
    }

    // ---- helpers ----

    private WebhookEventEntity buildEntity(Provider provider, String eventId, String eventType) {
        WebhookEventEntity e = new WebhookEventEntity();
        e.setProvider(provider);
        e.setProviderEventId(eventId);
        e.setProviderMessageId("msg-" + System.nanoTime());
        e.setEventType(eventType);
        e.setAppliedOutcome(WebhookEventEntity.AppliedOutcome.DROPPED);
        e.setRawPayload(JsonNodeFactory.instance.objectNode());
        e.setReceivedAt(Instant.now());
        return e;
    }
}
```

Run the test — it MUST fail (RED) because `WebhookEventEntity` and `WebhookEventRepository` do not yet exist:

```
mvn -B -pl app -am test -Dtest=WebhookEventRepositoryTest
# Expected: COMPILATION ERROR or test failure — RED is correct at this step.
```

---

- [ ] **Step 3: Write WebhookEventEntity**

Create `backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventEntity.java`:

```java
package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Forensic log of every inbound webhook callback from Postmark / SMSAPI.
 * Supports state-guarded dedupe: UNIQUE(provider, provider_event_id) WHERE NOT NULL.
 * Also stores events where no transition was applied (DEDUP, DROPPED, NO_MESSAGE, etc.)
 * for operational observability.
 *
 * <p>Fields are intentionally mutable (no @Immutable) so the reconciler can
 * UPDATE applied_outcome from PROCESSING → final value in a two-phase flow if needed.</p>
 */
@Entity
@Table(name = "webhook_event")
public class WebhookEventEntity {

    /** Mirrors the CHECK constraint in V010. */
    public enum AppliedStatus { DELIVERED, FAILED }

    /** Mirrors the CHECK constraint in V010 (includes PROCESSING — plan errata §1). */
    public enum AppliedOutcome {
        APPLIED, DEDUP, NO_MESSAGE, NO_TRANSITION, DROPPED, PROCESSING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Provider provider;

    @Column(name = "provider_event_id", length = 120)
    private String providerEventId;

    @Column(name = "provider_message_id", length = 120)
    private String providerMessageId;

    /** FK to message.id — nullable; ON DELETE SET NULL in schema. */
    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    /** NULL when outcome is DROPPED (no delivery decision made). */
    @Enumerated(EnumType.STRING)
    @Column(name = "applied_status", length = 16)
    private AppliedStatus appliedStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "applied_outcome", nullable = false, length = 20)
    private AppliedOutcome appliedOutcome;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayload;

    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt;

    @Column(name = "applied_at")
    private Instant appliedAt;

    // ---- getters / setters ----

    public UUID getId() { return id; }

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }

    public String getProviderEventId() { return providerEventId; }
    public void setProviderEventId(String providerEventId) { this.providerEventId = providerEventId; }

    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }

    public UUID getMessageId() { return messageId; }
    public void setMessageId(UUID messageId) { this.messageId = messageId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public AppliedStatus getAppliedStatus() { return appliedStatus; }
    public void setAppliedStatus(AppliedStatus appliedStatus) { this.appliedStatus = appliedStatus; }

    public AppliedOutcome getAppliedOutcome() { return appliedOutcome; }
    public void setAppliedOutcome(AppliedOutcome appliedOutcome) { this.appliedOutcome = appliedOutcome; }

    public JsonNode getRawPayload() { return rawPayload; }
    public void setRawPayload(JsonNode rawPayload) { this.rawPayload = rawPayload; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getAppliedAt() { return appliedAt; }
    public void setAppliedAt(Instant appliedAt) { this.appliedAt = appliedAt; }
}
```

---

- [ ] **Step 4: Write WebhookEventRepository**

Create `backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventRepository.java`:

```java
package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data repository for {@link WebhookEventEntity}.
 *
 * <p>{@code findByProviderAndProviderEventId} drives the in-memory dedupe path
 * (pre-INSERT lookup) in {@code WebhookStatusReconciler}.
 * The DB-level dedupe is the UNIQUE partial index — this query is a secondary defence.</p>
 */
public interface WebhookEventRepository extends JpaRepository<WebhookEventEntity, UUID> {

    /**
     * Returns the existing webhook event log row for (provider, provider_event_id),
     * or empty if no row exists or provider_event_id is null.
     */
    Optional<WebhookEventEntity> findByProviderAndProviderEventId(
            Provider provider, String providerEventId);
}
```

---

- [ ] **Step 5: Run tests — expect GREEN**

```
mvn -B -pl app -am test -Dtest=WebhookEventRepositoryTest
# Expected output (all 3 tests pass):
# [INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```

If the test fails with a Flyway checksum error on any earlier migration, verify that no existing V010 file is present in the migration directory before running.

---

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V010__messaging_providers.sql \
        backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventEntity.java \
        backend/app/src/main/java/com/drshoes/app/messaging/domain/WebhookEventRepository.java \
        backend/app/src/test/java/com/drshoes/app/messaging/domain/WebhookEventRepositoryTest.java
git commit -m "$(cat <<'EOF'
feat(messaging): V010 webhook_event table + retry chain on message [milestone:4][task:4-1]

Adds webhook_event log table (forensics + state-guarded dedupe via UNIQUE
(provider, provider_event_id) WHERE provider_event_id IS NOT NULL).
Adds retry_of_message_id FK + retry_attempt int default 1 to message
for the M4 manual retry chain.

Plan errata: applied_outcome CHECK extended with PROCESSING vs spec §3.5
to allow two-phase INSERT-then-UPDATE in WebhookStatusReconciler.

Refs: docs/dispatch-log/4-1-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-2: messaging-core extensions (Provider enum + WebhookEvent extension)

**Files:**
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/Provider.java`
- Modify: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/WebhookEvent.java`
- Create: `backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/WebhookEventTest.java`

**Review:** combined single-stage.

**Context:** `WebhookEvent` currently has 4 fields: `providerMessageId`, `status`, `occurredAt`, `rawPayload`. This task extends it to 6 fields by prepending `provider` (required) and inserting `providerEventId` (nullable, after `providerMessageId`). All callers in `app/` that construct `WebhookEvent` must be updated; the only expected caller at this stage is the M2 stub path in `MessageRouter` (or wherever the Logging gateways trigger reconciliation). Inspect at implementation time — do not blindly assume.

---

- [ ] **Step 1: Write the failing test**

Create `backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/WebhookEventTest.java`:

```java
package com.drshoes.lib.messaging;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

class WebhookEventTest {

    private static final Instant NOW = Instant.parse("2026-05-09T12:00:00Z");

    @Test
    @DisplayName("valid WebhookEvent with all required fields constructs successfully")
    void constructsWithRequiredFields() {
        WebhookEvent event = new WebhookEvent(
                Provider.POSTMARK,
                "pm-msg-abc",
                null,           // providerEventId — nullable
                DeliveryStatus.DELIVERED,
                NOW,
                "{\"RecordType\":\"Delivery\"}"
        );

        assertThat(event.provider()).isEqualTo(Provider.POSTMARK);
        assertThat(event.providerMessageId()).isEqualTo("pm-msg-abc");
        assertThat(event.providerEventId()).isNull();
        assertThat(event.status()).isEqualTo(DeliveryStatus.DELIVERED);
        assertThat(event.occurredAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("provider is required — null throws NullPointerException")
    void providerRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        null,
                        "pm-msg-abc",
                        null,
                        DeliveryStatus.DELIVERED,
                        NOW,
                        "{}"
                ))
                .withMessageContaining("provider");
    }

    @Test
    @DisplayName("status is required — null throws NullPointerException")
    void statusRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        Provider.SMSAPI,
                        "sms-msg-xyz",
                        null,
                        null,
                        NOW,
                        "{}"
                ))
                .withMessageContaining("status");
    }

    @Test
    @DisplayName("occurredAt is required — null throws NullPointerException")
    void occurredAtRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        Provider.SMSAPI,
                        "sms-msg-xyz",
                        null,
                        DeliveryStatus.FAILED,
                        null,
                        "{}"
                ))
                .withMessageContaining("occurredAt");
    }

    @Test
    @DisplayName("providerEventId may be null without throwing")
    void providerEventIdNullable() {
        WebhookEvent event = new WebhookEvent(
                Provider.SMSAPI,
                "sms-msg-123",
                null,
                DeliveryStatus.FAILED,
                NOW,
                "{\"status_name\":\"UNDELIVERED\"}"
        );

        assertThat(event.providerEventId()).isNull();
        assertThat(event.providerMessageId()).isEqualTo("sms-msg-123");
    }
}
```

Run the test — it MUST fail (RED) because `WebhookEvent` does not yet have `provider` or `providerEventId` fields, and `Provider` does not yet exist:

```
mvn -B -pl messaging-core test -Dtest=WebhookEventTest
# Expected: COMPILATION ERROR — RED is correct at this step.
```

---

- [ ] **Step 2: Create Provider enum**

Create `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/Provider.java`:

```java
package com.drshoes.lib.messaging;

/**
 * Identifies the external messaging provider that produced a webhook callback
 * or handled an outbound send.
 *
 * <p>Values are persisted as strings in {@code webhook_event.provider} (VARCHAR 20)
 * — do NOT rename without a migration.</p>
 */
public enum Provider {
    /** Postmark (transactional email). */
    POSTMARK,

    /** SMSAPI.pl (SMS). */
    SMSAPI
}
```

---

- [ ] **Step 3: Extend WebhookEvent record**

Modify `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/WebhookEvent.java` to the following complete content:

```java
package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;

/**
 * Normalised representation of an inbound provider webhook callback.
 *
 * <p>Constructed inside {@code WebhookEventMapper} from raw provider payloads.
 * Consumed by {@code WebhookStatusReconciler} to drive state-guarded UPDATEs
 * on {@code message.delivery_status}.</p>
 *
 * <p>Field contract:
 * <ul>
 *   <li>{@code provider} — required; identifies Postmark or SMSAPI.</li>
 *   <li>{@code providerMessageId} — the provider's outbound message reference
 *       (Postmark {@code MessageID}, SMSAPI {@code MsgId}). May be null if the
 *       provider does not supply one in the callback (treated as NO_MESSAGE).</li>
 *   <li>{@code providerEventId} — optional per-event unique ID. Null for both
 *       Postmark and SMSAPI in current integrations. Reserved for future providers
 *       that supply one (drives the UNIQUE dedupe index in webhook_event).</li>
 *   <li>{@code status} — required; DELIVERED or FAILED (caller has already mapped
 *       the raw provider status; DROPPED events are short-circuited before
 *       WebhookEvent is constructed).</li>
 *   <li>{@code occurredAt} — required; provider-supplied event timestamp.</li>
 *   <li>{@code rawPayload} — required; original payload string for forensics log.</li>
 * </ul>
 * </p>
 */
public record WebhookEvent(
        Provider provider,
        String providerMessageId,
        String providerEventId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload) {

    public WebhookEvent {
        Objects.requireNonNull(provider, "provider");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredAt, "occurredAt");
    }
}
```

**Important:** after saving, check if any existing class in the `app/` module constructs `WebhookEvent` with the old 4-argument signature. If found, update the call site to the new 6-argument form. At M3 close the only call site is expected to be logging-only stub code or no call sites at all — but verify with:

```
grep -rn "new WebhookEvent(" backend/app/src/
```

Fix any compilation errors before proceeding to Step 4.

---

- [ ] **Step 4: Run tests — expect GREEN**

```
mvn -B -pl messaging-core test -Dtest=WebhookEventTest
# Expected output (4 tests pass):
# [INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```

Also verify no regressions in the full messaging-core suite:

```
mvn -B -pl messaging-core test
# Expected: all tests pass (no new failures vs M3 close state).
```

---

- [ ] **Step 5: Verify full app compile (catch any broken WebhookEvent call sites)**

```
mvn -B -pl app -am compile
# Expected: BUILD SUCCESS — no compilation errors.
# If broken: fix call sites per Step 3 guidance, then re-run.
```

---

- [ ] **Step 6: Commit**

```bash
git add backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/Provider.java \
        backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/WebhookEvent.java \
        backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/WebhookEventTest.java
# If any app/ call sites were updated, add those files too.
git commit -m "$(cat <<'EOF'
feat(messaging-core): Provider enum + WebhookEvent 6-field extension [milestone:4][task:4-2]

Adds Provider enum (POSTMARK, SMSAPI) for use in webhook_event table JPA mapping
and normalized WebhookEvent record. Extends WebhookEvent from 4 to 6 fields:
prepends provider (required) and adds providerEventId (nullable, third position).
Validation guards: provider, status, occurredAt are requireNonNull.
providerEventId is intentionally nullable — neither Postmark nor SMSAPI supplies
a per-event ID in current integrations.

Refs: docs/dispatch-log/4-2-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Wave 2 — Real outbound providers

---

### Task 4-3: PostmarkPayloadMapper + PostmarkResponseMapper + unit tests

**Files:**
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapper.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkResponseMapper.java`
- Create: `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapperTest.java`
- Create: `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkResponseMapperTest.java`

**Review:** combined single-stage.

**Design notes:**
- `PostmarkPayloadMapper` is a pure static-utility class with no Spring dependencies. It takes `OutboundMessage`, a `Map<String, byte[]>` of attachment bytes keyed by attachment name, the Postmark `messageStream` string, and the `from` address. It produces a `Map<String, Object>` ready for Jackson serialisation.
- Body sniffing rule: if `m.body()` contains `<`, treat it as HTML and emit `HtmlBody`; otherwise emit `TextBody`. This is an explicit project decision — it covers the common case (manually-typed plain text vs. HTML template engine output) without requiring callers to carry a separate `isHtml` flag. **Plan errata #1: if a future message body legitimately starts with `<` but is not HTML, callers must HTML-encode it or pass a flag. Record this in the dispatch log.**
- Attachment byte-sum cap is **10 MB**. The mapper throws `IllegalArgumentException` when the total exceeds `10 * 1024 * 1024` bytes. The gateway (task 4-4) catches this and converts to `DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE", ...)`.
- `PostmarkResponseMapper` is also static-utility. It accepts HTTP status code (int) and body (String). For HTTP 200 it parses the JSON using a minimal `ObjectMapper` (created once as a class-level constant).
- `DeliveryReceipt.accepted` / `DeliveryReceipt.failed` are the only two factory methods used — per the existing record in `messaging-core`.

---

- [ ] **Step 1: Write the failing unit tests (RED)**

`backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapperTest.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Attachment;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class PostmarkPayloadMapperTest {

    private static final String STREAM = "outbound";
    private static final String FROM   = "noreply@drshoes.pl";

    // ── Case 1: plain-text body ─────────────────────────────────────────────
    @Test
    void plainTextBody_emitsTextBody() {
        var msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Zlecenie #42",
                "Twoje buty są gotowe.", List.of(), "idem-1");

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, Map.of(), STREAM, FROM);

        assertThat(payload).containsEntry("From", FROM)
                           .containsEntry("To", "jan@example.com")
                           .containsEntry("Subject", "Zlecenie #42")
                           .containsEntry("MessageStream", STREAM)
                           .containsEntry("TextBody", "Twoje buty są gotowe.")
                           .doesNotContainKey("HtmlBody")
                           .doesNotContainKey("Attachments");
    }

    // ── Case 2: HTML body ───────────────────────────────────────────────────
    @Test
    void htmlBody_emitsHtmlBody() {
        var msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Zlecenie #42",
                "<p>Twoje buty są gotowe.</p>", List.of(), "idem-2");

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, Map.of(), STREAM, FROM);

        assertThat(payload).containsEntry("HtmlBody", "<p>Twoje buty są gotowe.</p>")
                           .doesNotContainKey("TextBody");
    }

    // ── Case 3: attachment included ─────────────────────────────────────────
    @Test
    @SuppressWarnings("unchecked")
    void withAttachment_emitsAttachmentsArray() {
        byte[] pdfBytes = "PDF-CONTENT".getBytes(StandardCharsets.UTF_8);
        var attachment  = new Attachment("report.pdf", "application/pdf");
        var msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Raport",
                "Zobacz załącznik.", List.of(attachment), "idem-3");
        Map<String, byte[]> bytes = Map.of("report.pdf", pdfBytes);

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, bytes, STREAM, FROM);

        assertThat(payload).containsKey("Attachments");
        var attachments = (List<Map<String, String>>) payload.get("Attachments");
        assertThat(attachments).hasSize(1);
        Map<String, String> a = attachments.get(0);
        assertThat(a).containsEntry("Name", "report.pdf")
                     .containsEntry("ContentType", "application/pdf")
                     .containsEntry("Content", Base64.getEncoder().encodeToString(pdfBytes));
    }

    // ── Case 4: attachment total > 10 MB throws ─────────────────────────────
    @Test
    void attachmentExceeds10MB_throwsIllegalArgument() {
        byte[] big = new byte[10 * 1024 * 1024 + 1];
        var attachment = new Attachment("big.bin", "application/octet-stream");
        var msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Big",
                "Duzy plik.", List.of(attachment), "idem-4");
        Map<String, byte[]> bytes = Map.of("big.bin", big);

        assertThatThrownBy(() -> PostmarkPayloadMapper.toPayload(msg, bytes, STREAM, FROM))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("10 MB");
    }
}
```

`backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkResponseMapperTest.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class PostmarkResponseMapperTest {

    // ── Case 1: 200 + ErrorCode 0 ─────────────────────────────────────────
    @Test
    void http200_errorCode0_returnsAccepted() {
        String body = """
                {"ErrorCode":0,"Message":"OK","MessageID":"abc-123",
                 "SubmittedAt":"2026-05-09T10:00:00Z","To":"jan@example.com"}
                """;

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("abc-123");
        assertThat(receipt.errorCode()).isNull();
    }

    // ── Case 2: 200 + ErrorCode != 0 ─────────────────────────────────────
    @Test
    void http200_inlineError_returnsFailedWithPostmarkCode() {
        String body = """
                {"ErrorCode":10,"Message":"Bad or missing API token."}
                """;

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("POSTMARK-10");
        assertThat(receipt.errorMessage()).isEqualTo("Bad or missing API token.");
        assertThat(receipt.providerMessageId()).isNull();
    }

    // Cases follow same pattern as above:
    // - 422 Unprocessable → DeliveryReceipt.failed("HTTP-422", <body>)
    //   body = "{\"ErrorCode\":300,...}", status = 422 → errorCode = "HTTP-422"
    // - 500 Server Error → DeliveryReceipt.failed("HTTP-500", <body>)
    //   body = "Internal Server Error", status = 500 → errorCode = "HTTP-500"
}
```

- [ ] **Step 2: Run tests — should fail (compile error, classes don't exist)**

```bash
cd /path/to/project/backend && mvn -pl libs/email-gateway test \
    -Dtest="PostmarkPayloadMapperTest,PostmarkResponseMapperTest"
```

Expected: `COMPILATION ERROR` — `PostmarkPayloadMapper` and `PostmarkResponseMapper` not found. No `Tests run` output.

---

- [ ] **Step 3: Implement PostmarkPayloadMapper (GREEN)**

`backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapper.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Attachment;
import com.drshoes.lib.messaging.OutboundMessage;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure mapping utility: OutboundMessage + attachment bytes → Postmark JSON payload.
 *
 * Body-sniff rule: if body contains '<', it is treated as HTML and emitted as HtmlBody;
 * otherwise TextBody. Plan errata #1: if a body legitimately starts with '<' but is not
 * HTML, callers must HTML-encode the string or signal intent via a future flag.
 *
 * Attachment cap: 10 MB total. Throws {@link IllegalArgumentException} when exceeded.
 */
public final class PostmarkPayloadMapper {

    private static final long MAX_ATTACHMENT_BYTES = 10L * 1024 * 1024;

    private PostmarkPayloadMapper() {}

    /**
     * @param msg           the message to map
     * @param attachmentBytes  map from Attachment#name() to raw bytes; may be empty
     * @param messageStream Postmark message stream (e.g. "outbound")
     * @param from          sender address (e.g. "noreply@drshoes.pl")
     * @return Jackson-serialisable map representing the Postmark /email request body
     * @throws IllegalArgumentException if total attachment bytes exceed 10 MB
     */
    public static Map<String, Object> toPayload(
            OutboundMessage msg,
            Map<String, byte[]> attachmentBytes,
            String messageStream,
            String from) {

        // Validate attachment total size before building payload
        long totalBytes = attachmentBytes.values().stream().mapToLong(b -> b.length).sum();
        if (totalBytes > MAX_ATTACHMENT_BYTES) {
            throw new IllegalArgumentException(
                    "Total attachment size " + totalBytes + " bytes exceeds 10 MB Postmark limit");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("From", from);
        payload.put("To", msg.recipient());
        payload.put("Subject", msg.subject());
        payload.put("MessageStream", messageStream);

        boolean isHtml = msg.body().contains("<");
        if (isHtml) {
            payload.put("HtmlBody", msg.body());
        } else {
            payload.put("TextBody", msg.body());
        }

        if (!msg.attachments().isEmpty() && !attachmentBytes.isEmpty()) {
            List<Map<String, String>> attachments = new ArrayList<>();
            for (Attachment att : msg.attachments()) {
                byte[] bytes = attachmentBytes.get(att.name());
                if (bytes == null) continue;
                Map<String, String> a = new LinkedHashMap<>();
                a.put("Name", att.name());
                a.put("Content", Base64.getEncoder().encodeToString(bytes));
                a.put("ContentType", att.contentType());
                attachments.add(a);
            }
            if (!attachments.isEmpty()) {
                payload.put("Attachments", attachments);
            }
        }

        return payload;
    }
}
```

---

- [ ] **Step 4: Implement PostmarkResponseMapper (GREEN)**

`backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkResponseMapper.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Pure mapping utility: HTTP status + response body → DeliveryReceipt.
 *
 * Three response shapes handled:
 *  - 200 + ErrorCode=0 + MessageID        → DeliveryReceipt.accepted(messageId)
 *  - 200 + ErrorCode!=0 + Message         → DeliveryReceipt.failed("POSTMARK-"+code, message)
 *  - 4xx/5xx (any non-200 status)         → DeliveryReceipt.failed("HTTP-"+status, body)
 *
 * IOException from JSON parsing returns DeliveryReceipt.failed("PARSE_ERROR", ...).
 */
public final class PostmarkResponseMapper {

    private static final Logger log = LoggerFactory.getLogger(PostmarkResponseMapper.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private PostmarkResponseMapper() {}

    /**
     * @param httpStatus HTTP response status code
     * @param body       raw response body string
     * @return {@link DeliveryReceipt} — never null
     */
    public static DeliveryReceipt fromResponse(int httpStatus, String body) {
        if (httpStatus != 200) {
            return DeliveryReceipt.failed("HTTP-" + httpStatus, body);
        }

        try {
            Map<String, Object> json = MAPPER.readValue(body, MAP_TYPE);
            int errorCode = ((Number) json.getOrDefault("ErrorCode", 0)).intValue();
            if (errorCode == 0) {
                String messageId = (String) json.get("MessageID");
                return DeliveryReceipt.accepted(messageId);
            } else {
                String message = (String) json.getOrDefault("Message", "Postmark inline error");
                return DeliveryReceipt.failed("POSTMARK-" + errorCode, message);
            }
        } catch (Exception e) {
            log.warn("op=postmark.parseResponse outcome=parseError body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body, e);
            return DeliveryReceipt.failed("PARSE_ERROR", e.getMessage());
        }
    }
}
```

---

- [ ] **Step 5: Run tests — expect GREEN**

```bash
cd backend && mvn -pl libs/email-gateway test \
    -Dtest="PostmarkPayloadMapperTest,PostmarkResponseMapperTest"
```

Expected output:
```
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

(4 PayloadMapper cases + 2 explicit ResponseMapper cases; the 2 pattern-noted cases are not compiled at this step.)

- [ ] **Step 6: Full email-gateway module verify**

```bash
cd backend && mvn -pl libs/email-gateway verify
```

Expected:
```
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 7: Commit**

```bash
git add \
    backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapper.java \
    backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkResponseMapper.java \
    backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkPayloadMapperTest.java \
    backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkResponseMapperTest.java
git commit -m "$(cat <<'EOF'
feat(email-gateway): PostmarkPayloadMapper + PostmarkResponseMapper + unit tests

[milestone:4][task:4-3]

Refs: docs/dispatch-log/4-3-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-4: PostmarkEmailGateway (TWO-STAGE REVIEW)

**Files:**
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkProperties.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkAutoConfiguration.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkEmailGateway.java`
- Create: `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkEmailGatewayIT.java`

**Review:** TWO-STAGE — (1) spec + correctness review by second Sonnet before commit; (2) quality review in same pass (combined spec+quality per dispatch protocol rule 4, since the review is two-stage for logic not ceremony). Request reviewer to check: retry logic correctness, thread-safety of `RestClient` usage, WireMock test isolation.

**Design notes:**
- `PostmarkProperties` is bound to `messaging.email.postmark` (NOT `drshoes.email` — the existing `EmailGatewayProperties` owns that prefix; Postmark adds a sub-namespace).
- `PostmarkAutoConfiguration` is conditional on `messaging.email.provider=postmark`. The existing `EmailGatewayAutoConfiguration` retains its `@ConditionalOnMissingBean(EmailGateway.class)` logic unchanged — Logging is the fallback when Postmark is not activated.
- `PostmarkEmailGateway` must NOT exceed 120 LOC (Java class cap). Delegates payload building to `PostmarkPayloadMapper` and response parsing to `PostmarkResponseMapper` — those classes exist from task 4-3.
- Retry: on `ResourceAccessException` (Spring wrapper for `IOException`/timeout): sleep 1 000 ms, retry once. Any second failure → `DeliveryReceipt.failed("NETWORK", ...)`. Do NOT retry on HTTP 4xx/5xx.
- Attachment bytes are fetched via `BlobStorage.get(BlobKey)` before mapper call. `BlobKey` is constructed from `attachment.name()` (the name field holds the blob key in this project's convention — verify in dispatch log at execution time).
- Structured logging: every send emits one `INFO` on success and one `WARN` on failure, with `key=value` fields: `op`, `outcome`, `providerMessageId`, `idemKey`, `recipientLast4`.
- `WireMock` dependency: `spring-cloud-starter-contract-stub-runner` or `wiremock-spring-boot`. Check the existing `pom.xml` of `email-gateway` at execution time — if WireMock is already declared (it may be from M3 photo storage IT), reuse it. If not, add `com.github.tomakehurst:wiremock-standalone` or the Spring Cloud contract stub runner variant. Pin the exact dependency in the dispatch log.

---

- [ ] **Step 1: Write the failing WireMock integration test (RED)**

`backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkEmailGatewayIT.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Attachment;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.web.client.RestClient;

import java.util.List;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.stubbing.Scenario.STARTED;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * WireMock integration test for PostmarkEmailGateway.
 *
 * Uses WireMock JUnit5 extension (wiremock-standalone or wiremock-spring-boot).
 * No Spring context needed — wires the gateway manually with a RestClient
 * pointing at WireMock's dynamic port.
 */
class PostmarkEmailGatewayIT {

    @RegisterExtension
    static WireMockExtension wm = WireMockExtension.newInstance()
            .options(WireMockConfiguration.wireMockConfig().dynamicPort())
            .build();

    private PostmarkEmailGateway gateway;

    @BeforeEach
    void setUp() {
        PostmarkProperties props = new PostmarkProperties();
        props.setServerToken("test-token");
        props.setFrom("noreply@drshoes.pl");
        props.setMessageStream("outbound");
        props.setApiBaseUrl(wm.getRuntimeInfo().getHttpBaseUrl());
        props.setTimeoutSeconds(5);

        RestClient restClient = RestClient.builder()
                .baseUrl(wm.getRuntimeInfo().getHttpBaseUrl())
                .build();

        // BlobStorage stub: return empty bytes for any key (no attachments in base tests)
        var blobStorage = new com.drshoes.lib.storage.NoOpBlobStorage();
        gateway = new PostmarkEmailGateway(restClient, props, blobStorage);
    }

    // ── Test 1: 200 success ────────────────────────────────────────────────
    @Test
    void send_200Success_returnsAccepted() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":0,"Message":"OK",
                                 "MessageID":"msg-001","SubmittedAt":"2026-05-09T10:00:00Z",
                                 "To":"jan@example.com"}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Test", "Hello.", List.of(), "idem-test-1");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("msg-001");
        wm.verify(1, postRequestedFor(urlEqualTo("/email"))
                .withHeader("X-Postmark-Server-Token", equalTo("test-token")));
    }

    // ── Test 2: 200 + inline error ─────────────────────────────────────────
    @Test
    void send_200InlineError_returnsFailedWithPostmarkCode() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":10,"Message":"Invalid email address."}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.EMAIL, "bad@", "Test", "Hello.", List.of(), "idem-test-2");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("POSTMARK-10");
        assertThat(receipt.errorMessage()).isEqualTo("Invalid email address.");
    }

    // Cases follow same pattern as above:
    // - Test 3: 422 Unprocessable → stub returns status 422, body "{}";
    //   gateway returns DeliveryReceipt.failed("HTTP-422", "{}"); no retry attempted.
    // - Test 4: 500 Server Error → stub returns status 500, body "Internal Server Error";
    //   gateway returns DeliveryReceipt.failed("HTTP-500", "Internal Server Error").

    // ── Test 5: CONNECTION_RESET_BY_PEER — retry succeeds ─────────────────
    @Test
    void send_networkFaultThenSuccess_retriesAndReturnsAccepted() {
        wm.stubFor(post(urlEqualTo("/email"))
                .inScenario("retry")
                .whenScenarioStateIs(STARTED)
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER))
                .willSetStateTo("attempt-2"));

        wm.stubFor(post(urlEqualTo("/email"))
                .inScenario("retry")
                .whenScenarioStateIs("attempt-2")
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":0,"Message":"OK","MessageID":"msg-retry-ok",
                                 "SubmittedAt":"2026-05-09T10:00:01Z","To":"jan@example.com"}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Retry Test", "Hello.", List.of(), "idem-test-5");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("msg-retry-ok");
        wm.verify(2, postRequestedFor(urlEqualTo("/email")));
    }

    // ── Test 6: both attempts fail with reset ──────────────────────────────
    @Test
    void send_bothAttemptsNetworkFault_returnsFailedNetwork() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER)));

        OutboundMessage msg = new OutboundMessage(
                Channel.EMAIL, "jan@example.com", "Retry Test", "Hello.", List.of(), "idem-test-6");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("NETWORK");
        wm.verify(2, postRequestedFor(urlEqualTo("/email")));
    }
}
```

- [ ] **Step 2: Run test — should fail (compile error)**

```bash
cd backend && mvn -pl libs/email-gateway test \
    -Dtest="PostmarkEmailGatewayIT"
```

Expected: `COMPILATION ERROR` — `PostmarkEmailGateway`, `PostmarkProperties`, `PostmarkAutoConfiguration` not found.

---

- [ ] **Step 3: Implement PostmarkProperties**

`backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkProperties.java`:

```java
package com.drshoes.lib.email.postmark;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for the Postmark email gateway.
 * Activated by: messaging.email.provider=postmark
 */
@ConfigurationProperties("messaging.email.postmark")
public class PostmarkProperties {

    /** Postmark server API token (required). */
    private String serverToken;

    /** Sender address, e.g. "noreply@drshoes.pl". */
    private String from = "noreply@drshoes.pl";

    /** Postmark message stream, e.g. "outbound". */
    private String messageStream = "outbound";

    /** Basic-auth username sent by Postmark on webhook callbacks. */
    private String webhookUsername = "drshoes";

    /** Basic-auth password (webhook secret). */
    private String webhookSecret;

    /** Base URL for Postmark API, overridable for testing. */
    private String apiBaseUrl = "https://api.postmarkapp.com";

    /** HTTP read/connect timeout in seconds. */
    private int timeoutSeconds = 10;

    // Getters and setters

    public String getServerToken() { return serverToken; }
    public void setServerToken(String serverToken) { this.serverToken = serverToken; }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public String getMessageStream() { return messageStream; }
    public void setMessageStream(String messageStream) { this.messageStream = messageStream; }

    public String getWebhookUsername() { return webhookUsername; }
    public void setWebhookUsername(String webhookUsername) { this.webhookUsername = webhookUsername; }

    public String getWebhookSecret() { return webhookSecret; }
    public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
```

---

- [ ] **Step 4: Implement PostmarkAutoConfiguration**

`backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkAutoConfiguration.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.storage.BlobStorage;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Auto-configures {@link PostmarkEmailGateway} when
 * {@code messaging.email.provider=postmark} is set.
 *
 * The existing {@link com.drshoes.lib.email.EmailGatewayAutoConfiguration} retains
 * its {@code @ConditionalOnMissingBean(EmailGateway.class)} guard, so
 * {@link com.drshoes.lib.email.LoggingEmailGateway} remains the fallback in
 * dev/test/local where this auto-configuration is not activated.
 */
@AutoConfiguration
@ConditionalOnProperty(name = "messaging.email.provider", havingValue = "postmark")
@EnableConfigurationProperties(PostmarkProperties.class)
public class PostmarkAutoConfiguration {

    @Bean
    public RestClient postmarkRestClient(PostmarkProperties props) {
        var factory = new SimpleClientHttpRequestFactory();
        int ms = props.getTimeoutSeconds() * 1000;
        factory.setConnectTimeout(ms);
        factory.setReadTimeout(ms);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(props.getApiBaseUrl())
                .build();
    }

    @Bean
    public PostmarkEmailGateway postmarkEmailGateway(
            RestClient postmarkRestClient,
            PostmarkProperties props,
            BlobStorage blobStorage) {
        return new PostmarkEmailGateway(postmarkRestClient, props, blobStorage);
    }
}
```

Register in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (add a new line):
```
com.drshoes.lib.email.postmark.PostmarkAutoConfiguration
```

---

- [ ] **Step 5: Implement PostmarkEmailGateway**

`backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkEmailGateway.java`:

```java
package com.drshoes.lib.email.postmark;

import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Postmark email gateway implementation.
 *
 * Sends to ${apiBaseUrl}/email with X-Postmark-Server-Token header.
 * Retry policy: one retry on ResourceAccessException (network/timeout), 1 s pause.
 * No retry on 4xx/5xx — terminal or operator-initiated retry only.
 */
public class PostmarkEmailGateway implements EmailGateway {

    private static final Logger log = LoggerFactory.getLogger(PostmarkEmailGateway.class);

    private final RestClient restClient;
    private final PostmarkProperties props;
    private final BlobStorage blobStorage;

    public PostmarkEmailGateway(RestClient restClient,
                                PostmarkProperties props,
                                BlobStorage blobStorage) {
        this.restClient  = restClient;
        this.props       = props;
        this.blobStorage = blobStorage;
    }

    @Override
    public Channel channel() { return Channel.EMAIL; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        Map<String, byte[]> attachmentBytes = fetchAttachmentBytes(m);
        if (attachmentBytes == null) {
            // fetchAttachmentBytes returns null when total > 10 MB
            return DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE",
                    "Total attachment size exceeds 10 MB Postmark limit");
        }

        Map<String, Object> payload;
        try {
            payload = PostmarkPayloadMapper.toPayload(
                    m, attachmentBytes, props.getMessageStream(), props.getFrom());
        } catch (IllegalArgumentException e) {
            log.warn("op=postmark.send outcome=attachmentTooLarge idemKey={}", m.idempotencyKey());
            return DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE", e.getMessage());
        }

        return executeWithRetry(m, payload);
    }

    // ─── private helpers ────────────────────────────────────────────────────

    /**
     * Returns null when attachment total exceeds 10 MB.
     */
    private Map<String, byte[]> fetchAttachmentBytes(OutboundMessage m) {
        Map<String, byte[]> result = new HashMap<>();
        long total = 0;
        for (var att : m.attachments()) {
            try (InputStream is = blobStorage.get(new BlobKey(att.name()))) {
                byte[] bytes = is.readAllBytes();
                total += bytes.length;
                if (total > 10L * 1024 * 1024) return null;
                result.put(att.name(), bytes);
            } catch (Exception e) {
                log.warn("op=postmark.fetchAttachment outcome=error attachment={} idemKey={}",
                        att.name(), m.idempotencyKey(), e);
                // Propagate as runtime exception — caller treats as send failure
                throw new RuntimeException("Failed to fetch attachment: " + att.name(), e);
            }
        }
        return result;
    }

    private DeliveryReceipt executeWithRetry(OutboundMessage m, Map<String, Object> payload) {
        try {
            return doPost(m, payload);
        } catch (ResourceAccessException e) {
            log.warn("op=postmark.send outcome=networkErrorAttempt1 idemKey={} error={}",
                    m.idempotencyKey(), e.getMessage());
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            try {
                return doPost(m, payload);
            } catch (ResourceAccessException e2) {
                log.warn("op=postmark.send outcome=failed errorCode=NETWORK idemKey={} error={}",
                        m.idempotencyKey(), e2.getMessage());
                return DeliveryReceipt.failed("NETWORK", e2.getMessage());
            }
        }
    }

    private DeliveryReceipt doPost(OutboundMessage m, Map<String, Object> payload) {
        var responseEntity = restClient.post()
                .uri("/email")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Postmark-Server-Token", props.getServerToken())
                .body(payload)
                .retrieve()
                .toEntity(String.class);

        int status = responseEntity.getStatusCode().value();
        String body = responseEntity.getBody() != null ? responseEntity.getBody() : "";

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(status, body);

        if (receipt.initialStatus().name().equals("SENT")) {
            log.info("op=postmark.send outcome=success providerMessageId={} idemKey={} recipientLast4={}",
                    receipt.providerMessageId(), m.idempotencyKey(), last4(m.recipient()));
        } else {
            log.warn("op=postmark.send outcome=failed errorCode={} errorMessage={} idemKey={} recipientLast4={}",
                    receipt.errorCode(), receipt.errorMessage(), m.idempotencyKey(), last4(m.recipient()));
        }
        return receipt;
    }

    private static String last4(String recipient) {
        if (recipient == null || recipient.length() < 4) return "****";
        return recipient.substring(recipient.length() - 4);
    }
}
```

**Note on RestClient 4xx/5xx behaviour:** by default `RestClient` throws `HttpClientErrorException` / `HttpServerErrorException` (both extend `RestClientResponseException`) for 4xx/5xx. Add a `.onStatus(...)` handler or use `.toEntity` with `retrieve().onStatus(HttpStatusCode::isError, ...)` to capture the body instead of throwing. In `doPost` above, use an error-capturing approach:

Replace the `retrieve()` block with:
```java
        var responseEntity = restClient.post()
                .uri("/email")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Postmark-Server-Token", props.getServerToken())
                .body(payload)
                .retrieve()
                .onStatus(status2 -> !status2.is2xxSuccessful(),
                          (req, resp) -> {
                              // suppress throw; let toEntity capture status+body
                          })
                .toEntity(String.class);
```

This ensures 4xx/5xx responses flow through `PostmarkResponseMapper.fromResponse` rather than becoming exceptions.

---

- [ ] **Step 6: (SPEC REVIEW) — Stop; request second Sonnet reviewer**

Before running tests, dispatch a second Sonnet subagent to review `PostmarkEmailGateway` and `PostmarkEmailGatewayIT` against spec §4.1 and the retry contract. Reviewer must confirm:
1. Retry fires exactly once on `ResourceAccessException` (not on `HttpClientErrorException`).
2. `doPost` never throws unchecked on 4xx/5xx (body captured, not exception).
3. WireMock test isolation is correct (scenario state reset between tests).
4. Thread-safety: `RestClient` is safe to share; no mutable state in gateway.

Record review outcome in dispatch log before proceeding to step 7.

---

- [ ] **Step 7: Run integration test — expect GREEN**

```bash
cd backend && mvn -pl libs/email-gateway verify \
    -Dtest="PostmarkEmailGatewayIT"
```

Expected:
```
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 8: Full email-gateway module verify (all tests pass)**

```bash
cd backend && mvn -pl libs/email-gateway verify
```

Expected:
```
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

(6 unit tests from task 4-3 + 6 IT from task 4-4.)

- [ ] **Step 9: Commit**

```bash
git add \
    backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkProperties.java \
    backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkAutoConfiguration.java \
    backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/postmark/PostmarkEmailGateway.java \
    backend/libs/email-gateway/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports \
    backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/postmark/PostmarkEmailGatewayIT.java
git commit -m "$(cat <<'EOF'
feat(email-gateway): PostmarkEmailGateway + PostmarkProperties + autoconfig + WireMock IT

[milestone:4][task:4-4]

Refs: docs/dispatch-log/4-4-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-5: SmsApiPayloadMapper + SmsApiResponseMapper + unit tests

**Files:**
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapper.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapper.java`
- Create: `backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapperTest.java`
- Create: `backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapperTest.java`

**Review:** combined single-stage.

**Design notes:**
- SMSAPI modern JSON endpoint: POST to `/sms.do` with `Content-Type: application/json`.
- Payload fields: `to`, `message`, `from`, `idempotency_key` (the `idempotencyKey` field from `OutboundMessage`). No `subject` — SMS is body-only. No attachments.
- `SmsApiPayloadMapper` is pure static utility, no Spring dependencies.
- Response shapes:
  - Success: `{ "list": [{ "id": "abc", "status": "QUEUE" }], "count": 1 }` → `DeliveryReceipt.accepted(list[0].id)`.
  - Error envelope: `{ "error": 13, "message": "Wrong phone number" }` → `DeliveryReceipt.failed("SMSAPI-" + error, message)`.
  - HTTP non-200 → `DeliveryReceipt.failed("HTTP-" + status, body)`.
- **Plan-time errata note embedded in code:** field names `idempotency_key` and response `list[0].id` must be verified against live SMSAPI docs at execution time. The embedded TODO comment is mandatory (see below).

---

- [ ] **Step 1: Write the failing unit tests (RED)**

`backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapperTest.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SmsApiPayloadMapperTest {

    private static final String FROM = "DrShoes";

    // ── Case 1: basic SMS payload ─────────────────────────────────────────
    @Test
    void basicMessage_emitsRequiredFields() {
        var msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Twoje buty są gotowe.", List.of(), "idem-sms-1");

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, FROM);

        assertThat(payload)
                .containsEntry("to", "+48600100200")
                .containsEntry("message", "Twoje buty są gotowe.")
                .containsEntry("from", FROM)
                .containsEntry("idempotency_key", "idem-sms-1");
    }

    // ── Case 2: null idempotency key handled gracefully ───────────────────
    @Test
    void nullIdempotencyKey_fieldOmitted() {
        var msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Wiadomość testowa.", List.of(), null);

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, FROM);

        assertThat(payload).doesNotContainKey("idempotency_key");
    }

    // Cases follow same pattern as above:
    // - Long message (>160 chars): payload still emits full body under "message" key;
    //   no truncation in mapper (SMSAPI handles multipart internally).
    // - Non-Polish from: payload emits "from" as provided; no validation in mapper.
}
```

`backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapperTest.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmsApiResponseMapperTest {

    // ── Case 1: success response ─────────────────────────────────────────
    @Test
    void successEnvelope_returnsAccepted() {
        String body = """
                {"list":[{"id":"sms-abc","status":"QUEUE","number":"+48600100200",
                          "date_sent":1715250000,"submitted_number":"+48600100200",
                          "points":0.160,"encoding":"utf-8","idx":"idem-sms-1"}],
                 "count":1}
                """;

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-abc");
        assertThat(receipt.errorCode()).isNull();
    }

    // ── Case 2: error envelope ────────────────────────────────────────────
    @Test
    void errorEnvelope_returnsFailedWithSmsApiCode() {
        String body = """
                {"error":13,"message":"Wrong phone number"}
                """;

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("SMSAPI-13");
        assertThat(receipt.errorMessage()).isEqualTo("Wrong phone number");
    }

    // Cases follow same pattern as above:
    // - HTTP 400 → DeliveryReceipt.failed("HTTP-400", <body>); no JSON parsing attempted.
    // - HTTP 500 → DeliveryReceipt.failed("HTTP-500", <body>).
}
```

- [ ] **Step 2: Run tests — should fail (compile error)**

```bash
cd backend && mvn -pl libs/sms-gateway test \
    -Dtest="SmsApiPayloadMapperTest,SmsApiResponseMapperTest"
```

Expected: `COMPILATION ERROR` — classes not found.

---

- [ ] **Step 3: Implement SmsApiPayloadMapper (GREEN)**

`backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapper.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.OutboundMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure mapping utility: OutboundMessage → SMSAPI /sms.do JSON payload.
 *
 * Payload fields: to, message, from, idempotency_key (omitted if null).
 *
 * TODO(plan-errata #6): verify request/response shape against current SMSAPI docs
 *   at execution time. Spec §10 errata #6. Confirm field name "idempotency_key"
 *   is accepted by the SMSAPI JSON endpoint (not just the legacy form endpoint).
 *   If SMSAPI changed the field name, update this mapper and the dispatch log.
 */
public final class SmsApiPayloadMapper {

    private SmsApiPayloadMapper() {}

    /**
     * @param msg  the outbound SMS message
     * @param from sender name or phone number registered in SMSAPI account
     * @return Jackson-serialisable map representing the SMSAPI /sms.do request body
     */
    public static Map<String, Object> toPayload(OutboundMessage msg, String from) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", msg.recipient());
        payload.put("message", msg.body());
        payload.put("from", from);
        if (msg.idempotencyKey() != null && !msg.idempotencyKey().isBlank()) {
            payload.put("idempotency_key", msg.idempotencyKey());
        }
        return payload;
    }
}
```

---

- [ ] **Step 4: Implement SmsApiResponseMapper (GREEN)**

`backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapper.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * Pure mapping utility: SMSAPI HTTP response → DeliveryReceipt.
 *
 * Response shapes:
 *  - 200 + {"list":[{"id":"..."}],"count":1}   → DeliveryReceipt.accepted(list[0].id)
 *  - 200 + {"error":N,"message":"..."}          → DeliveryReceipt.failed("SMSAPI-N", message)
 *  - non-200                                    → DeliveryReceipt.failed("HTTP-N", body)
 *
 * TODO(plan-errata #6): verify response shape against current SMSAPI docs at execution time.
 *   Confirm list[0].id is the stable message identifier field. See SmsApiPayloadMapper note.
 */
public final class SmsApiResponseMapper {

    private static final Logger log = LoggerFactory.getLogger(SmsApiResponseMapper.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private SmsApiResponseMapper() {}

    /**
     * @param httpStatus HTTP response status code
     * @param body       raw response body string
     * @return {@link DeliveryReceipt} — never null
     */
    @SuppressWarnings("unchecked")
    public static DeliveryReceipt fromResponse(int httpStatus, String body) {
        if (httpStatus != 200) {
            return DeliveryReceipt.failed("HTTP-" + httpStatus, body);
        }

        try {
            Map<String, Object> json = MAPPER.readValue(body, MAP_TYPE);

            // Error envelope: {"error": N, "message": "..."}
            if (json.containsKey("error")) {
                int errorCode = ((Number) json.get("error")).intValue();
                String message = (String) json.getOrDefault("message", "SMSAPI error");
                return DeliveryReceipt.failed("SMSAPI-" + errorCode, message);
            }

            // Success envelope: {"list":[{"id":"...","status":"QUEUE",...}],"count":1}
            if (json.containsKey("list")) {
                List<Map<String, Object>> list = (List<Map<String, Object>>) json.get("list");
                if (list != null && !list.isEmpty()) {
                    String msgId = (String) list.get(0).get("id");
                    return DeliveryReceipt.accepted(msgId);
                }
            }

            // Unexpected shape
            log.warn("op=smsapi.parseResponse outcome=unknownShape body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body);
            return DeliveryReceipt.failed("PARSE_ERROR", "Unexpected SMSAPI response shape");

        } catch (Exception e) {
            log.warn("op=smsapi.parseResponse outcome=parseError body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body, e);
            return DeliveryReceipt.failed("PARSE_ERROR", e.getMessage());
        }
    }
}
```

---

- [ ] **Step 5: Run tests — expect GREEN**

```bash
cd backend && mvn -pl libs/sms-gateway test \
    -Dtest="SmsApiPayloadMapperTest,SmsApiResponseMapperTest"
```

Expected:
```
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```

- [ ] **Step 6: Full sms-gateway module verify**

```bash
cd backend && mvn -pl libs/sms-gateway verify
```

Expected:
```
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 7: Commit**

```bash
git add \
    backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapper.java \
    backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapper.java \
    backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiPayloadMapperTest.java \
    backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiResponseMapperTest.java
git commit -m "$(cat <<'EOF'
feat(sms-gateway): SmsApiPayloadMapper + SmsApiResponseMapper + unit tests

[milestone:4][task:4-5]

Refs: docs/dispatch-log/4-5-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-6: SmsApiSmsGateway (TWO-STAGE REVIEW)

**Files:**
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiProperties.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiAutoConfiguration.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGateway.java`
- Create: `backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGatewayIT.java`

**Review:** TWO-STAGE — same pattern as task 4-4. Reviewer checks: retry logic, `RestClient` 4xx/5xx body capture (not throw), IP allowlist wiring (confirmed not to be in this task — allowlist lives in the webhook controller, but confirm the gateway does NOT validate IPs on outbound), WireMock isolation.

**Design notes:**
- `SmsApiProperties` is bound to `messaging.sms.smsapi`.
- `SmsApiAutoConfiguration` is conditional on `messaging.sms.provider=smsapi`.
- Existing `SmsGatewayAutoConfiguration` retains its `@ConditionalOnMissingBean(SmsGateway.class)` guard unchanged.
- `SmsApiSmsGateway` sends POST to `${apiBaseUrl}/sms.do` with `Authorization: Bearer <token>` header and `Content-Type: application/json`.
- Retry policy: identical to Postmark — one retry on `ResourceAccessException`, 1 s pause.
- SMS has no attachments — no `BlobStorage` dependency.
- Structured logging: `op=smsapi.send outcome=success/failed` with `idemKey` and `recipientLast4`.
- `callbackAllowlist` and `clientIpHeader` live in `SmsApiProperties` but are NOT used by the gateway — they are wired in the webhook controller (task 4-10). They appear in properties now so the YAML is complete.

---

- [ ] **Step 1: Write the failing WireMock integration test (RED)**

`backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGatewayIT.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.web.client.RestClient;

import java.util.List;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.stubbing.Scenario.STARTED;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * WireMock integration test for SmsApiSmsGateway.
 *
 * Uses WireMock JUnit5 extension; no Spring context needed.
 * Gateway wired manually with RestClient pointing at WireMock's dynamic port.
 */
class SmsApiSmsGatewayIT {

    @RegisterExtension
    static WireMockExtension wm = WireMockExtension.newInstance()
            .options(WireMockConfiguration.wireMockConfig().dynamicPort())
            .build();

    private SmsApiSmsGateway gateway;

    @BeforeEach
    void setUp() {
        SmsApiProperties props = new SmsApiProperties();
        props.setToken("test-smsapi-token");
        props.setFrom("DrShoes");
        props.setApiBaseUrl(wm.getRuntimeInfo().getHttpBaseUrl());
        props.setTimeoutSeconds(5);

        RestClient restClient = RestClient.builder()
                .baseUrl(wm.getRuntimeInfo().getHttpBaseUrl())
                .build();

        gateway = new SmsApiSmsGateway(restClient, props);
    }

    // ── Test 1: 200 success ────────────────────────────────────────────────
    @Test
    void send_200Success_returnsAccepted() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"list":[{"id":"sms-001","status":"QUEUE",
                                          "number":"+48600100200","date_sent":1715250000,
                                          "submitted_number":"+48600100200",
                                          "points":0.160,"encoding":"utf-8",
                                          "idx":"idem-sms-test-1"}],
                                 "count":1}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Twoje buty są gotowe.", List.of(), "idem-sms-test-1");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-001");
        wm.verify(1, postRequestedFor(urlEqualTo("/sms.do"))
                .withHeader("Authorization", equalTo("Bearer test-smsapi-token"))
                .withHeader("Content-Type", containing("application/json")));
    }

    // ── Test 2: 200 inline error envelope ─────────────────────────────────
    @Test
    void send_200ErrorEnvelope_returnsFailedWithSmsApiCode() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"error":13,"message":"Wrong phone number"}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "badphone", null,
                "Test.", List.of(), "idem-sms-test-2");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("SMSAPI-13");
        assertThat(receipt.errorMessage()).isEqualTo("Wrong phone number");
    }

    // Cases follow same pattern as above:
    // - Test 3: 400 Bad Request → stub returns status 400, body "Bad Request";
    //   gateway returns DeliveryReceipt.failed("HTTP-400", "Bad Request"); no retry.
    // - Test 4: CONNECTION_RESET_BY_PEER on attempt 1 → succeeds on attempt 2 →
    //   gateway returns DeliveryReceipt.accepted("sms-retry-ok");
    //   WireMock scenario "retry": STARTED → fault → "attempt-2" → success.
    //   verify(2, postRequestedFor(urlEqualTo("/sms.do"))) asserts retry happened.

    // ── Test 4 (inline — network retry): ────────────────────────────────────
    @Test
    void send_networkFaultThenSuccess_retriesAndReturnsAccepted() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .inScenario("sms-retry")
                .whenScenarioStateIs(STARTED)
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER))
                .willSetStateTo("attempt-2"));

        wm.stubFor(post(urlEqualTo("/sms.do"))
                .inScenario("sms-retry")
                .whenScenarioStateIs("attempt-2")
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"list":[{"id":"sms-retry-ok","status":"QUEUE",
                                          "number":"+48600100200","date_sent":1715250001,
                                          "submitted_number":"+48600100200",
                                          "points":0.160,"encoding":"utf-8",
                                          "idx":"idem-sms-test-4"}],
                                 "count":1}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Retry test.", List.of(), "idem-sms-test-4");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-retry-ok");
        wm.verify(2, postRequestedFor(urlEqualTo("/sms.do")));
    }
}
```

- [ ] **Step 2: Run test — should fail (compile error)**

```bash
cd backend && mvn -pl libs/sms-gateway test \
    -Dtest="SmsApiSmsGatewayIT"
```

Expected: `COMPILATION ERROR` — `SmsApiSmsGateway`, `SmsApiProperties`, `SmsApiAutoConfiguration` not found.

---

- [ ] **Step 3: Implement SmsApiProperties**

`backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiProperties.java`:

```java
package com.drshoes.lib.sms.smsapi;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

/**
 * Configuration properties for the SMSAPI SMS gateway.
 * Activated by: messaging.sms.provider=smsapi
 */
@ConfigurationProperties("messaging.sms.smsapi")
public class SmsApiProperties {

    /** SMSAPI OAuth2 token (required). */
    private String token;

    /** Sender name or number registered in the SMSAPI account, e.g. "DrShoes". */
    private String from = "DrShoes";

    /**
     * Comma-separated list of allowed source IPs for SMSAPI webhook callbacks.
     * Used by the webhook controller (task 4-10), not by the gateway.
     * Defaults to the SMSAPI documented IP range (2026-05-09).
     */
    private List<String> callbackAllowlist = List.of(
            "89.174.81.98",
            "91.185.187.219",
            "213.189.53.211",
            "31.186.83.18",
            "212.91.26.253"
    );

    /**
     * HTTP header to read client IP from (for webhook IP allowlist check).
     * Behind Cloudflare Containers set to "Cf-Connecting-Ip".
     * Used by the webhook controller (task 4-10), not by the gateway.
     */
    private String clientIpHeader = "X-Forwarded-For";

    /** Base URL for SMSAPI, overridable for testing. */
    private String apiBaseUrl = "https://api.smsapi.pl";

    /** HTTP read/connect timeout in seconds. */
    private int timeoutSeconds = 10;

    // Getters and setters

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public List<String> getCallbackAllowlist() { return callbackAllowlist; }
    public void setCallbackAllowlist(List<String> callbackAllowlist) {
        this.callbackAllowlist = callbackAllowlist;
    }

    public String getClientIpHeader() { return clientIpHeader; }
    public void setClientIpHeader(String clientIpHeader) { this.clientIpHeader = clientIpHeader; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
```

---

- [ ] **Step 4: Implement SmsApiAutoConfiguration**

`backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiAutoConfiguration.java`:

```java
package com.drshoes.lib.sms.smsapi;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Auto-configures {@link SmsApiSmsGateway} when
 * {@code messaging.sms.provider=smsapi} is set.
 *
 * The existing {@link com.drshoes.lib.sms.SmsGatewayAutoConfiguration} retains
 * its {@code @ConditionalOnMissingBean(SmsGateway.class)} guard, so
 * {@link com.drshoes.lib.sms.LoggingSmsGateway} remains the fallback in
 * dev/test/local where this auto-configuration is not activated.
 */
@AutoConfiguration
@ConditionalOnProperty(name = "messaging.sms.provider", havingValue = "smsapi")
@EnableConfigurationProperties(SmsApiProperties.class)
public class SmsApiAutoConfiguration {

    @Bean
    public RestClient smsApiRestClient(SmsApiProperties props) {
        var factory = new SimpleClientHttpRequestFactory();
        int ms = props.getTimeoutSeconds() * 1000;
        factory.setConnectTimeout(ms);
        factory.setReadTimeout(ms);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(props.getApiBaseUrl())
                .build();
    }

    @Bean
    public SmsApiSmsGateway smsApiSmsGateway(
            RestClient smsApiRestClient,
            SmsApiProperties props) {
        return new SmsApiSmsGateway(smsApiRestClient, props);
    }
}
```

Register in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` for the `sms-gateway` module (create if absent):
```
com.drshoes.lib.sms.smsapi.SmsApiAutoConfiguration
```

---

- [ ] **Step 5: Implement SmsApiSmsGateway**

`backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGateway.java`:

```java
package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * SMSAPI SMS gateway implementation.
 *
 * POSTs to ${apiBaseUrl}/sms.do with Authorization: Bearer <token> header.
 * Retry policy: one retry on ResourceAccessException (network/timeout), 1 s pause.
 * No retry on 4xx/5xx — terminal or operator-initiated retry only.
 *
 * No attachment support: SMS is body-only.
 *
 * TODO(plan-errata #6): verify request/response shape against current SMSAPI docs
 *   at execution time. See SmsApiPayloadMapper and SmsApiResponseMapper.
 */
public class SmsApiSmsGateway implements SmsGateway {

    private static final Logger log = LoggerFactory.getLogger(SmsApiSmsGateway.class);

    private final RestClient restClient;
    private final SmsApiProperties props;

    public SmsApiSmsGateway(RestClient restClient, SmsApiProperties props) {
        this.restClient = restClient;
        this.props      = props;
    }

    @Override
    public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(m, props.getFrom());
        return executeWithRetry(m, payload);
    }

    // ─── private helpers ────────────────────────────────────────────────────

    private DeliveryReceipt executeWithRetry(OutboundMessage m, Map<String, Object> payload) {
        try {
            return doPost(m, payload);
        } catch (ResourceAccessException e) {
            log.warn("op=smsapi.send outcome=networkErrorAttempt1 idemKey={} error={}",
                    m.idempotencyKey(), e.getMessage());
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            try {
                return doPost(m, payload);
            } catch (ResourceAccessException e2) {
                log.warn("op=smsapi.send outcome=failed errorCode=NETWORK idemKey={} error={}",
                        m.idempotencyKey(), e2.getMessage());
                return DeliveryReceipt.failed("NETWORK", e2.getMessage());
            }
        }
    }

    private DeliveryReceipt doPost(OutboundMessage m, Map<String, Object> payload) {
        var responseEntity = restClient.post()
                .uri("/sms.do")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + props.getToken())
                .body(payload)
                .retrieve()
                .onStatus(status -> !status.is2xxSuccessful(),
                          (req, resp) -> {
                              // suppress throw; capture status+body via toEntity
                          })
                .toEntity(String.class);

        int status = responseEntity.getStatusCode().value();
        String body = responseEntity.getBody() != null ? responseEntity.getBody() : "";

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(status, body);

        if (receipt.initialStatus().name().equals("SENT")) {
            log.info("op=smsapi.send outcome=success providerMessageId={} idemKey={} recipientLast4={}",
                    receipt.providerMessageId(), m.idempotencyKey(), last4(m.recipient()));
        } else {
            log.warn("op=smsapi.send outcome=failed errorCode={} errorMessage={} idemKey={} recipientLast4={}",
                    receipt.errorCode(), receipt.errorMessage(), m.idempotencyKey(), last4(m.recipient()));
        }
        return receipt;
    }

    private static String last4(String recipient) {
        if (recipient == null || recipient.length() < 4) return "****";
        return recipient.substring(recipient.length() - 4);
    }
}
```

---

- [ ] **Step 6: (SPEC REVIEW) — Stop; request second Sonnet reviewer**

Before running tests, dispatch a second Sonnet subagent to review `SmsApiSmsGateway` and `SmsApiSmsGatewayIT` against spec §4.2. Reviewer must confirm:
1. Retry fires exactly once on `ResourceAccessException`; does NOT retry on SMSAPI error envelope (200 + `error` field).
2. `doPost` never throws on non-200 HTTP (body captured via `onStatus` suppression).
3. `callbackAllowlist` and `clientIpHeader` are in `SmsApiProperties` but not referenced in gateway (deferred to webhook controller task 4-10).
4. WireMock scenario state is reset correctly between test methods (each `@Test` has its own stub via `@BeforeEach` reset or scenario-scoped stubs).
5. No mutable shared state in gateway — `RestClient` is thread-safe.

Record review outcome in dispatch log.

---

- [ ] **Step 7: Run integration test — expect GREEN**

```bash
cd backend && mvn -pl libs/sms-gateway test \
    -Dtest="SmsApiSmsGatewayIT"
```

Expected:
```
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```

- [ ] **Step 8: Full sms-gateway module verify (all tests)**

```bash
cd backend && mvn -pl libs/sms-gateway verify
```

Expected:
```
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

(4 unit tests from task 4-5 + 4 IT from task 4-6.)

- [ ] **Step 9: Full backend verify (all modules — regression gate)**

```bash
cd backend && mvn verify
```

Expected:
```
Tests run: 175, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

(Baseline before Wave 2: 167 tests from M3 closure + 8 new from tasks 4-3 through 4-6 = 175.)

- [ ] **Step 10: Commit**

```bash
git add \
    backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiProperties.java \
    backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiAutoConfiguration.java \
    backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGateway.java \
    backend/libs/sms-gateway/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports \
    backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/smsapi/SmsApiSmsGatewayIT.java
git commit -m "$(cat <<'EOF'
feat(sms-gateway): SmsApiSmsGateway + SmsApiProperties + autoconfig + WireMock IT

[milestone:4][task:4-6]

Refs: docs/dispatch-log/4-6-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 2 closure checklist

After tasks 4-3 through 4-6 are committed:

- [ ] `mvn verify` from `backend/` root: `Tests run: 175, Failures: 0, Errors: 0, Skipped: 0`
- [ ] No new `@ConditionalOnMissingBean` conflicts: `LoggingEmailGateway` and `LoggingSmsGateway` remain active in dev/test/local; real gateways only activate when provider property is set.
- [ ] `PostmarkAutoConfiguration` and `SmsApiAutoConfiguration` registered in their respective `AutoConfiguration.imports` files.
- [ ] `TODO(plan-errata #6)` comments present in both SMSAPI mapper files — will be resolved in dispatch log at execution time.
- [ ] Both two-stage review outcomes documented in dispatch logs for tasks 4-4 and 4-6.
- [ ] `docs/dispatch-log/tasks.json` updated: tasks 4-3, 4-4, 4-5, 4-6 set to `"status": "done"`.

## Wave 3 — Webhook receivers + reconciler

---

### Task 4-7: PostmarkWebhookController + Basic-auth verifier + IT

**Review:** combined single-stage.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookPayload.java`
- Create: `backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java`
- Create: `backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookController.java`
- Create: `backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkWebhookControllerIT.java`

---

- [ ] **Step 1: Write the failing integration test**

`backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkWebhookControllerIT.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.domain.AuditEventRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.Channel;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.Message;
import com.drshoes.app.messaging.domain.MessageRepository;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.email.postmark.webhook-username=drshoes",
    "messaging.email.postmark.webhook-secret=test-secret"
})
class PostmarkWebhookControllerIT extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MessageRepository messages;
    @Autowired WebhookEventRepository webhookEvents;
    @Autowired AuditEventRepository auditEvents;
    @Autowired ClientRepository clients;
    @Autowired OrderRepository orders;

    private static final String VALID_AUTH =
        "Basic " + Base64.getEncoder().encodeToString("drshoes:test-secret".getBytes(StandardCharsets.UTF_8));
    private static final String BAD_AUTH =
        "Basic " + Base64.getEncoder().encodeToString("drshoes:wrong-password".getBytes(StandardCharsets.UTF_8));

    private UUID orderId;
    private String providerMessageId;

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFullName("Testowy Klient");
        client.setPhone("+48600100200");
        var savedClient = clients.save(client);

        var order = new Order();
        order.setClientId(savedClient.getId());
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        order.setOrderType(OrderType.NAPRAWA);
        var savedOrder = orders.save(order);
        orderId = savedOrder.getId();

        // Insert a SENT message with a known providerMessageId
        providerMessageId = "postmark-msg-" + UUID.randomUUID();
        var msg = new Message();
        msg.setOrderId(orderId);
        msg.setChannel(Channel.EMAIL);
        msg.setDeliveryStatus(DeliveryStatus.SENT);
        msg.setProviderMessageId(providerMessageId);
        msg.setRecipient("klient@example.com");
        msg.setSubject("Test");
        msg.setBody("Treść");
        messages.save(msg);
    }

    @Test
    void delivery_validAuth_returns200_appliedOutcomeDelivered() throws Exception {
        String payload = """
            {
              "RecordType": "Delivery",
              "MessageID": "%s",
              "DeliveredAt": "2026-05-09T12:00:00Z",
              "MessageStream": "outbound"
            }
            """.formatted(providerMessageId);

        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        // webhook_event row with APPLIED outcome
        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        WebhookEventEntity ev = events.get(0);
        assertThat(ev.getAppliedOutcome().name()).isEqualTo("APPLIED");
        assertThat(ev.getAppliedStatus().name()).isEqualTo("DELIVERED");

        // message row updated to DELIVERED
        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMessageId, Channel.EMAIL);
        assertThat(updatedMsg).isPresent();
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.DELIVERED);

        // audit_log row written for WebhookStatusReconciler#apply
        var reconcilerAudits = auditEvents.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().contains("WebhookStatusReconciler#apply"))
            .toList();
        assertThat(reconcilerAudits).isNotEmpty();

        // timeline endpoint includes MESSAGE_DELIVERED event
        mockMvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$[?(@.kind == 'MESSAGE_DELIVERED')]").exists());
    }

    @Test
    void bounce_validAuth_returns200_appliedOutcomeFailed() throws Exception {
        String payload = """
            {
              "RecordType": "Bounce",
              "MessageID": "%s",
              "BouncedAt": "2026-05-09T12:01:00Z",
              "Type": "HardBounce",
              "TypeCode": 1,
              "Description": "The server was unable to deliver your message."
            }
            """.formatted(providerMessageId);

        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("APPLIED");
        assertThat(events.get(0).getAppliedStatus().name()).isEqualTo("FAILED");
        assertThat(events.get(0).getErrorMessage()).isNotBlank();

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMessageId, Channel.EMAIL);
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.FAILED);
    }

    // Cases follow same pattern:
    // - Bad Basic Auth (wrong password) → 401, zero webhook_event rows, message row unchanged.
    // - Unknown RecordType=Click → 200, webhook_event with outcome=DROPPED, message unchanged.
    // - Unknown MessageID (not in DB) → 200, webhook_event with outcome=NO_MESSAGE.
    // - Malformed JSON → 400, no webhook_event row.

    @Test
    void badAuth_returns401_noDbWrites() throws Exception {
        String payload = """
            {"RecordType":"Delivery","MessageID":"%s","DeliveredAt":"2026-05-09T12:00:00Z"}
            """.formatted(providerMessageId);

        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", BAD_AUTH)
                .content(payload))
            .andExpect(status().isUnauthorized());

        assertThat(webhookEvents.findAll()).isEmpty();
        var msg = messages.findByProviderMessageIdAndChannel(providerMessageId, Channel.EMAIL);
        assertThat(msg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void unknownRecordTypeClick_returns200_droppedOutcome() throws Exception {
        String payload = """
            {"RecordType":"Click","MessageID":"%s","ClickedAt":"2026-05-09T12:02:00Z"}
            """.formatted(providerMessageId);

        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("DROPPED");

        var msg = messages.findByProviderMessageIdAndChannel(providerMessageId, Channel.EMAIL);
        assertThat(msg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void unknownMessageId_returns200_noMessageOutcome() throws Exception {
        String payload = """
            {"RecordType":"Delivery","MessageID":"unknown-id-not-in-db","DeliveredAt":"2026-05-09T12:00:00Z"}
            """;

        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("NO_MESSAGE");
    }

    @Test
    void malformedJson_returns400_noDbWrites() throws Exception {
        mockMvc.perform(post("/api/webhooks/postmark")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content("{this is not valid json"))
            .andExpect(status().isBadRequest());

        assertThat(webhookEvents.findAll()).isEmpty();
    }
}
```

- [ ] **Step 2: Run test — fails (compile errors; controller doesn't exist)**

```bash
cd backend && mvn -pl app test -Dtest=PostmarkWebhookControllerIT
```
Expected: compile errors on `PostmarkWebhookController`, `PostmarkWebhookPayload`, `WebhookEventMapper`. Proceed to author them.

- [ ] **Step 3: Author `PostmarkWebhookPayload` record**

`backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookPayload.java`:

```java
package com.drshoes.app.webhooks;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Jackson record for Postmark webhook payload.
 * Only the fields used for delivery reconciliation are bound.
 * Additional fields pass through silently (@JsonIgnoreProperties).
 *
 * RecordType discriminates the event kind.
 * MessageID is the provider-assigned message identifier (correlates to message.provider_message_id).
 * For Bounce records: Type, TypeCode, Description carry the error detail.
 * For SpamComplaint: no extra error fields needed; error_code is hardcoded to SPAM_COMPLAINT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PostmarkWebhookPayload(

    @JsonProperty("RecordType")
    String recordType,

    @JsonProperty("MessageID")
    String messageId,

    // Delivery
    @JsonProperty("DeliveredAt")
    Instant deliveredAt,

    // Bounce
    @JsonProperty("BouncedAt")
    Instant bouncedAt,

    @JsonProperty("Type")
    String bounceType,

    @JsonProperty("TypeCode")
    Integer bounceTypeCode,

    @JsonProperty("Description")
    String bounceDescription,

    // SpamComplaint
    @JsonProperty("ReceivedAt")
    Instant receivedAt
) {
    /** Convenience: returns the best-available occurred-at timestamp across record types. */
    public Instant occurredAt() {
        if (deliveredAt != null) return deliveredAt;
        if (bouncedAt    != null) return bouncedAt;
        if (receivedAt   != null) return receivedAt;
        return Instant.now();
    }
}
```

- [ ] **Step 4: Author `WebhookEventMapper` (Postmark mapping; `fromSmsApi` stub added in task 4-8)**

`backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import org.springframework.stereotype.Component;

/**
 * Maps provider-specific webhook payloads to the normalised {@link WebhookEvent} DTO.
 *
 * Postmark RecordType → DeliveryStatus mapping (per spec §3.6.3):
 *   Delivery           → DELIVERED
 *   Bounce             → FAILED  (error from Type+TypeCode+Description)
 *   SpamComplaint      → FAILED  (error_code=SPAM_COMPLAINT)
 *   Open/Click/SubscriptionChange/other → null (caller treats as DROPPED)
 *
 * SMSAPI status_name → DeliveryStatus mapping is added in task 4-8.
 */
@Component
public class WebhookEventMapper {

    /**
     * Maps a Postmark payload (with raw JSON for archival) to {@link WebhookEvent}.
     *
     * @param payload  deserialized Postmark payload
     * @param rawJson  original raw JSON string — stored verbatim as raw_payload in webhook_event
     * @return normalized event; status() is null for non-delivery record types (DROPPED path)
     */
    public WebhookEvent fromPostmark(PostmarkWebhookPayload payload, String rawJson) {
        DeliveryStatus status = mapPostmarkRecordType(payload);

        String errorCode    = null;
        String errorMessage = null;

        if ("Bounce".equalsIgnoreCase(payload.recordType())) {
            errorCode    = payload.bounceType();
            errorMessage = buildBounceMessage(payload.bounceType(), payload.bounceTypeCode(),
                                              payload.bounceDescription());
        } else if ("SpamComplaint".equalsIgnoreCase(payload.recordType())) {
            errorCode = "SPAM_COMPLAINT";
        }

        return new WebhookEvent(
            Provider.POSTMARK,
            payload.messageId(),
            null,               // Postmark has no per-event id; dedup relies on state-guarded UPDATE
            status,
            payload.occurredAt(),
            rawJson,
            errorCode,
            errorMessage
        );
    }

    // fromSmsApi is added in task 4-8.

    // ── private helpers ────────────────────────────────────────────────────────

    private DeliveryStatus mapPostmarkRecordType(PostmarkWebhookPayload p) {
        if (p.recordType() == null) return null;
        return switch (p.recordType()) {
            case "Delivery"           -> DeliveryStatus.DELIVERED;
            case "Bounce",
                 "SpamComplaint"      -> DeliveryStatus.FAILED;
            // Open, Click, SubscriptionChange, and any unknown record types → null (DROPPED)
            default                   -> null;
        };
    }

    private String buildBounceMessage(String type, Integer typeCode, String description) {
        var sb = new StringBuilder();
        if (type        != null) sb.append("Type=").append(type);
        if (typeCode    != null) sb.append(" TypeCode=").append(typeCode);
        if (description != null && !description.isBlank()) sb.append(" ").append(description);
        return sb.toString().trim();
    }
}
```

- [ ] **Step 5: Author `PostmarkWebhookController`**

`backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookController.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

/**
 * Receives Postmark delivery webhook callbacks.
 *
 * Authentication: HTTP Basic auth. Credentials verified via constant-time
 * compare (MessageDigest.isEqual) to prevent timing-based credential oracle.
 * Mismatch → 401, zero DB writes.
 *
 * Body strategy: Spring binds a raw {@code String} body, then this class
 * deserializes to {@link PostmarkWebhookPayload} manually via ObjectMapper.
 * This ensures we archive the original raw JSON regardless of deserialization
 * outcome (rawJson stored in webhook_event.raw_payload).
 *
 * Endpoint: POST /api/webhooks/postmark
 * This path is already declared CSRF-exempt in SecurityConfig (M4 wave 1 task).
 */
@RestController
public class PostmarkWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PostmarkWebhookController.class);

    private final WebhookStatusReconciler reconciler;
    private final WebhookEventMapper mapper;
    private final ObjectMapper objectMapper;

    private final byte[] expectedUsername;
    private final byte[] expectedPassword;

    public PostmarkWebhookController(
            WebhookStatusReconciler reconciler,
            WebhookEventMapper mapper,
            ObjectMapper objectMapper,
            @Value("${messaging.email.postmark.webhook-username:drshoes}") String webhookUsername,
            @Value("${messaging.email.postmark.webhook-secret}") String webhookSecret) {
        this.reconciler       = reconciler;
        this.mapper           = mapper;
        this.objectMapper     = objectMapper;
        this.expectedUsername = webhookUsername.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = webhookSecret.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/api/webhooks/postmark")
    public ResponseEntity<Void> receive(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody String rawBody) {

        // ── 1. Authenticate ─────────────────────────────────────────────────
        if (!verifyBasicAuth(authHeader)) {
            log.info("op=webhook.receive provider=postmark outcome=denied");
            return ResponseEntity.status(401).build();
        }

        // ── 2. Deserialize ───────────────────────────────────────────────────
        PostmarkWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, PostmarkWebhookPayload.class);
        } catch (Exception e) {
            log.warn("op=webhook.receive provider=postmark outcome=malformed error={}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }

        log.info("op=webhook.receive provider=postmark outcome=verified recordType={}",
            payload.recordType());

        // ── 3. Map + reconcile ───────────────────────────────────────────────
        var event = mapper.fromPostmark(payload, rawBody);
        reconciler.apply(event);

        return ResponseEntity.ok().build();
    }

    // ── private ──────────────────────────────────────────────────────────────

    /**
     * Parses "Basic <base64>" header, decodes to "username:password",
     * and performs a constant-time credential comparison.
     */
    private boolean verifyBasicAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) {
            return false;
        }
        String encoded = authHeader.substring(6).trim();
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            return false;
        }
        // Split on first ':' only — passwords may contain ':'
        int colonIdx = -1;
        for (int i = 0; i < decoded.length; i++) {
            if (decoded[i] == ':') { colonIdx = i; break; }
        }
        if (colonIdx < 0) return false;

        byte[] incomingUser = Arrays.copyOfRange(decoded, 0, colonIdx);
        byte[] incomingPass = Arrays.copyOfRange(decoded, colonIdx + 1, decoded.length);

        // Constant-time compare using MessageDigest.isEqual (Java stdlib).
        // Both comparisons must execute regardless of username match to avoid timing oracle.
        boolean userOk = MessageDigest.isEqual(incomingUser, expectedUsername);
        boolean passOk = MessageDigest.isEqual(incomingPass, expectedPassword);
        return userOk && passOk;
    }
}
```

- [ ] **Step 6: Run test — should pass**

```bash
cd backend && mvn -pl app test -Dtest=PostmarkWebhookControllerIT
```
Expected: 6 tests, all green.

Full suite:
```bash
cd backend && mvn verify
```
Expected: prior count + 6 (e.g. 167/0/0/0 → 173/0/0/0). Adjust expected baseline from running suite; what matters is 0 failures.

- [ ] **Step 7: Commit**

```bash
git add \
    backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookPayload.java \
    backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java \
    backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkWebhookController.java \
    backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkWebhookControllerIT.java
git commit -m "$(cat <<'EOF'
feat(webhooks): PostmarkWebhookController + Basic-auth verifier + IT

[milestone:4][task:4-7]

POST /api/webhooks/postmark receives Postmark delivery callbacks. Raw String
body bound first (archival), deserialized to PostmarkWebhookPayload via
ObjectMapper. Constant-time Basic-auth via MessageDigest.isEqual on decoded
username+password independently.

RecordType mapping: Delivery→DELIVERED, Bounce→FAILED (with error detail),
SpamComplaint→FAILED (error_code=SPAM_COMPLAINT), all others→null (DROPPED).

WebhookEventMapper.fromPostmark encapsulates mapping; fromSmsApi stub
placeholder added for task 4-8. IT: 6 cases cover APPLIED, FAILED,
bad-auth 401, DROPPED, NO_MESSAGE, malformed-JSON 400.

Refs: docs/dispatch-log/4-7-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-8: SmsApiWebhookController + IP allowlist + IT

**Review:** combined single-stage.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/webhooks/SmsApiWebhookController.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java` (add `fromSmsApi`)
- Create: `backend/app/src/test/java/com/drshoes/app/webhooks/SmsApiWebhookControllerIT.java`

---

- [ ] **Step 1: Write the failing integration test**

`backend/app/src/test/java/com/drshoes/app/webhooks/SmsApiWebhookControllerIT.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.Channel;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.Message;
import com.drshoes.app.messaging.domain.MessageRepository;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.sms.smsapi.callback-allowlist=127.0.0.1",
    "messaging.sms.smsapi.client-ip-header=X-Test-Client-IP"
})
class SmsApiWebhookControllerIT extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MessageRepository messages;
    @Autowired WebhookEventRepository webhookEvents;
    @Autowired ClientRepository clients;
    @Autowired OrderRepository orders;

    private UUID orderId;
    private String providerMsgId;

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFullName("SMS Klient");
        client.setPhone("+48600200300");
        var savedClient = clients.save(client);

        var order = new Order();
        order.setClientId(savedClient.getId());
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        order.setOrderType(OrderType.NAPRAWA);
        var savedOrder = orders.save(order);
        orderId = savedOrder.getId();

        providerMsgId = "smsapi-msg-" + UUID.randomUUID();
        var msg = new Message();
        msg.setOrderId(orderId);
        msg.setChannel(Channel.SMS);
        msg.setDeliveryStatus(DeliveryStatus.SENT);
        msg.setProviderMessageId(providerMsgId);
        msg.setRecipient("+48600200300");
        msg.setBody("Test SMS treść");
        messages.save(msg);
    }

    @Test
    void delivered_validIp_returns200OK_appliedOutcomeDelivered() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "127.0.0.1")
                .param("MsgId", providerMsgId)
                .param("status", "404")
                .param("status_name", "DELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(content().string("OK"));

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("APPLIED");
        assertThat(events.get(0).getAppliedStatus().name()).isEqualTo("DELIVERED");

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMsgId, Channel.SMS);
        assertThat(updatedMsg).isPresent();
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.DELIVERED);

        // timeline includes MESSAGE_DELIVERED event
        mockMvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$[?(@.kind == 'MESSAGE_DELIVERED')]").exists());
    }

    @Test
    void undelivered_validIp_returns200OK_appliedOutcomeFailed() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "127.0.0.1")
                .param("MsgId", providerMsgId)
                .param("status", "8")
                .param("status_name", "UNDELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(content().string("OK"));

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("APPLIED");
        assertThat(events.get(0).getAppliedStatus().name()).isEqualTo("FAILED");
        assertThat(events.get(0).getErrorCode()).isEqualTo("UNDELIVERED");

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMsgId, Channel.SMS);
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.FAILED);
    }

    // Cases follow same pattern:
    // - Client IP not in allowlist → 403 "Forbidden", zero webhook_event rows, message unchanged.
    // - status_name=ACCEPTD (in-flight) → 200 "OK", DROPPED outcome, message unchanged.

    @Test
    void forbiddenIp_returns403_noDbWrites() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "1.2.3.4")   // not in allowlist
                .param("MsgId", providerMsgId)
                .param("status", "404")
                .param("status_name", "DELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden())
            .andExpect(content().string("Forbidden"));

        assertThat(webhookEvents.findAll()).isEmpty();
        var msg = messages.findByProviderMessageIdAndChannel(providerMsgId, Channel.SMS);
        assertThat(msg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void inFlightStatus_acceptd_returns200OK_droppedOutcome() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "127.0.0.1")
                .param("MsgId", providerMsgId)
                .param("status", "1")
                .param("status_name", "ACCEPTD")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(content().string("OK"));

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome().name()).isEqualTo("DROPPED");

        var msg = messages.findByProviderMessageIdAndChannel(providerMsgId, Channel.SMS);
        assertThat(msg.get().getDeliveryStatus()).isEqualTo(DeliveryStatus.SENT);
    }
}
```

- [ ] **Step 2: Run test — fails (SmsApiWebhookController doesn't exist)**

```bash
cd backend && mvn -pl app test -Dtest=SmsApiWebhookControllerIT
```
Expected: compile error on `SmsApiWebhookController`. Proceed to implement.

- [ ] **Step 3: Add `fromSmsApi` to `WebhookEventMapper`**

Open `backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java` and add after `fromPostmark`:

```java
    /**
     * Maps SMSAPI GET callback query params to {@link WebhookEvent}.
     *
     * status_name (preferred) mapping per spec §3.6.2:
     *   DELIVERED                              → DELIVERED
     *   UNDELIVERED, EXPIRED, FAILED,
     *   REJECTD, UNKNOWN                       → FAILED  (error_code = status_name)
     *   QUEUE, ACCEPTD, SENT                   → null    (DROPPED — still in-flight)
     *
     * Numeric status fallback (when status_name absent):
     *   404 → DELIVERED.
     *   All others → TODO: pin exact numeric mapping from current SMSAPI docs
     *                at execution time per spec §10 errata #5.
     *
     * @param msgId       MsgId query parameter (provider_message_id)
     * @param statusName  status_name query param (may be null)
     * @param statusCode  numeric status query param (used only if statusName is null)
     * @param occurredAt  parsed donedate (UNIX seconds → Instant)
     * @param rawQueryJson JSON encoding of the full query param map for archival
     * @return normalized event; status() is null for in-flight statuses
     */
    public WebhookEvent fromSmsApi(String msgId, String statusName, Integer statusCode,
                                   java.time.Instant occurredAt, String rawQueryJson) {
        DeliveryStatus status;
        String errorCode    = null;
        String errorMessage = null;

        if (statusName != null && !statusName.isBlank()) {
            status = mapSmsApiStatusName(statusName);
            if (status == DeliveryStatus.FAILED) {
                errorCode = statusName;
            }
        } else {
            status = mapSmsApiNumericStatus(statusCode);
            if (status == DeliveryStatus.FAILED) {
                errorCode = statusCode != null ? String.valueOf(statusCode) : "UNKNOWN";
            }
        }

        return new WebhookEvent(
            Provider.SMSAPI,
            msgId,
            null,           // SMSAPI has no per-event id; dedupe via state-guarded UPDATE
            status,
            occurredAt,
            rawQueryJson,
            errorCode,
            errorMessage
        );
    }

    private DeliveryStatus mapSmsApiStatusName(String name) {
        return switch (name.toUpperCase()) {
            case "DELIVERED"                           -> DeliveryStatus.DELIVERED;
            case "UNDELIVERED", "EXPIRED", "FAILED",
                 "REJECTD",     "UNKNOWN"              -> DeliveryStatus.FAILED;
            case "QUEUE", "ACCEPTD", "SENT"            -> null;  // DROPPED
            default                                    -> null;  // unknown; treat as DROPPED
        };
    }

    private DeliveryStatus mapSmsApiNumericStatus(Integer code) {
        if (code == null) return null;
        // 404 = DELIVERED per SMSAPI legacy API.
        // TODO: pin remaining numeric codes from current SMSAPI docs (spec §10 errata #5).
        return switch (code) {
            case 404 -> DeliveryStatus.DELIVERED;
            default  -> null;  // conservative: treat unknowns as DROPPED until spec pins them
        };
    }
```

Close the class brace properly after this addition. The class grows to ~100 LOC — within the 120-LOC cap.

- [ ] **Step 4: Author `SmsApiWebhookController`**

`backend/app/src/main/java/com/drshoes/app/webhooks/SmsApiWebhookController.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Receives SMSAPI delivery callbacks.
 *
 * Authentication: source IP allowlist. SMSAPI does NOT sign callbacks;
 * identity is by IP only. IP read from {@code messaging.sms.smsapi.client-ip-header}
 * (default X-Forwarded-For; production should be Cf-Connecting-Ip). Fallback
 * to {@code request.getRemoteAddr()} when header is absent.
 *
 * Method: GET (per SMSAPI spec §3.6.1 — see M4 spec errata).
 * Response: 200 with body "OK" (text/plain, case-sensitive — SMSAPI retries otherwise).
 * Rejection: 403 with body "Forbidden", zero DB writes.
 *
 * Endpoint: GET /api/webhooks/smsapi
 * This path is CSRF-exempt (GET method is not CSRF-protected by default in Spring Security;
 * additionally declared exempt in SecurityConfig M4 wave-1 task).
 */
@RestController
public class SmsApiWebhookController {

    private static final Logger log = LoggerFactory.getLogger(SmsApiWebhookController.class);

    private final WebhookStatusReconciler reconciler;
    private final WebhookEventMapper mapper;
    private final ObjectMapper objectMapper;
    private final Set<String> allowlist;
    private final String clientIpHeader;

    public SmsApiWebhookController(
            WebhookStatusReconciler reconciler,
            WebhookEventMapper mapper,
            ObjectMapper objectMapper,
            @Value("${messaging.sms.smsapi.callback-allowlist:}") String allowlistCsv,
            @Value("${messaging.sms.smsapi.client-ip-header:X-Forwarded-For}") String clientIpHeader) {
        this.reconciler     = reconciler;
        this.mapper         = mapper;
        this.objectMapper   = objectMapper;
        this.clientIpHeader = clientIpHeader;
        // Parse comma-separated allowlist at startup; trim whitespace around entries.
        this.allowlist = allowlistCsv.isBlank()
            ? Set.of()
            : Set.of(allowlistCsv.split("\\s*,\\s*"));
    }

    @GetMapping(value = "/api/webhooks/smsapi", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receive(
            @RequestParam("MsgId")                       String msgId,
            @RequestParam("status")                      Integer statusCode,
            @RequestParam("donedate")                    Long doneDateUnixSeconds,
            @RequestParam(value = "status_name", required = false) String statusName,
            @RequestParam(value = "idx",         required = false) String idx,
            HttpServletRequest request) {

        // ── 1. IP allowlist check ────────────────────────────────────────────
        String clientIp = resolveClientIp(request);
        if (!allowlist.contains(clientIp)) {
            log.info("op=webhook.receive provider=smsapi clientIp={} outcome=forbidden", clientIp);
            return ResponseEntity.status(403)
                .contentType(MediaType.TEXT_PLAIN)
                .body("Forbidden");
        }

        log.info("op=webhook.receive provider=smsapi clientIp={} msgId={} statusName={} statusCode={}",
            clientIp, msgId, statusName, statusCode);

        // ── 2. Build raw query-params JSON for archival ──────────────────────
        String rawQueryJson = buildRawQueryJson(msgId, statusCode, doneDateUnixSeconds,
                                                statusName, idx);

        // ── 3. Map + reconcile ───────────────────────────────────────────────
        Instant occurredAt = Instant.ofEpochSecond(doneDateUnixSeconds);
        var event = mapper.fromSmsApi(msgId, statusName, statusCode, occurredAt, rawQueryJson);
        reconciler.apply(event);

        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_PLAIN)
            .body("OK");
    }

    // ── private ──────────────────────────────────────────────────────────────

    private String resolveClientIp(HttpServletRequest request) {
        String fromHeader = request.getHeader(clientIpHeader);
        if (fromHeader != null && !fromHeader.isBlank()) {
            // X-Forwarded-For may be a comma-separated list; take the first (leftmost = client)
            return fromHeader.split("\\s*,\\s*")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String buildRawQueryJson(String msgId, Integer statusCode, Long donedate,
                                     String statusName, String idx) {
        try {
            var params = new java.util.LinkedHashMap<String, Object>();
            params.put("MsgId",       msgId);
            params.put("status",      statusCode);
            params.put("donedate",    donedate);
            if (statusName != null) params.put("status_name", statusName);
            if (idx        != null) params.put("idx",         idx);
            return objectMapper.writeValueAsString(params);
        } catch (Exception e) {
            log.warn("op=webhook.receive provider=smsapi outcome=rawJsonSerializeFailed error={}", e.getMessage());
            return "{}";
        }
    }
}
```

- [ ] **Step 5: Run test — should pass**

```bash
cd backend && mvn -pl app test -Dtest=SmsApiWebhookControllerIT
```
Expected: 4 tests, all green.

Full suite:
```bash
cd backend && mvn verify
```
Expected: prior count + 4 new tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add \
    backend/app/src/main/java/com/drshoes/app/webhooks/SmsApiWebhookController.java \
    backend/app/src/main/java/com/drshoes/app/webhooks/WebhookEventMapper.java \
    backend/app/src/test/java/com/drshoes/app/webhooks/SmsApiWebhookControllerIT.java
git commit -m "$(cat <<'EOF'
feat(webhooks): SmsApiWebhookController + IP allowlist + fromSmsApi mapping

[milestone:4][task:4-8]

GET /api/webhooks/smsapi receives SMSAPI delivery callbacks. IP allowlist
parsed at startup from messaging.sms.smsapi.callback-allowlist (CSV).
Client IP resolved via configurable header (default X-Forwarded-For, with
X-Forwarded-For first-token trimming). Rejected IPs → 403 "Forbidden",
zero DB writes.

status_name mapping: DELIVERED→DELIVERED; UNDELIVERED/EXPIRED/FAILED/
REJECTD/UNKNOWN→FAILED (error_code=status_name); QUEUE/ACCEPTD/SENT→null
(DROPPED). Numeric fallback: 404→DELIVERED; others conservative (DROPPED)
pending spec §10 errata #5.

WebhookEventMapper.fromSmsApi added. IT: 4 cases — APPLIED+DELIVERED,
APPLIED+FAILED, 403 forbidden-IP, DROPPED in-flight.

Refs: docs/dispatch-log/4-8-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-9: WebhookStatusReconciler (TWO-STAGE REVIEW)

**Review:** TWO-STAGE — spec review on reconcile logic + state-guard UPDATE first; quality review after.

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/AppliedOutcome.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/ReconcileResult.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/WebhookStatusReconciler.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/timeline/MessageReconcileTimelineHandler.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEventKind.java` (add MESSAGE_DELIVERED, MESSAGE_FAILED)
- Modify: `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java` (add reconciler path-pattern dispatch + handler wiring)
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageRepository.java` (add `findByProviderMessageIdAndChannel` + `reconcileDeliveryStatus` @Modifying query)
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/WebhookStatusReconcilerTest.java`

---

- [ ] **Step 1: Write the failing tests**

`backend/app/src/test/java/com/drshoes/app/messaging/service/WebhookStatusReconcilerTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.domain.AuditEventRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.Channel;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.Message;
import com.drshoes.app.messaging.domain.MessageRepository;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WebhookStatusReconcilerTest extends AbstractIntegrationTest {

    @Autowired WebhookStatusReconciler reconciler;
    @Autowired MessageRepository messages;
    @Autowired WebhookEventRepository webhookEvents;
    @Autowired AuditEventRepository auditEvents;
    @Autowired ClientRepository clients;
    @Autowired OrderRepository orders;
    @Autowired MockMvc mockMvc;

    private UUID orderId;

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFullName("Reconciler Klient");
        client.setPhone("+48600300400");
        var savedClient = clients.save(client);

        var order = new Order();
        order.setClientId(savedClient.getId());
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        order.setOrderType(OrderType.NAPRAWA);
        orderId = orders.save(order).getId();
    }

    // ── Test 1: APPLIED outcome — SENT → DELIVERED ───────────────────────────

    @Test
    void apply_sentMessage_deliveryEvent_returns_APPLIED_updatesStatus_writesAudit_emitsTimelineKind() throws Exception {
        String providerMsgId = "pm-" + UUID.randomUUID();
        var msg = sentMessage(providerMsgId, Channel.EMAIL);

        var event = new WebhookEvent(
            Provider.POSTMARK, providerMsgId, null,
            com.drshoes.lib.messaging.DeliveryStatus.DELIVERED,
            Instant.now(), "{}", null, null
        );

        ReconcileResult result = reconciler.apply(event);

        // Outcome
        assertThat(result.outcome()).isEqualTo(AppliedOutcome.APPLIED);
        assertThat(result.appliedStatus())
            .isEqualTo(com.drshoes.lib.messaging.DeliveryStatus.DELIVERED);
        assertThat(result.messageId()).isEqualTo(msg.getId());

        // webhook_event row
        List<WebhookEventEntity> wes = webhookEvents.findAll();
        assertThat(wes).hasSize(1);
        assertThat(wes.get(0).getAppliedOutcome()).isEqualTo(AppliedOutcome.APPLIED);
        assertThat(wes.get(0).getAppliedAt()).isNotNull();

        // message row updated to DELIVERED
        var updated = messages.findById(msg.getId()).orElseThrow();
        assertThat(updated.getDeliveryStatus())
            .isEqualTo(com.drshoes.app.messaging.domain.DeliveryStatus.DELIVERED);

        // audit_log row written with path containing WebhookStatusReconciler#apply
        var reconcilerAudits = auditEvents.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().contains("WebhookStatusReconciler#apply"))
            .toList();
        assertThat(reconcilerAudits).isNotEmpty();

        // timeline event kind = MESSAGE_DELIVERED
        mockMvc.perform(get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.kind == 'MESSAGE_DELIVERED')]").exists());
    }

    // ── Test 2: DEDUP outcome ────────────────────────────────────────────────

    @Test
    void apply_duplicateProviderEventId_returns_DEDUP_noAdditionalDbWrites() {
        String providerMsgId   = "pm-" + UUID.randomUUID();
        String providerEventId = "evt-" + UUID.randomUUID();
        sentMessage(providerMsgId, Channel.EMAIL);

        var event = new WebhookEvent(
            Provider.POSTMARK, providerMsgId, providerEventId,
            com.drshoes.lib.messaging.DeliveryStatus.DELIVERED,
            Instant.now(), "{}", null, null
        );

        // First application — succeeds
        ReconcileResult first = reconciler.apply(event);
        assertThat(first.outcome()).isEqualTo(AppliedOutcome.APPLIED);

        // Second application with same providerEventId — DEDUP
        ReconcileResult second = reconciler.apply(event);
        assertThat(second.outcome()).isEqualTo(AppliedOutcome.DEDUP);

        // Only 1 webhook_event row (the first insert succeeded; second was rejected by UNIQUE)
        assertThat(webhookEvents.findAll()).hasSize(1);
    }

    // Cases follow same pattern:
    // - NO_MESSAGE: providerMessageId not in message table → APPLIED outcome with NO_MESSAGE,
    //   webhook_event row applied_outcome=NO_MESSAGE, message table unchanged.
    // - NO_TRANSITION: message already at DELIVERED → state-guarded UPDATE returns 0 rows →
    //   webhook_event applied_outcome=NO_TRANSITION, message status unchanged.
    // - DROPPED: event.status() == null (e.g. Postmark Click) → webhook_event
    //   applied_outcome=DROPPED, no message lookup, no audit row emitted by curator.

    @Test
    void apply_unknownProviderMessageId_returns_NO_MESSAGE() {
        var event = new WebhookEvent(
            Provider.POSTMARK, "unknown-provider-msg-id", null,
            com.drshoes.lib.messaging.DeliveryStatus.DELIVERED,
            Instant.now(), "{}", null, null
        );

        ReconcileResult result = reconciler.apply(event);

        assertThat(result.outcome()).isEqualTo(AppliedOutcome.NO_MESSAGE);
        assertThat(result.messageId()).isNull();

        List<WebhookEventEntity> wes = webhookEvents.findAll();
        assertThat(wes).hasSize(1);
        assertThat(wes.get(0).getAppliedOutcome()).isEqualTo(AppliedOutcome.NO_MESSAGE);
    }

    @Test
    void apply_messageAlreadyDelivered_returns_NO_TRANSITION() {
        String providerMsgId = "pm-" + UUID.randomUUID();
        var msg = sentMessage(providerMsgId, Channel.EMAIL);
        // Advance message to DELIVERED directly (simulates prior reconcile)
        messages.reconcileDeliveryStatus(msg.getId(),
            com.drshoes.app.messaging.domain.DeliveryStatus.DELIVERED,
            null, null, Instant.now());

        var event = new WebhookEvent(
            Provider.POSTMARK, providerMsgId, null,
            com.drshoes.lib.messaging.DeliveryStatus.DELIVERED,
            Instant.now(), "{}", null, null
        );

        ReconcileResult result = reconciler.apply(event);

        assertThat(result.outcome()).isEqualTo(AppliedOutcome.NO_TRANSITION);
        List<WebhookEventEntity> wes = webhookEvents.findAll();
        assertThat(wes).hasSize(1);
        assertThat(wes.get(0).getAppliedOutcome()).isEqualTo(AppliedOutcome.NO_TRANSITION);
    }

    @Test
    void apply_nullStatus_click_returns_DROPPED_noMessageLookup() {
        // status=null simulates Postmark Click / non-delivery RecordType
        var event = new WebhookEvent(
            Provider.POSTMARK, "pm-click-" + UUID.randomUUID(), null,
            null,   // null DeliveryStatus → DROPPED path
            Instant.now(), "{\"RecordType\":\"Click\"}", null, null
        );

        ReconcileResult result = reconciler.apply(event);

        assertThat(result.outcome()).isEqualTo(AppliedOutcome.DROPPED);
        List<WebhookEventEntity> wes = webhookEvents.findAll();
        assertThat(wes).hasSize(1);
        assertThat(wes.get(0).getAppliedOutcome()).isEqualTo(AppliedOutcome.DROPPED);
        // No audit row from curator (DROPPED branch never reaches @Audited method)
        var reconcilerAudits = auditEvents.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().contains("WebhookStatusReconciler#apply"))
            .toList();
        assertThat(reconcilerAudits).isEmpty();
    }

    // ── helper ───────────────────────────────────────────────────────────────

    private Message sentMessage(String providerMsgId, Channel channel) {
        var msg = new Message();
        msg.setOrderId(orderId);
        msg.setChannel(channel);
        msg.setDeliveryStatus(com.drshoes.app.messaging.domain.DeliveryStatus.SENT);
        msg.setProviderMessageId(providerMsgId);
        msg.setRecipient(channel == Channel.EMAIL ? "klient@example.com" : "+48600300400");
        if (channel == Channel.EMAIL) { msg.setSubject("Test"); }
        msg.setBody("Treść");
        return messages.save(msg);
    }
}
```

- [ ] **Step 2: Run test — fails (WebhookStatusReconciler doesn't exist)**

```bash
cd backend && mvn -pl app test -Dtest=WebhookStatusReconcilerTest
```
Expected: compile errors on `WebhookStatusReconciler`, `AppliedOutcome`, `ReconcileResult`. Proceed.

- [ ] **Step 3: Author `AppliedOutcome` enum**

`backend/app/src/main/java/com/drshoes/app/messaging/service/AppliedOutcome.java`:

```java
package com.drshoes.app.messaging.service;

/**
 * Outcome of a single {@link WebhookStatusReconciler#apply} invocation.
 *
 * APPLIED      — state-guarded UPDATE succeeded; message.delivery_status changed.
 * DEDUP        — UNIQUE(provider, provider_event_id) conflict; already processed.
 * NO_MESSAGE   — no message row found for this providerMessageId+channel; cannot reconcile.
 * NO_TRANSITION — message found but state guard prevented the UPDATE (wrong current status).
 * DROPPED      — event status was null (non-delivery record type); no reconciliation needed.
 * PROCESSING   — transient state during the reconcile transaction; never returned to caller.
 */
public enum AppliedOutcome {
    APPLIED,
    DEDUP,
    NO_MESSAGE,
    NO_TRANSITION,
    DROPPED,
    PROCESSING   // internal: webhook_event row saved as PROCESSING until final outcome determined
}
```

- [ ] **Step 4: Author `ReconcileResult` record**

`backend/app/src/main/java/com/drshoes/app/messaging/service/ReconcileResult.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.lib.messaging.DeliveryStatus;
import org.springframework.lang.Nullable;

import java.util.UUID;

/**
 * Return value of {@link WebhookStatusReconciler#apply}.
 *
 * @param messageId     the reconciled message UUID, or null for DROPPED/DEDUP/NO_MESSAGE.
 * @param outcome       the reconciliation outcome.
 * @param appliedStatus the delivery status written to the message, or null when not APPLIED.
 */
public record ReconcileResult(
    @Nullable UUID messageId,
    AppliedOutcome outcome,
    @Nullable DeliveryStatus appliedStatus
) {}
```

- [ ] **Step 5: Extend `MessageRepository` with reconcile methods**

Open `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageRepository.java` and add:

```java
    import org.springframework.data.jpa.repository.Modifying;
    import org.springframework.data.jpa.repository.Query;
    import org.springframework.data.repository.query.Param;
    import java.time.Instant;
    import java.util.Optional;

    /**
     * Finds the most recently created message with the given providerMessageId and channel.
     * Returns Optional.empty() when no match exists.
     */
    Optional<Message> findByProviderMessageIdAndChannel(String providerMessageId, Channel channel);

    /**
     * State-guarded delivery status UPDATE.
     * Only transitions messages currently in SENT or QUEUED state.
     * Returns 1 if the row was updated, 0 if the state guard prevented the UPDATE.
     *
     * @param messageId     the message to update
     * @param newStatus     DELIVERED or FAILED
     * @param errorCode     nullable error code (for FAILED outcomes)
     * @param errorMessage  nullable error message (for FAILED outcomes)
     * @param deliveredAt   timestamp to write to delivered_at (nullable for FAILED)
     */
    @Modifying
    @Query("""
        UPDATE Message m
           SET m.deliveryStatus = :newStatus,
               m.errorCode      = :errorCode,
               m.errorMessage   = :errorMessage,
               m.deliveredAt    = :deliveredAt,
               m.updatedAt      = CURRENT_TIMESTAMP
         WHERE m.id = :messageId
           AND m.deliveryStatus IN ('SENT', 'QUEUED')
        """)
    int reconcileDeliveryStatus(
        @Param("messageId")    UUID messageId,
        @Param("newStatus")    DeliveryStatus newStatus,
        @Param("errorCode")    @Nullable String errorCode,
        @Param("errorMessage") @Nullable String errorMessage,
        @Param("deliveredAt")  @Nullable Instant deliveredAt
    );
```

Ensure the `Message` entity has `deliveredAt`, `errorCode`, `errorMessage` columns (these should exist from M4 wave-1 V010 migration via Part A1 tasks; confirm in errata if missing and add `@Column` fields to the entity).

- [ ] **Step 6: Author `WebhookStatusReconciler`**

`backend/app/src/main/java/com/drshoes/app/messaging/service/WebhookStatusReconciler.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.messaging.domain.Channel;
import com.drshoes.app.messaging.domain.MessageRepository;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Core domain logic for delivery webhook reconciliation.
 *
 * Implements the 5-step reconcile flow from spec §3.3 step 5:
 *   1. INSERT webhook_event (PROCESSING). ON CONFLICT on provider_event_id UNIQUE → DEDUP.
 *   2. If event.status() == null → DROPPED (non-delivery record type).
 *   3. Channel from provider (POSTMARK→EMAIL, SMSAPI→SMS). Find message.
 *   4. Missing message → NO_MESSAGE.
 *   5. State-guarded UPDATE. Zero rows → NO_TRANSITION. One row → APPLIED.
 *
 * The @Audited annotation writes an audit_log row for every APPLIED invocation.
 * The parent SpEL binds to result.messageId() so the timeline curator can
 * associate the audit row with the parent order via message→order FK lookup.
 * For non-APPLIED outcomes the audit row is still written (aspect fires regardless)
 * but the curator emits no timeline event (it checks appliedOutcome label).
 */
@Service
public class WebhookStatusReconciler {

    private static final Logger log = LoggerFactory.getLogger(WebhookStatusReconciler.class);

    private final WebhookEventRepository webhookEventRepo;
    private final MessageRepository messageRepo;

    public WebhookStatusReconciler(WebhookEventRepository webhookEventRepo,
                                   MessageRepository messageRepo) {
        this.webhookEventRepo = webhookEventRepo;
        this.messageRepo      = messageRepo;
    }

    /**
     * Reconciles a single normalized webhook event.
     *
     * The @Audited aspect writes an audit_log row after this method returns.
     * SpEL "#result.messageId" is evaluated against the ReconcileResult; when
     * messageId is null (DROPPED/DEDUP/NO_MESSAGE) the audit row's parent_entity_id
     * is also null — the curator skips those rows.
     *
     * @param event normalized webhook event from PostmarkWebhookController or SmsApiWebhookController
     * @return reconciliation result (never null)
     */
    @Audited(parent = "#result.messageId")
    @Transactional
    public ReconcileResult apply(WebhookEvent event) {

        // ── Step 1: INSERT webhook_event at PROCESSING ────────────────────────
        WebhookEventEntity entity = buildEntity(event);
        try {
            entity = webhookEventRepo.save(entity);
        } catch (DataIntegrityViolationException dedupEx) {
            // UNIQUE(provider, provider_event_id) conflict — already processed
            log.info("op=webhook.reconcile providerMessageId={} appliedOutcome=DEDUP",
                event.providerMessageId());
            return new ReconcileResult(null, AppliedOutcome.DEDUP, null);
        }

        // ── Step 2: DROPPED check (null status = non-delivery event type) ─────
        if (event.status() == null) {
            finaliseEntity(entity, AppliedOutcome.DROPPED, null, null, null);
            log.info("op=webhook.reconcile providerMessageId={} appliedOutcome=DROPPED",
                event.providerMessageId());
            return new ReconcileResult(null, AppliedOutcome.DROPPED, null);
        }

        // ── Step 3: Resolve channel + find message ────────────────────────────
        Channel channel = channelFor(event.provider());
        var msgOpt = messageRepo.findByProviderMessageIdAndChannel(
            event.providerMessageId(), channel);

        if (msgOpt.isEmpty()) {
            finaliseEntity(entity, AppliedOutcome.NO_MESSAGE, null, null, null);
            log.info("op=webhook.reconcile providerMessageId={} appliedOutcome=NO_MESSAGE provider={}",
                event.providerMessageId(), event.provider());
            return new ReconcileResult(null, AppliedOutcome.NO_MESSAGE, null);
        }

        var msg = msgOpt.get();

        // ── Step 4: State-guarded UPDATE ──────────────────────────────────────
        Instant deliveredAt = event.status() == DeliveryStatus.DELIVERED ? event.occurredAt() : null;
        int updated = messageRepo.reconcileDeliveryStatus(
            msg.getId(),
            toDomainStatus(event.status()),
            event.errorCode(),
            event.errorMessage(),
            deliveredAt
        );

        if (updated == 0) {
            finaliseEntity(entity, AppliedOutcome.NO_TRANSITION, null, null, msg.getId());
            log.info("op=webhook.reconcile providerMessageId={} messageId={} appliedOutcome=NO_TRANSITION",
                event.providerMessageId(), msg.getId());
            return new ReconcileResult(msg.getId(), AppliedOutcome.NO_TRANSITION, null);
        }

        // ── Step 5: APPLIED ───────────────────────────────────────────────────
        DeliveryStatus libStatus = event.status();
        finaliseEntity(entity, AppliedOutcome.APPLIED, libStatus, msg.getId(), msg.getId());

        log.info("op=webhook.reconcile providerMessageId={} messageId={} appliedOutcome=APPLIED appliedStatus={}",
            event.providerMessageId(), msg.getId(), libStatus);

        return new ReconcileResult(msg.getId(), AppliedOutcome.APPLIED, libStatus);
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private WebhookEventEntity buildEntity(WebhookEvent event) {
        var e = new WebhookEventEntity();
        e.setProvider(event.provider());
        e.setProviderEventId(event.providerEventId());
        e.setProviderMessageId(event.providerMessageId());
        e.setEventType(event.status() != null ? event.status().name() : "UNKNOWN");
        e.setAppliedOutcome(AppliedOutcome.PROCESSING);
        e.setRawPayload(event.rawPayload());
        e.setReceivedAt(Instant.now());
        return e;
    }

    private void finaliseEntity(WebhookEventEntity entity, AppliedOutcome outcome,
                                 DeliveryStatus appliedStatus, java.util.UUID messageId,
                                 java.util.UUID linkedMessageId) {
        entity.setAppliedOutcome(outcome);
        entity.setAppliedAt(Instant.now());
        if (appliedStatus != null) {
            entity.setAppliedStatus(appliedStatus);
        }
        if (messageId != null) {
            entity.setMessageId(messageId);
        }
        webhookEventRepo.save(entity);
    }

    private Channel channelFor(Provider provider) {
        return switch (provider) {
            case POSTMARK -> Channel.EMAIL;
            case SMSAPI   -> Channel.SMS;
        };
    }

    private com.drshoes.app.messaging.domain.DeliveryStatus toDomainStatus(
            DeliveryStatus libStatus) {
        return switch (libStatus) {
            case DELIVERED -> com.drshoes.app.messaging.domain.DeliveryStatus.DELIVERED;
            case FAILED    -> com.drshoes.app.messaging.domain.DeliveryStatus.FAILED;
            default        -> throw new IllegalArgumentException("Unexpected lib status: " + libStatus);
        };
    }
}
```

LOC: ~120. At the cap. If subagent finds the helpers push it over, extract `WebhookEntityBuilder` private static class or inline the finalise calls.

- [ ] **Step 7: Add MESSAGE_DELIVERED and MESSAGE_FAILED to `TimelineEventKind`**

Open `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEventKind.java` and append after `PHOTO_RELABELED`:

```java
    MESSAGE_DELIVERED,  // M4 — emitted by WebhookStatusReconciler#apply when SENT→DELIVERED
    MESSAGE_FAILED      // M4 — emitted by WebhookStatusReconciler#apply when SENT→FAILED
```

Updated file (full):

```java
package com.drshoes.app.audit.dto;

/**
 * Kinds of curated timeline events surfaced to the admin UI.
 * ...
 */
public enum TimelineEventKind {
    ORDER_CREATED,
    ORDER_UPDATED,
    STATUS_CHANGED,
    ASSIGNEE_CHANGED,
    PICKUP_DATE_CHANGED,
    ITEM_ADDED,
    ITEM_EDITED,
    ITEM_REMOVED,
    ORDER_SOFT_DELETED,
    MESSAGE_SENT,         // M2 — emitted by MessageSentTimelineHandler
    PHOTO_UPLOADED,       // M3
    PHOTO_DELETED,        // M3
    PHOTO_RELABELED,      // M3
    MESSAGE_DELIVERED,    // M4 — emitted by WebhookStatusReconciler#apply for SENT→DELIVERED
    MESSAGE_FAILED        // M4 — emitted by WebhookStatusReconciler#apply for SENT→FAILED
}
```

- [ ] **Step 8: Author `MessageReconcileTimelineHandler`**

Architecture choice: mirror the existing `MessageSentTimelineHandler` (per-handler class delegated from `TimelineEventCurator.curateInternal`). The curator holds a reference to the handler and calls `handler.toEvent(log, actorFullName)` in the internal dispatch chain. This keeps the curator clean and the handler independently testable.

`backend/app/src/main/java/com/drshoes/app/messaging/timeline/MessageReconcileTimelineHandler.java`:

```java
package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.service.AppliedOutcome;
import com.drshoes.lib.messaging.DeliveryStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Translates {@code WebhookStatusReconciler#apply} audit rows into
 * {@link TimelineEvent}s for the admin timeline.
 *
 * <p>Only emits events when {@code appliedOutcome == APPLIED}.
 * Other outcomes (DEDUP, NO_MESSAGE, NO_TRANSITION, DROPPED) produce
 * audit rows but no timeline events — they are forensic records only.
 *
 * <p>The audit row's {@code labels} JSONB (written by the @Audited aspect)
 * carries {@code appliedOutcome} and {@code appliedStatus} string values.
 * This handler reads them to select MESSAGE_DELIVERED vs MESSAGE_FAILED.
 *
 * <p>Path-pattern matched by {@link com.drshoes.app.audit.TimelineEventCurator}:
 * audit rows whose {@code path} contains {@code "WebhookStatusReconciler#apply"}.
 */
@Component
public class MessageReconcileTimelineHandler {

    /**
     * Returns a {@link TimelineEvent} if this audit row should produce a timeline
     * entry, or {@code null} if it should be skipped.
     *
     * @param log           the INTERNAL audit log row from @Audited on WebhookStatusReconciler#apply
     * @param actorFullName resolved display name of the actor (may be "system" for webhook callbacks)
     */
    public TimelineEvent toEvent(AuditLog log, String actorFullName) {
        if (log.getPath() == null || !log.getPath().contains("WebhookStatusReconciler#apply")) {
            return null;
        }

        // Read labels JSONB: appliedOutcome and appliedStatus are written by the @Audited aspect.
        // The aspect serializes the ReconcileResult fields into labels via result inspection.
        String appliedOutcome = labelOrNull(log, "appliedOutcome");
        String appliedStatus  = labelOrNull(log, "appliedStatus");

        // Only emit for APPLIED outcomes
        if (!"APPLIED".equals(appliedOutcome)) {
            return null;
        }

        TimelineEventKind kind;
        if (DeliveryStatus.DELIVERED.name().equals(appliedStatus)) {
            kind = TimelineEventKind.MESSAGE_DELIVERED;
        } else if (DeliveryStatus.FAILED.name().equals(appliedStatus)) {
            kind = TimelineEventKind.MESSAGE_FAILED;
        } else {
            // Unexpected appliedStatus — skip rather than emit wrong kind
            return null;
        }

        return new TimelineEvent(
            log.getId(),
            kind,
            log.getCreatedAt(),
            actorFullName,
            Map.of("appliedStatus", appliedStatus != null ? appliedStatus : "")
        );
    }

    // ── private ──────────────────────────────────────────────────────────────

    /**
     * Reads a string value from the audit row's labels JSONB map.
     * The @Audited aspect stores labels as a {@code Map<String,String>} serialized
     * to JSONB. AuditLog exposes them via {@code getLabels()} returning
     * {@code Map<String, String>} (or null when no labels were written).
     */
    private String labelOrNull(AuditLog log, String key) {
        var labels = log.getLabels();
        return labels != null ? labels.get(key) : null;
    }
}
```

**Important:** The `@Audited` aspect must serialize `ReconcileResult` fields into the labels map so `appliedOutcome` and `appliedStatus` appear in `audit_log.labels`. If the existing `@Audited` aspect only captures `parentEntityId` (M2 shape), the subagent must extend it. See note below.

**Aspect extension note (read before executing):** The M3 spec mentioned a "4-arg overload exists" in `AuditedParentResolver` for binding `#result` to labels. Subagent: read `backend/app/src/main/java/com/drshoes/app/audit/` (AuditAspect or equivalent) before authoring to confirm the exact mechanism. If `@Audited` only supports `parent` SpEL (for `parent_entity_id`) and NOT labels capture from the return value, add a `labels` attribute to `@Audited` and serialize `appliedOutcome` + `appliedStatus` from the result in the aspect. Minimal extension: add `String[] labels() default {}` to the annotation and `Map<String, String> resolveLabels(WebhookStatusReconciler, ReconcileResult)` logic in the aspect that reads `result.outcome().name()` and `result.appliedStatus()?.name()`. Document the exact approach in the dispatch log.

- [ ] **Step 9: Wire `MessageReconcileTimelineHandler` into `TimelineEventCurator`**

Open `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java`.

Add a field and constructor param for `MessageReconcileTimelineHandler` (alongside the existing `MessageSentTimelineHandler`):

```java
    private final MessageSentTimelineHandler messagingHandler;
    private final MessageReconcileTimelineHandler reconcileHandler;

    public TimelineEventCurator(MessageSentTimelineHandler messagingHandler,
                                 MessageReconcileTimelineHandler reconcileHandler) {
        this.messagingHandler  = messagingHandler;
        this.reconcileHandler  = reconcileHandler;
    }
```

In `curateInternal`, after the existing `messagingHandler.toEvent(log, actorFullName)` call, add:

```java
    private Optional<TimelineEvent> curateInternal(AuditLog log, String path, String actorFullName) {
        // M2: MESSAGE_SENT dispatch
        TimelineEvent msgEvent = messagingHandler.toEvent(log, actorFullName);
        if (msgEvent != null) {
            return Optional.of(msgEvent);
        }

        // M4: MESSAGE_DELIVERED / MESSAGE_FAILED dispatch
        TimelineEvent reconcileEvent = reconcileHandler.toEvent(log, actorFullName);
        if (reconcileEvent != null) {
            return Optional.of(reconcileEvent);
        }

        // ... existing item + photo dispatch branches follow unchanged ...
```

Also add a skip-pattern for the HTTP webhook paths (so the curator doesn't try to curate the raw HTTP rows for `/api/webhooks/*`):

```java
    // HTTP rows for webhook endpoints — skip; the @Audited INTERNAL row from
    // WebhookStatusReconciler is the canonical source for MESSAGE_DELIVERED / MESSAGE_FAILED.
    private static final Pattern WEBHOOKS_SEGMENT_PATTERN =
        Pattern.compile("/api/webhooks/.*");
```

And in the `curate` method's HTTP-skip block:

```java
        if (WEBHOOKS_SEGMENT_PATTERN.matcher(path).matches()) {
            return Optional.empty();
        }
```

- [ ] **Step 10: Run tests — should pass**

```bash
cd backend && mvn -pl app test -Dtest=WebhookStatusReconcilerTest
```
Expected: 5 tests, all green.

Full suite:
```bash
cd backend && mvn verify
```
Expected: prior count + 5 new tests, 0 failures. Confirm 0/0 on errors/skips.

- [ ] **Step 11: Spec review gate (TWO-STAGE — first stage)**

Before the quality review, the spec reviewer must confirm:

1. State-guarded UPDATE condition `IN ('SENT','QUEUED')` matches spec §3.3 step 5.3.
2. DEDUP try-catch on `DataIntegrityViolationException` correctly handles the partial-UNIQUE index (`WHERE provider_event_id IS NOT NULL`). Events without providerEventId (Postmark, SMSAPI) skip the UNIQUE constraint; their dedupe falls to NO_TRANSITION from the state guard. Spec §3.5 comment confirms this is accepted.
3. `@Audited(parent = "#result.messageId")` — null messageId for DROPPED/DEDUP/NO_MESSAGE means `parent_entity_id` is null in the audit row. Curator skips those (null check). Confirm curator null-guard exists.
4. `PROCESSING` outcome stored briefly during transaction; `finaliseEntity` always overwrites before transaction commit. Confirm no scenario where PROCESSING leaks to the caller.
5. Channel mapping: POSTMARK→EMAIL, SMSAPI→SMS. Confirm these align with `Channel` enum values in `messaging.domain.Channel`.

**Proceed to step 12 only after spec sign-off.**

- [ ] **Step 12: Quality review gate (TWO-STAGE — second stage)**

Reviewer checks:

1. No `equals`/`==` on enums — all switch expressions cover all cases.
2. `finaliseEntity` called on every non-DEDUP branch including the exception path.
3. `@Transactional` on `apply` — both webhook_event save and message UPDATE are in same transaction. Rollback on any unchecked exception reverts both.
4. Structured log fields consistently present: `providerMessageId`, `appliedOutcome`, `appliedStatus`, `messageId`.
5. `MessageReconcileTimelineHandler` — null guard on `log.getLabels()`, null guard on `appliedStatus`.
6. No more than 120 LOC in `WebhookStatusReconciler`.
7. `TimelineEventCurator` constructor still compiles after adding second handler param — Spring auto-wires both.

**Proceed to commit only after quality sign-off.**

- [ ] **Step 13: Commit**

```bash
git add \
    backend/app/src/main/java/com/drshoes/app/messaging/service/AppliedOutcome.java \
    backend/app/src/main/java/com/drshoes/app/messaging/service/ReconcileResult.java \
    backend/app/src/main/java/com/drshoes/app/messaging/service/WebhookStatusReconciler.java \
    backend/app/src/main/java/com/drshoes/app/messaging/timeline/MessageReconcileTimelineHandler.java \
    backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEventKind.java \
    backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java \
    backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageRepository.java \
    backend/app/src/test/java/com/drshoes/app/messaging/service/WebhookStatusReconcilerTest.java
git commit -m "$(cat <<'EOF'
feat(webhooks): WebhookStatusReconciler + MESSAGE_DELIVERED/FAILED timeline kinds

[milestone:4][task:4-9]

5-step reconcile flow (spec §3.3 step 5): INSERT PROCESSING → DROPPED check
→ channel+message lookup → state-guarded UPDATE (IN SENT,QUEUED) → APPLIED.
DEDUP via DataIntegrityViolationException on UNIQUE(provider,provider_event_id).

AppliedOutcome enum (APPLIED/DEDUP/NO_MESSAGE/NO_TRANSITION/DROPPED/PROCESSING),
ReconcileResult record (messageId, outcome, appliedStatus).

@Audited(parent="#result.messageId") + labels capture for appliedOutcome/
appliedStatus feeds MessageReconcileTimelineHandler which emits MESSAGE_DELIVERED
or MESSAGE_FAILED timeline kinds when outcome=APPLIED. Non-APPLIED audit rows
are written but the curator skips timeline emission.

MessageRepository extended: findByProviderMessageIdAndChannel + @Modifying
reconcileDeliveryStatus state-guarded UPDATE. TimelineEventCurator wired with
reconcileHandler; /api/webhooks/* HTTP rows skipped.

Tests: 5 cases — APPLIED+DELIVERED, DEDUP, NO_MESSAGE, NO_TRANSITION, DROPPED.
Suite: two-stage review gate passed before commit.

Refs: docs/dispatch-log/4-9-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Wave 4 — Retry path

### Task 4-10: `MessageRetryService` + unit tests

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRetryService.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRetryServiceTest.java`

**Review:** combined single-stage.

- [ ] **Step 1: Write the failing unit tests**

`backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRetryServiceTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageRetryServiceTest {

    @Mock MessageRepository messageRepository;
    @Mock MessageRouter      messageRouter;
    @Mock OrderRepository    orderRepository;

    @InjectMocks MessageRetryService retryService;

    private final UUID ACTOR_ID  = UUID.randomUUID();
    private final UUID ORDER_ID  = UUID.randomUUID();
    private final UUID CLIENT_ID = UUID.randomUUID();

    private AdminPrincipal actor() {
        return new AdminPrincipal(ACTOR_ID, "actor@drshoes.pl", "OWNER");
    }

    private Order stubOrder() {
        var o = new Order();
        // minimal fields needed for ownership check
        return o;
    }

    private MessageEntity failedMessage(UUID id, UUID orderId, int attempt, String idempotencyKey) {
        var m = MessageEntity.newMessage();
        // Use reflection to set id since there is no public setter
        try {
            var f = MessageEntity.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(m, id);
        } catch (Exception e) { throw new RuntimeException(e); }
        m.setOrderId(orderId);
        m.setClientId(CLIENT_ID);
        m.setDirection("OUTBOUND");
        m.setChannel("EMAIL");
        m.setSubject("Re: Zamówienie");
        m.setBody("Treść wiadomości");
        m.setDeliveryStatus(DeliveryStatus.FAILED.name());
        m.setSentBy(ACTOR_ID);
        m.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        return m;
    }

    // ---- helper: build a delivered (non-FAILED) message ----
    private MessageEntity deliveredMessage(UUID id, UUID orderId) {
        var m = failedMessage(id, orderId, 1, "key-1");
        m.setDeliveryStatus(DeliveryStatus.DELIVERED.name());
        return m;
    }

    @Test
    void retry_happyPath_returnsNewMessageDto() {
        var origId  = UUID.randomUUID();
        var newMsgId = UUID.randomUUID();
        var orig = failedMessage(origId, ORDER_ID, 1, "idem-key");

        when(messageRepository.findById(origId)).thenReturn(Optional.of(orig));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));
        when(messageRouter.sendManual(eq(ORDER_ID), eq(CLIENT_ID), any(), anyString(), eq(ACTOR_ID)))
            .thenReturn(newMsgId);

        var newMsg = MessageEntity.newMessage();
        try {
            var f = MessageEntity.class.getDeclaredField("id"); f.setAccessible(true); f.set(newMsg, newMsgId);
        } catch (Exception e) { throw new RuntimeException(e); }
        newMsg.setOrderId(ORDER_ID);
        newMsg.setClientId(CLIENT_ID);
        newMsg.setDirection("OUTBOUND");
        newMsg.setChannel("EMAIL");
        newMsg.setDeliveryStatus(DeliveryStatus.SENT.name());
        newMsg.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        when(messageRepository.findById(newMsgId)).thenReturn(Optional.of(newMsg));
        // setRetryOfMessageId will be called before the sendManual call
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageDto dto = retryService.retry(origId, actor());

        assertThat(dto.id()).isEqualTo(newMsgId);
        assertThat(dto.deliveryStatus()).isEqualTo(DeliveryStatus.SENT.name());
        assertThat(dto.retryOfMessageId()).isEqualTo(origId);
        assertThat(dto.retryAttempt()).isEqualTo(2);
    }

    @Test
    void retry_notFailed_throws409() {
        var origId = UUID.randomUUID();
        var delivered = deliveredMessage(origId, ORDER_ID);
        when(messageRepository.findById(origId)).thenReturn(Optional.of(delivered));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));

        assertThatThrownBy(() -> retryService.retry(origId, actor()))
            .isInstanceOf(NotRetryableException.class);
    }

    @Test
    void retry_messageNotFound_throws404() {
        var id = UUID.randomUUID();
        when(messageRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> retryService.retry(id, actor()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    void retry_retryOfRetry_chainContinues() {
        // original (attempt 1) → retry 1 (attempt 2) → now retrying to attempt 3
        var origId  = UUID.randomUUID();
        var retry1Id = UUID.randomUUID();
        var retry2Id = UUID.randomUUID();

        var retry1Msg = failedMessage(retry1Id, ORDER_ID, 2, "idem:retry-2");
        // simulate retry_attempt=2 (stored on entity as column via V010)
        // MessageRetryService reads retry_attempt from entity; at attempt 2, next = 3
        when(messageRepository.findById(retry1Id)).thenReturn(Optional.of(retry1Msg));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));
        when(messageRouter.sendManual(eq(ORDER_ID), eq(CLIENT_ID), any(), anyString(), eq(ACTOR_ID)))
            .thenReturn(retry2Id);
        var retry2Msg = MessageEntity.newMessage();
        try {
            var f = MessageEntity.class.getDeclaredField("id"); f.setAccessible(true); f.set(retry2Msg, retry2Id);
        } catch (Exception e) { throw new RuntimeException(e); }
        retry2Msg.setOrderId(ORDER_ID); retry2Msg.setClientId(CLIENT_ID);
        retry2Msg.setDirection("OUTBOUND"); retry2Msg.setChannel("EMAIL");
        retry2Msg.setDeliveryStatus(DeliveryStatus.SENT.name());
        retry2Msg.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        when(messageRepository.findById(retry2Id)).thenReturn(Optional.of(retry2Msg));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageDto dto = retryService.retry(retry1Id, actor());

        assertThat(dto.retryAttempt()).isEqualTo(3);
        assertThat(dto.retryOfMessageId()).isEqualTo(retry1Id);
    }
}
```

- [ ] **Step 2: Run failing tests**

```bash
cd backend && mvn -pl app test -Dtest=MessageRetryServiceTest
```
Expected: compile failure — `MessageRetryService`, `NotRetryableException` do not exist yet.

- [ ] **Step 3: Author `NotRetryableException`**

`backend/app/src/main/java/com/drshoes/app/messaging/service/NotRetryableException.java`:

```java
package com.drshoes.app.messaging.service;

import java.util.UUID;

/**
 * Thrown when a retry is attempted on a message that is not in FAILED state.
 * Maps to HTTP 409 Conflict in MessagesController.
 */
public class NotRetryableException extends RuntimeException {
    private final UUID messageId;
    private final String actualStatus;

    public NotRetryableException(UUID messageId, String actualStatus) {
        super("Message " + messageId + " is not retryable — delivery_status=" + actualStatus);
        this.messageId = messageId;
        this.actualStatus = actualStatus;
    }

    public UUID getMessageId()     { return messageId; }
    public String getActualStatus() { return actualStatus; }
}
```

- [ ] **Step 4: Author `MessageRetryService`**

`backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRetryService.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Operator-initiated retry for messages with delivery_status='FAILED'.
 *
 * Creates a new message row (same channel/recipient/subject/body) linked to the
 * original via retry_of_message_id. The retry_attempt counter increments.
 * The original FAILED row is preserved as the historical record.
 *
 * Pattern note: delegates to MessageRouter.sendManual which applies full
 * template-render + thread logic. This is intentional — the stored body/subject
 * on the original row IS the rendered text; MessageRetryService passes it through
 * the templateId+channel path to reuse the same outbound pipeline. If the
 * subagent finds this semantically clunky (sendManual re-fetches the template and
 * re-renders), it MAY instead add a thin `sendRetry(MessageEntity orig, UUID actorId)`
 * private helper on MessageRouter that skips the template lookup and builds an
 * OutboundMessage directly. If that path is chosen, document it in plan errata.
 *
 * LOC: ~60.
 */
@Service
public class MessageRetryService {

    private static final Logger log = LoggerFactory.getLogger(MessageRetryService.class);

    private final MessageRepository messages;
    private final MessageRouter      router;
    private final OrderRepository    orders;

    public MessageRetryService(MessageRepository messages, MessageRouter router, OrderRepository orders) {
        this.messages = messages;
        this.router   = router;
        this.orders   = orders;
    }

    /**
     * Retries a failed message. The @Audited aspect writes an audit row with
     * parent_entity_id = orderId, which the MessageSentTimelineHandler curator
     * picks up as a MESSAGE_SENT event for the NEW row.
     *
     * @param failedMessageId id of the original FAILED message
     * @param actor           authenticated admin principal
     * @return MessageDto for the newly created retry row
     */
    @Transactional
    @Audited(parent = "#result.orderId()")
    public MessageDto retry(UUID failedMessageId, AdminPrincipal actor) {
        // 1. Load original message
        MessageEntity orig = messages.findById(failedMessageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Message not found: " + failedMessageId));

        // 2. RBAC ownership — actor must be able to see the parent order
        orders.findById(orig.getOrderId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Order not found: " + orig.getOrderId()));
        // Full RBAC check deferred to SecurityConfig @PreAuthorize at controller;
        // this validates the order exists for the message (cross-tenant guard).

        // 3. Validate FAILED status
        if (!DeliveryStatus.FAILED.name().equals(orig.getDeliveryStatus())) {
            log.warn("op=message.retry outcome=not_retryable actor={} messageId={} status={}",
                actor.userId(), failedMessageId, orig.getDeliveryStatus());
            throw new NotRetryableException(failedMessageId, orig.getDeliveryStatus());
        }

        // 4. Compute retry_attempt (V010 column; defaults to 1 on original rows)
        int nextAttempt = (orig.getRetryAttempt() == null ? 1 : orig.getRetryAttempt()) + 1;

        log.info("op=message.retry outcome=start actor={} originalId={} orderId={} attempt={}",
            actor.userId(), failedMessageId, orig.getOrderId(), nextAttempt);

        // 5. Send via existing pipeline — produces a new MessageEntity row
        UUID newMsgId = router.sendManual(
            orig.getOrderId(), orig.getClientId(), orig.getTemplateId(),
            orig.getChannel(), actor.userId());

        // 6. Link new row back to original + set retry_attempt
        MessageEntity newMsg = messages.findById(newMsgId)
            .orElseThrow(() -> new IllegalStateException("Retry message not found after send: " + newMsgId));
        newMsg.setRetryOfMessageId(failedMessageId);
        newMsg.setRetryAttempt(nextAttempt);
        messages.save(newMsg);

        log.info("op=message.retry outcome=ok actor={} originalId={} newId={} attempt={} status={}",
            actor.userId(), failedMessageId, newMsgId, nextAttempt, newMsg.getDeliveryStatus());

        return toDto(newMsg);
    }

    private MessageDto toDto(MessageEntity e) {
        return new MessageDto(
            e.getId(), e.getOrderId(), e.getClientId(),
            e.getDirection(), e.getChannel(),
            e.getTemplateId(), e.getTriggerId(),
            e.getSubject(), e.getBody(),
            e.getDeliveryStatus(), e.getProviderMessageId(),
            e.getSentAt(), e.getCreatedAt(),
            e.getErrorCode(), e.getErrorMessage(),
            e.getRetryOfMessageId(),
            e.getRetryAttempt() == null ? 1 : e.getRetryAttempt());
    }
}
```

**Implementation note:** `MessageEntity` needs two new fields (`retryOfMessageId`, `retryAttempt`) added as JPA columns corresponding to V010 schema. `MessageDto` needs fields `errorCode`, `errorMessage`, `retryOfMessageId`, `retryAttempt` added. The subagent adds these to both files before running tests. If `MessageDto` is a record referenced elsewhere, extend all callers' `toDto` methods (MessagesController and here) to pass the new fields.

- [ ] **Step 5: Add `retryOfMessageId` + `retryAttempt` to `MessageEntity`**

Modify `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageEntity.java` — add after the `sentBy` field:

```java
    /** V010: FK to the original message that this row retried. Null for original sends. */
    @Column(name = "retry_of_message_id", columnDefinition = "uuid")
    private UUID retryOfMessageId;

    /** V010: Attempt count. Defaults to 1 for all original sends. */
    @Column(name = "retry_attempt", nullable = false)
    private Integer retryAttempt = 1;
```

Add getters/setters after the existing `getSentBy()` block:

```java
    public UUID getRetryOfMessageId() { return retryOfMessageId; }
    public void setRetryOfMessageId(UUID retryOfMessageId) { this.retryOfMessageId = retryOfMessageId; }

    public Integer getRetryAttempt() { return retryAttempt; }
    public void setRetryAttempt(Integer retryAttempt) { this.retryAttempt = retryAttempt; }
```

- [ ] **Step 6: Extend `MessageDto` record with new fields**

Modify `backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageDto.java`:

```java
package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageDto(
    UUID id,
    UUID orderId,
    UUID clientId,
    String direction,
    String channel,
    UUID templateId,
    UUID triggerId,
    String subject,
    String body,
    String deliveryStatus,
    String providerMessageId,
    OffsetDateTime sentAt,
    OffsetDateTime createdAt,
    String errorCode,
    String errorMessage,
    UUID retryOfMessageId,
    int retryAttempt) {}
```

Update the existing `toDto` in `MessagesController` to pass the four new fields:

```java
    private MessageDto toDto(MessageEntity e) {
        return new MessageDto(
            e.getId(), e.getOrderId(), e.getClientId(),
            e.getDirection(), e.getChannel(),
            e.getTemplateId(), e.getTriggerId(),
            e.getSubject(), e.getBody(),
            e.getDeliveryStatus(), e.getProviderMessageId(),
            e.getSentAt(), e.getCreatedAt(),
            e.getErrorCode(), e.getErrorMessage(),
            e.getRetryOfMessageId(),
            e.getRetryAttempt() == null ? 1 : e.getRetryAttempt());
    }
```

- [ ] **Step 7: Run tests — GREEN**

```bash
cd backend && mvn -pl app test -Dtest=MessageRetryServiceTest
```
Expected: 4 tests pass.

Full suite:
```bash
cd backend && mvn verify
```
Expected: all green, 167 → ~171/0/0/0.

- [ ] **Step 8: Combined review**

Reviewer checks:
- `@Audited(parent="#result.orderId()")` — verify the SpEL expression resolves correctly for the record method. If MessageDto uses `orderId()` (record accessor), the expression is correct. If the aspect uses field access, adjust to `"#result.orderId"`.
- `NotRetryableException` is unchecked and mapped to 409 at the controller boundary (task 4-11).
- No N+1: single `findById` on message, single `findById` on order, then `sendManual` (which does its own queries internally).
- Thread-safety: `sendManual` is `@Transactional`; the post-send `save(newMsg)` is in the outer `retry` transaction boundary — verify `@Transactional` on `retry` wraps both correctly (it does; Spring merges to the outer tx if one exists).

- [ ] **Step 9: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRetryService.java \
        backend/app/src/main/java/com/drshoes/app/messaging/service/NotRetryableException.java \
        backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageEntity.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageDto.java \
        backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java \
        backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRetryServiceTest.java
git commit -m "$(cat <<'EOF'
feat(messaging): MessageRetryService — operator-initiated retry

[milestone:4][task:4-10]

Validates FAILED status (→ 409 NotRetryableException if not).
Loads original, computes retry_attempt = original.retry_attempt + 1,
delegates to MessageRouter.sendManual, then writes retry_of_message_id
FK + retry_attempt on the new row. Original FAILED row preserved.
@Audited(parent="#result.orderId()") emits MESSAGE_SENT audit row for
the new message via the existing MessageSentTimelineHandler curator.

MessageEntity extended: retryOfMessageId + retryAttempt (V010 columns).
MessageDto extended: errorCode, errorMessage, retryOfMessageId, retryAttempt.
MessagesController.toDto updated to pass new fields.

Unit test coverage: happy path, not-FAILED guard (409), message-not-found (404),
retry-of-retry chain (attempt 3).

Refs: docs/dispatch-log/4-10-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-11: `POST /api/admin/messages/{id}/retry` endpoint + integration test

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/api/MessageRetryControllerIT.java`

**Review:** combined single-stage.

- [ ] **Step 1: Write the failing integration test**

`backend/app/src/test/java/com/drshoes/app/messaging/api/MessageRetryControllerIT.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MessageRetryControllerIT extends AdminWebTestBase {

    @Autowired MessageRepository messageRepository;
    @Autowired ObjectMapper       objectMapper;

    /**
     * Full round-trip:
     *  1. Create a FAILED message row directly in DB (simulates a prior send failure).
     *  2. POST /api/admin/messages/{id}/retry → 200 + new MessageDto.
     *  3. Assert: new row exists, retry_of_message_id FK set, retry_attempt = 2,
     *     audit_log row written, timeline event kind = MESSAGE_SENT.
     *
     * Note: MessageRouter.sendManual calls the real EmailGateway/SmsGateway which in
     * test profile are LoggingEmailGateway / LoggingSmsGateway — both return a
     * successful DeliveryReceipt. No WireMock needed for this IT.
     */
    @Test
    void retry_happyPath_createsNewRowLinkedToOriginal() throws Exception {
        loginAsOwner();
        UUID clientId = createClientAndReturnId("Jan Kowalski", "+48600000001", "jan@example.com");
        UUID orderId  = createOrderAndReturnId(clientId);

        // Seed a FAILED message directly
        UUID origId = seedFailedMessage(orderId, clientId);

        var result = mockMvc.perform(post("/api/admin/messages/{id}/retry", origId)
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deliveryStatus").value("SENT"))
            .andExpect(jsonPath("$.retryOfMessageId").value(origId.toString()))
            .andExpect(jsonPath("$.retryAttempt").value(2))
            .andReturn();

        // Verify new row exists in DB
        var body   = objectMapper.readTree(result.getResponse().getContentAsString());
        var newId  = UUID.fromString(body.get("id").asText());
        var newMsg = messageRepository.findById(newId).orElseThrow();
        assertThat(newMsg.getRetryOfMessageId()).isEqualTo(origId);
        assertThat(newMsg.getRetryAttempt()).isEqualTo(2);

        // Original row still FAILED
        var origMsg = messageRepository.findById(origId).orElseThrow();
        assertThat(origMsg.getDeliveryStatus()).isEqualTo(DeliveryStatus.FAILED.name());
    }

    @Test
    void retry_notFailed_returns409() throws Exception {
        loginAsOwner();
        UUID clientId = createClientAndReturnId("Anna Nowak", "+48600000002", "anna@example.com");
        UUID orderId  = createOrderAndReturnId(clientId);

        // Seed a DELIVERED message
        UUID deliveredId = seedDeliveredMessage(orderId, clientId);

        mockMvc.perform(post("/api/admin/messages/{id}/retry", deliveredId)
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("NOT_RETRYABLE"));
    }

    @Test
    void retry_messageNotFound_returns404() throws Exception {
        loginAsOwner();
        mockMvc.perform(post("/api/admin/messages/{id}/retry", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isNotFound());
    }

    // ---- seed helpers ----

    private UUID seedFailedMessage(UUID orderId, UUID clientId) {
        var m = buildMessage(orderId, clientId, DeliveryStatus.FAILED.name());
        m.setErrorCode("PROVIDER_5XX");
        m.setErrorMessage("Simulated 5xx from seed");
        return messageRepository.saveAndFlush(m).getId();
    }

    private UUID seedDeliveredMessage(UUID orderId, UUID clientId) {
        var m = buildMessage(orderId, clientId, DeliveryStatus.DELIVERED.name());
        return messageRepository.saveAndFlush(m).getId();
    }

    private MessageEntity buildMessage(UUID orderId, UUID clientId, String status) {
        var m = MessageEntity.newMessage();
        // threadId: find-or-create not available here; use a random UUID for the thread stub
        // In practice MessageRetryService re-uses MessageRouter which finds/creates the thread.
        // The IT seeds the message directly bypassing the thread — the retry triggers sendManual
        // which creates/finds the real thread for the new row.
        try {
            var threadField = MessageEntity.class.getDeclaredField("threadId");
            threadField.setAccessible(true);
            threadField.set(m, UUID.randomUUID());
        } catch (Exception e) { throw new RuntimeException(e); }
        m.setOrderId(orderId);
        m.setClientId(clientId);
        m.setDirection("OUTBOUND");
        m.setChannel("EMAIL");
        m.setBody("Treść testowa");
        m.setDeliveryStatus(status);
        m.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        m.setRetryAttempt(1);
        return m;
    }
}
```

**Subagent note:** `seedFailedMessage` bypasses `MessageRouter` to plant the row directly. The retry endpoint then calls `MessageRouter.sendManual` which requires a `templateId`. Because `templateId` is null on the seeded row, `MessageRetryService` must handle the null case (either pick a system default, or use a direct `sendRetry` path that skips template re-fetch). **Implementer must verify** whether passing `templateId=null` into `sendManual` works (it will throw). If so, the correct approach is a thin `MessageRouter.sendRetry(MessageEntity orig, UUID actorId)` that builds the `OutboundMessage` directly from the stored `body`/`subject`/`channel`/`recipient` without touching templates. Document the decision in the dispatch log and update plan errata.

- [ ] **Step 2: Run test — compile error (endpoint not added yet)**

```bash
cd backend && mvn -pl app test -Dtest=MessageRetryControllerIT
```
Expected: test wires correctly but endpoint returns 404 until added.

- [ ] **Step 3: Add retry endpoint to `MessagesController`**

Add the following inside `MessagesController` class (after the existing `send` method):

```java
    @PostMapping("/api/admin/messages/{id}/retry")
    public ResponseEntity<MessageDto> retry(@PathVariable("id") UUID messageId,
                                            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=messages.retry actor={} messageId={}", actor.email(), messageId);
        MessageDto dto = retryService.retry(messageId, actor);
        log.info("op=messages.retry actor={} messageId={} newId={} outcome=ok",
            actor.email(), messageId, dto.id());
        return ResponseEntity.ok(dto);
    }

    @ExceptionHandler(com.drshoes.app.messaging.service.NotRetryableException.class)
    public ResponseEntity<java.util.Map<String, String>> handleNotRetryable(
            com.drshoes.app.messaging.service.NotRetryableException e) {
        log.info("op=messages.retry outcome=not_retryable messageId={} status={}",
            e.getMessageId(), e.getActualStatus());
        return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT)
            .body(java.util.Map.of("code", "NOT_RETRYABLE",
                                   "messageId", e.getMessageId().toString(),
                                   "actualStatus", e.getActualStatus()));
    }
```

Also inject `MessageRetryService retryService` into the constructor:

```java
    private final MessageRetryService retryService;

    public MessagesController(MessageRepository messageRepository,
                               MessageRouter router,
                               OrderRepository orderRepository,
                               MessageRetryService retryService) {
        this.messageRepository = messageRepository;
        this.router            = router;
        this.orderRepository   = orderRepository;
        this.retryService      = retryService;
    }
```

Note the `@PostMapping` on the retry endpoint does NOT include `{orderId}` in the path — the message id alone identifies the message, and order context is recovered from the stored row. The class-level `@RequestMapping("/api/admin/orders/{orderId}/messages")` conflicts with this path. **Resolution:** remove the class-level `@RequestMapping` and make all method-level paths explicit:

- `@GetMapping("/api/admin/orders/{orderId}/messages")` on `list`
- `@PostMapping("/api/admin/orders/{orderId}/messages")` on `send`
- `@PostMapping("/api/admin/messages/{id}/retry")` on `retry`

Confirm the existing two tests in `MessagesController*` suite still pass after the path change.

- [ ] **Step 4: Run full IT suite — GREEN**

```bash
cd backend && mvn -pl app test -Dtest=MessageRetryControllerIT
```
Expected: 3 tests pass.

Full suite:
```bash
cd backend && mvn verify
```
Expected: all green, ~174/0/0/0.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/MessagesController.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/MessageRetryControllerIT.java
git commit -m "$(cat <<'EOF'
feat(messaging): POST /api/admin/messages/{id}/retry endpoint + IT

[milestone:4][task:4-11]

New endpoint: POST /api/admin/messages/{id}/retry → MessageDto 200.
Maps NotRetryableException → 409 {code:'NOT_RETRYABLE', messageId, actualStatus}.
Removed class-level @RequestMapping so the retry path (/messages/{id}/retry)
doesn't require the orderId prefix; existing GET+POST paths made explicit.

IT covers: happy path round-trip (FAILED→new SENT row + FK + retryAttempt=2),
409 on non-FAILED message, 404 on unknown id.

Refs: docs/dispatch-log/4-11-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 5 — Frontend

### Task 4-12: `lib/messaging` types extension + `retryMessage` API function

**Files:**
- Modify: `apps/web/lib/messaging/types.ts`
- Modify: `apps/web/lib/messaging/api.ts`

**Review:** combined single-stage.

- [ ] **Step 1: Read current state of both files**

```bash
grep -n "MessageDto\|deliveryStatus\|retryOf" apps/web/lib/messaging/types.ts
grep -n "retryMessage\|api\." apps/web/lib/messaging/api.ts
```

Ground-truth from reading (confirmed at plan-write time 2026-05-09):
- `MessageDto` already has `deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ"` — no change needed for that field.
- `MessageDto` lacks `retryOfMessageId`, `retryAttempt`, `errorCode`, `errorMessage` — add these.
- `api.ts` uses `api` (not `apiClient`) — confirmed. URL prefix is `/admin/...` (BASE env covers `/api`).

- [ ] **Step 2: Extend `MessageDto` in `types.ts`**

In `apps/web/lib/messaging/types.ts`, modify the `MessageDto` interface — add four fields after `providerMessageId`:

```ts
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
  errorCode: string | null;
  errorMessage: string | null;
  retryOfMessageId: string | null;
  retryAttempt: number;
}
```

- [ ] **Step 3: Add `retryMessage` to `api.ts`**

In `apps/web/lib/messaging/api.ts`, add after the existing `sendMessage` export:

```ts
export async function retryMessage(id: string): Promise<MessageDto> {
  log.info("op=retryMessage", { id });
  return api.post<MessageDto>(`/admin/messages/${id}/retry`);
}
```

URL is `/admin/messages/${id}/retry` — BASE env prepends `/api`, producing `/api/admin/messages/{id}/retry`. The `api.post<MessageDto>` call matches the `ApiClient.post` signature confirmed from `apps/web/lib/api.ts`.

- [ ] **Step 4: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors. If any existing code constructs a `MessageDto` literal (e.g. in tests), add `errorCode: null, errorMessage: null, retryOfMessageId: null, retryAttempt: 1` to those sites.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/messaging/types.ts apps/web/lib/messaging/api.ts
git commit -m "$(cat <<'EOF'
feat(web): extend MessageDto + add retryMessage API function

[milestone:4][task:4-12]

MessageDto gains: errorCode, errorMessage, retryOfMessageId, retryAttempt.
Matches the M4 backend MessageDto record (tasks 4-10/4-11 added these fields).

retryMessage(id) → POST /admin/messages/{id}/retry using the shared `api`
client (not apiClient alias). Logger: op=retryMessage.

Refs: docs/dispatch-log/4-12-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-13: `MessageStatusBadge` component (NEW)

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/MessageStatusBadge.tsx`

**Review:** combined single-stage.

- [ ] **Step 1: Author the component**

`apps/web/app/(admin)/admin/orders/_components/MessageStatusBadge.tsx`:

```tsx
import type { MessageDto } from "@/lib/messaging/types";

const STATUS_LABEL_PL: Record<NonNullable<MessageDto["deliveryStatus"]>, string> = {
  QUEUED:    "Kolejka",
  SENT:      "Wysłane",
  DELIVERED: "Doręczone",
  FAILED:    "Niedoręczone",
  READ:      "Przeczytane",
};

const STATUS_CLASSES: Record<NonNullable<MessageDto["deliveryStatus"]>, string> = {
  QUEUED:    "bg-neutral-200 text-neutral-700",
  SENT:      "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED:    "bg-red-100 text-red-800",
  READ:      "bg-emerald-100 text-emerald-800",
};

interface Props {
  status: MessageDto["deliveryStatus"];
}

/**
 * Inline status pill for outbound messages.
 * Pure render — no state, no effects. ~25 LOC.
 */
export function MessageStatusBadge({ status }: Props) {
  const label   = STATUS_LABEL_PL[status]  ?? status;
  const classes = STATUS_CLASSES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
```

LOC: ~28. Under cap.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/MessageStatusBadge.tsx
git commit -m "$(cat <<'EOF'
feat(web): MessageStatusBadge — delivery status pill component

[milestone:4][task:4-13]

Polish labels: Kolejka/Wysłane/Doręczone/Niedoręczone/Przeczytane.
Tailwind classes per spec §4.6. Pure render, no state. ~28 LOC.

Refs: docs/dispatch-log/4-13-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-14: `OrderDrawerMessages` — badge + retry button + 10s polling

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`

**Review:** combined single-stage.

- [ ] **Step 1: Read the current file**

```bash
cat apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerMessages.tsx
```

Ground-truth confirmed at plan-write time (2026-05-09): the file uses `getOrderMessages`, `MessageDto`, `createLogger`, `MessageRow` sub-component, `useCallback`, `useEffect`, `useState`. State: `items: MessageDto[]`, `state: "loading"|"ok"|"err"`. The `load` function is a `useCallback` over `[orderId]`, triggered by `[load, refreshKey]` effect.

- [ ] **Step 2: Rewrite `OrderDrawerMessages` with all four modifications**

`apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderMessages, retryMessage } from "@/lib/messaging/api";
import type { MessageDto } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";
import { MessageStatusBadge } from "./MessageStatusBadge";

const log = createLogger("messaging.thread");
const POLL_INTERVAL_MS = 10_000;

interface Props {
  orderId: string;
  refreshKey: number;
  onComposeClick: () => void;
}

export function OrderDrawerMessages({ orderId, refreshKey, onComposeClick }: Props) {
  const [items, setItems]   = useState<MessageDto[]>([]);
  const [state, setState]   = useState<"loading" | "ok" | "err">("loading");
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState("loading");
    try {
      const data = await getOrderMessages(orderId);
      setItems(data);
      if (!silent) setState("ok");
      log.info("op=poll.thread outcome=ok", { orderId, count: data.length });
    } catch (e) {
      if (!silent) setState("err");
      log.warn("op=poll.thread outcome=stale-error", { orderId, err: String(e) });
    }
  }, [orderId]);

  // Initial + refreshKey-driven load
  useEffect(() => { void load(false); }, [load, refreshKey]);

  // 10s polling while drawer is mounted
  useEffect(() => {
    pollRef.current = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, [load]);

  async function handleRetry(msg: MessageDto) {
    setRetrying((prev) => new Set(prev).add(msg.id));
    setRetryError((prev) => { const n = { ...prev }; delete n[msg.id]; return n; });
    try {
      log.info("op=message.retry outcome=start", { messageId: msg.id });
      await retryMessage(msg.id);
      log.info("op=message.retry outcome=ok", { messageId: msg.id });
      await load(false);
    } catch (e) {
      const errText = "Nie udało się ponowić — spróbuj ponownie.";
      log.warn("op=message.retry outcome=failed", { messageId: msg.id, err: String(e) });
      setRetryError((prev) => ({ ...prev, [msg.id]: errText }));
    } finally {
      setRetrying((prev) => { const n = new Set(prev); n.delete(msg.id); return n; });
    }
  }

  return (
    <section className="px-6 py-4 border-t border-admin-line">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-medium text-admin-mute uppercase tracking-wide">
          Komunikacja z klientem
        </p>
        <button
          type="button"
          onClick={onComposeClick}
          className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-acid text-paper hover:bg-acid/90 transition-colors"
        >
          Wyślij wiadomość
        </button>
      </div>

      {state === "loading" && (
        <p className="text-xs text-admin-mute italic">Ładowanie wiadomości…</p>
      )}

      {state === "err" && (
        <div className="space-y-1">
          <p className="text-xs text-red-600">Nie udało się załadować wiadomości.</p>
          <button
            type="button"
            onClick={() => void load(false)}
            className="text-xs text-acid hover:underline font-medium"
          >
            Ponów
          </button>
        </div>
      )}

      {state === "ok" && items.length === 0 && (
        <p className="text-xs text-admin-mute italic">Brak wiadomości.</p>
      )}

      {(state === "ok" || items.length > 0) && (
        <div className="space-y-3 mt-1">
          {items.map((msg) => (
            <div key={msg.id} className="text-sm border border-admin-line rounded p-3 space-y-1">
              {/* Retry-chain indicator */}
              {msg.retryOfMessageId !== null && (
                <span className="text-xs text-admin-mute" aria-label="Ponowienie wiadomości">↳ </span>
              )}

              {/* Channel + status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-admin-mute">{msg.channel}</span>
                {msg.direction === "OUTBOUND" && (
                  <MessageStatusBadge status={msg.deliveryStatus} />
                )}
              </div>

              {/* Body */}
              <p className="text-ink whitespace-pre-wrap">{msg.body}</p>

              {/* FAILED: error message + retry button */}
              {msg.direction === "OUTBOUND" && msg.deliveryStatus === "FAILED" && (
                <div className="space-y-1 pt-1">
                  {msg.errorMessage && (
                    <p className="text-xs text-red-600">{msg.errorMessage}</p>
                  )}
                  {retryError[msg.id] && (
                    <p className="text-xs text-red-600">{retryError[msg.id]}</p>
                  )}
                  <button
                    type="button"
                    disabled={retrying.has(msg.id)}
                    onClick={() => void handleRetry(msg)}
                    className="text-xs px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {retrying.has(msg.id) ? "Wysyłanie…" : "Wyślij ponownie"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

LOC: ~95. Slightly over the 80-LOC soft cap due to the inline retry block. Document in dispatch log; no split needed as each JSX section is cohesive.

**Subagent note:** the existing `MessageRow` import is removed — the new component renders inline instead. If `MessageRow` is used elsewhere, do NOT delete it; just remove the import from this file. Verify with `grep -r MessageRow apps/web/`.

- [ ] **Step 3: Typecheck + lint**

```bash
cd apps/web && pnpm typecheck && pnpm lint
```
Expected: zero errors. If `react-hooks/exhaustive-deps` fires on the `setInterval` effect, the dep array `[load]` is already correct — the effect re-registers the poll whenever `orderId` changes (which rebuilds `load`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerMessages.tsx
git commit -m "$(cat <<'EOF'
feat(web): OrderDrawerMessages — status badges, retry button, 10s polling

[milestone:4][task:4-14]

Each outbound message now shows a MessageStatusBadge (Kolejka/Wysłane/Doręczone/
Niedoręczone/Przeczytane). FAILED messages show the errorMessage text + a
'Wyślij ponownie' button that calls retryMessage(id) and refreshes the thread.
Retry-of-retry messages prefixed with ↳ when retryOfMessageId !== null.

10s setInterval polling refreshes thread silently (silent=true preserves
'ok' state, swallows errors with warn log). clearInterval on unmount via
cleanup return in useEffect.

Polling op: op=poll.thread outcome=ok|stale-error.
Retry op: op=message.retry outcome=start|ok|failed.

Refs: docs/dispatch-log/4-14-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4-15: `KIND_LABELS_PL` + `KIND_ICONS` extension for `MESSAGE_DELIVERED` / `MESSAGE_FAILED`

This is a trivial inline fixup (~6 lines total across two files). Dispatching as a subagent task per plan structure; inline if the executor finds it faster.

**Files:**
- Modify: `apps/web/lib/timeline/types.ts`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`

**Review:** combined single-stage.

- [ ] **Step 1: Read both files to confirm current state**

```bash
grep -n "TimelineEventKind\|MESSAGE_\|KIND_LABELS_PL\|KIND_ICONS" \
  apps/web/lib/timeline/types.ts \
  apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerTimeline.tsx
```

Ground-truth confirmed at plan-write time (2026-05-09):
- `TimelineEventKind` in `types.ts` ends at `"PHOTO_RELABELED"`.
- `KIND_ICONS` and `KIND_LABELS_PL` in `OrderDrawerTimeline.tsx` have 13 entries ending with `PHOTO_RELABELED`.

- [ ] **Step 2: Extend `TimelineEventKind` in `types.ts`**

Add two entries after `"PHOTO_RELABELED"`:

```ts
  | "MESSAGE_DELIVERED"     // M4 — provider confirmed delivery
  | "MESSAGE_FAILED";       // M4 — provider reported delivery failure
```

(The semicolon moves from `"PHOTO_RELABELED"` to `"MESSAGE_FAILED"`.)

- [ ] **Step 3: Extend `KIND_ICONS` in `OrderDrawerTimeline.tsx`**

Add after the `PHOTO_RELABELED` entry:

```tsx
  MESSAGE_DELIVERED:    "✅",
  MESSAGE_FAILED:       "⚠️",
```

- [ ] **Step 4: Extend `KIND_LABELS_PL` in `OrderDrawerTimeline.tsx`**

Add after the `PHOTO_RELABELED` entry:

```tsx
  MESSAGE_DELIVERED:    "Wiadomość doręczona",
  MESSAGE_FAILED:       "Wiadomość nie doręczona",
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: zero errors. The `Record<TimelineEventKind, string>` type on both maps will now require the two new keys — step 3/4 satisfy this requirement.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/timeline/types.ts \
        apps/web/app/\(admin\)/admin/orders/_components/OrderDrawerTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(web): timeline labels for MESSAGE_DELIVERED / MESSAGE_FAILED

[milestone:4][task:4-15]

Extends TimelineEventKind union with MESSAGE_DELIVERED and MESSAGE_FAILED.
KIND_ICONS: ✅ / ⚠️. KIND_LABELS_PL: 'Wiadomość doręczona' /
'Wiadomość nie doręczona'. These kinds are emitted by WebhookStatusReconciler
(task 4-9) via the TimelineEventCurator APPLIED-outcome path.

Refs: docs/dispatch-log/4-15-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 6 — Closure

### Task 4-16: Smoke + `milestone-4` tag + `CLAUDE.md` flip

**Files:**
- Modify: `CLAUDE.md` (status block)

**Review:** combined single-stage.

- [ ] **Step 1: Run full backend suite**

```bash
cd backend && mvn -B verify
```
Expected: BUILD SUCCESS. Suite ≥ 190, 0 failures, 0 errors, 0 skipped.
If count is below 190, check that all IT classes compiled. Do NOT proceed to step 2 with failures.

- [ ] **Step 2: Run frontend typecheck + lint + build**

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm build
```
Expected: `pnpm typecheck` — 0 errors. `pnpm lint` — 0 errors (warnings acceptable). `pnpm build` — BUILD SUCCESSFUL, zero type errors in compiled output.

- [ ] **Step 3: Smoke approach**

Automated only — consistent with M2/M3 owner-locked precedent. `docker compose` manual smoke is not run. The following is the automated smoke record:

```bash
# Automated smoke: backend suite ≥ 190, frontend build green.
# Manual UI smoke skipped per owner directive (precedent: M2/M3).
# Provider integration exercised via WireMock ITs in tasks 4-4, 4-6, 4-7, 4-8, 4-11.
```

- [ ] **Step 4: Create local git tag `milestone-4`**

```bash
git tag -a milestone-4 -m "$(cat <<'EOF'
Milestone 4 — Real Providers + Webhooks + Delivery Reconciliation + Retry

16 tasks across 6 waves. Suite: 167 (M3 close) → ≥190/0/0/0.

What shipped:
- Real Postmark email provider (profile-gated: messaging.email.provider=postmark).
  PostmarkEmailGateway uses Spring RestClient; 1 network retry on IO failure;
  10MB attachment cap; WireMock IT green across 200/4xx/5xx/timeout paths.
- Real SMSAPI.pl SMS provider (profile-gated: messaging.sms.provider=smsapi).
  SmsApiSmsGateway uses Bearer token auth; WireMock IT green.
- Webhook receiver: POST /api/webhooks/postmark with HTTP Basic-Auth verification.
  Records Delivery→DELIVERED, Bounce/SpamComplaint→FAILED, Open/Click/SubscriptionChange→DROPPED.
- Webhook receiver: GET /api/webhooks/smsapi with source-IP allowlist (5 fixed IPs, Cf-Connecting-Ip aware).
  Records DELIVERED/UNDELIVERED/EXPIRED/FAILED/REJECTD→FAILED, QUEUE/ACCEPTD/SENT→DROPPED.
- WebhookStatusReconciler: idempotent state-guarded UPDATE, DEDUP on unique provider_event_id,
  NO_MESSAGE / NO_TRANSITION guard. @Audited → MESSAGE_DELIVERED / MESSAGE_FAILED timeline kinds.
- V010 schema: webhook_event table (forensics + dedupe), message.retry_of_message_id FK,
  message.retry_attempt INTEGER DEFAULT 1.
- MessageRetryService: manual retry for FAILED messages. New row + retry chain FK.
  POST /api/admin/messages/{id}/retry → 200 MessageDto | 409 NOT_RETRYABLE | 404.
- Frontend: MessageStatusBadge (Kolejka/Wysłane/Doręczone/Niedoręczone/Przeczytane).
  OrderDrawerMessages: status badge + FAILED error text + 'Wyślij ponownie' button + 10s polling.
  Timeline labels for MESSAGE_DELIVERED + MESSAGE_FAILED in Polish.
- Provider activation is profile-gated: real impls active only when config property present.
  Dev/test/local use LoggingEmailGateway / LoggingSmsGateway (no quota burn, no cloudflared).

Smoke: automated only (WireMock ITs + pnpm build) — manual UI smoke skipped per M2/M3 precedent.

Deferred to later milestones (M5+):
- Inbound parsing (email reply / SMS inbound → direction=INBOUND rows + thread surfacing).
- Reply UI and unread count / top-nav inbox.
- WhatsApp channel (no microlib stub yet).
- SMTP fallback for email.
- READ status / open tracking (schema column present, never populated).
- DB outbox + @Scheduled auto-retry worker.
- Twilio SMS alternative.
EOF
)"
```

- [ ] **Step 5: Read and flip `CLAUDE.md` status row**

First read the current status block:

```bash
grep -n "Milestone 3\|Milestone 4" CLAUDE.md
```

Expected current state (from M3 closure, task 3-13):

```
- [x] Milestone 3: Photos + actor resolution (real providers deferred to a later milestone)
```

M4 row is absent — add it. Edit `CLAUDE.md` to append:

```
- [x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry
```

The status block should end with:

```
- [x] Milestone 0A: foundation skeleton boots — health green, V001 applied, web renders
- [x] Milestone 0B: auth + RBAC + audit log + login UI + admin guard
- [x] Milestone 1: Order domain + drawer + audit timeline
- [x] Milestone 2: Messaging + triggers
- [x] Milestone 3: Photos + actor resolution (real providers deferred to a later milestone)
- [x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry
```

- [ ] **Step 6: Write dispatch log + update `tasks.json`**

Create `docs/dispatch-log/4-16-<UTC>.md` with the standard template:

```markdown
# Dispatch log: 4-16

**task:** 4-16 — Smoke + milestone-4 tag + CLAUDE.md flip
**milestone:** 4
**executed:** <UTC timestamp>
**subagent:** general-purpose Sonnet

## Files modified
- CLAUDE.md — status row added for Milestone 4

## Commands run
- `cd backend && mvn -B verify` → BUILD SUCCESS <N>/0/0/0
- `cd apps/web && pnpm typecheck && pnpm lint && pnpm build` → all green
- `git tag -a milestone-4 -m "..."` → tag created

## Test summary
Suite: <N>/0/0/0 (M4 close). All green.

## Decisions
- Manual smoke skipped per M2/M3 owner-locked precedent.

## Commit SHA
<sha>
```

Update `docs/dispatch-log/tasks.json` — set `"status": "completed"` and `"commitSha": "<sha>"` for task `4-16`.

- [ ] **Step 7: Commit closure**

```bash
git add CLAUDE.md docs/dispatch-log/tasks.json docs/dispatch-log/4-16-*.md
git commit -m "$(cat <<'EOF'
docs: mark Milestone 4 complete

[milestone:4][task:4-16]

Real Postmark/SMSAPI providers, webhook reconciliation (DELIVERED/FAILED
timeline kinds), manual retry path, UI badges + 10s polling. Suite ≥ 190.
Local tag milestone-4 created. CLAUDE.md status row flipped.

Refs: docs/dispatch-log/4-16-<UTC>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git log --oneline -5
git tag --list 'milestone-*'
```

Expected: `milestone-4` listed alongside `milestone-3`, `milestone-2`, `milestone-1`, `milestone-0b`.

---

## Plan errata

_None yet — implementer adds discoveries here._

Anticipated errata candidates (based on task analysis):

- **4-10 / 4-11:** `MessageRouter.sendManual` requires a non-null `templateId`. A seeded FAILED row with `templateId=null` will throw inside `sendManual`. If the IT (task 4-11) plants a message without a templateId, the retry path needs a `sendRetry(MessageEntity, UUID actorId)` entry point on `MessageRouter` that skips template lookup and builds `OutboundMessage` directly from stored body/subject/channel. Flag decision in dispatch log.
- **4-10:** `@Audited(parent="#result.orderId()")` — Spring's SpEL on a record accessor: confirm the aspect resolves record method calls (`.orderId()` style) vs field access (`.orderId`). Adjust SpEL if needed.
- **4-10:** `MessageEntity` does not have public `retryAttempt` field until step 5 of this task. The test at step 1 calls `failedMessage(..., int attempt, ...)` but the entity has no setter yet — the test helper may need to use reflection until step 5 ships the field. Task is structured to add the field at step 5; adjust test step 1 if the compile fails for a different reason.

---

## Closing checklist

The following bars must all be green before task 4-16 is committed (these are the M4 ship gates per spec §11):

1. All 16 tasks (`4-1` through `4-16`) marked `completed` in `docs/dispatch-log/tasks.json` with commit SHAs.
2. `cd backend && mvn -B verify` — BUILD SUCCESS, suite ≥ 190, 0 failures, 0 errors, 0 skipped.
3. `cd apps/web && pnpm typecheck` — 0 type errors.
4. `cd apps/web && pnpm lint` — 0 errors (warnings do not block).
5. `cd apps/web && pnpm build` — BUILD SUCCESSFUL.
6. Local git tag `milestone-4` annotated with what shipped, suite count, smoke approach, deferred items.
7. `CLAUDE.md` status block includes `[x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry`.
8. A new session-memory entry summarizing M4 exists with a paste-ready resume prompt for M5.

<!-- Spec coverage: §1-§11 mapped to tasks 4-1 through 4-16. -->
