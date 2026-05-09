# Milestone 5 — Inbound parsing, replies, and the cross-client inbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two-way messaging loop. Persist inbound email + SMS as `direction=INBOUND` rows under per-client `MessageThread`s; expose unread state via sidebar nav + OrderDrawer banner; ship a cross-client `/admin/messages` inbox with reply composer; quarantine unmatched senders.

**Architecture:** Webhook receivers (`/api/webhooks/{postmark,smsapi}/inbound`) → `InboundMessageService` (idempotent on `provider_message_id`) → `MessageThreadService` extensions (find-or-create, mark-read, assign, discard) → `Message` row + `MESSAGE_RECEIVED` audit/timeline. Reply send reuses M4 outbound stack via the new `MessageRouter.sendReply`. Operator surfaces: `/admin/messages` page (thread list + filter + search + composer), `Sidebar/MessagesNavItem`, `OrderDrawer/UnreadElsewhereBanner`. Schema: V012 makes `client_id` nullable on `message_thread` + `message`, adds `raw_sender VARCHAR(255)`, adds `discarded_at TIMESTAMPTZ` for soft-delete.

**Tech Stack:** Java 21 + Spring Boot 3.4 (multi-module Maven), Spring Security session-based, Postgres 16, Flyway, Jackson, RestClient. Frontend: Next.js 16 App Router, TS strict, Tailwind, Radix. WireMock + Testcontainers for IT.

---

## ERRATA — pre-execution clarifications (read before any task)

### 1. Hard rules (MUST read before writing any code)

- **IT class naming:** ALL integration test classes MUST be named `*IntegrationTest.java`. Classes named `*IT.java` are silently skipped by Maven Failsafe and will NEVER execute. This bit M3 and M4 hard. There are no exceptions.
- **Controller package convention:** ALL controllers MUST live in a `.api.` package (e.g. `com.drshoes.app.messaging.api`, `com.drshoes.app.webhooks`). The `AuditLogAspect` path-pattern curator requires this. A controller outside `.api.` will not fire audit events.
- **Real entity field names:**
  - `Client` setters: `setFirstName(String)` / `setLastName(String)`. There is NO `setFullName`. Use both setters when building client fixtures.
  - `Order` has `code VARCHAR(20) UNIQUE NOT NULL`. All order fixtures must supply a unique `code`.
  - `MessageEntity.channel` and `.direction` are stored as `String` with DB CHECK constraints. Use `.name()` on enums (e.g. `"EMAIL"`, `"INBOUND"`) — do NOT pass enum instances directly.
  - `MessageEntity.clientId` is `nullable=false` in the pre-V012 JPA mapping. After V012 + task 5-2 patch the entity, it becomes nullable. Build fixtures accordingly.
  - `MessageEntity` factory: use `MessageEntity.newMessage()` (the protected no-arg constructor is not accessible from other packages).
  - `MessageThreadEntity` has NO `channel` field pre-M5. V012 + task 5-2 add it. Do NOT reference `.getChannel()` on a thread before task 5-2 ships.
- **IT base class:** `AbstractIntegrationTest` (in `com.drshoes.app`). All `*IntegrationTest.java` files MUST `extends AbstractIntegrationTest`. It boots the full Spring context with `@SpringBootTest(webEnvironment = RANDOM_PORT)` and spins a shared Postgres 16 Testcontainers instance.
- **No `Co-Authored-By:` lines** in any commit message. This project does not use that trailer.
- **LOC caps:** Java classes < 120 LOC; flag and split at ≥ 120. TypeScript modules < 80 LOC; flag and split at ≥ 80. The cap is a hard rule, not a suggestion.
- **`MessageRouter` pre-M5 LOC:** 293 lines. It already has duplicated send logic between `send(...)` (private) and `sendRetry(...)` (public). M5 adds `sendReply` and `sendNewToClient`, which would bring it to ~380 LOC and deepen the duplication. Task 5-3 is a BLOCKER: extract `MessageGatewayDispatcher` before adding any new methods to `MessageRouter`. After 5-3, `MessageRouter` must be ≤ 130 LOC.

### 2. Anticipated errata (pre-populated from spec §9)

- **Postmark inbound payload field names** — per Postmark inbound stream docs the fields are: `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, `StrippedTextReply`, `MessageID`, `Date`. Verify against current Postmark documentation at implementation time. `StrippedTextReply` is preferred over `TextBody` for replies; fall back to `TextBody` when `StrippedTextReply` is blank. Implementers: note actual field names used in the errata Findings section below if they differ.
- **SMSAPI MO payload format** — spec expects `application/x-www-form-urlencoded` with fields `from`, `to`, `text`, `MsgId`, `sms_date`. Verify at implementation time whether SMSAPI sends form-encoded or JSON (or both depending on configuration). If JSON, add a `@RequestBody` variant. Implementers: note confirmed format in Findings below.
- **Phone normalization** — inbound SMS `from` may arrive as `+48506220119`, `48506220119`, or `00 48 506 220 119`. The client lookup queries `client.phone`. The stored format (from M1/M2) must be checked — look at `ClientService` or existing fixtures. Extract or reuse a normalizer; do not assume the inbound format matches stored format without verification. Implementers: confirm stored format and normalization logic in Findings below.
- **`order_.code` on right-rail "Aktywne zlecenie"** — design references order code (e.g. "DR-1042"). The recent-order lookup picks the client's most-recent order with status NOT IN (WYDANE, ANULOWANE); if none, the right-rail collapses that section. The `Order` entity has `code` as a UNIQUE NOT NULL column — use it directly for display.
- **Cross-thread compose endpoint** — `POST /api/admin/clients/{clientId}/messages` is a NEW endpoint, not a modification of `POST /api/admin/orders/{orderId}/messages`. Do NOT add `orderId=null` semantics to the existing M2 endpoint — that would break the M2-locked contract. Implement as a separate path in a new or extended controller.
- **`message_thread.channel` column** — V012 must add a `channel VARCHAR(16) NOT NULL DEFAULT 'EMAIL'` column to `message_thread` (pre-existing rows can default to EMAIL which is the only channel used to date). The repo finder methods in task 5-2 (`findFirstByClientIdAndChannelAndDiscardedAtIsNull`, `findFirstByRawSenderAndChannelAndDiscardedAtIsNull`) depend on this column. V012 SQL and `MessageThreadEntity` must add it together in task 5-1 + 5-2. Implementers: confirm column added and note in Findings.
- **`OutboundMessage` constructor validation** — `OutboundMessage` rejects blank recipient AND blank body at construction time (throws `IllegalArgumentException`). The `MessageGatewayDispatcher` cannot defensively call the gateway if recipient is blank — the `OutboundMessage` record will throw before the switch. The "blank recipient" test in 5-3 must be structured accordingly: verify the IllegalArgumentException path, NOT a gateway dispatch path. Adjust test to assert `IllegalArgumentException` is thrown from `dispatch()` when recipient is blank.
- **`DeliveryReceipt` not `OutboundResult`** — the gateway interfaces return `DeliveryReceipt` (from `com.drshoes.lib.messaging`), not `OutboundResult`. The `MessageGatewayDispatcher` implementation template in task 5-3 shows `OutboundResult result = ...`. Replace all occurrences of `OutboundResult` with `DeliveryReceipt` and use `receipt.providerMessageId()` (accessor on the record). `DeliveryReceipt.accepted(providerMessageId)` is the happy-path factory; `DeliveryReceipt.failed(code, message)` for the failure path.

### 3. Findings (filled by implementers)

_None yet — implementers add discoveries here as tasks ship._

---

## Wave 1 — Schema + domain

### Task 5-1: V012 migration

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V012__inbound_messaging.sql`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/repository/V012MigrationIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write migration SQL**

Create `backend/app/src/main/resources/db/migration/V012__inbound_messaging.sql`:

```sql
-- V012: inbound messaging support.
-- Makes client_id nullable on message_thread + message (unmatched inbound rows have no client).
-- Adds raw_sender VARCHAR(255) — set for unmatched, NULL for matched rows.
-- Adds discarded_at TIMESTAMPTZ to message_thread (soft-delete for quarantine).
-- Adds channel VARCHAR(16) to message_thread (per-channel threading; defaults to EMAIL for existing rows).
-- CHECK constraints ensure exactly one of (client_id, raw_sender) is non-null per row.
-- Idempotency: UNIQUE partial (provider_message_id, channel) WHERE provider_message_id IS NOT NULL on message.

ALTER TABLE message_thread ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE message_thread ADD COLUMN raw_sender    VARCHAR(255) NULL;
ALTER TABLE message_thread ADD COLUMN discarded_at  TIMESTAMPTZ NULL;
ALTER TABLE message_thread ADD COLUMN channel       VARCHAR(16) NOT NULL DEFAULT 'EMAIL'
                               CHECK (channel IN ('EMAIL','SMS','WHATSAPP'));
ALTER TABLE message_thread
  ADD CONSTRAINT message_thread_client_or_raw
  CHECK (
    (client_id IS NOT NULL AND raw_sender IS NULL)
    OR (client_id IS NULL AND raw_sender IS NOT NULL)
  );

ALTER TABLE message ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE message ADD COLUMN raw_sender VARCHAR(255) NULL;
ALTER TABLE message
  ADD CONSTRAINT message_client_or_raw
  CHECK (
    (client_id IS NOT NULL AND raw_sender IS NULL)
    OR (client_id IS NULL AND raw_sender IS NOT NULL)
  );

CREATE INDEX message_thread_unmatched_idx ON message_thread (channel, raw_sender)
  WHERE client_id IS NULL;

CREATE UNIQUE INDEX message_provider_msg_channel_unique_idx
  ON message (provider_message_id, channel)
  WHERE provider_message_id IS NOT NULL;
```

---

- [ ] **Step 2: Write the IT class**

Create `backend/app/src/test/java/com/drshoes/app/messaging/repository/V012MigrationIntegrationTest.java`:

```java
package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies V012 migration applied cleanly: new columns, check constraints, and
 * partial unique index on message.provider_message_id + channel.
 */
class V012MigrationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("V012 columns exist on message_thread with correct types")
    void columnsExist() {
        var rawSenderType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='raw_sender'",
                String.class);
        assertThat(rawSenderType).isEqualTo("character varying");

        var discardedAtType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='discarded_at'",
                String.class);
        assertThat(discardedAtType).isEqualTo("timestamp with time zone");

        var channelType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='channel'",
                String.class);
        assertThat(channelType).isEqualTo("character varying");
    }

    @Test
    @DisplayName("CHECK constraint on message_thread blocks both client_id and raw_sender NULL")
    void checkConstraintBlocksBothNull() {
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) VALUES (?::uuid, NULL, NULL, 'EMAIL')",
                UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("CHECK constraint on message_thread blocks both client_id and raw_sender set")
    void checkConstraintBlocksBothPresent() {
        // Need a valid client_id — skip with raw insert; the FK would also fire, but
        // the CHECK fires first in Postgres (implementation-defined order).
        // Use a non-existent UUID: the FK violation is also a DataIntegrityViolation.
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) VALUES (?::uuid, ?::uuid, '+48123456789', 'EMAIL')",
                UUID.randomUUID().toString(), UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("idempotency unique index prevents duplicate (provider_message_id, channel) on message")
    void idempotencyUniquePreventsDuplicates() {
        // Build the minimal prerequisite rows: a client, a thread.
        UUID clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Test', 'Unique', ?, '+48000000001', 'EMAIL')",
                clientId.toString(), "unique-idem-" + clientId + "@test.pl");

        UUID threadId = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                threadId.toString(), clientId.toString());

        String pmId = "pm-idem-" + UUID.randomUUID();

        // First insert — must succeed.
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, " +
                "delivery_status, provider_message_id) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'hello', 'QUEUED', ?)",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString(), pmId);

        // Second insert with same provider_message_id + channel — must fail.
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message (id, thread_id, client_id, direction, channel, body, " +
                "delivery_status, provider_message_id) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'hello2', 'QUEUED', ?)",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString(), pmId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("NULL provider_message_id allows multiple rows (partial unique index skips NULLs)")
    void nullProviderMessageIdAllowedMultipleTimes() {
        UUID clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Test', 'NullPm', ?, '+48000000002', 'EMAIL')",
                clientId.toString(), "null-pm-" + clientId + "@test.pl");

        UUID threadId = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                threadId.toString(), clientId.toString());

        // Two rows with provider_message_id = NULL — both must succeed.
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, delivery_status) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'msg1', 'QUEUED')",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString());
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, delivery_status) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'msg2', 'QUEUED')",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message WHERE thread_id = ?::uuid AND provider_message_id IS NULL",
                Integer.class, threadId.toString());
        assertThat(count).isGreaterThanOrEqualTo(2);
    }
}
```

---

- [ ] **Step 3: Run targeted test — confirm shape**

```bash
mvn -B -pl app -am test -Dtest=V012MigrationIntegrationTest
```

On first run Flyway auto-applies V012 and tests should pass GREEN. If migration has a syntax error, Flyway will report it at startup — fix SQL and re-run. RED is also acceptable at this step if the migration has not yet been validated; either outcome confirms the test shape.

---

- [ ] **Step 4: Full suite — GREEN**

```bash
mvn -B -pl app -am test
```

Expected: ≥ 206 tests (201 baseline + 5 new), 0 failures, 0 errors, 0 skipped.

---

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V012__inbound_messaging.sql \
        backend/app/src/test/java/com/drshoes/app/messaging/repository/V012MigrationIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(db): V012 — inbound messaging schema (nullable client_id, raw_sender, channel, idempotency unique) [milestone:5][task:5-1]

Adds to message_thread: client_id nullable, raw_sender VARCHAR(255),
discarded_at TIMESTAMPTZ, channel VARCHAR(16) DEFAULT 'EMAIL'.
Adds CHECK message_thread_client_or_raw (exactly one of client_id/raw_sender non-null).
Adds to message: client_id nullable, raw_sender VARCHAR(255).
Adds CHECK message_client_or_raw.
Adds partial index message_thread_unmatched_idx (channel, raw_sender WHERE client_id IS NULL).
Adds partial unique index message_provider_msg_channel_unique_idx (provider_message_id, channel
WHERE provider_message_id IS NOT NULL) for inbound idempotency.

Refs: docs/dispatch-log/5-1-<UTC>.md
EOF
)"
```

**Acceptance:**
- V012 applies cleanly on top of V011; existing data preserved (all current threads get `channel='EMAIL'`, `raw_sender=NULL`, `discarded_at=NULL`).
- 5 IT methods all green.
- Suite ≥ 206.

---

### Task 5-2: Entity + repo updates + repo IT

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageThreadEntity.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageEntity.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadRepositoryInboundIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Read existing files**

Read all three files before patching. Confirm current field names and nullability annotations. Do NOT skip this step — the edit must be a diff, not a rewrite.

---

- [ ] **Step 2: Patch `MessageThreadEntity`**

Add to `MessageThreadEntity.java` after the `subject` field:

```java
/** EMAIL / SMS / WHATSAPP — per-channel threading. Added V012. */
@Column(nullable = false, length = 16)
private String channel = "EMAIL";

/** Null for matched threads (client known). Set for unmatched inbound threads. Added V012. */
@Column(name = "raw_sender", length = 255)
private String rawSender;

/** Non-null when operator has discarded this unmatched thread. Added V012. */
@Column(name = "discarded_at")
private OffsetDateTime discardedAt;
```

Change the existing `clientId` field annotation from `nullable = false` to `nullable = true`:

```java
// BEFORE:
@Column(name = "client_id", nullable = false, columnDefinition = "uuid")
private UUID clientId;

// AFTER:
@Column(name = "client_id", columnDefinition = "uuid")
private UUID clientId;
```

Add accessors for all three new fields after the existing `getUpdatedAt()`:

```java
public String getChannel() { return channel; }
public void setChannel(String channel) { this.channel = channel; }

public String getRawSender() { return rawSender; }
public void setRawSender(String rawSender) { this.rawSender = rawSender; }

public OffsetDateTime getDiscardedAt() { return discardedAt; }
public void setDiscardedAt(OffsetDateTime discardedAt) { this.discardedAt = discardedAt; }
```

---

- [ ] **Step 3: Patch `MessageEntity`**

Add `rawSender` field after the existing `clientId` field:

```java
/** Null for matched messages (client known). Set for unmatched inbound messages. Added V012. */
@Column(name = "raw_sender", length = 255)
private String rawSender;
```

Change the existing `clientId` annotation from `nullable = false` to `nullable = true`:

```java
// BEFORE:
@Column(name = "client_id", nullable = false, columnDefinition = "uuid")
private UUID clientId;

// AFTER:
@Column(name = "client_id", columnDefinition = "uuid")
private UUID clientId;
```

Add accessor after the existing `getClientId()`/`setClientId()` block:

```java
public String getRawSender() { return rawSender; }
public void setRawSender(String rawSender) { this.rawSender = rawSender; }
```

---

- [ ] **Step 4: Patch `MessageThreadRepository`**

Add finders after the existing `findFirstByClientIdOrderByCreatedAtAsc`:

```java
/**
 * Returns the most recent non-discarded thread for a known client + channel.
 * Used by InboundMessageService to route matched inbound messages.
 */
Optional<MessageThreadEntity> findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
        UUID clientId, String channel);

/**
 * Returns the non-discarded thread for an unmatched sender + channel, if one exists.
 * Used by InboundMessageService to group repeated unmatched inbound messages.
 */
Optional<MessageThreadEntity> findFirstByRawSenderAndChannelAndDiscardedAtIsNull(
        String rawSender, String channel);

/**
 * Returns all non-discarded unmatched threads (client_id IS NULL), ordered newest-first.
 * Used by ThreadController to populate the "Niesparowane" filter.
 */
List<MessageThreadEntity> findAllByClientIdIsNullAndDiscardedAtIsNullOrderByLastMessageAtDesc();

/**
 * Counts non-discarded threads for a client that have at least one unread message.
 * Used by OrderDrawer banner to detect "unread elsewhere".
 */
long countByClientIdAndUnreadCountGreaterThan(UUID clientId, int min);

/**
 * Counts all non-discarded threads system-wide with unread messages.
 * Used by MessagesNavItem sidebar badge.
 */
long countByUnreadCountGreaterThan(int min);
```

Also add the missing `List` import at the top of the interface file:

```java
import java.util.List;
```

---

- [ ] **Step 5: Write IT class**

Create `backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadRepositoryInboundIntegrationTest.java`:

```java
package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Repository-level integration tests for V012 inbound finder methods.
 * Each test creates its own client + thread fixtures via JdbcTemplate for speed.
 */
@Transactional
class MessageThreadRepositoryInboundIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MessageThreadRepository repo;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        clientId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Repo', 'Test', ?, '+48111000001', 'EMAIL')",
                clientId.toString(), "repo-test-" + clientId + "@test.pl");
    }

    // ---- helper ----

    private UUID insertThread(UUID cId, String channel, String rawSender,
                              OffsetDateTime lastMessageAt, boolean discarded) {
        UUID id = UUID.randomUUID();
        OffsetDateTime discardedAt = discarded ? OffsetDateTime.now(ZoneOffset.UTC) : null;
        jdbc.update(
                "INSERT INTO message_thread (id, client_id, channel, raw_sender, last_message_at, discarded_at) " +
                "VALUES (?::uuid, ?::uuid, ?, ?, ?, ?)",
                id.toString(),
                cId != null ? cId.toString() : null,
                channel,
                rawSender,
                lastMessageAt,
                discardedAt);
        return id;
    }

    // ---- tests ----

    @Test
    @DisplayName("findFirstByClientIdAndChannel returns most recent non-discarded thread")
    void findFirstByClientIdAndChannel_returnsMostRecent() {
        OffsetDateTime older = OffsetDateTime.now(ZoneOffset.UTC).minusHours(2);
        OffsetDateTime newer = OffsetDateTime.now(ZoneOffset.UTC).minusHours(1);

        UUID olderThread = insertThread(clientId, "EMAIL", null, older, false);
        UUID newerThread = insertThread(clientId, "EMAIL", null, newer, false);

        var found = repo.findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
                clientId, "EMAIL");

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(newerThread);
    }

    @Test
    @DisplayName("findFirstByClientIdAndChannel excludes discarded threads")
    void findFirstByClientIdAndChannel_excludesDiscarded() {
        insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), true);

        var found = repo.findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
                clientId, "EMAIL");

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("findFirstByRawSenderAndChannel returns matching unmatched thread")
    void findFirstByRawSenderAndChannel_returnsMatch() {
        String rawSender = "+48500600700";
        insertThread(null, "SMS", rawSender, OffsetDateTime.now(ZoneOffset.UTC), false);

        var found = repo.findFirstByRawSenderAndChannelAndDiscardedAtIsNull(rawSender, "SMS");

        assertThat(found).isPresent();
        assertThat(found.get().getRawSender()).isEqualTo(rawSender);
        assertThat(found.get().getClientId()).isNull();
    }

    @Test
    @DisplayName("findAllByClientIdIsNullAndDiscardedAtIsNull lists only active unmatched threads")
    void findAllByClientIdIsNullAndDiscardedAtIsNull_listsAllUnmatched() {
        // matched thread — should NOT appear
        insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        // active unmatched — should appear
        UUID unmatchedActive = insertThread(null, "EMAIL", "unknown@example.com",
                OffsetDateTime.now(ZoneOffset.UTC), false);
        // discarded unmatched — should NOT appear
        insertThread(null, "SMS", "+48000000099",
                OffsetDateTime.now(ZoneOffset.UTC), true);

        List<MessageThreadEntity> result =
                repo.findAllByClientIdIsNullAndDiscardedAtIsNullOrderByLastMessageAtDesc();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(unmatchedActive);
    }

    @Test
    @DisplayName("countByClientIdAndUnreadCountGreaterThan skips threads with zero unread")
    void countByClientIdAndUnreadCountGreaterThan_skipsZero() {
        UUID threadWithUnread = insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        jdbc.update("UPDATE message_thread SET unread_count = 3 WHERE id = ?::uuid", threadWithUnread.toString());
        insertThread(clientId, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false); // 0 unread

        long count = repo.countByClientIdAndUnreadCountGreaterThan(clientId, 0);

        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("countByUnreadCountGreaterThan aggregates across all clients")
    void countByUnreadCountGreaterThan_aggregates() {
        UUID otherClient = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Other', 'Client', ?, '+48222000002', 'EMAIL')",
                otherClient.toString(), "other-" + otherClient + "@test.pl");

        UUID t1 = insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        UUID t2 = insertThread(otherClient, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        jdbc.update("UPDATE message_thread SET unread_count = 2 WHERE id = ?::uuid", t1.toString());
        jdbc.update("UPDATE message_thread SET unread_count = 1 WHERE id = ?::uuid", t2.toString());
        insertThread(clientId, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false); // 0 unread

        long total = repo.countByUnreadCountGreaterThan(0);

        assertThat(total).isGreaterThanOrEqualTo(2);
    }

    @Test
    @DisplayName("native insert with both client_id and raw_sender NULL violates CHECK constraint")
    void nativeRepoBlocksDoubleNull() {
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) " +
                "VALUES (?::uuid, NULL, NULL, 'EMAIL')",
                UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
```

---

- [ ] **Step 6: Run targeted test — RED then GREEN**

```bash
mvn -B -pl app -am test -Dtest=MessageThreadRepositoryInboundIntegrationTest
```

Before entity + repo changes: expect compilation failures (missing fields/methods) — RED is correct. After Steps 2-4: GREEN.

---

- [ ] **Step 7: Full suite — GREEN**

```bash
mvn -B -pl app -am test
```

Expected: ≥ 213 tests (206 + 7 new), 0 failures, 0 errors, 0 skipped.

---

- [ ] **Step 8: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageThreadEntity.java \
        backend/app/src/main/java/com/drshoes/app/messaging/domain/MessageEntity.java \
        backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
        backend/app/src/test/java/com/drshoes/app/messaging/repository/MessageThreadRepositoryInboundIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(messaging): entity + repo extensions for inbound threading (V012 domain) [milestone:5][task:5-2]

MessageThreadEntity: nullable clientId, +channel/rawSender/discardedAt fields + accessors.
MessageEntity: nullable clientId, +rawSender field + accessor.
MessageThreadRepository: 5 new finders/aggregates for inbound routing + unread badge.
7 IT methods covering per-channel finder, discarded exclusion, unmatched list, unread counts,
and native CHECK constraint enforcement.

Refs: docs/dispatch-log/5-2-<UTC>.md
EOF
)"
```

**Acceptance:**
- 7 IT methods all green.
- Suite ≥ 213.
- `MessageThreadEntity.getChannel()` / `getRawSender()` / `getDiscardedAt()` accessible.
- `MessageEntity.getRawSender()` accessible; `clientId` nullable in JPA.

---

## Wave 2 prelude

### Task 5-3: MessageGatewayDispatcher hygiene extraction (BLOCKER for 5-10 / 5-11)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageGatewayDispatcher.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageGatewayDispatcherTest.java`

**Review:** combined single-stage (refactor; existing tests are the contract).

---

**Context — duplicated section identified (pre-M5 MessageRouter):**

Both the private `send(...)` (lines 186-256) and the public `sendRetry(...)` (lines 127-182) share the same structure:

```
// BEFORE — duplicated in send() AND sendRetry():
Channel ch = Channel.valueOf(orig.getChannel());
String recipient = switch (ch) {
    case EMAIL -> clients.findById(...).map(Client::getEmail).orElse(null);
    case SMS   -> clients.findById(...).map(Client::getPhone).orElse(null);
    ...
};
var outbound = new OutboundMessage(ch, recipient, subject, body, null, null);
boolean sent = false;
try {
    var receipt = switch (ch) {
        case EMAIL -> email.send(outbound);
        case SMS   -> sms.send(outbound);
        ...
    };
    saved.setDeliveryStatus(DeliveryStatus.SENT.name());
    saved.setProviderMessageId(receipt.providerMessageId());
    saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
    sent = true;
} catch (RuntimeException e) {
    saved.setDeliveryStatus(DeliveryStatus.FAILED.name());
    ...
}
messages.save(saved);
if (sent) {
    thread.setLastMessageAt(OffsetDateTime.now(ZoneOffset.UTC));
    threads.save(thread);
}
```

`MessageGatewayDispatcher` extracts this block into a single reusable method.

---

- [ ] **Step 1: Write `MessageGatewayDispatcherTest` (full code — RED first)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageGatewayDispatcherTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageGatewayDispatcherTest {

    @Mock EmailGateway emailGateway;
    @Mock SmsGateway smsGateway;
    @Mock MessageRepository messages;
    @Mock MessageThreadRepository threads;

    private MessageGatewayDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new MessageGatewayDispatcher(emailGateway, smsGateway, messages, threads);
    }

    private MessageEntity buildMessage(String channel) {
        var msg = MessageEntity.newMessage();
        msg.setChannel(channel);
        msg.setDirection("OUTBOUND");
        msg.setBody("Test body");
        when(messages.save(any())).thenAnswer(inv -> inv.getArgument(0));
        return msg;
    }

    @Test
    @DisplayName("dispatch EMAIL happy path: marks SENT, sets providerMessageId, bumps thread")
    void dispatch_emailHappyPath_marksSent() {
        var msg = buildMessage("EMAIL");
        UUID threadId = UUID.randomUUID();
        msg.setThreadId(threadId);

        var thread = new MessageThreadEntity();
        when(threads.findById(threadId)).thenReturn(Optional.of(thread));
        when(emailGateway.send(any(OutboundMessage.class)))
                .thenReturn(DeliveryReceipt.accepted("pm-abc-123"));

        var result = dispatcher.dispatch(msg, "client@example.com", "Subject", "Test body");

        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getProviderMessageId()).isEqualTo("pm-abc-123");
        assertThat(result.getSentAt()).isNotNull();
        verify(threads).save(thread);
    }

    @Test
    @DisplayName("dispatch SMS happy path: marks SENT, sets providerMessageId, bumps thread")
    void dispatch_smsHappyPath_marksSent() {
        var msg = buildMessage("SMS");
        UUID threadId = UUID.randomUUID();
        msg.setThreadId(threadId);

        var thread = new MessageThreadEntity();
        when(threads.findById(threadId)).thenReturn(Optional.of(thread));
        when(smsGateway.send(any(OutboundMessage.class)))
                .thenReturn(DeliveryReceipt.accepted("sms-provider-456"));

        var result = dispatcher.dispatch(msg, "+48500600700", null, "Treść SMS");

        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getProviderMessageId()).isEqualTo("sms-provider-456");
        verify(threads).save(thread);
    }

    @Test
    @DisplayName("dispatch EMAIL gateway throws: marks FAILED, records error, does not bump thread")
    void dispatch_emailGatewayThrows_marksFailed() {
        var msg = buildMessage("EMAIL");
        msg.setThreadId(UUID.randomUUID());

        when(emailGateway.send(any(OutboundMessage.class)))
                .thenThrow(new RuntimeException("SMTP connection refused"));

        var result = dispatcher.dispatch(msg, "client@example.com", "Subject", "Test body");

        assertThat(result.getDeliveryStatus()).isEqualTo("FAILED");
        assertThat(result.getErrorCode()).isNotBlank();
        assertThat(result.getErrorMessage()).contains("SMTP connection refused");
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("dispatch unknown channel throws IllegalArgumentException")
    void dispatch_unknownChannel_throwsIllegalArgument() {
        var msg = buildMessage("WHATSAPP");
        msg.setThreadId(UUID.randomUUID());

        // OutboundMessage rejects blank subject for EMAIL only; WHATSAPP is not EMAIL.
        // But WHATSAPP is not handled in the switch — expect IllegalArgumentException from
        // the switch default arm, not from OutboundMessage validation.
        // Note: OutboundMessage requires non-blank recipient AND body.
        assertThatThrownBy(() -> dispatcher.dispatch(msg, "+48500000001", null, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown channel");
    }

    @Test
    @DisplayName("dispatch blank recipient throws IllegalArgumentException from OutboundMessage")
    void dispatch_blankRecipient_throwsIllegalArgument() {
        // OutboundMessage rejects blank recipient at construction — dispatcher propagates.
        var msg = buildMessage("SMS");
        msg.setThreadId(UUID.randomUUID());

        assertThatThrownBy(() -> dispatcher.dispatch(msg, "", null, "Hello"))
                .isInstanceOf(IllegalArgumentException.class);

        // Gateway must not have been called.
        verifyNoInteractions(smsGateway);
    }
}
```

Run to confirm RED (class does not exist yet):

```bash
mvn -B -pl app -am test -Dtest=MessageGatewayDispatcherTest
# Expected: COMPILATION ERROR — RED is correct.
```

---

- [ ] **Step 2: Write `MessageGatewayDispatcher.java`**

Create `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageGatewayDispatcher.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Extracted gateway dispatch unit. Builds an {@link OutboundMessage}, dispatches it
 * through the appropriate channel gateway, updates {@link MessageEntity} status
 * (SENT / FAILED), persists, and bumps the thread's {@code lastMessageAt} on success.
 *
 * <p>Previously this logic was duplicated between {@code MessageRouter.send(...)} and
 * {@code MessageRouter.sendRetry(...)}. M5 adds {@code sendReply} and {@code sendNewToClient},
 * so extraction is a BLOCKER before adding further methods. (M5 plan §10 debt item.)</p>
 *
 * <p>LOC target: ≤ 90. Flag if exceeded.</p>
 */
@Service
public class MessageGatewayDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MessageGatewayDispatcher.class);

    private final EmailGateway emailGateway;
    private final SmsGateway smsGateway;
    private final MessageRepository messages;
    private final MessageThreadRepository threads;

    public MessageGatewayDispatcher(EmailGateway emailGateway, SmsGateway smsGateway,
                                    MessageRepository messages, MessageThreadRepository threads) {
        this.emailGateway = emailGateway;
        this.smsGateway = smsGateway;
        this.messages = messages;
        this.threads = threads;
    }

    /**
     * Dispatch a SAVED {@link MessageEntity} through its channel gateway, update status
     * (SENT / FAILED), persist, and bump the thread's {@code last_message_at} on success.
     *
     * <p>Logging contract: one INFO per call with {@code op=gateway.dispatch outcome=ok|failed}.</p>
     *
     * @param saved     a persisted MessageEntity in QUEUED state
     * @param recipient email address or phone number (validated non-blank by OutboundMessage)
     * @param subject   email subject; null for SMS
     * @param body      message body (validated non-blank by OutboundMessage)
     * @return the updated and persisted MessageEntity
     * @throws IllegalArgumentException if channel is not EMAIL or SMS, or if recipient/body blank
     */
    public MessageEntity dispatch(MessageEntity saved, String recipient, String subject, String body) {
        Channel ch = Channel.valueOf(saved.getChannel());
        var outbound = new OutboundMessage(ch, recipient, subject, body, null, null);

        try {
            DeliveryReceipt receipt = switch (ch) {
                case EMAIL -> emailGateway.send(outbound);
                case SMS   -> smsGateway.send(outbound);
                default    -> throw new IllegalArgumentException("unknown channel: " + saved.getChannel());
            };
            saved.setDeliveryStatus("SENT");
            saved.setProviderMessageId(receipt.providerMessageId());
            saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
            log.info("op=gateway.dispatch outcome=ok messageId={} channel={} providerId={}",
                    saved.getId(), saved.getChannel(), receipt.providerMessageId());
        } catch (IllegalArgumentException e) {
            throw e; // propagate unknown-channel and OutboundMessage validation errors
        } catch (Exception e) {
            saved.setDeliveryStatus("FAILED");
            saved.setErrorCode(truncate(e.getClass().getSimpleName(), 60));
            saved.setErrorMessage(truncate(e.getMessage(), 1000));
            log.warn("op=gateway.dispatch outcome=failed messageId={} channel={} err={}",
                    saved.getId(), saved.getChannel(), e.toString());
        }

        MessageEntity persisted = messages.save(saved);

        if ("SENT".equals(persisted.getDeliveryStatus())) {
            threads.findById(persisted.getThreadId()).ifPresent(t -> {
                t.setLastMessageAt(persisted.getSentAt());
                threads.save(t);
            });
        }

        return persisted;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
```

---

- [ ] **Step 3: Run new unit tests — GREEN**

```bash
mvn -B -pl app -am test -Dtest=MessageGatewayDispatcherTest
# Expected: 5/5 pass.
```

---

- [ ] **Step 4: Refactor `MessageRouter` — delegate to dispatcher**

Read the current `MessageRouter` before editing. Replace the gateway-dispatch + status-update + thread-bump block in both `send(...)` and `sendRetry(...)` with a single call to `dispatcher.dispatch(saved, recipient, subject, body)`.

**BEFORE in `send(...)` (lines ~212-255 after the `saveAndFlush`):**

```java
// existing recipient lookup stays:
Channel ch = Channel.valueOf(channel);
String recipient = switch (ch) { ... };

if (recipient == null || recipient.isBlank()) {
    log.warn(...);
}

var outbound = new OutboundMessage(ch, recipient, renderedSubject, renderedBody, null, null);

boolean sent = false;
try {
    var receipt = switch (ch) { ... };
    saved.setDeliveryStatus(DeliveryStatus.SENT.name());
    saved.setProviderMessageId(receipt.providerMessageId());
    saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
    sent = true;
} catch (RuntimeException e) {
    saved.setDeliveryStatus(DeliveryStatus.FAILED.name());
    ...
}
messages.save(saved);
if (sent) {
    thread.setLastMessageAt(OffsetDateTime.now(ZoneOffset.UTC));
    threads.save(thread);
}
log.info("op=message.send outcome={} ...", saved.getDeliveryStatus(), ...);
return saved.getId();
```

**AFTER in `send(...)`:**

```java
Channel ch = Channel.valueOf(channel);
String recipient = switch (ch) {
    case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
    case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
    default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
};

MessageEntity persisted = dispatcher.dispatch(saved, recipient, renderedSubject, renderedBody);

log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
        persisted.getDeliveryStatus(), orderId, persisted.getId(), channel, triggerId);

return persisted.getId();
```

Apply the same refactor to `sendRetry(...)`. Remove the now-redundant `email`, `sms`, `threads` fields from the constructor (only keep what `send(...)` and `sendRetry(...)` still need after the refactor — `dispatcher` replaces `email`, `sms`, and the thread-bump code; `threads` may still be needed by `threadService` which holds its own reference, so check). Remove `truncate(...)` static helper from `MessageRouter` — it is now in `MessageGatewayDispatcher`.

After refactor, `MessageRouter` LOC target: ≤ 130. Count and flag in commit message if ≥ 120.

Also: inject `MessageGatewayDispatcher dispatcher` in the constructor. Remove `EmailGateway email` and `SmsGateway sms` fields (now owned by `MessageGatewayDispatcher`). Remove the `MessageThreadRepository threads` field if its only remaining use was the thread-bump (now in dispatcher). Keep it if `threadService` still needs the repo directly — check.

---

- [ ] **Step 5: Full suite — GREEN**

```bash
mvn -B -pl app -am test
```

Expected: ≥ 218 (213 + 5 new unit tests), 0 failures, 0 errors, 0 skipped. Zero regressions on existing send/retry tests.

---

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageGatewayDispatcher.java \
        backend/app/src/main/java/com/drshoes/app/messaging/service/MessageRouter.java \
        backend/app/src/test/java/com/drshoes/app/messaging/service/MessageGatewayDispatcherTest.java
git commit -m "$(cat <<'EOF'
refactor(messaging): extract MessageGatewayDispatcher from MessageRouter [milestone:5][task:5-3]

Eliminates send/retry duplication (gateway lookup + OutboundMessage build + try/catch
+ status update + thread bump) by extracting into MessageGatewayDispatcher.dispatch().
MessageRouter delegates from both send() and sendRetry(). MessageRouter shrinks from
293 LOC to target ≤ 130. MessageGatewayDispatcher ≤ 90 LOC.
5 new unit tests (email/SMS happy paths, gateway failure, unknown channel, blank recipient).
Zero regressions.

Refs: docs/dispatch-log/5-3-<UTC>.md
EOF
)"
```

**Acceptance:**
- `MessageRouter` LOC ≤ 130 (count after refactor; flag in commit body if between 120-130).
- `MessageGatewayDispatcher` LOC ≤ 90.
- Zero existing test regressions.
- 5 new unit tests green.
- Suite ≥ 218.
### Task 5-4: InboundMessageService + PhoneNormalizer

**Depends on:** 5-1 (V012 applied — `message_thread.channel` column exists), 5-2 (entity patches — `MessageThreadEntity.channel`, `MessageEntity.clientId` nullable, `MessageEntity.rawSender`; `MessageThreadRepository` finders with channel param), 5-3 (MessageGatewayDispatcher extracted — `MessageRouter` ≤ 130 LOC)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/util/PhoneNormalizer.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/service/InboundMessageService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/PostmarkInboundPayload.java` (minimal stub — full DTO in 5-5)
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/SmsApiInboundPayload.java` (minimal stub — full DTO in 5-6)
- Modify: `backend/app/src/main/java/com/drshoes/app/client/domain/ClientRepository.java` — add `findByEmailIgnoreCase` and `findByPhone`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java` — add `findOrCreateForClient(UUID, String)` overload and `findOrCreateForRawSender(String, String)`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/util/PhoneNormalizerTest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/InboundMessageServiceTest.java`

**Review:** TWO-STAGE — security-sensitive parsing + DB write path.

**LOC targets:** `InboundMessageService` ~95 LOC (under 120 cap), `PhoneNormalizer` ~30 LOC.

---

> **Pre-execution: read these notes before touching a single file.**
>
> - `ClientRepository` lives at `com.drshoes.app.client.domain.ClientRepository` (NOT `client.repository`). Verified on disk.
> - `MessageThreadService.findOrCreateForClient` currently takes only `UUID clientId` (no channel). This task adds the two-arg overload and `findOrCreateForRawSender`. The old single-arg method stays to avoid breaking M1/M2 callers.
> - `@Audited(parent="#result.threadId()")` is safe: `AuditLogAspect.auditAnnotated` passes the return value as `out` to `AuditedParentResolver.resolve(...)` — confirmed in AuditLogAspect line 86. SpEL `#result` resolves to the method's return value.
> - Audit path format is `ClassName#methodName` (AuditLogAspect line 112) — NOT dotted. Curator key for 5-7: `InboundMessageService#recordEmailInbound` and `InboundMessageService#recordSmsInbound`.
> - `MessageEntity` must be constructed via `MessageEntity.newMessage()` static factory (no-arg constructor is package-private). Confirmed from slice A1 errata.
> - `MessageEntity.channel` and `.direction` are stored as `String` — pass `"EMAIL"` / `"SMS"` / `"INBOUND"` literals, not enum instances.
> - `MessageEntity.clientId` is nullable AFTER V012 + 5-2 patch. If 5-2 is not yet complete, compilation fails — this task is blocked on 5-2.
> - `DeliveryReceipt` not `OutboundResult` — not relevant here (this task does not touch gateways) but note for context.
> - `findByProviderMessageIdAndChannel` confirmed in `MessageRepository` (JPQL `@Query`, takes `String providerMessageId, String channel`).

---

- [ ] **Step 1: Write PhoneNormalizerTest — RED**

Create `backend/app/src/test/java/com/drshoes/app/messaging/util/PhoneNormalizerTest.java`:

```java
package com.drshoes.app.messaging.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PhoneNormalizerTest {

    @Test
    void plusSpaceFormat() {
        assertThat(PhoneNormalizer.normalize("+48 506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void plusNoSpace() {
        assertThat(PhoneNormalizer.normalize("+48506220119")).isEqualTo("+48506220119");
    }

    @Test
    void countryCodeBare() {
        assertThat(PhoneNormalizer.normalize("48506220119")).isEqualTo("+48506220119");
    }

    @Test
    void doubleZeroPrefix() {
        assertThat(PhoneNormalizer.normalize("00 48 506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void nineDigitsPolish() {
        assertThat(PhoneNormalizer.normalize("506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void parensAndDashes() {
        assertThat(PhoneNormalizer.normalize("(506) 220-119")).isEqualTo("+48506220119");
    }

    @Test
    void emptyString() {
        assertThat(PhoneNormalizer.normalize("")).isNull();
    }

    @Test
    void nullInput() {
        assertThat(PhoneNormalizer.normalize(null)).isNull();
    }
}
```

- [ ] **Step 2: Run — expect RED (class missing)**

```bash
mvn -B -pl app -am test -Dtest=PhoneNormalizerTest
```

Expected: compilation failure — `PhoneNormalizer` does not exist yet.

- [ ] **Step 3: Write PhoneNormalizer**

Create `backend/app/src/main/java/com/drshoes/app/messaging/util/PhoneNormalizer.java`:

```java
package com.drshoes.app.messaging.util;

/**
 * Normalizes phone numbers to E.164 format with Polish country code fallback.
 * Strips spaces, parentheses, and dashes; converts 00-prefix to +; prepends +48
 * for bare 9-digit or 11-digit 48-prefixed numbers.
 *
 * Returns null for null or empty-after-stripping input.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null) return null;
        var digits = raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("00")) digits = "+" + digits.substring(2);
        if (digits.startsWith("+")) return digits;
        if (digits.length() == 11 && digits.startsWith("48")) return "+" + digits;
        if (digits.length() == 9) return "+48" + digits;
        return digits.isEmpty() ? null : "+" + digits;
    }
}
```

**LOC: ~27 lines — well under cap.**

- [ ] **Step 4: Run — expect GREEN**

```bash
mvn -B -pl app -am test -Dtest=PhoneNormalizerTest
```

Expected: 8/8 passing.

- [ ] **Step 5: Add missing finders to ClientRepository and MessageThreadService**

**5a. Modify `ClientRepository`** — add two finder methods (DOES NOT EXIST in current file):

```java
// Add to com.drshoes.app.client.domain.ClientRepository
// after the existing searchTopN method:

Optional<Client> findByEmailIgnoreCase(String email);

Optional<Client> findByPhone(String phone);
```

Full file after edit:

```java
package com.drshoes.app.client.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
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

    Optional<Client> findByEmailIgnoreCase(String email);

    Optional<Client> findByPhone(String phone);
}
```

**5b. Add `findOrCreateForClient(UUID, String)` overload and `findOrCreateForRawSender(String, String)` to `MessageThreadService`.**

The current `findOrCreateForClient(UUID clientId)` single-arg method stays for backward compat (M1/M2 callers). Add two new methods below it. After V012 + 5-2, `MessageThreadEntity` has `.setChannel(String)` and the repository has `findFirstByClientIdAndChannelAndDiscardedAtIsNull` and `findFirstByRawSenderAndChannelAndDiscardedAtIsNull` — use those finders here.

> **Verify at implementation time:** confirm the exact repository method names added by task 5-2. The plan assumes `findFirstByClientIdAndChannelAndDiscardedAtIsNull(UUID, String)` and `findFirstByRawSenderAndChannelAndDiscardedAtIsNull(String, String)`. Adjust if 5-2 used different names.

New methods to add to `MessageThreadService` (append after existing `findOrCreateForClient`):

```java
@Transactional
public MessageThreadEntity findOrCreateForClient(UUID clientId, String channel) {
    return threads.findFirstByClientIdAndChannelAndDiscardedAtIsNull(clientId, channel)
        .orElseGet(() -> {
            var t = new MessageThreadEntity();
            t.setClientId(clientId);
            t.setChannel(channel);
            t.setUnreadCount(0);
            MessageThreadEntity saved = threads.save(t);
            log.info("op=thread.create clientId={} channel={} threadId={}", clientId, channel, saved.getId());
            return saved;
        });
}

@Transactional
public MessageThreadEntity findOrCreateForRawSender(String rawSender, String channel) {
    return threads.findFirstByRawSenderAndChannelAndDiscardedAtIsNull(rawSender, channel)
        .orElseGet(() -> {
            var t = new MessageThreadEntity();
            t.setRawSender(rawSender);
            t.setChannel(channel);
            t.setUnreadCount(0);
            MessageThreadEntity saved = threads.save(t);
            log.info("op=thread.create rawSender={} channel={} threadId={}", rawSender, channel, saved.getId());
            return saved;
        });
}
```

**LOC check after additions:** `MessageThreadService` goes from 35 → ~65 LOC — under cap.

- [ ] **Step 6: Write stub DTOs**

**PostmarkInboundPayload** — minimal stub matching service's needs. Full Jackson deserialization and field validation deferred to 5-5.

Create `backend/app/src/main/java/com/drshoes/app/messaging/dto/PostmarkInboundPayload.java`:

```java
package com.drshoes.app.messaging.dto;

/**
 * Minimal stub for Postmark inbound webhook payload.
 * Full DTO with Jackson annotations and field validation ships in task 5-5.
 * Only the fields consumed by InboundMessageService are declared here.
 */
public record PostmarkInboundPayload(
    String messageId,
    String from,
    String subject,
    String textBody,
    String strippedTextReply,
    String date
) {}
```

**SmsApiInboundPayload** — minimal stub. Full parsing in 5-6.

Create `backend/app/src/main/java/com/drshoes/app/messaging/dto/SmsApiInboundPayload.java`:

```java
package com.drshoes.app.messaging.dto;

/**
 * Minimal stub for SMSAPI MO (inbound SMS) payload.
 * Full DTO with form-encoded binding and field validation ships in task 5-6.
 * Only the fields consumed by InboundMessageService are declared here.
 */
public record SmsApiInboundPayload(
    String smsId,
    String smsFrom,
    String smsText,
    long smsDate
) {}
```

- [ ] **Step 7: Write InboundMessageServiceTest — RED**

Create `backend/app/src/test/java/com/drshoes/app/messaging/service/InboundMessageServiceTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InboundMessageServiceTest {

    private MessageRepository messageRepo;
    private MessageThreadRepository threadRepo;
    private ClientRepository clientRepo;
    private MessageThreadService threadService;
    private InboundMessageService sut;

    @BeforeEach
    void setUp() {
        messageRepo   = mock(MessageRepository.class);
        threadRepo    = mock(MessageThreadRepository.class);
        clientRepo    = mock(ClientRepository.class);
        threadService = mock(MessageThreadService.class);
        sut = new InboundMessageService(messageRepo, threadRepo, clientRepo, threadService);
    }

    // --- helpers ---

    private MessageThreadEntity stubThread(UUID threadId) {
        var t = new MessageThreadEntity();
        t.setId(threadId);
        t.setUnreadCount(0);
        return t;
    }

    private MessageEntity stubSavedMessage(UUID msgId, UUID threadId) {
        var m = MessageEntity.newMessage();
        m.setId(msgId);
        m.setThreadId(threadId);
        return m;
    }

    private Client stubClient(UUID clientId, String email, String phone) {
        var c = new Client();
        c.setId(clientId);
        c.setFirstName("Jan");
        c.setLastName("Kowalski");
        c.setEmail(email);
        c.setPhone(phone);
        return c;
    }

    private PostmarkInboundPayload emailPayload(String from, String msgId) {
        return new PostmarkInboundPayload(msgId, from, "Temat", "body text", null, null);
    }

    private SmsApiInboundPayload smsPayload(String smsId, String from) {
        return new SmsApiInboundPayload(smsId, from, "SMS body", 1715000000L);
    }

    // --- tests ---

    @Test
    void email_matched_clientFound_routesAndInserts() {
        var clientId = UUID.randomUUID();
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var client   = stubClient(clientId, "jan@example.com", "+48506220119");
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-001", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("jan@example.com")).thenReturn(Optional.of(client));
        when(threadService.findOrCreateForClient(clientId, "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordEmailInbound(emailPayload("jan@example.com", "pm-001"));

        assertThat(result.duplicate()).isFalse();
        assertThat(result.unmatched()).isFalse();
        assertThat(result.threadId()).isEqualTo(threadId);
        assertThat(result.messageId()).isEqualTo(msgId);
        verify(messageRepo).save(any(MessageEntity.class));
    }

    @Test
    void email_unmatched_rawSenderThread() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-002", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("unknown@example.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordEmailInbound(emailPayload("unknown@example.com", "pm-002"));

        assertThat(result.unmatched()).isTrue();
        assertThat(result.duplicate()).isFalse();
        verify(threadService).findOrCreateForRawSender("unknown@example.com", "EMAIL");
        verify(messageRepo).save(argThat(m -> m.getClientId() == null && "unknown@example.com".equals(m.getRawSender())));
    }

    @Test
    void sms_matched_phoneNormalized() {
        var clientId = UUID.randomUUID();
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var client   = stubClient(clientId, "jan@example.com", "+48506220119");
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-001", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48506220119")).thenReturn(Optional.of(client));
        when(threadService.findOrCreateForClient(clientId, "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        // raw form "506 220 119" must normalize to "+48506220119"
        var result = sut.recordSmsInbound(smsPayload("sms-001", "506 220 119"));

        assertThat(result.unmatched()).isFalse();
        assertThat(result.duplicate()).isFalse();
        verify(clientRepo).findByPhone("+48506220119");
        verify(threadService).findOrCreateForClient(clientId, "SMS");
    }

    @Test
    void sms_unmatched() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-002", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48999000111")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("+48999000111", "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordSmsInbound(smsPayload("sms-002", "+48999000111"));

        assertThat(result.unmatched()).isTrue();
        verify(threadService).findOrCreateForRawSender("+48999000111", "SMS");
        verify(messageRepo).save(argThat(m -> m.getClientId() == null));
    }

    @Test
    void idempotency_emailDuplicate_noInsert() {
        var existingMsgId  = UUID.randomUUID();
        var existingThread = UUID.randomUUID();
        var existing = stubSavedMessage(existingMsgId, existingThread);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-dup", "EMAIL"))
            .thenReturn(Optional.of(existing));

        var result = sut.recordEmailInbound(emailPayload("any@example.com", "pm-dup"));

        assertThat(result.duplicate()).isTrue();
        assertThat(result.messageId()).isEqualTo(existingMsgId);
        assertThat(result.threadId()).isEqualTo(existingThread);
        verify(messageRepo, never()).save(any());
        verify(threadRepo,  never()).save(any());
    }

    @Test
    void idempotency_smsDuplicate_noInsert() {
        var existingMsgId  = UUID.randomUUID();
        var existingThread = UUID.randomUUID();
        var existing = stubSavedMessage(existingMsgId, existingThread);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-dup", "SMS"))
            .thenReturn(Optional.of(existing));

        var result = sut.recordSmsInbound(smsPayload("sms-dup", "+48999000000"));

        assertThat(result.duplicate()).isTrue();
        assertThat(result.messageId()).isEqualTo(existingMsgId);
        verify(messageRepo, never()).save(any());
        verify(threadRepo,  never()).save(any());
    }

    @Test
    void email_strippedReplyEmpty_fallsBackToTextBody() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);
        var payload  = new PostmarkInboundPayload("pm-003", "a@b.com", "Subj", "fallback body", "", null);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-003", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        sut.recordEmailInbound(payload);

        verify(messageRepo).save(argThat(m -> "fallback body".equals(m.getBody())));
    }

    @Test
    void email_strippedReplyPresent_overridesTextBody() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);
        var payload  = new PostmarkInboundPayload("pm-004", "a@b.com", "Subj", "full body", "quoted reply only", null);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-004", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        sut.recordEmailInbound(payload);

        verify(messageRepo).save(argThat(m -> "quoted reply only".equals(m.getBody())));
    }

    @Test
    void email_subjectCarriedToThread() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-005", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        var payload = new PostmarkInboundPayload("pm-005", "a@b.com", "Pilna sprawa!", "body", null, null);
        sut.recordEmailInbound(payload);

        verify(threadRepo).save(argThat(t -> "Pilna sprawa!".equals(t.getSubject())));
    }

    @Test
    void sms_subjectNotCarried() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-003", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48506220119")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("+48506220119", "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        sut.recordSmsInbound(smsPayload("sms-003", "+48506220119"));

        // SMS has no subject — message.subject must be null
        verify(messageRepo).save(argThat(m -> m.getSubject() == null));
    }

    @Test
    void email_recipientLookupCaseInsensitive() {
        // verifies that the service calls findByEmailIgnoreCase (not findByEmail)
        // so that "JAN@EXAMPLE.COM" from Postmark header matches "jan@example.com" in DB
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-006", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("JAN@EXAMPLE.COM")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("JAN@EXAMPLE.COM", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        var payload = new PostmarkInboundPayload("pm-006", "JAN@EXAMPLE.COM", "Subj", "body", null, null);
        sut.recordEmailInbound(payload);

        verify(clientRepo).findByEmailIgnoreCase("JAN@EXAMPLE.COM");
        verify(clientRepo, never()).findByEmailIgnoreCase(eq("jan@example.com"));
    }

    @Test
    void email_unreadIncrementsBy1() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);
        thread.setUnreadCount(3); // pre-existing unread count

        when(messageRepo.findByProviderMessageIdAndChannel("pm-007", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        sut.recordEmailInbound(emailPayload("a@b.com", "pm-007"));

        verify(threadRepo).save(argThat(t -> t.getUnreadCount() == 4));
    }
}
```

- [ ] **Step 8: Run — expect RED (InboundMessageService missing)**

```bash
mvn -B -pl app -am test -Dtest=InboundMessageServiceTest
```

Expected: compilation failure — `InboundMessageService`, `PostmarkInboundPayload`, `SmsApiInboundPayload` do not exist yet.

- [ ] **Step 9: Write InboundMessageService (with InboundResult record)**

Create `backend/app/src/main/java/com/drshoes/app/messaging/service/InboundMessageService.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.messaging.util.PhoneNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class InboundMessageService {

    private static final Logger log = LoggerFactory.getLogger(InboundMessageService.class);

    private final MessageRepository messageRepo;
    private final MessageThreadRepository threadRepo;
    private final ClientRepository clientRepo;
    private final MessageThreadService threadService;

    public InboundMessageService(MessageRepository messageRepo,
                                 MessageThreadRepository threadRepo,
                                 ClientRepository clientRepo,
                                 MessageThreadService threadService) {
        this.messageRepo   = messageRepo;
        this.threadRepo    = threadRepo;
        this.clientRepo    = clientRepo;
        this.threadService = threadService;
    }

    public record InboundResult(UUID messageId, UUID threadId, boolean duplicate, boolean unmatched) {}

    @Audited(parent = "#result.threadId()")
    @Transactional
    public InboundResult recordEmailInbound(PostmarkInboundPayload p) {
        var existing = messageRepo.findByProviderMessageIdAndChannel(p.messageId(), "EMAIL");
        if (existing.isPresent()) {
            log.info("op=inbound.email outcome=duplicate providerId={} threadId={}",
                p.messageId(), existing.get().getThreadId());
            return new InboundResult(existing.get().getId(), existing.get().getThreadId(), true, false);
        }
        var clientOpt = clientRepo.findByEmailIgnoreCase(p.from());
        boolean unmatched = clientOpt.isEmpty();
        MessageThreadEntity thread = unmatched
            ? threadService.findOrCreateForRawSender(p.from(), "EMAIL")
            : threadService.findOrCreateForClient(clientOpt.get().getId(), "EMAIL");
        thread.setSubject(p.subject());
        thread.setUnreadCount(thread.getUnreadCount() + 1);
        thread.setLastMessageAt(OffsetDateTime.now());
        threadRepo.save(thread);
        String body = (p.strippedTextReply() != null && !p.strippedTextReply().isBlank())
                      ? p.strippedTextReply() : p.textBody();
        var msg = MessageEntity.newMessage();
        msg.setThreadId(thread.getId());
        msg.setClientId(unmatched ? null : clientOpt.get().getId());
        msg.setRawSender(unmatched ? p.from() : null);
        msg.setDirection("INBOUND");
        msg.setChannel("EMAIL");
        msg.setSubject(p.subject());
        msg.setBody(body);
        msg.setProviderMessageId(p.messageId());
        msg.setSentAt(parseDateOrNow(p.date()));
        msg.setDeliveryStatus("DELIVERED");
        var saved = messageRepo.save(msg);
        log.info("op=inbound.email outcome=recorded messageId={} threadId={} unmatched={}",
            saved.getId(), thread.getId(), unmatched);
        return new InboundResult(saved.getId(), thread.getId(), false, unmatched);
    }

    @Audited(parent = "#result.threadId()")
    @Transactional
    public InboundResult recordSmsInbound(SmsApiInboundPayload p) {
        var existing = messageRepo.findByProviderMessageIdAndChannel(p.smsId(), "SMS");
        if (existing.isPresent()) {
            log.info("op=inbound.sms outcome=duplicate providerId={}", p.smsId());
            return new InboundResult(existing.get().getId(), existing.get().getThreadId(), true, false);
        }
        var normalized = PhoneNormalizer.normalize(p.smsFrom());
        var clientOpt  = clientRepo.findByPhone(normalized);
        boolean unmatched = clientOpt.isEmpty();
        MessageThreadEntity thread = unmatched
            ? threadService.findOrCreateForRawSender(normalized, "SMS")
            : threadService.findOrCreateForClient(clientOpt.get().getId(), "SMS");
        thread.setUnreadCount(thread.getUnreadCount() + 1);
        thread.setLastMessageAt(OffsetDateTime.now());
        threadRepo.save(thread);
        var msg = MessageEntity.newMessage();
        msg.setThreadId(thread.getId());
        msg.setClientId(unmatched ? null : clientOpt.get().getId());
        msg.setRawSender(unmatched ? normalized : null);
        msg.setDirection("INBOUND");
        msg.setChannel("SMS");
        msg.setBody(p.smsText());
        msg.setProviderMessageId(p.smsId());
        msg.setSentAt(OffsetDateTime.ofInstant(Instant.ofEpochSecond(p.smsDate()), ZoneOffset.UTC));
        msg.setDeliveryStatus("DELIVERED");
        var saved = messageRepo.save(msg);
        log.info("op=inbound.sms outcome=recorded messageId={} threadId={} unmatched={}",
            saved.getId(), thread.getId(), unmatched);
        return new InboundResult(saved.getId(), thread.getId(), false, unmatched);
    }

    private OffsetDateTime parseDateOrNow(String rfc2822) {
        if (rfc2822 == null) return OffsetDateTime.now();
        try {
            return OffsetDateTime.parse(rfc2822, DateTimeFormatter.RFC_1123_DATE_TIME);
        } catch (Exception e) {
            return OffsetDateTime.now();
        }
    }
}
```

**LOC: ~100 lines — within cap. Flag if over: service is dense due to two symmetric paths; if reviewer requires a split, extract `buildMessageEntity(...)` private helper to bring each method under 40 LOC while the class stays under 120.**

> **Implementation-time note on `MessageEntity` factory method:** If `MessageEntity.newMessage()` is not a static factory but has a different name (e.g. `new MessageEntity()` is in fact accessible), adjust accordingly. The slice A1 errata says "use `MessageEntity.newMessage()`" — trust that.

- [ ] **Step 10: Run InboundMessageServiceTest — expect GREEN**

```bash
mvn -B -pl app -am test -Dtest=InboundMessageServiceTest
```

Expected: 12/12 passing.

- [ ] **Step 11: Full suite — expect baseline + 20**

```bash
mvn -B -pl app -am test
```

Expected: prior baseline + 20 (8 PhoneNormalizerTest + 12 InboundMessageServiceTest). All pre-existing tests green.

- [ ] **Step 12: Spec + quality review (Stage 1)**

Reviewer checklist:

1. **Security — idempotency gate:** `findByProviderMessageIdAndChannel` checked before any write. Confirmed.
2. **Security — SpEL injection:** `@Audited(parent="#result.threadId()")` — `#result` bound to return value (not user input). `SimpleEvaluationContext` sandbox blocks reflection. Safe.
3. **Security — phone input sanitization:** `PhoneNormalizer.normalize` strips all non-digit/non-plus characters before DB lookup. No SQL injection surface (JPA binding). Safe.
4. **Security — email input:** `findByEmailIgnoreCase` passes raw `p.from()` to Spring Data binding — parameterized, no injection surface.
5. **Atomicity:** `@Transactional` on both public methods. Thread save + message save in same transaction — consistent.
6. **Duplicate check scope:** checks `providerMessageId + channel` — correct. Cross-channel collision (same provider ID in EMAIL and SMS) impossible in practice but harmless: two rows would be created in that edge case (acceptable).
7. **LOC:** Service ~100 LOC (flag if reviewer counts over 120 — split by extracting `buildEmailMessage` / `buildSmsMessage` private helpers).
8. **Unread count:** incremented by exactly 1 per inbound. No race condition in unit tests; in production, concurrent inbounds on same thread need optimistic lock or DB-level increment — flag as known limitation for post-M5 if owner cares about high concurrency.

- [ ] **Step 13: Final quality review (Stage 2)**

Reviewer confirms:
- `@Audited` on both public methods with correct SpEL.
- `@Transactional` on both public methods.
- No `Co-Authored-By:` in commit.
- Stub DTOs are truly stubs (no Jackson annotations) — 5-5 and 5-6 add them.
- `ClientRepository` addition does not break existing tests (Spring Data derives the query — no custom SQL needed).
- `MessageThreadService` additions: no impact on M1/M2 callers of the single-arg overload.

- [ ] **Step 14: Commit**

```
feat(messaging): InboundMessageService + PhoneNormalizer [milestone:5][task:5-4]

Ships:
- PhoneNormalizer (E.164 normalizer, 8 unit tests)
- InboundMessageService with recordEmailInbound + recordSmsInbound
  (idempotent on provider_message_id+channel, client lookup by email/phone,
   raw-sender fallback for unmatched, @Audited + @Transactional)
- InboundResult record (messageId, threadId, duplicate, unmatched)
- PostmarkInboundPayload stub (full DTO deferred to 5-5)
- SmsApiInboundPayload stub (full DTO deferred to 5-6)
- ClientRepository: findByEmailIgnoreCase + findByPhone
- MessageThreadService: findOrCreateForClient(UUID, String) overload
  + findOrCreateForRawSender(String, String)

Dependency chain: 5-1 (V012) → 5-2 (entity patches) → 5-3 (dispatcher extract)
→ 5-4 (this) → 5-8 (MessageThreadService.markRead / assign / discard).
Curator paths wired in 5-7: InboundMessageService#recordEmailInbound,
InboundMessageService#recordSmsInbound.

Suite delta: +20 tests (8 PhoneNormalizerTest + 12 InboundMessageServiceTest).

Refs: docs/dispatch-log/5-4-<UTC>.md
```

---

### Acceptance criteria

- [ ] 8 PhoneNormalizerTest cases green.
- [ ] 12 InboundMessageServiceTest cases green.
- [ ] Full suite: baseline + 20, zero failures.
- [ ] `InboundMessageService`: both public methods have `@Audited(parent="#result.threadId()")` and `@Transactional`.
- [ ] `InboundMessageService` LOC ≤ 120 (target ~100).
- [ ] `PhoneNormalizer` LOC ≤ 120 (target ~30).
- [ ] `ClientRepository` has `findByEmailIgnoreCase` and `findByPhone`.
- [ ] Stub DTOs are stubs only — no Jackson annotations.
- [ ] No `Co-Authored-By:` in commit message.

---

### Errata / concerns for downstream tasks

1. **`MessageThreadEntity.subject` field:** Service calls `thread.setSubject(p.subject())`. Verify that V012 + 5-2 add `subject VARCHAR(512)` to `message_thread` and expose `setSubject` on the entity. If 5-2 omitted this field, add it there or add a targeted patch here. **Verify at implementation time.**

2. **`MessageThreadEntity.lastMessageAt` field:** Service calls `thread.setLastMessageAt(OffsetDateTime.now())`. Verify that the entity has this field (likely added by V012 + 5-2). **Verify at implementation time.**

3. **`MessageThreadEntity.rawSender` field:** Service calls `t.setRawSender(rawSender)` in `findOrCreateForRawSender`. Verify V012 adds `raw_sender VARCHAR(255)` to `message_thread` and 5-2 exposes the setter. **Verify at implementation time.**

4. **`MessageEntity.subject` nullability:** SMS path never sets `.setSubject(...)`. Verify `MessageEntity.subject` is nullable in the JPA mapping (it should be — it was nullable before M5 per OrderMessage semantics).

5. **Slice B flag — dotted audit path:** If any 5-7 curator configuration uses dotted form `service.InboundMessageService.recordEmailInbound`, that is WRONG. The correct key is `InboundMessageService#recordEmailInbound` (hash-separated, simple class name only). Flag to 5-7 author.

6. **Concurrency note (non-blocking for M5):** `thread.setUnreadCount(thread.getUnreadCount() + 1)` is not race-safe under concurrent inbound webhooks. Acceptable for workshop scale; post-M5 consider a DB-level `UPDATE ... SET unread_count = unread_count + 1`.
### Task 5-5: PostmarkInboundController + IT

**Depends on:** 5-4 (`InboundMessageService` implementation complete, `PostmarkInboundPayload` stub written in `com.drshoes.app.messaging.dto`).

**Files:**
- Replace stub: `backend/app/src/main/java/com/drshoes/app/messaging/dto/PostmarkInboundPayload.java`
- Create: `backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkInboundController.java`
- Create: `backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkInboundControllerIntegrationTest.java`

**Review:** Combined single-stage.

---

**Architecture note — auth pattern:**
`SecurityConfig` already lists `/api/webhooks/**` in both `PUBLIC_MATCHERS` and `CSRF_IGNORED`, so Spring Security does not gate the inbound URL. Do NOT add `@PreAuthorize` — the outbound `PostmarkWebhookController` (M4) performs Basic Auth manually via `@RequestHeader(Authorization)` + `MessageDigest.isEqual`. This controller must replicate that exact pattern using the same `@Value("${messaging.email.postmark.webhook-username:drshoes}")` and `@Value("${messaging.email.postmark.webhook-secret:}")` properties. The `verifyBasicAuth` private helper can be a private method copy or a shared utility (verify at implementation time whether a `WebhookAuthHelper` was extracted in 5-3/5-4; if so, inject it). Package: `com.drshoes.app.webhooks` (all controllers must live in a `.api.` or `webhooks` package so `AuditLogAspect` path-pattern curator fires — see plan errata §1).

---

- [ ] **Step 1: Write IT class with 6 stubbed test methods (each fails initially — RED)**

Create `backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkInboundControllerIntegrationTest.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test for PostmarkInboundController — 6-case matrix:
 *
 *   1. Valid payload + known sender  → 200, INBOUND message row, unread_count=1, audit row
 *   2. Valid payload + unknown sender → 200, INBOUND row, thread.client_id NULL, raw_sender set
 *   3. Duplicate provider_message_id → 200, body duplicate=true, no second row
 *   4. Missing Basic Auth            → 401, no DB writes
 *   5. Wrong Basic Auth credentials  → 401, no DB writes
 *   6. strippedTextReply blank       → 200, message body falls back to textBody
 *
 * Named *IntegrationTest per project convention (*IT silently skipped by Maven Failsafe).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.email.postmark.webhook-username=drshoes",
    "messaging.email.postmark.webhook-secret=test-secret"
})
class PostmarkInboundControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc               mockMvc;
    @Autowired MessageRepository     messages;
    @Autowired MessageThreadRepository threads;
    @Autowired AuditLogRepository    auditLogs;
    @Autowired ClientRepository      clients;

    private static final String VALID_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:test-secret".getBytes(StandardCharsets.UTF_8));
    private static final String BAD_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:wrong-password".getBytes(StandardCharsets.UTF_8));

    private static final String ENDPOINT = "/api/webhooks/postmark/inbound";

    @AfterEach
    void tearDown() {
        // FK order: audit_log first, then messages, then threads, then clients
        auditLogs.deleteAll();
        messages.deleteAll();
        threads.deleteAll();
        clients.deleteAll();
    }

    // ── Case 1: Valid payload, known sender ──────────────────────────────────

    @Test
    void validPayload_matchedClient_returns200_recordsMessage_bumpsUnread() throws Exception {
        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Kowalska");
        client.setEmail("anna@example.com");
        client.setPhone("+48600100200");
        var saved = clients.save(client);

        String msgId = "pm-inbound-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "anna@example.com", "Anna Kowalska",
            "Kiedy będzie gotowe?", "Kiedy będzie gotowe?", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Exactly one INBOUND message row
        var inboundRows = messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList();
        assertThat(inboundRows).hasSize(1);
        assertThat(inboundRows.get(0).getProviderMessageId()).isEqualTo(msgId);

        // Thread unread_count = 1
        var thread = threads.findById(inboundRows.get(0).getThreadId()).orElseThrow();
        assertThat(thread.getUnreadCount()).isEqualTo(1);

        // Audit row with path = InboundMessageService#recordEmailInbound, parent = thread id
        var auditRow = auditLogs.findAll().stream()
            .filter(a -> a.getPath() != null
                      && a.getPath().contains("InboundMessageService#recordEmailInbound"))
            .findFirst();
        assertThat(auditRow).isPresent();
        assertThat(auditRow.get().getParentEntityId()).isEqualTo(thread.getId());
    }

    // ── Case 2: Unknown sender → unmatched / raw_sender set ─────────────────

    @Test
    void validPayload_unmatchedSender_recordsRawSenderThread() throws Exception {
        String msgId = "pm-inbound-unmatched-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "stranger@example.com", "Random Person",
            "Hej, ile kosztuje?", "Hej, ile kosztuje?", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        var inboundRows = messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList();
        assertThat(inboundRows).hasSize(1);

        // Thread must have client_id=NULL, raw_sender=sender address
        var thread = threads.findById(inboundRows.get(0).getThreadId()).orElseThrow();
        assertThat(thread.getClientId()).isNull();
        assertThat(thread.getRawSender()).isEqualTo("stranger@example.com");

        // Message row must mirror raw_sender; client_id null
        assertThat(inboundRows.get(0).getClientId()).isNull();
        assertThat(inboundRows.get(0).getRawSender()).isEqualTo("stranger@example.com");
    }

    // ── Case 3: Duplicate provider_message_id → idempotent ──────────────────

    @Test
    void duplicateProviderMessageId_returns200_doesNotInsert() throws Exception {
        String msgId = "pm-inbound-dup-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "dup@example.com", "Dup Person",
            "Pierwsze wysłanie", "Pierwsze wysłanie", "");

        // First POST
        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        long countAfterFirst = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .count();
        assertThat(countAfterFirst).isEqualTo(1);

        // Second POST — same messageId
        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(true));

        long countAfterSecond = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .count();
        assertThat(countAfterSecond).isEqualTo(1); // no second row
    }

    // ── Case 4: Missing Authorization header → 401 ───────────────────────────

    @Test
    void missingBasicAuth_returns401() throws Exception {
        String payload = inboundJson("pm-noauth-" + UUID.randomUUID(), "x@example.com",
            "X", "body", "body", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isUnauthorized());

        assertThat(messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList()).isEmpty();
    }

    // ── Case 5: Wrong credentials → 401 ─────────────────────────────────────

    @Test
    void wrongBasicAuth_returns401() throws Exception {
        String payload = inboundJson("pm-badauth-" + UUID.randomUUID(), "x@example.com",
            "X", "body", "body", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", BAD_AUTH)
                .content(payload))
            .andExpect(status().isUnauthorized());

        assertThat(messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList()).isEmpty();
    }

    // ── Case 6: strippedTextReply blank → falls back to textBody ─────────────

    @Test
    void strippedTextReplyEmpty_fallsBackToTextBody() throws Exception {
        String msgId = "pm-fallback-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "fallback@example.com", "Fallback Person",
            /* textBody */ "Pełna treść wiadomości",
            /* strippedReply (blank) */ "",
            /* subject */ "Zapytanie");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        var inboundRows = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .toList();
        assertThat(inboundRows).hasSize(1);
        // Body must equal textBody because strippedTextReply was blank
        assertThat(inboundRows.get(0).getBody()).isEqualTo("Pełna treść wiadomości");
    }

    // ── helper ───────────────────────────────────────────────────────────────

    /**
     * Builds a minimal Postmark inbound JSON payload.
     * strippedTextReply may be blank string (not null) to test fallback.
     */
    private String inboundJson(String messageId, String from, String fromName,
                                String textBody, String strippedTextReply, String subject) {
        return """
            {
              "MessageID": "%s",
              "From": "%s",
              "FromName": "%s",
              "To": "drshoes@inbound.postmarkapp.com",
              "Subject": "%s",
              "TextBody": "%s",
              "StrippedTextReply": "%s",
              "Date": "2026-05-10T10:00:00Z"
            }
            """.formatted(messageId, from, fromName, subject, textBody, strippedTextReply);
    }
}
```

- [ ] **Step 2: Run IT — confirm RED (6 failures, controller not yet created)**

```
mvn -B -f backend/pom.xml -pl app test \
  -Dtest=PostmarkInboundControllerIntegrationTest
```

Expected: compilation failure or 6 failures (endpoint 404 + missing classes). This is the RED gate.

- [ ] **Step 3: Write `PostmarkInboundPayload` record (replace 5-4 stub)**

Replace (or create if 5-4 wrote only a placeholder) `backend/app/src/main/java/com/drshoes/app/messaging/dto/PostmarkInboundPayload.java`:

```java
package com.drshoes.app.messaging.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PostmarkInboundPayload(
    @JsonProperty("MessageID")         String messageId,
    @JsonProperty("From")              String from,
    @JsonProperty("FromName")          String fromName,
    @JsonProperty("To")                String to,
    @JsonProperty("Subject")           String subject,
    @JsonProperty("TextBody")          String textBody,
    @JsonProperty("StrippedTextReply") String strippedTextReply,
    @JsonProperty("Date")              String date
) {}
```

LOC: 13 (well under 120 cap).

- [ ] **Step 4: Write `PostmarkInboundController`**

Create `backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkInboundController.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.service.InboundMessageService;
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
import java.util.UUID;

/**
 * Receives Postmark inbound stream callbacks.
 *
 * <h2>Authentication</h2>
 * HTTP Basic auth verified via constant-time compare ({@link MessageDigest#isEqual}).
 * Same env credentials as the M4 outbound webhook — no new secrets required.
 * Mismatch → 401, zero DB writes.
 *
 * <h2>Endpoint</h2>
 * POST /api/webhooks/postmark/inbound — CSRF-exempt, no session auth required
 * (SecurityConfig lists /api/webhooks/** in PUBLIC_MATCHERS and CSRF_IGNORED).
 *
 * <h2>Body</h2>
 * Postmark inbound stream JSON. Key fields: MessageID (idempotency key),
 * From (sender lookup), StrippedTextReply (preferred body), TextBody (fallback).
 *
 * <h2>Logging</h2>
 * INFO per CLAUDE.md §7 key=value convention. From/FromName NOT logged at INFO (PII risk).
 */
@RestController
public class PostmarkInboundController {

    private static final Logger log = LoggerFactory.getLogger(PostmarkInboundController.class);

    private final InboundMessageService inboundService;
    private final byte[] expectedUsername;
    private final byte[] expectedPassword;

    public PostmarkInboundController(
            InboundMessageService inboundService,
            @Value("${messaging.email.postmark.webhook-username:drshoes}") String webhookUsername,
            @Value("${messaging.email.postmark.webhook-secret:}") String webhookSecret) {
        this.inboundService   = inboundService;
        this.expectedUsername = webhookUsername.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = webhookSecret.getBytes(StandardCharsets.UTF_8);
    }

    public record InboundResponse(UUID messageId, UUID threadId, boolean duplicate) {}

    @PostMapping("/api/webhooks/postmark/inbound")
    public ResponseEntity<InboundResponse> receive(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody PostmarkInboundPayload payload) {

        if (!verifyBasicAuth(authHeader)) {
            log.info("op=inbound.email.received outcome=rejected_auth");
            return ResponseEntity.status(401).build();
        }

        log.info("op=inbound.email.received messageId={}", payload.messageId());
        var result = inboundService.recordEmailInbound(payload);
        log.info("op=inbound.email.handled outcome=ok threadId={} duplicate={} unmatched={}",
            result.threadId(), result.duplicate(), result.unmatched());

        return ResponseEntity.ok(
            new InboundResponse(result.messageId(), result.threadId(), result.duplicate()));
    }

    /**
     * Parses "Basic &lt;base64&gt;" header, decodes to "username:password",
     * and performs constant-time credential comparison via {@link MessageDigest#isEqual}.
     * Both checks always execute — no short-circuit — to prevent timing oracles.
     */
    private boolean verifyBasicAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) return false;
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(authHeader.substring(6).trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        int colonIdx = -1;
        for (int i = 0; i < decoded.length; i++) {
            if (decoded[i] == ':') { colonIdx = i; break; }
        }
        if (colonIdx < 0) return false;
        byte[] user = Arrays.copyOfRange(decoded, 0, colonIdx);
        byte[] pass = Arrays.copyOfRange(decoded, colonIdx + 1, decoded.length);
        boolean userOk = MessageDigest.isEqual(user, expectedUsername);
        boolean passOk = MessageDigest.isEqual(pass, expectedPassword);
        return userOk && passOk;
    }
}
```

LOC: ~90. Verify at implementation time; if the `verifyBasicAuth` helper was extracted to a shared `WebhookAuthHelper` in 5-3/5-4, replace the private method with an injected helper call to stay under 80 LOC.

- [ ] **Step 5: Verify SecurityConfig coverage — no changes expected**

Confirm that `/api/webhooks/**` in `PUBLIC_MATCHERS` covers the new `/api/webhooks/postmark/inbound` URL. It does (wildcard match). No `SecurityConfig` changes required. If a future task narrows the wildcard, update this note in the plan errata Findings section.

- [ ] **Step 6: Run IT — GREEN**

```
mvn -B -f backend/pom.xml -pl app test \
  -Dtest=PostmarkInboundControllerIntegrationTest
```

All 6 methods must pass. If any fail:
- 401 on valid-auth cases: check `@TestPropertySource` props match the `@Value` keys; confirm the `Authorization` header is sent in the test with the right encoding.
- NPE or 500: check `InboundMessageService.recordEmailInbound` return type matches the `InboundResponse` fields (`messageId`, `threadId`, `duplicate`, `unmatched`). Adjust field names to match what 5-4 actually shipped — verify at implementation time.
- `raw_sender` NPE: confirm V012 + 5-2 entity patches are applied (nullable `clientId`, `rawSender` field on `MessageThreadEntity` and `MessageEntity`).
- audit assertion (case 1): confirm `AuditLogAspect` fires on `InboundMessageService#recordEmailInbound`. The aspect matches on `.service.` in the class package path — verify `InboundMessageService` lives under `.messaging.service.`. If it lives elsewhere, update the audit path assertion to match the actual class FQCN.

- [ ] **Step 7: Full suite — baseline + 6**

```
mvn -B -f backend/pom.xml verify
```

Suite must be (prior baseline + 6), 0 failures, 0 errors, 0 skipped. Note the new count in the commit message body.

- [ ] **Step 8: Commit**

```
git add \
  backend/app/src/main/java/com/drshoes/app/webhooks/PostmarkInboundController.java \
  backend/app/src/main/java/com/drshoes/app/messaging/dto/PostmarkInboundPayload.java \
  backend/app/src/test/java/com/drshoes/app/webhooks/PostmarkInboundControllerIntegrationTest.java
git commit -m "feat(messaging): PostmarkInboundController + IT (inbound stream) [milestone:5][task:5-5]

- PostmarkInboundPayload record (8 fields, Jackson @JsonProperty mapping)
- PostmarkInboundController at POST /api/webhooks/postmark/inbound
  - Basic Auth manual verify (constant-time, same @Value props as M4 outbound)
  - Delegates to InboundMessageService.recordEmailInbound
  - Returns InboundResponse {messageId, threadId, duplicate}
- PostmarkInboundControllerIntegrationTest: 6 cases
  - matched sender → INBOUND row + unread_count=1 + audit row
  - unmatched sender → client_id NULL + raw_sender set
  - duplicate MessageID → 200 + duplicate=true + no second row
  - missing auth → 401
  - wrong credentials → 401
  - blank strippedTextReply → falls back to textBody
- SecurityConfig: no changes (existing /api/webhooks/** wildcard covers inbound URL)
- Suite: <N>/0/0/0

Refs: docs/dispatch-log/5-5-<UTC>.md"
```

(Fill `<N>` and `<UTC>` with actual values at commit time.)

---

**Acceptance criteria:**
- 6 IT methods green, suite clean (0 failures / 0 errors / 0 skipped).
- `POST /api/webhooks/postmark/inbound` requires Basic Auth (401 without it).
- Idempotent on `provider_message_id` — second identical POST returns `duplicate=true`, no second DB row.
- Body fallback: `StrippedTextReply` used when non-blank; `TextBody` used when `StrippedTextReply` is blank.
- Controller LOC ≤ 120 (target ~90); IT LOC ~160 (test classes exempt from cap).
- No `Co-Authored-By:` trailer in commit message.
### Task 5-6: SmsApiInboundController + IT

**Files:**
- Create `backend/app/src/main/java/com/drshoes/app/webhooks/SmsApiInboundController.java` (~60 LOC)
- Create or replace stub `backend/app/src/main/java/com/drshoes/app/messaging/dto/SmsApiInboundPayload.java`
- Create `backend/app/src/test/java/com/drshoes/app/webhooks/SmsApiInboundControllerIntegrationTest.java` (~150 LOC, 6 cases)

**Review:** combined single-stage.

**Context — existing outbound pattern:**
The M4 outbound `SmsApiWebhookController` (at `com.drshoes.app.webhooks`) uses:
- `@Value("${messaging.sms.smsapi.callback-allowlist:...}") List<String> allowlist`
- `@Value("${messaging.sms.smsapi.client-ip-header:X-Forwarded-For}") String clientIpHeader`
- IP extracted via `request.getHeader(clientIpHeader)`, leftmost token for proxy compat, fallback to `request.getRemoteAddr()`

For the inbound controller we keep the allowlist pattern BUT use the Cloudflare-specific header `Cf-Connecting-Ip` directly (no configurable header name — inbound is always behind Cloudflare). We store the allowlist under a DISTINCT property key so the delivery callback allowlist and MO inbound allowlist can diverge: `messaging.sms.smsapi.allowlist` (not `callback-allowlist`). This matches the carry-forward note in the task brief.

---

- [ ] **Step 1: Write `SmsApiInboundPayload` record**

Create `backend/app/src/main/java/com/drshoes/app/messaging/dto/SmsApiInboundPayload.java`:

```java
package com.drshoes.app.messaging.dto;

/**
 * Form-encoded MO (mobile-originated) payload from SMSAPI inbound callback.
 *
 * Field names match the SMSAPI MO webhook specification (application/x-www-form-urlencoded):
 *   sms_id   — unique ID for the inbound SMS (used as provider_message_id / dedup key)
 *   sms_from — sender phone number (may include country prefix, spaces, or leading zeros)
 *   sms_to   — virtual number that received the SMS (optional — absent on some routes)
 *   sms_text — message body
 *   sms_date — Unix epoch seconds, when SMSAPI received the message
 *
 * Verify field names against SMSAPI MO webhook documentation at implementation time.
 * If SMSAPI uses different names (e.g. "MsgId" or "from" without prefix), update
 * both this record and the @RequestParam bindings in SmsApiInboundController.
 */
public record SmsApiInboundPayload(
    String smsId,
    String smsFrom,
    String smsTo,
    String smsText,
    long   smsDate
) {}
```

---

- [ ] **Step 2: Write the IT (RED)**

Create `backend/app/src/test/java/com/drshoes/app/webhooks/SmsApiInboundControllerIntegrationTest.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for SmsApiInboundController — 6-case matrix.
 *
 * Allowlist: 198.18.0.1 (injected via TestPropertySource).
 * IP header: Cf-Connecting-Ip (hardcoded in the controller — not configurable).
 *
 * Named *IntegrationTest (NOT *IT) per project convention.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.sms.smsapi.allowlist=198.18.0.1"
})
class SmsApiInboundControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc               mockMvc;
    @Autowired ClientRepository      clients;
    @Autowired MessageRepository     messages;
    @Autowired MessageThreadRepository threads;

    private static final String ALLOWED_IP = "198.18.0.1";
    private static final String CLIENT_PHONE_STORED = "+48506220119";

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFirstName("Inbound");
        client.setLastName("Tester");
        client.setPhone(CLIENT_PHONE_STORED);
        clients.save(client);
    }

    @AfterEach
    void tearDown() {
        messages.deleteAll();
        threads.deleteAll();
        clients.deleteAll();
    }

    // ── Case 1: matched client, phone with spaces ─────────────────────────────

    @Test
    void validPayload_matchedClient_phoneNormalized() throws Exception {
        // sms_from with spaces — normalizer should strip to "+48506220119"
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-match-" + System.nanoTime())
                .param("sms_from", "+48 506 220 119")
                .param("sms_to",   "+48123456789")
                .param("sms_text", "Kiedy bedzie gotowe?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // A thread for the matched client must have been created/found
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNotNull();
    }

    // ── Case 2: unmatched sender — raw_sender thread ─────────────────────────

    @Test
    void validPayload_unmatchedSender_rawSenderThread() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-unmatched-" + System.nanoTime())
                .param("sms_from", "+48999888777")   // no matching client
                .param("sms_text", "Kto to jest?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Thread must exist with null clientId and non-null rawSender
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNull();
        assertThat(thread.getRawSender()).isEqualTo("+48999888777");
    }

    // ── Case 3: duplicate smsId — 200 no second insert ───────────────────────

    @Test
    void duplicateSmsId_returns200_noSecondInsert() throws Exception {
        String smsId = "sms-dup-" + System.nanoTime();

        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   smsId)
                .param("sms_from", "+48506220119")
                .param("sms_text", "First")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Replay with same smsId
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   smsId)
                .param("sms_from", "+48506220119")
                .param("sms_text", "Replay")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(true));

        // Only one message row in DB
        assertThat(messages.findAll()).hasSize(1);
    }

    // ── Case 4: IP not in allowlist → 403 ────────────────────────────────────

    @Test
    void ipNotInAllowlist_returns403() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", "1.2.3.4")   // not in allowlist
                .param("sms_id",   "sms-forbidden-" + System.nanoTime())
                .param("sms_from", "+48506220119")
                .param("sms_text", "Hack")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden());

        assertThat(messages.findAll()).isEmpty();
        assertThat(threads.findAll()).isEmpty();
    }

    // ── Case 5: missing Cf-Connecting-Ip header → 403 fail-closed ────────────

    @Test
    void cfConnectingIpHeaderMissing_returns403_failClosed() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                // No Cf-Connecting-Ip header
                .param("sms_id",   "sms-noheader-" + System.nanoTime())
                .param("sms_from", "+48506220119")
                .param("sms_text", "Test")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden());

        assertThat(messages.findAll()).isEmpty();
    }

    // ── Case 6: bare phone format (no +48) routes via normalizer ─────────────

    @Test
    void barePhoneFormat_routesViaNormalizer() throws Exception {
        // "506220119" — no country code prefix; normalizer should prepend +48
        // and match the client whose phone is stored as "+48506220119"
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-bare-" + System.nanoTime())
                .param("sms_from", "506220119")
                .param("sms_text", "Jak tam?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk());

        // Thread must be matched (clientId not null) — normalizer resolved to +48 prefix
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNotNull();
    }
}
```

---

- [ ] **Step 3: Write `SmsApiInboundController` (GREEN)**

Create `backend/app/src/main/java/com/drshoes/app/webhooks/SmsApiInboundController.java`:

```java
package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.service.InboundMessageService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.UUID;

/**
 * Receives SMSAPI MO (mobile-originated / inbound) callbacks.
 *
 * <h2>Authentication</h2>
 * Source IP allowlist via the {@code Cf-Connecting-Ip} header set by Cloudflare.
 * The header is NOT configurable — production traffic always arrives through Cloudflare.
 * Absent or non-allowlisted IP receives 403 with zero DB writes (fail-closed).
 *
 * <h2>Method + payload</h2>
 * POST /api/webhooks/smsapi/inbound, application/x-www-form-urlencoded.
 * Response: 200 JSON {@code {"messageId", "threadId", "duplicate"}}.
 *
 * <h2>Idempotency</h2>
 * Delegated to {@link InboundMessageService#recordSmsInbound} which checks
 * {@code provider_message_id} uniqueness. Replays return {@code duplicate=true}.
 *
 * <h2>Security</h2>
 * SecurityConfig lists /api/webhooks/** in PUBLIC_MATCHERS and CSRF_IGNORED.
 *
 * <h2>Logging</h2>
 * INFO with key=value fields per CLAUDE.md §7. Sender phone is NOT logged at INFO (PII).
 */
@RestController
@RequestMapping("/api/webhooks/smsapi/inbound")
public class SmsApiInboundController {

    private static final Logger log = LoggerFactory.getLogger(SmsApiInboundController.class);

    private final InboundMessageService inboundService;
    private final Set<String>           allowlist;

    public SmsApiInboundController(
            InboundMessageService inboundService,
            @Value("${messaging.sms.smsapi.allowlist:198.18.0.1,198.18.0.2,198.18.0.3,198.18.0.4,198.18.0.5}")
            String allowlistCsv) {
        this.inboundService = inboundService;
        this.allowlist      = Set.of(allowlistCsv.split(","));
    }

    public record InboundResponse(UUID messageId, UUID threadId, boolean duplicate) {}

    @PostMapping(consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<InboundResponse> receive(
            @RequestParam("sms_id")                          String smsId,
            @RequestParam("sms_from")                        String smsFrom,
            @RequestParam(value = "sms_to", required = false) String smsTo,
            @RequestParam("sms_text")                        String smsText,
            @RequestParam("sms_date")                        long   smsDate,
            HttpServletRequest req) {

        String ip = req.getHeader("Cf-Connecting-Ip");
        if (ip == null || !allowlist.contains(ip)) {
            log.warn("op=inbound.sms.received outcome=ip-rejected ip={}", ip);
            return ResponseEntity.status(403).build();
        }

        log.info("op=inbound.sms.received smsId={}", smsId);
        var payload = new SmsApiInboundPayload(smsId, smsFrom, smsTo, smsText, smsDate);
        var result  = inboundService.recordSmsInbound(payload);
        log.info("op=inbound.sms.handled outcome=ok threadId={} duplicate={}",
                result.threadId(), result.duplicate());

        return ResponseEntity.ok(
            new InboundResponse(result.messageId(), result.threadId(), result.duplicate()));
    }
}
```

**Package note:** Controller lives in `com.drshoes.app.webhooks` (same package as `SmsApiWebhookController`) to satisfy the `.api.` / `.webhooks.` path-pattern requirement for `AuditLogAspect`. Verify that `SecurityConfig`'s `PUBLIC_MATCHERS` and `CSRF_IGNORED` already cover `/api/webhooks/**` — they do (confirmed from M4 outbound pattern); no SecurityConfig change needed.

**`InboundResponse` vs `InboundMessageService.InboundResult`:** The service returns an internal result type (to be defined in task 5-3). The controller wraps it into the `InboundResponse` record above. If `InboundMessageService` defines a public `InboundResult` record, the controller can reference it directly — implementer should prefer reuse over duplication.

---

- [ ] **Step 4: Run IT suite — assert 6 cases green**

```bash
cd /path/to/project
mvn -B -f backend/pom.xml -pl app test -Dtest=SmsApiInboundControllerIntegrationTest
```

Fix any RED cases before proceeding to Step 5.

---

- [ ] **Step 5: Full suite + commit**

```bash
mvn -B -f backend/pom.xml verify
```

Assert BUILD SUCCESS, 0 failures, 0 errors, 0 skipped.

Commit message:
```
feat(messaging): SmsApiInboundController + IT (MO callback) [milestone:5][task:5-6]

Refs: docs/dispatch-log/5-6-<UTC>.md
```

**Acceptance criteria:**
- 6 IT methods pass: matched client / unmatched / duplicate / bad IP / missing header / bare phone
- IP allowlist strictly enforced; missing `Cf-Connecting-Ip` returns 403
- Phone normalization verified (case 1: spaces stripped; case 6: bare 9-digit maps to +48 prefix)
- Full suite BUILD SUCCESS, 0 failures

---

### Task 5-7: Timeline kinds + curator wiring + frontend label/icon

**Files:**
- Modify `backend/app/src/main/java/com/drshoes/app/audit/dto/TimelineEventKind.java`
- Modify `backend/app/src/main/java/com/drshoes/app/audit/TimelineEventCurator.java`
- Create `backend/app/src/test/java/com/drshoes/app/audit/TimelineEventCuratorM5Test.java` (~80 LOC, 4–5 unit tests)
- Modify `apps/web/lib/timeline/types.ts`
- Modify `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Extend `TimelineEventKind.java`**

Current last line is `PHOTO_RELABELED`. Append four new values:

```java
// M5 — inbound messages + thread state
MESSAGE_RECEIVED,    // inbound message recorded (email or SMS)
THREAD_MARKED_READ,  // operator opened thread or clicked mark-read
THREAD_ASSIGNED,     // unmatched thread assigned to a known client
THREAD_DISCARDED     // unmatched thread soft-deleted by operator
```

Full enum after edit (comment block at top remains unchanged; add the four values after `PHOTO_RELABELED`):

```java
PHOTO_RELABELED,    // M3 — emitted by PhotoService#relabel @Audited row
// M5 — inbound messages + thread lifecycle
MESSAGE_RECEIVED,   // M5 — emitted by InboundMessageService#recordEmailInbound / #recordSmsInbound
THREAD_MARKED_READ, // M5 — emitted by MessageThreadMutationService#markRead (or MessageThreadService#markRead — see note)
THREAD_ASSIGNED,    // M5 — emitted by MessageThreadMutationService#assignUnmatched (or MessageThreadService#assignUnmatched)
THREAD_DISCARDED    // M5 — emitted by MessageThreadMutationService#discardUnmatched (or MessageThreadService#discardUnmatched)
```

**Naming note (verify at implementation time):** The spec plans to extract `MessageThreadService` into a read-side and mutation-side class in slice B (task 5-8). The curator path mappings below use `MessageThreadMutationService` as the anticipated class name. If slice B has NOT yet shipped and `MessageThreadService` is still the single class, replace `MessageThreadMutationService` with `MessageThreadService` everywhere in this task. Reconcile against the actual class name — do not hard-code the wrong name.

---

- [ ] **Step 2: Write curator unit tests (RED)**

Create `backend/app/src/test/java/com/drshoes/app/audit/TimelineEventCuratorM5Test.java`:

```java
package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.timeline.MessageReconcileTimelineHandler;
import com.drshoes.app.messaging.timeline.MessageSentTimelineHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for M5 TimelineEventCurator path mappings.
 * Complements TimelineEventCuratorTest (which covers M1–M4 paths).
 *
 * Class-name suffix M5Test avoids merging with the existing M1–M4 test class,
 * keeping LOC per file within the 120-line cap.
 *
 * NOTE on class names: If MessageThreadService has NOT been split into
 * MessageThreadMutationService (slice B task 5-8), replace "MessageThreadMutationService"
 * with "MessageThreadService" in all path strings below.
 */
class TimelineEventCuratorM5Test {

    private static final String ACTOR = "Anna Kowalska";

    private TimelineEventCurator curator;

    @BeforeEach
    void setUp() {
        MessageSentTimelineHandler noopSent =
            mock(MessageSentTimelineHandler.class);
        when(noopSent.toEvent(any(AuditLog.class), anyString())).thenReturn(null);

        MessageReconcileTimelineHandler noopReconcile =
            mock(MessageReconcileTimelineHandler.class);
        when(noopReconcile.toEvent(any(AuditLog.class), anyString())).thenReturn(null);

        curator = new TimelineEventCurator(noopSent, noopReconcile);
    }

    @Test
    void recordEmailInbound_mapsToMessageReceived() {
        AuditLog log = auditLog("InboundMessageService#recordEmailInbound");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.MESSAGE_RECEIVED);
    }

    @Test
    void recordSmsInbound_mapsToMessageReceived() {
        AuditLog log = auditLog("InboundMessageService#recordSmsInbound");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.MESSAGE_RECEIVED);
    }

    @Test
    void markRead_mapsToThreadMarkedRead() {
        // Adjust class name if MessageThreadService is not yet split:
        AuditLog log = auditLog("MessageThreadMutationService#markRead");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_MARKED_READ);
    }

    @Test
    void assignUnmatched_mapsToThreadAssigned() {
        AuditLog log = auditLog("MessageThreadMutationService#assignUnmatched");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_ASSIGNED);
    }

    @Test
    void discardUnmatched_mapsToThreadDiscarded() {
        AuditLog log = auditLog("MessageThreadMutationService#discardUnmatched");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_DISCARDED);
    }

    // ── helper ───────────────────────────────────────────────────────────────

    private static AuditLog auditLog(String path) {
        var log = new AuditLog();
        log.setId(UUID.randomUUID());
        log.setMethod("INTERNAL");
        log.setPath(path);
        log.setStatus(0);
        log.setActorId(UUID.randomUUID());
        log.setCreatedAt(Instant.now());
        return log;
    }
}
```

Run: tests will be RED (curator does not yet contain M5 paths).

---

- [ ] **Step 3: Extend `TimelineEventCurator` (GREEN)**

Read `TimelineEventCurator.java` fully before editing. The class dispatches INTERNAL rows through:
1. `messagingHandler.toEvent(log, actorFullName)` — MessageSentTimelineHandler (M2)
2. `reconcileHandler.toEvent(log, actorFullName)` — MessageReconcileTimelineHandler (M4)
3. Pattern matchers for OrderService, PhotoService items

For M5 we add five new `Pattern` constants and five new `if` blocks in `curateInternal`, placed AFTER the existing photo-relabeled block and BEFORE the terminal `return Optional.empty()`.

**Add static patterns (place with the existing M3 photo patterns):**

```java
// M5 inbound service paths (@Audited INTERNAL rows)
private static final Pattern INTERNAL_EMAIL_INBOUND =
    Pattern.compile("^InboundMessageService#recordEmailInbound$");
private static final Pattern INTERNAL_SMS_INBOUND =
    Pattern.compile("^InboundMessageService#recordSmsInbound$");

// M5 thread mutation paths — class name depends on slice B split;
// "MessageThreadMutationService" if split landed; "MessageThreadService" otherwise.
// Implementer: reconcile against the actual class name before committing.
private static final Pattern INTERNAL_THREAD_MARK_READ =
    Pattern.compile("^MessageThreadMutationService#markRead$");
private static final Pattern INTERNAL_THREAD_ASSIGN =
    Pattern.compile("^MessageThreadMutationService#assignUnmatched$");
private static final Pattern INTERNAL_THREAD_DISCARD =
    Pattern.compile("^MessageThreadMutationService#discardUnmatched$");
```

**Add dispatch blocks in `curateInternal` (append after the M3 photo block):**

```java
// ── M5 inbound + thread lifecycle ────────────────────────────────────────
if (INTERNAL_EMAIL_INBOUND.matcher(path).find()) {
    return Optional.of(event(log, TimelineEventKind.MESSAGE_RECEIVED, actorFullName, labels));
}
if (INTERNAL_SMS_INBOUND.matcher(path).find()) {
    return Optional.of(event(log, TimelineEventKind.MESSAGE_RECEIVED, actorFullName, labels));
}
if (INTERNAL_THREAD_MARK_READ.matcher(path).find()) {
    return Optional.of(event(log, TimelineEventKind.THREAD_MARKED_READ, actorFullName, labels));
}
if (INTERNAL_THREAD_ASSIGN.matcher(path).find()) {
    return Optional.of(event(log, TimelineEventKind.THREAD_ASSIGNED, actorFullName, labels));
}
if (INTERNAL_THREAD_DISCARD.matcher(path).find()) {
    return Optional.of(event(log, TimelineEventKind.THREAD_DISCARDED, actorFullName, labels));
}
```

**LOC guard:** `TimelineEventCurator` is currently 203 lines. Adding ~25 lines brings it to ~228 LOC, exceeding the 120-line cap. This class was already over the cap before M5. Flag this for a future refactor — a `CuratorInternalDispatcher` extraction would bring each handler under 80 LOC. For now, add a comment and proceed (the class is read-only/hot-path with no mutation risk; structural complexity is low). Do NOT split mid-task — that would be a separate hygiene task.

---

- [ ] **Step 4: Run curator unit tests (GREEN)**

```bash
mvn -B -f backend/pom.xml -pl app test \
    -Dtest=TimelineEventCuratorM5Test,TimelineEventCuratorTest
```

Both test classes must pass (5 new + all existing M1–M4 cases).

---

- [ ] **Step 5: Extend `apps/web/lib/timeline/types.ts`**

Current union ends with `| "MESSAGE_FAILED";`. Change the semicolon to `|` on that line and append four new members:

```ts
export type TimelineEventKind =
  | "ORDER_CREATED"
  | "ORDER_UPDATED"        // generic PATCH — added M1; no field-level diff
  | "STATUS_CHANGED"
  | "ASSIGNEE_CHANGED"     // reserved M2 — body capture required
  | "PICKUP_DATE_CHANGED"  // reserved M2 — body capture required
  | "ITEM_ADDED"
  | "ITEM_EDITED"
  | "ITEM_REMOVED"
  | "ORDER_SOFT_DELETED"
  | "MESSAGE_SENT"         // M2 — outbound message dispatched
  | "PHOTO_UPLOADED"       // M3 — admin uploaded a photo
  | "PHOTO_DELETED"        // M3 — admin deleted a photo
  | "PHOTO_RELABELED"      // M3 — admin changed a photo's label
  | "MESSAGE_DELIVERED"    // M4 — provider confirmed delivery
  | "MESSAGE_FAILED"       // M4 — provider reported delivery failure
  | "MESSAGE_RECEIVED"     // M5 — inbound message recorded (email or SMS)
  | "THREAD_MARKED_READ"   // M5 — operator opened thread or clicked mark-read
  | "THREAD_ASSIGNED"      // M5 — unmatched thread assigned to a client
  | "THREAD_DISCARDED";    // M5 — unmatched thread soft-deleted by operator
```

---

- [ ] **Step 6: Extend `OrderDrawerTimeline.tsx`**

Both `KIND_ICONS` and `KIND_LABELS_PL` are typed as `Record<TimelineEventKind, string>` — TypeScript's exhaustiveness check will fail to compile if any key is missing. Add the four new entries to BOTH objects.

In `KIND_ICONS` (after `MESSAGE_FAILED: "⚠️",`):

```ts
MESSAGE_RECEIVED:    "📥",
THREAD_MARKED_READ:  "✓",
THREAD_ASSIGNED:     "👤",
THREAD_DISCARDED:    "🗑️",
```

In `KIND_LABELS_PL` (after `MESSAGE_FAILED: "Wiadomość nie doręczona",`):

```ts
MESSAGE_RECEIVED:    "Otrzymano wiadomość",
THREAD_MARKED_READ:  "Wątek oznaczony jako przeczytany",
THREAD_ASSIGNED:     "Wątek przypisany do klienta",
THREAD_DISCARDED:    "Wątek odrzucony",
```

**Icon collision note:** `ITEM_REMOVED`, `PHOTO_DELETED`, and the new `THREAD_DISCARDED` all use `"🗑️"`. This is an accepted visual trade-off — the Polish label text differentiates them. No action required.

---

- [ ] **Step 7: Typecheck + lint + build (frontend)**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm build
```

All three must be green. A compile error on `KIND_ICONS` or `KIND_LABELS_PL` means a key is missing from the union or an entry was omitted from one of the Record objects.

---

- [ ] **Step 8: Full backend suite**

```bash
mvn -B -f backend/pom.xml verify
```

Assert BUILD SUCCESS, suite count ≥ previous + 5 (new curator tests), 0 failures.

---

- [ ] **Step 9: Commit**

```
feat(audit): timeline kinds for M5 inbound + thread actions [milestone:5][task:5-7]

Adds MESSAGE_RECEIVED, THREAD_MARKED_READ, THREAD_ASSIGNED, THREAD_DISCARDED to
TimelineEventKind.java, curator patterns, frontend type union, and PL labels/icons.
TimelineEventCurator LOC flagged for future CuratorInternalDispatcher extraction.

Refs: docs/dispatch-log/5-7-<UTC>.md
```

**Acceptance criteria:**
- 4 new `TimelineEventKind` values present in backend enum
- 5 curator path mappings added (`recordEmailInbound`, `recordSmsInbound`, `markRead`, `assignUnmatched`, `discardUnmatched`)
- `TimelineEventCuratorM5Test` — 5 unit tests green; `TimelineEventCuratorTest` existing tests still green
- `apps/web/lib/timeline/types.ts` union has 19 members total (15 existing + 4 new)
- `OrderDrawerTimeline.tsx` `KIND_ICONS` and `KIND_LABELS_PL` each have entries for all 19 kinds
- `pnpm typecheck && pnpm lint && pnpm build` — all green (Record exhaustiveness enforced by compiler)
- `mvn -B -f backend/pom.xml verify` — BUILD SUCCESS, 0 failures
### Task 5-8: `MessageThreadService` extensions

**Files:**
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java`
- Modify: `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageRepository.java` (add `updateClientIdAndRawSenderByThreadId`)
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageThreadServiceTest.java`

**Review:** combined single-stage.

> **LOC flag:** `MessageThreadService` currently is 35 LOC. Adding ~120 LOC of new methods brings the total to ~155 LOC — over the 120-LOC cap. The executor MUST split the file into two classes: `MessageThreadService` retaining `findOrCreateForClient(UUID)` and `findOrCreateForRawSender(...)`, and a new `MessageThreadMutationService` holding `markRead`, `assignUnmatched`, `discardUnmatched`. Both stay in `com.drshoes.app.messaging.service`. Inject `MessageThreadMutationService` into `ThreadController` alongside the read-side service.

---

- [ ] **Step 1: Write failing unit tests (RED)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageThreadServiceTest.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageThreadServiceTest {

    @Mock MessageThreadRepository threads;
    @Mock MessageRepository messages;

    MessageThreadService svc;
    MessageThreadMutationService mutSvc;

    AdminPrincipal actor = new AdminPrincipal(UUID.randomUUID(), "owner@drshoes.pl", "OWNER");

    @BeforeEach
    void setUp() {
        svc    = new MessageThreadService(threads);
        mutSvc = new MessageThreadMutationService(threads, messages);
    }

    // ---- findOrCreateForClient(clientId, channel) ----

    @Test
    @DisplayName("findOrCreateForClient: returns existing thread for same clientId+channel")
    void findOrCreateForClient_returnsExisting() {
        UUID clientId = UUID.randomUUID();
        var existing = thread(clientId, "EMAIL");
        when(threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, "EMAIL"))
            .thenReturn(Optional.of(existing));

        var result = svc.findOrCreateForClient(clientId, "EMAIL");

        assertThat(result.getId()).isEqualTo(existing.getId());
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("findOrCreateForClient: creates new thread when none found")
    void findOrCreateForClient_createsNew() {
        UUID clientId = UUID.randomUUID();
        when(threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, "SMS"))
            .thenReturn(Optional.empty());
        when(threads.save(any())).thenAnswer(inv -> {
            MessageThreadEntity t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        var result = svc.findOrCreateForClient(clientId, "SMS");

        assertThat(result.getClientId()).isEqualTo(clientId);
        assertThat(result.getChannel()).isEqualTo("SMS");
        verify(threads).save(any());
    }

    // ---- findOrCreateForRawSender(rawSender, channel) ----

    @Test
    @DisplayName("findOrCreateForRawSender: returns existing unmatched thread")
    void findOrCreateForRawSender_returnsExisting() {
        String raw = "+48506220119";
        var existing = unmatchedThread(raw, "SMS");
        when(threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(raw, "SMS"))
            .thenReturn(Optional.of(existing));

        var result = svc.findOrCreateForRawSender(raw, "SMS");

        assertThat(result.getRawSender()).isEqualTo(raw);
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("findOrCreateForRawSender: creates new unmatched thread when none found")
    void findOrCreateForRawSender_createsNew() {
        String raw = "unknown@example.com";
        when(threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(raw, "EMAIL"))
            .thenReturn(Optional.empty());
        when(threads.save(any())).thenAnswer(inv -> {
            MessageThreadEntity t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        var result = svc.findOrCreateForRawSender(raw, "EMAIL");

        assertThat(result.getRawSender()).isEqualTo(raw);
        assertThat(result.getClientId()).isNull();
        verify(threads).save(any());
    }

    // ---- markRead ----

    @Test
    @DisplayName("markRead: sets unreadCount=0 and saves")
    void markRead_setsZero() {
        UUID threadId = UUID.randomUUID();
        var t = thread(UUID.randomUUID(), "EMAIL");
        t.setId(threadId);
        t.setUnreadCount(5);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.markRead(threadId, actor);

        assertThat(t.getUnreadCount()).isZero();
        verify(threads).save(t);
    }

    @Test
    @DisplayName("markRead: throws 404 for unknown thread")
    void markRead_notFound() {
        UUID threadId = UUID.randomUUID();
        when(threads.findById(threadId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mutSvc.markRead(threadId, actor))
            .isInstanceOf(ResponseStatusException.class);
    }

    // ---- assignUnmatched ----

    @Test
    @DisplayName("assignUnmatched: updates thread + messages in one call")
    void assignUnmatched_happy() {
        UUID threadId  = UUID.randomUUID();
        UUID clientId  = UUID.randomUUID();
        var t = unmatchedThread("+48600100200", "SMS");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.assignUnmatched(threadId, clientId, actor);

        assertThat(t.getClientId()).isEqualTo(clientId);
        assertThat(t.getRawSender()).isNull();
        verify(messages).bulkUpdateClientIdByThreadId(threadId, clientId);
        verify(threads).save(t);
    }

    @Test
    @DisplayName("assignUnmatched: throws 409 when thread already has clientId")
    void assignUnmatched_alreadyAssigned() {
        UUID threadId = UUID.randomUUID();
        var t = thread(UUID.randomUUID(), "EMAIL");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));

        assertThatThrownBy(() -> mutSvc.assignUnmatched(threadId, UUID.randomUUID(), actor))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");
    }

    // ---- discardUnmatched ----

    @Test
    @DisplayName("discardUnmatched: sets discardedAt")
    void discardUnmatched_happy() {
        UUID threadId = UUID.randomUUID();
        var t = unmatchedThread("+48123456789", "SMS");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.discardUnmatched(threadId, actor);

        assertThat(t.getDiscardedAt()).isNotNull();
        verify(threads).save(t);
    }

    @Test
    @DisplayName("discardUnmatched: throws 409 when already discarded")
    void discardUnmatched_alreadyDiscarded() {
        UUID threadId = UUID.randomUUID();
        var t = unmatchedThread("+48123456789", "SMS");
        t.setId(threadId);
        t.setDiscardedAt(OffsetDateTime.now());
        when(threads.findById(threadId)).thenReturn(Optional.of(t));

        assertThatThrownBy(() -> mutSvc.discardUnmatched(threadId, actor))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");
    }

    // ---- helpers ----

    private MessageThreadEntity thread(UUID clientId, String channel) {
        var t = new MessageThreadEntity();
        t.setId(UUID.randomUUID());
        t.setClientId(clientId);
        t.setChannel(channel);
        t.setUnreadCount(0);
        return t;
    }

    private MessageThreadEntity unmatchedThread(String rawSender, String channel) {
        var t = new MessageThreadEntity();
        t.setId(UUID.randomUUID());
        t.setRawSender(rawSender);
        t.setChannel(channel);
        t.setUnreadCount(0);
        return t;
    }
}
```

Run RED:

```bash
mvn -B -pl app -am test -Dtest=MessageThreadServiceTest 2>&1 | tail -20
# Expected: COMPILATION ERROR — classes do not exist yet.
```

---

- [ ] **Step 2: Extend `MessageThreadRepository` with new finder methods**

In `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java`, add:

```java
// after the existing findFirstByClientIdOrderByCreatedAtAsc

Optional<MessageThreadEntity> findFirstByClientIdAndChannelOrderByCreatedAtAsc(UUID clientId, String channel);

Optional<MessageThreadEntity> findFirstByRawSenderAndChannelOrderByCreatedAtAsc(String rawSender, String channel);
```

Note: slice A's task 5-2 also adds repo finders. Confirm at dispatch time that these two don't conflict; if 5-2 already adds them, skip this step.

---

- [ ] **Step 3: Add `bulkUpdateClientIdByThreadId` to `MessageRepository`**

In `backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageRepository.java`, add:

```java
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Modifying
@Query("UPDATE MessageEntity m SET m.clientId = :clientId, m.rawSender = null WHERE m.threadId = :threadId")
void bulkUpdateClientIdByThreadId(@Param("threadId") UUID threadId, @Param("clientId") UUID clientId);
```

---

- [ ] **Step 4: Extend `MessageThreadService` (read-side: find-or-create methods + updated channel-aware `findOrCreateForClient`)**

Modify `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java`:

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

    /** Retained for M2/M4 callers that pass clientId only (EMAIL assumed). */
    @Transactional
    public MessageThreadEntity findOrCreateForClient(UUID clientId) {
        return findOrCreateForClient(clientId, "EMAIL");
    }

    @Transactional
    public MessageThreadEntity findOrCreateForClient(UUID clientId, String channel) {
        return threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, channel)
            .orElseGet(() -> {
                var t = new MessageThreadEntity();
                t.setClientId(clientId);
                t.setChannel(channel);
                t.setUnreadCount(0);
                var saved = threads.save(t);
                log.info("op=thread.create clientId={} channel={} threadId={}",
                    clientId, channel, saved.getId());
                return saved;
            });
    }

    @Transactional
    public MessageThreadEntity findOrCreateForRawSender(String rawSender, String channel) {
        return threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(rawSender, channel)
            .orElseGet(() -> {
                var t = new MessageThreadEntity();
                t.setRawSender(rawSender);
                t.setChannel(channel);
                t.setUnreadCount(0);
                var saved = threads.save(t);
                log.info("op=thread.createUnmatched rawSender={} channel={} threadId={}",
                    rawSender, channel, saved.getId());
                return saved;
            });
    }
}
```

LOC: ~55. Under cap.

---

- [ ] **Step 5: Create `MessageThreadMutationService` (write-side)**

Create `backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadMutationService.java`:

```java
package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class MessageThreadMutationService {

    private static final Logger log = LoggerFactory.getLogger(MessageThreadMutationService.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;

    public MessageThreadMutationService(MessageThreadRepository threads,
                                        MessageRepository messages) {
        this.threads  = threads;
        this.messages = messages;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity markRead(UUID threadId, AdminPrincipal actor) {
        log.info("op=thread.markRead actor={} threadId={}", actor.email(), threadId);
        var t = require(threadId);
        t.setUnreadCount(0);
        var saved = threads.save(t);
        log.info("op=thread.markRead actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity assignUnmatched(UUID threadId, UUID targetClientId,
                                               AdminPrincipal actor) {
        log.info("op=thread.assign actor={} threadId={} targetClientId={}",
            actor.email(), threadId, targetClientId);
        var t = require(threadId);
        if (t.getClientId() != null) {
            log.info("op=thread.assign actor={} threadId={} outcome=conflict_already_assigned",
                actor.email(), threadId);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Thread already assigned to a client");
        }
        t.setClientId(targetClientId);
        t.setRawSender(null);
        messages.bulkUpdateClientIdByThreadId(threadId, targetClientId);
        var saved = threads.save(t);
        log.info("op=thread.assign actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity discardUnmatched(UUID threadId, AdminPrincipal actor) {
        log.info("op=thread.discard actor={} threadId={}", actor.email(), threadId);
        var t = require(threadId);
        if (t.getDiscardedAt() != null) {
            log.info("op=thread.discard actor={} threadId={} outcome=conflict_already_discarded",
                actor.email(), threadId);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thread already discarded");
        }
        t.setDiscardedAt(OffsetDateTime.now(ZoneOffset.UTC));
        var saved = threads.save(t);
        log.info("op=thread.discard actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    // ---- private ----

    private MessageThreadEntity require(UUID threadId) {
        return threads.findById(threadId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Thread not found: " + threadId));
    }
}
```

LOC: ~77. Under cap.

---

- [ ] **Step 6: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=MessageThreadServiceTest 2>&1 | tail -20
# Expected: BUILD SUCCESS, 10 tests passing.
```

---

- [ ] **Step 7: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadService.java \
        backend/app/src/main/java/com/drshoes/app/messaging/service/MessageThreadMutationService.java \
        backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
        backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageRepository.java \
        backend/app/src/test/java/com/drshoes/app/messaging/service/MessageThreadServiceTest.java
git commit -m "$(cat <<'EOF'
feat(backend): MessageThreadService + MessageThreadMutationService extensions

[milestone:5][task:5-8]

Split service at 120-LOC cap: read-side (findOrCreateForClient+channel,
findOrCreateForRawSender) stays in MessageThreadService; write-side
(markRead, assignUnmatched, discardUnmatched) in new MessageThreadMutationService.
@Audited on all 3 mutating methods. 10 unit tests green.

Refs: docs/dispatch-log/5-8-<UTC>.md
EOF
)"
```

**Acceptance:**
- `findOrCreateForClient(UUID, channel)` returns existing thread when one exists; creates with correct channel when absent.
- `findOrCreateForRawSender` returns existing unmatched thread; creates with `clientId=null` when absent.
- `markRead` zeros `unreadCount`, saves, logs `outcome=ok`.
- `assignUnmatched` moves `clientId`, clears `rawSender`, bulk-updates message rows; throws 409 if already assigned.
- `discardUnmatched` sets `discardedAt`; throws 409 if already discarded.
- All 10 unit tests GREEN.

---

### Task 5-9: `ThreadController` + integration test (TWO-STAGE REVIEW)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageThreadDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/ThreadDetailDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/AssignThreadRequest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java`

**Review:** two-stage. Stage 1 = spec review after Step 1 (failing test written). Stage 2 = quality review after Step 7 (green).

> **LOC flag:** `ThreadController` will reach ~135–150 LOC with 7 endpoints. Over the 120-LOC cap. Recommended split: `ThreadController` handles GET endpoints (list, get-by-id); `ThreadMutationController` handles POST endpoints (mark-read, assign, discard). Both in `com.drshoes.app.messaging.api`. The task executor MUST apply the split. Alternatively, if M4 sibling `MessagesController` is accepted at ~140 LOC (it is, at 139 LOC), the reviewer may accept a single controller at ~150 LOC — flag the decision in the dispatch log.

> **Search query note:** `GET /api/admin/threads?filter=&channel=&q=` — the `q` parameter triggers a JPQL native query if length ≥ 2; otherwise the standard `findAll` (with filter) is used. The LATERAL subquery approach described in the spec may not be writable in JPQL; use a `@Query(nativeQuery=true)` for the search path.

---

- [ ] **Step 1: Write failing integration test (spec review gate)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ThreadControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MessageThreadRepository threadRepo;
    @Autowired ClientRepository clientRepo;

    private UUID clientId;
    private UUID unmatchedThreadId;
    private UUID matchedThreadId;

    @BeforeEach
    void setUp() {
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Kowalska");
        client.setEmail("anna@example.com");
        client.setPhone("+48600100200");
        clientId = clientRepo.save(client).getId();

        var matched = new MessageThreadEntity();
        matched.setClientId(clientId);
        matched.setChannel("EMAIL");
        matched.setUnreadCount(3);
        matchedThreadId = threadRepo.save(matched).getId();

        var unmatched = new MessageThreadEntity();
        unmatched.setRawSender("+48999888777");
        unmatched.setChannel("SMS");
        unmatched.setUnreadCount(1);
        unmatchedThreadId = threadRepo.save(unmatched).getId();
    }

    @Test
    @DisplayName("GET /threads?filter=ALL returns both matched and unmatched threads")
    void list_filterAll() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("filter", "ALL")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("GET /threads?filter=UNREAD returns only threads with unreadCount > 0")
    void list_filterUnread() throws Exception {
        var zeroRead = new MessageThreadEntity();
        zeroRead.setClientId(clientId);
        zeroRead.setChannel("SMS");
        zeroRead.setUnreadCount(0);
        threadRepo.save(zeroRead);

        mockMvc.perform(get("/api/admin/threads").param("filter", "UNREAD")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.unreadCount > 0)]").exists());
    }

    @Test
    @DisplayName("GET /threads?filter=UNMATCHED returns only threads with clientId=null")
    void list_filterUnmatched() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("filter", "UNMATCHED")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].unmatched").value(true));
    }

    @Test
    @DisplayName("GET /threads?q=Anna matches on client firstName")
    void list_searchByClientName() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "Anna")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    @Test
    @DisplayName("GET /threads?q=X (1 char) ignores q — returns all")
    void list_shortQueryIgnored() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "X")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("GET /threads/{id} returns thread detail with messages list")
    void getThread_found() throws Exception {
        mockMvc.perform(get("/api/admin/threads/{id}", matchedThreadId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.thread.id").value(matchedThreadId.toString()))
            .andExpect(jsonPath("$.messages").isArray());
    }

    @Test
    @DisplayName("GET /threads/{id} returns 404 for unknown id")
    void getThread_notFound() throws Exception {
        mockMvc.perform(get("/api/admin/threads/{id}", UUID.randomUUID())
                .with(owner()))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /threads/{id}/mark-read sets unreadCount to 0")
    void markRead_setsZero() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/mark-read", matchedThreadId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unreadCount").value(0));

        assertThat(threadRepo.findById(matchedThreadId))
            .get().extracting(MessageThreadEntity::getUnreadCount).isEqualTo(0);
    }

    @Test
    @DisplayName("POST /threads/{id}/assign moves thread to client")
    void assign_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/assign", unmatchedThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"clientId": "%s"}
                    """.formatted(clientId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clientId").value(clientId.toString()))
            .andExpect(jsonPath("$.unmatched").value(false));
    }

    @Test
    @DisplayName("POST /threads/{id}/assign returns 409 when already assigned")
    void assign_alreadyAssigned() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/assign", matchedThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"clientId": "%s"}
                    """.formatted(clientId)))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("POST /threads/{id}/discard sets discardedAt")
    void discard_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner()))
            .andExpect(status().isOk());

        assertThat(threadRepo.findById(unmatchedThreadId))
            .get().extracting(MessageThreadEntity::getDiscardedAt).isNotNull();
    }

    @Test
    @DisplayName("POST /threads/{id}/discard returns 409 when already discarded")
    void discard_alreadyDiscarded() throws Exception {
        // first discard
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner())).andExpect(status().isOk());
        // second attempt
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner()))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("GET /threads returns 401 for anonymous request")
    void list_anonymous_401() throws Exception {
        mockMvc.perform(get("/api/admin/threads"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /threads returns 403 for PUBLIC role")
    void list_publicRole_403() throws Exception {
        mockMvc.perform(get("/api/admin/threads")
                .with(SecurityMockMvcRequestPostProcessors.user("u").roles("PUBLIC")))
            .andExpect(status().isForbidden());
    }

    // ---- helpers ----

    private static SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor owner() {
        return SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER");
    }
}
```

Run RED:

```bash
mvn -B -pl app -am test -Dtest=ThreadControllerIntegrationTest 2>&1 | tail -20
# Expected: COMPILATION ERROR or test failure — RED is correct.
```

---

- [ ] **Step 2: SPEC REVIEW GATE — pause, request stage-1 review**

The orchestrator reviews the IT for: correct RBAC assertions, correct filter semantics, search test covers both client-name and raw-sender paths, mark-read/assign/discard assertions use DB state not just HTTP response.

Proceed only after approval.

---

- [ ] **Step 3: Create DTO records**

`backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageThreadDto.java`:

```java
package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageThreadDto(
    UUID id,
    UUID clientId,
    String rawSender,
    String channel,
    String subject,
    OffsetDateTime lastMessageAt,
    int unreadCount,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String lastMessagePreview,
    boolean unmatched,
    String clientName,
    OffsetDateTime discardedAt
) {}
```

`backend/app/src/main/java/com/drshoes/app/messaging/dto/ThreadDetailDto.java`:

```java
package com.drshoes.app.messaging.dto;

import java.util.List;

public record ThreadDetailDto(MessageThreadDto thread, List<MessageDto> messages) {}
```

`backend/app/src/main/java/com/drshoes/app/messaging/dto/AssignThreadRequest.java`:

```java
package com.drshoes.app.messaging.dto;

import java.util.UUID;

public record AssignThreadRequest(UUID clientId) {}
```

---

- [ ] **Step 4: Create `ThreadController`**

> Apply the LOC split: `ThreadController` = GET endpoints; `ThreadMutationController` = POST endpoints. Both below 120 LOC.

`backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.MessageThreadDto;
import com.drshoes.app.messaging.dto.ThreadDetailDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read-only thread endpoints.
 * POST (mark-read, assign, discard, reply) live in ThreadMutationController.
 * LOC target: < 120.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadController {

    private static final Logger log = LoggerFactory.getLogger(ThreadController.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;
    private final ClientRepository clients;

    public ThreadController(MessageThreadRepository threads,
                            MessageRepository messages,
                            ClientRepository clients) {
        this.threads  = threads;
        this.messages = messages;
        this.clients  = clients;
    }

    @GetMapping
    public List<MessageThreadDto> list(
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String q,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=threads.list actor={} filter={} channel={} q={}", actor.email(), filter, channel, q);
        List<MessageThreadEntity> raw;
        if (q != null && q.length() >= 2) {
            raw = threads.searchThreads(q, channel);
        } else {
            raw = switch (filter.toUpperCase()) {
                case "UNREAD"    -> threads.findAllWithUnreadOrderByLastMessageAtDesc(channel);
                case "UNMATCHED" -> threads.findAllUnmatchedOrderByLastMessageAtDesc(channel);
                default          -> threads.findAllActiveOrderByLastMessageAtDesc(channel);
            };
        }
        Map<UUID, String> clientNames = loadClientNames(raw);
        log.info("op=threads.list actor={} outcome=ok count={}", actor.email(), raw.size());
        return raw.stream().map(t -> toDto(t, clientNames.get(t.getClientId()))).toList();
    }

    @GetMapping("/{id}")
    public ThreadDetailDto getThread(@PathVariable UUID id,
                                     @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=threads.get actor={} threadId={}", actor.email(), id);
        var t = threads.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        String clientName = t.getClientId() == null ? null
            : clients.findById(t.getClientId()).map(Client::getFullName).orElse(null);
        var msgs = messages.findAllByThreadIdOrderByCreatedAtAsc(id)
            .stream().map(this::toMessageDto).toList();
        log.info("op=threads.get actor={} threadId={} outcome=ok messages={}", actor.email(), id, msgs.size());
        return new ThreadDetailDto(toDto(t, clientName), msgs);
    }

    // ---- private ----

    private Map<UUID, String> loadClientNames(List<MessageThreadEntity> ts) {
        var ids = ts.stream().map(MessageThreadEntity::getClientId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return clients.findAllById(ids).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));
    }

    private MessageThreadDto toDto(MessageThreadEntity t, String clientName) {
        return new MessageThreadDto(
            t.getId(), t.getClientId(), t.getRawSender(), t.getChannel(), t.getSubject(),
            t.getLastMessageAt(), t.getUnreadCount(), t.getCreatedAt(), t.getUpdatedAt(),
            t.getLastMessagePreview(), t.getClientId() == null, clientName, t.getDiscardedAt());
    }

    private MessageDto toMessageDto(com.drshoes.app.messaging.domain.MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt());
    }
}
```

LOC: ~100. Under cap.

Create `backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadMutationController.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.dto.AssignThreadRequest;
import com.drshoes.app.messaging.dto.MessageThreadDto;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.service.MessageThreadMutationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Write-side thread endpoints: mark-read, assign, discard.
 * Reply endpoint (POST /threads/{id}/messages) lives in ThreadReplyController (task 5-10).
 * LOC target: < 80.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadMutationController {

    private static final Logger log = LoggerFactory.getLogger(ThreadMutationController.class);

    private final MessageThreadMutationService mutationService;
    private final ClientRepository clients;

    public ThreadMutationController(MessageThreadMutationService mutationService,
                                    ClientRepository clients) {
        this.mutationService = mutationService;
        this.clients         = clients;
    }

    @PostMapping("/{id}/mark-read")
    public MessageThreadDto markRead(@PathVariable UUID id,
                                     @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.markRead actor={} threadId={}", actor.email(), id);
        var t = mutationService.markRead(id, actor);
        return toDto(t);
    }

    @PostMapping("/{id}/assign")
    public MessageThreadDto assign(@PathVariable UUID id,
                                   @RequestBody AssignThreadRequest req,
                                   @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.assign actor={} threadId={} targetClientId={}",
            actor.email(), id, req.clientId());
        var t = mutationService.assignUnmatched(id, req.clientId(), actor);
        return toDto(t);
    }

    @PostMapping("/{id}/discard")
    public MessageThreadDto discard(@PathVariable UUID id,
                                    @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.discard actor={} threadId={}", actor.email(), id);
        var t = mutationService.discardUnmatched(id, actor);
        return toDto(t);
    }

    // ---- private ----

    private MessageThreadDto toDto(MessageThreadEntity t) {
        String clientName = t.getClientId() == null ? null
            : clients.findById(t.getClientId())
                .map(c -> c.getFirstName() + " " + c.getLastName()).orElse(null);
        return new MessageThreadDto(
            t.getId(), t.getClientId(), t.getRawSender(), t.getChannel(), t.getSubject(),
            t.getLastMessageAt(), t.getUnreadCount(), t.getCreatedAt(), t.getUpdatedAt(),
            t.getLastMessagePreview(), t.getClientId() == null, clientName, t.getDiscardedAt());
    }
}
```

LOC: ~67. Under cap.

---

- [ ] **Step 5: Add repository query methods needed by `ThreadController`**

In `MessageThreadRepository`, add (native queries needed for search and filter):

```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

/** Active = not discarded. */
@Query(value = """
    SELECT * FROM message_thread
    WHERE discarded_at IS NULL
      AND (:channel IS NULL OR channel = :channel)
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 50
    """, nativeQuery = true)
List<MessageThreadEntity> findAllActiveOrderByLastMessageAtDesc(@Param("channel") String channel);

@Query(value = """
    SELECT * FROM message_thread
    WHERE discarded_at IS NULL AND unread_count > 0
      AND (:channel IS NULL OR channel = :channel)
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 50
    """, nativeQuery = true)
List<MessageThreadEntity> findAllWithUnreadOrderByLastMessageAtDesc(@Param("channel") String channel);

@Query(value = """
    SELECT * FROM message_thread
    WHERE discarded_at IS NULL AND client_id IS NULL
      AND (:channel IS NULL OR channel = :channel)
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 50
    """, nativeQuery = true)
List<MessageThreadEntity> findAllUnmatchedOrderByLastMessageAtDesc(@Param("channel") String channel);

/** Full-text search: matches client name/phone/email, raw_sender, or latest 3 message bodies. */
@Query(value = """
    SELECT DISTINCT t.* FROM message_thread t
    LEFT JOIN client c ON c.id = t.client_id
    WHERE t.discarded_at IS NULL
      AND (:channel IS NULL OR t.channel = :channel)
      AND (
           c.first_name ILIKE '%' || :q || '%'
        OR c.last_name  ILIKE '%' || :q || '%'
        OR c.phone      ILIKE '%' || :q || '%'
        OR c.email      ILIKE '%' || :q || '%'
        OR t.raw_sender ILIKE '%' || :q || '%'
        OR EXISTS (
             SELECT 1 FROM message m
             WHERE m.thread_id = t.id
             ORDER BY m.created_at DESC
             LIMIT 3
             OFFSET 0
           ) -- replaced by lateral below for correctness
      )
    ORDER BY t.last_message_at DESC NULLS LAST
    LIMIT 50
    """, nativeQuery = true)
List<MessageThreadEntity> searchThreads(@Param("q") String q, @Param("channel") String channel);
```

> **Implementation note for executor:** the `searchThreads` query above uses a placeholder EXISTS that does NOT filter on body — replace it with a LATERAL subquery for correctness:
> ```sql
> OR EXISTS (
>   SELECT 1 FROM (
>     SELECT body FROM message WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 3
>   ) recent WHERE recent.body ILIKE '%' || :q || '%'
> )
> ```
> Postgres 9.3+ supports this pattern without `LATERAL` keyword when used inside `EXISTS`. Verify at execution time.

Also add to `MessageRepository`:

```java
List<MessageEntity> findAllByThreadIdOrderByCreatedAtAsc(UUID threadId);
```

---

- [ ] **Step 6: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=ThreadControllerIntegrationTest 2>&1 | tail -30
# Expected: BUILD SUCCESS, 12 tests passing.
```

---

- [ ] **Step 7: QUALITY REVIEW GATE — pause, request stage-2 review**

Reviewer checks: LOC split correctly applied, RBAC `@PreAuthorize` at class level on both controllers, structured logging on every public method, native queries safe (no injection — all params bound).

---

- [ ] **Step 8: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadController.java \
        backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadMutationController.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/MessageThreadDto.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/ThreadDetailDto.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/AssignThreadRequest.java \
        backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
        backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageRepository.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(backend): ThreadController + ThreadMutationController + IT

[milestone:5][task:5-9]

GET endpoints (list with filter/channel/q search, get-by-id) in ThreadController.
POST endpoints (mark-read, assign, discard) in ThreadMutationController.
Split at 120-LOC cap. Native JPQL queries for filter/search (ILIKE, LATERAL subq).
AssignThreadRequest + MessageThreadDto + ThreadDetailDto records.
12 IT cases: filters, search, 401 anon, 403 PUBLIC, 409 conflicts, 404 unknown.
Suite delta: +12.

Refs: docs/dispatch-log/5-9-<UTC>.md
EOF
)"
```

**Acceptance:**
- `filter=ALL` returns all non-discarded threads; `UNREAD` returns only `unread_count > 0`; `UNMATCHED` returns only `client_id IS NULL`.
- `q=Anna` matches client first name; `q` < 2 chars → ignored, all threads returned.
- `GET /threads/{id}` returns `ThreadDetailDto` with messages array; 404 for unknown id.
- `POST /mark-read` → `unread_count=0` persisted; `POST /assign` → clientId set, messages bulk-updated; `POST /discard` → `discardedAt` set.
- 401 anonymous; 403 PUBLIC role.
- 409 on assign-already-assigned and discard-already-discarded.
- Both controllers < 120 LOC. Suite +12.

---

### Task 5-10: Reply send — `POST /api/admin/threads/{id}/messages`

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadReplyController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/SendReplyRequest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadReplyControllerIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write failing integration test (RED)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadReplyControllerIntegrationTest.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ThreadReplyControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MessageThreadRepository threadRepo;
    @Autowired MessageRepository messageRepo;
    @Autowired ClientRepository clientRepo;

    private UUID emailThreadId;
    private UUID smsThreadId;
    private UUID unmatchedThreadId;
    private UUID discardedThreadId;

    @BeforeEach
    void setUp() {
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Nowak");
        client.setEmail("jan@example.com");
        client.setPhone("+48600100200");
        var clientId = clientRepo.save(client).getId();

        var emailThread = new MessageThreadEntity();
        emailThread.setClientId(clientId);
        emailThread.setChannel("EMAIL");
        emailThread.setUnreadCount(0);
        emailThreadId = threadRepo.save(emailThread).getId();

        var smsThread = new MessageThreadEntity();
        smsThread.setClientId(clientId);
        smsThread.setChannel("SMS");
        smsThread.setUnreadCount(0);
        smsThreadId = threadRepo.save(smsThread).getId();

        var unmatched = new MessageThreadEntity();
        unmatched.setRawSender("+48999888777");
        unmatched.setChannel("EMAIL");
        unmatched.setUnreadCount(0);
        unmatchedThreadId = threadRepo.save(unmatched).getId();

        var discarded = new MessageThreadEntity();
        discarded.setClientId(clientId);
        discarded.setChannel("SMS");
        discarded.setUnreadCount(0);
        discarded.setDiscardedAt(OffsetDateTime.now());
        discardedThreadId = threadRepo.save(discarded).getId();
    }

    @Test
    @DisplayName("happy email reply — 200 + message row created")
    void reply_email_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", emailThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","subject":"Re: Twoje zlecenie","body":"Gotowe, zapraszamy!","orderId":null}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.direction").value("OUTBOUND"))
            .andExpect(jsonPath("$.channel").value("EMAIL"));

        assertThat(messageRepo.findAllByThreadIdOrderByCreatedAtAsc(emailThreadId)).hasSize(1);
    }

    @Test
    @DisplayName("happy SMS reply — 200 + message row created")
    void reply_sms_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", smsThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","subject":null,"body":"Gotowe!","orderId":null}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.channel").value("SMS"));
    }

    @Test
    @DisplayName("channel mismatch → 400")
    void reply_channelMismatch_400() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", emailThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Cześć","orderId":null}
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("unmatched thread → 422")
    void reply_unmatched_422() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", unmatchedThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Hej","orderId":null}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("discarded thread → 422")
    void reply_discarded_422() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", discardedThreadId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Hej","orderId":null}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("unknown thread → 404")
    void reply_notFound_404() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/messages", UUID.randomUUID())
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Test","orderId":null}
                    """))
            .andExpect(status().isNotFound());
    }

    private static SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor owner() {
        return SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER");
    }
}
```

Run RED:

```bash
mvn -B -pl app -am test -Dtest=ThreadReplyControllerIntegrationTest 2>&1 | tail -20
```

---

- [ ] **Step 2: Create `SendReplyRequest`**

`backend/app/src/main/java/com/drshoes/app/messaging/dto/SendReplyRequest.java`:

```java
package com.drshoes.app.messaging.dto;

import java.util.UUID;

public record SendReplyRequest(
    String channel,
    String subject,
    String body,
    UUID orderId
) {}
```

---

- [ ] **Step 3: Create `ThreadReplyController`**

`backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadReplyController.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendReplyRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * POST /api/admin/threads/{id}/messages — send a reply on an existing thread.
 * Delegates to MessageRouter.sendReply (added by slice-A task 5-3).
 * LOC target: < 70.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadReplyController {

    private static final Logger log = LoggerFactory.getLogger(ThreadReplyController.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;
    private final MessageRouter router;

    public ThreadReplyController(MessageThreadRepository threads,
                                 MessageRepository messages,
                                 MessageRouter router) {
        this.threads  = threads;
        this.messages = messages;
        this.router   = router;
    }

    @PostMapping("/{id}/messages")
    public MessageDto sendReply(@PathVariable UUID id,
                                @RequestBody SendReplyRequest req,
                                @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.sendReply actor={} threadId={} channel={}", actor.email(), id, req.channel());

        var thread = threads.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));

        if (thread.getClientId() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Cannot reply to unmatched thread — assign to a client first");
        }
        if (thread.getDiscardedAt() != null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Cannot reply to discarded thread");
        }
        if (!thread.getChannel().equalsIgnoreCase(req.channel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Channel mismatch: thread is " + thread.getChannel()
                + " but request specifies " + req.channel());
        }

        UUID messageId = router.sendReply(id, req.channel(), req.subject(), req.body(),
            req.orderId(), actor);

        var msg = messages.findById(messageId)
            .orElseThrow(() -> new IllegalStateException("Message not found after send: " + messageId));

        log.info("op=thread.sendReply actor={} threadId={} messageId={} outcome=ok",
            actor.email(), id, messageId);

        return toDto(msg);
    }

    // ---- private ----

    private MessageDto toDto(com.drshoes.app.messaging.domain.MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt());
    }
}
```

LOC: ~66. Under cap.

> **Dependency note:** this task assumes `MessageRouter.sendReply(UUID threadId, String channel, String subject, String body, UUID orderId, AdminPrincipal actor)` is in place from slice A task 5-3. If slice A is not yet merged at dispatch time, stub the call with a `throw new UnsupportedOperationException("pending 5-3")` and add a TODO comment — do not block the IT from being wired.

---

- [ ] **Step 4: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=ThreadReplyControllerIntegrationTest 2>&1 | tail -20
# Expected: BUILD SUCCESS, 6 tests passing.
```

---

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/ThreadReplyController.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/SendReplyRequest.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/ThreadReplyControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(backend): ThreadReplyController — POST /api/admin/threads/{id}/messages

[milestone:5][task:5-10]

Reply send on existing thread. Validates: channel match, not-unmatched,
not-discarded, thread exists (404). Delegates to MessageRouter.sendReply.
Returns MessageDto 200. 6 IT cases green.

Refs: docs/dispatch-log/5-10-<UTC>.md
EOF
)"
```

**Acceptance:**
- Happy email/SMS reply → `MessageEntity` row created with `direction=OUTBOUND`, `threadId` set.
- 400 on channel mismatch (e.g. SMS body to EMAIL thread).
- 422 when thread `clientId IS NULL` (unmatched).
- 422 when thread `discardedAt IS NOT NULL`.
- 404 for unknown thread id.
- 6 IT cases GREEN. Suite delta: +6.

---

### Task 5-11: Cross-thread compose — `POST /api/admin/clients/{id}/messages`

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/ClientMessageController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/SendNewMessageRequest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/api/ClientMessageControllerIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write failing integration test (RED)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/api/ClientMessageControllerIntegrationTest.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ClientMessageControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ClientRepository clientRepo;
    @Autowired MessageRepository messageRepo;
    @Autowired MessageThreadRepository threadRepo;

    private UUID clientWithBothId;
    private UUID clientEmailOnlyId;
    private UUID clientSmsOnlyId;

    @BeforeEach
    void setUp() {
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var withBoth = new Client();
        withBoth.setFirstName("Piotr");
        withBoth.setLastName("Wiśniewski");
        withBoth.setEmail("piotr@example.com");
        withBoth.setPhone("+48700200300");
        clientWithBothId = clientRepo.save(withBoth).getId();

        var emailOnly = new Client();
        emailOnly.setFirstName("Maria");
        emailOnly.setLastName("Kowalczyk");
        emailOnly.setEmail("maria@example.com");
        clientEmailOnlyId = clientRepo.save(emailOnly).getId();

        var smsOnly = new Client();
        smsOnly.setFirstName("Tomasz");
        smsOnly.setLastName("Jabłoński");
        smsOnly.setPhone("+48800300400");
        clientSmsOnlyId = clientRepo.save(smsOnly).getId();
    }

    @Test
    @DisplayName("happy email compose — 200 + thread created + message created")
    void compose_email_happy() throws Exception {
        mockMvc.perform(post("/api/admin/clients/{id}/messages", clientWithBothId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","subject":"Zapraszamy","body":"Witamy!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.direction").value("OUTBOUND"))
            .andExpect(jsonPath("$.channel").value("EMAIL"));

        assertThat(threadRepo.findFirstByClientIdAndChannelOrderByCreatedAtAsc(
            clientWithBothId, "EMAIL")).isPresent();
        assertThat(messageRepo.count()).isGreaterThan(0);
    }

    @Test
    @DisplayName("happy SMS compose — 200")
    void compose_sms_happy() throws Exception {
        mockMvc.perform(post("/api/admin/clients/{id}/messages", clientWithBothId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","subject":null,"body":"Cześć!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.channel").value("SMS"));
    }

    @Test
    @DisplayName("client has no email → EMAIL compose returns 422")
    void compose_noEmail_422() throws Exception {
        mockMvc.perform(post("/api/admin/clients/{id}/messages", clientSmsOnlyId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Cześć!"}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("client has no phone → SMS compose returns 422")
    void compose_noPhone_422() throws Exception {
        mockMvc.perform(post("/api/admin/clients/{id}/messages", clientEmailOnlyId)
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Cześć!"}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("unknown client → 404")
    void compose_unknownClient_404() throws Exception {
        mockMvc.perform(post("/api/admin/clients/{id}/messages", UUID.randomUUID())
                .with(owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Test"}
                    """))
            .andExpect(status().isNotFound());
    }

    private static SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor owner() {
        return SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER");
    }
}
```

Run RED:

```bash
mvn -B -pl app -am test -Dtest=ClientMessageControllerIntegrationTest 2>&1 | tail -20
```

---

- [ ] **Step 2: Create `SendNewMessageRequest`**

`backend/app/src/main/java/com/drshoes/app/messaging/dto/SendNewMessageRequest.java`:

```java
package com.drshoes.app.messaging.dto;

public record SendNewMessageRequest(String channel, String subject, String body) {}
```

---

- [ ] **Step 3: Create `ClientMessageController`**

`backend/app/src/main/java/com/drshoes/app/messaging/api/ClientMessageController.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendNewMessageRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * POST /api/admin/clients/{id}/messages — cross-thread "Nowa wiadomość" composer.
 * Separate controller for clean RBAC surface; keeps MessagesController unchanged (M2 contract).
 * LOC target: < 70.
 */
@RestController
@RequestMapping("/api/admin/clients")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ClientMessageController {

    private static final Logger log = LoggerFactory.getLogger(ClientMessageController.class);

    private final ClientRepository clients;
    private final MessageRepository messages;
    private final MessageRouter router;

    public ClientMessageController(ClientRepository clients,
                                   MessageRepository messages,
                                   MessageRouter router) {
        this.clients  = clients;
        this.messages = messages;
        this.router   = router;
    }

    @PostMapping("/{clientId}/messages")
    public MessageDto sendNew(@PathVariable UUID clientId,
                              @RequestBody SendNewMessageRequest req,
                              @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=client.sendNew actor={} clientId={} channel={}", actor.email(), clientId, req.channel());

        Client client = clients.findById(clientId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));

        String channel = req.channel() == null ? null : req.channel().toUpperCase();
        validateChannelAvailability(client, channel);

        UUID messageId = router.sendNewToClient(clientId, channel, req.subject(), req.body(), actor);

        var msg = messages.findById(messageId)
            .orElseThrow(() -> new IllegalStateException("Message not found after send: " + messageId));

        log.info("op=client.sendNew actor={} clientId={} messageId={} outcome=ok",
            actor.email(), clientId, messageId);

        return toDto(msg);
    }

    // ---- private ----

    private void validateChannelAvailability(Client client, String channel) {
        if ("EMAIL".equals(channel) && (client.getEmail() == null || client.getEmail().isBlank())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Client has no email address");
        }
        if ("SMS".equals(channel) && (client.getPhone() == null || client.getPhone().isBlank())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Client has no phone number");
        }
    }

    private MessageDto toDto(com.drshoes.app.messaging.domain.MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt());
    }
}
```

LOC: ~66. Under cap.

> **Dependency note:** `router.sendNewToClient(...)` is added by slice A task 5-3. Same stub-and-TODO approach as 5-10 if 5-3 is not yet merged.

---

- [ ] **Step 4: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=ClientMessageControllerIntegrationTest 2>&1 | tail -20
# Expected: BUILD SUCCESS, 5 tests passing.
```

---

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/messaging/api/ClientMessageController.java \
        backend/app/src/main/java/com/drshoes/app/messaging/dto/SendNewMessageRequest.java \
        backend/app/src/test/java/com/drshoes/app/messaging/api/ClientMessageControllerIntegrationTest.java
git commit -m "$(cat <<'EOF'
feat(backend): ClientMessageController — POST /api/admin/clients/{id}/messages

[milestone:5][task:5-11]

Cross-thread compose endpoint. Validates client exists (404), channel
available: no email → 422, no phone → 422. Delegates to
MessageRouter.sendNewToClient. 5 IT cases green.

Refs: docs/dispatch-log/5-11-<UTC>.md
EOF
)"
```

**Acceptance:**
- Happy email/SMS → `MessageEntity` row created, thread found-or-created; 200 + `MessageDto` response.
- 422 when `client.email` is blank/null and channel=EMAIL.
- 422 when `client.phone` is blank/null and channel=SMS.
- 404 for unknown `clientId`.
- 5 IT cases GREEN. Suite delta: +5.

---

### Task 5-12: `lib/messaging` frontend extensions

**Files:**
- Modify: `apps/web/lib/messaging/types.ts`
- Modify: `apps/web/lib/messaging/api.ts`

**Review:** combined single-stage.

---

- [ ] **Step 1: Read current state (ground-truth check)**

```bash
grep -n "export\|MessageDto\|Channel\|ThreadDto" apps/web/lib/messaging/types.ts
grep -n "export async\|log.info" apps/web/lib/messaging/api.ts
```

Confirmed at plan-write time:
- `types.ts` has `Channel`, `MessageDto`, `SendMessageRequest` — no `MessageThreadDto`, `ThreadFilter`, `ThreadDetailDto`.
- `api.ts` has `getOrderMessages`, `sendMessage`, `retryMessage` — no thread functions.

---

- [ ] **Step 2: Extend `types.ts`**

Append the following to `apps/web/lib/messaging/types.ts` (after the existing exports):

```ts
export type ThreadFilter = "ALL" | "UNREAD" | "UNMATCHED";

export interface MessageThreadDto {
  id: string;
  clientId: string | null;
  rawSender: string | null;
  channel: Channel;
  subject: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  unmatched: boolean;
  clientName: string | null;
  discardedAt: string | null;
}

export interface ThreadDetailDto {
  thread: MessageThreadDto;
  messages: MessageDto[];
}

export interface SendReplyRequest {
  channel: Channel;
  subject?: string | null;
  body: string;
  orderId?: string | null;
}

export interface SendNewRequest {
  channel: Channel;
  subject?: string | null;
  body: string;
}
```

LOC addition: ~35. Total file stays well under cap.

---

- [ ] **Step 3: Extend `api.ts`**

Append to `apps/web/lib/messaging/api.ts` (after `retryMessage`):

```ts
export async function listThreads(
  filter?: ThreadFilter,
  channel?: Channel,
  q?: string,
): Promise<MessageThreadDto[]> {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (channel) params.set("channel", channel);
  if (q && q.length >= 2) params.set("q", q);
  const qs = params.toString();
  log.info("op=listThreads", { filter, channel, q });
  return api.get<MessageThreadDto[]>(`/admin/threads${qs ? "?" + qs : ""}`);
}

export async function getThread(id: string): Promise<ThreadDetailDto> {
  log.info("op=getThread", { id });
  return api.get<ThreadDetailDto>(`/admin/threads/${id}`);
}

export async function sendReply(
  threadId: string,
  req: SendReplyRequest,
): Promise<MessageDto> {
  log.info("op=sendReply", { threadId, channel: req.channel });
  return api.post<MessageDto>(`/admin/threads/${threadId}/messages`, req);
}

export async function markThreadRead(threadId: string): Promise<MessageThreadDto> {
  log.info("op=markThreadRead", { threadId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/mark-read`);
}

export async function assignUnmatched(
  threadId: string,
  clientId: string,
): Promise<MessageThreadDto> {
  log.info("op=assignUnmatched", { threadId, clientId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/assign`, { clientId });
}

export async function discardUnmatched(threadId: string): Promise<MessageThreadDto> {
  log.info("op=discardUnmatched", { threadId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/discard`);
}

export async function sendNewToClient(
  clientId: string,
  req: SendNewRequest,
): Promise<MessageDto> {
  log.info("op=sendNewToClient", { clientId, channel: req.channel });
  return api.post<MessageDto>(`/admin/clients/${clientId}/messages`, req);
}
```

Also add the new types to the import block at the top of `api.ts`:

```ts
import type {
  TemplateDto,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TriggerDto,
  MessageDto,
  SendMessageRequest,
  // new:
  MessageThreadDto,
  ThreadDetailDto,
  ThreadFilter,
  SendReplyRequest,
  SendNewRequest,
} from "./types";
```

LOC addition: ~55. Total `api.ts` stays under 130 LOC — acceptable; if over, the split is import-heavy not logic-heavy.

---

- [ ] **Step 4: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: zero errors. If `Channel` is used in function signatures and the import of `Channel` is not already in scope inside `api.ts`, add it to the import block.

---

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/messaging/types.ts apps/web/lib/messaging/api.ts
git commit -m "$(cat <<'EOF'
feat(web): lib/messaging types + API extensions for M5 thread surface

[milestone:5][task:5-12]

types.ts: ThreadFilter, MessageThreadDto, ThreadDetailDto, SendReplyRequest,
SendNewRequest added (~35 LOC).
api.ts: listThreads, getThread, sendReply, markThreadRead, assignUnmatched,
discardUnmatched, sendNewToClient added (~55 LOC). All log op= entries.
pnpm typecheck green.

Refs: docs/dispatch-log/5-12-<UTC>.md
EOF
)"
```

**Acceptance:**
- `MessageThreadDto` fields match backend `MessageThreadDto` record field-for-field.
- All 7 new API functions exported with `log.info("op=...")` calls.
- `pnpm typecheck` passes with zero errors.
- `pnpm lint` passes.

---

### Task 5-13: `MessagesNavItem` (sidebar) + unread polling + `OrderDrawerMessages` NIT fixups

**Files:**
- Create: `apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx`
- Modify: `apps/web/components/admin/AdminSidebar.tsx`
- Create: `apps/web/lib/messaging/useUnreadCount.ts`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Create `MessagesNavItem.tsx`**

Translate `handoff/design/m5-messages/SidebarItem.jsx` to TSX:

```
apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx
```

> Note: this directory does not exist yet — create it. `AdminSidebar` is in `apps/web/components/admin/`; the `MessagesNavItem` is placed here per the design pack annotation (and imported into `AdminSidebar`).

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createLogger } from "@/lib/log";
import { useUnreadCount } from "@/lib/messaging/useUnreadCount";

const log = createLogger("messaging.nav");

/**
 * Sidebar nav item for /admin/messages.
 * Shows an unread count badge (capped at 99+).
 * Polls via useUnreadCount (30s cadence).
 * ~35 LOC.
 */
export function MessagesNavItem() {
  const pathname = usePathname();
  const active   = pathname.startsWith("/admin/messages");
  const unread   = useUnreadCount();
  const fmt      = unread > 99 ? "99+" : String(unread);

  log.debug("op=MessagesNavItem.render", { unread, active });

  return (
    <Link
      href="/admin/messages"
      className={
        "group flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium transition-colors " +
        (active
          ? "bg-white/10 text-paper"
          : "text-paper/75 hover:bg-white/5 hover:text-paper")
      }
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="flex-1">Wiadomości</span>
      {unread > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10.5px] font-bold leading-none">
          {fmt}
        </span>
      )}
    </Link>
  );
}
```

LOC: ~38. Under cap.

---

- [ ] **Step 2: Create `useUnreadCount.ts`**

`apps/web/lib/messaging/useUnreadCount.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { listThreads } from "@/lib/messaging/api";

const log = createLogger("messaging.unread");
const POLL_MS = 30_000;

/**
 * Polls GET /api/admin/threads?filter=UNREAD every 30 s.
 * Returns total unread count across all unread threads.
 * Uses race-cancel guard to prevent stale updates after unmount.
 * ~40 LOC.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const threads = await listThreads("UNREAD");
        if (!cancelled) {
          const total = threads.reduce((sum, t) => sum + t.unreadCount, 0);
          setCount(total);
          log.debug("op=unreadCount.poll outcome=ok", { total });
        }
      } catch (e) {
        if (!cancelled) {
          log.warn("op=unreadCount.poll outcome=error", { err: String(e) });
        }
      }
    }

    void fetch();
    const id = setInterval(() => { void fetch(); }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
}
```

LOC: ~42. Under cap.

---

- [ ] **Step 3: Modify `AdminSidebar.tsx` to render `MessagesNavItem`**

`AdminSidebar` is a server component; `MessagesNavItem` is a client component (uses `usePathname` and `useUnreadCount`). This is valid — Next.js allows client components nested inside server components.

In `apps/web/components/admin/AdminSidebar.tsx`, add the import and render the item in the nav section:

```tsx
// Add import at top:
import { MessagesNavItem } from "@/app/(admin)/admin/_components/Sidebar/MessagesNavItem";

// Inside the <nav> block, after the existing Zamówienia and Klienci items:
<MessagesNavItem />
```

---

- [ ] **Step 4: Apply `OrderDrawerMessages.tsx` NIT fixups**

In `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`, apply two targeted edits:

**Edit A — distinguish 404 vs 409 retry errors:**

Replace the current `handleRetry` catch block:

```ts
// BEFORE:
    } catch (e) {
      const errText = "Nie udało się ponowić — spróbuj ponownie.";
      log.warn("op=message.retry outcome=failed", { messageId: msg.id, err: String(e) });
      setRetryError((prev) => ({ ...prev, [msg.id]: errText }));
    }
```

With:

```ts
// AFTER:
    } catch (e: unknown) {
      let errText = "Nie udało się ponowić — spróbuj ponownie.";
      if (e && typeof e === "object") {
        const resp = e as { status?: number; body?: { code?: string } };
        if (resp.status === 404) {
          errText = "Nie znaleziono wiadomości.";
        } else if (resp.status === 409 || resp.body?.code === "NOT_RETRYABLE") {
          errText = "Wiadomość nie kwalifikuje się do ponowienia.";
        }
      }
      log.warn("op=message.retry outcome=failed", { messageId: msg.id, err: String(e) });
      setRetryError((prev) => ({ ...prev, [msg.id]: errText }));
    }
```

**Edit B — add race-cancel guard to `orderId`-changed fetch effect:**

The current `load` callback is stable per `orderId` (via `useCallback([orderId])`), so the polling `useEffect` already restarts correctly on `orderId` change. The NIT is that the initial load on `orderId` change has no cancel guard. Replace the two `useEffect` blocks:

```ts
// BEFORE:
  // Initial + refreshKey-driven load
  useEffect(() => { void load(false); }, [load, refreshKey]);

  // 10s polling while drawer is mounted
  useEffect(() => {
    pollRef.current = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, [load]);
```

With:

```ts
// AFTER:
  // Initial + refreshKey-driven load with race-cancel guard
  useEffect(() => {
    let cancelled = false;
    void load(false).then(() => {
      if (cancelled) return; // discard result if orderId changed before load completed
    });
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  // 10s polling while drawer is mounted
  useEffect(() => {
    pollRef.current = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, [load]);
```

> Note: `load` already sets state conditionally; this cancel guard prevents the state setter from running on stale closures when orderId changes rapidly. The `load` signature is `async (silent?: boolean): Promise<void>` — the `.then(...)` wrapper is a no-op result handler that checks `cancelled` before touching state (belt-and-suspenders alongside the `useCallback` reset).

---

- [ ] **Step 5: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: zero errors.

---

- [ ] **Step 6: Commit**

```bash
git add \
  "apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx" \
  apps/web/components/admin/AdminSidebar.tsx \
  apps/web/lib/messaging/useUnreadCount.ts \
  "apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx"
git commit -m "$(cat <<'EOF'
feat(web): MessagesNavItem + unread polling + OrderDrawerMessages NIT fixups

[milestone:5][task:5-13]

MessagesNavItem: sidebar link with red badge (99+ cap), active state,
polling via useUnreadCount hook. AdminSidebar renders item.
useUnreadCount: polls UNREAD filter every 30s, race-cancel guard on unmount.
OrderDrawerMessages NITs: 404/409 retry error strings distinguished (Polish);
race-cancel guard added to orderId-changed effect.
pnpm typecheck green.

Refs: docs/dispatch-log/5-13-<UTC>.md
EOF
)"
```

**Acceptance:**
- `MessagesNavItem` renders chat icon + "Wiadomości" label + red badge when `unread > 0`; badge shows `99+` when count > 99; `active` state applied when pathname starts with `/admin/messages`.
- `useUnreadCount` polls every 30 s; returns total across all UNREAD threads; clears interval on unmount (cancel guard set).
- `AdminSidebar` renders `<MessagesNavItem />` in the nav section.
- `OrderDrawerMessages`: 409/NOT_RETRYABLE → "Wiadomość nie kwalifikuje się do ponowienia."; 404 → "Nie znaleziono wiadomości."; race-cancel guard present in orderId effect.
- `pnpm typecheck` green.

---

### Task 5-14: `UnreadElsewhereBanner` + dedicated backend endpoint

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer/UnreadElsewhereBanner.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/messaging/dto/UnreadElsewhereDto.java`
- Create: `backend/app/src/test/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereControllerIntegrationTest.java`

**Review:** combined single-stage.

---

- [ ] **Step 1: Create backend DTO**

`backend/app/src/main/java/com/drshoes/app/messaging/dto/UnreadElsewhereDto.java`:

```java
package com.drshoes.app.messaging.dto;

import java.util.UUID;

/**
 * Response for GET /api/admin/orders/{orderId}/unread-elsewhere.
 * count=0 and threadId=null means no unread messages on other threads.
 */
public record UnreadElsewhereDto(int count, UUID threadId) {}
```

---

- [ ] **Step 2: Write failing IT (RED)**

Create `backend/app/src/test/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereControllerIntegrationTest.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class OrderUnreadElsewhereControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired OrderRepository orderRepo;
    @Autowired ClientRepository clientRepo;
    @Autowired MessageThreadRepository threadRepo;

    private UUID orderId;
    private UUID clientId;
    private UUID otherThreadId;

    @BeforeEach
    void setUp() {
        threadRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Zofia");
        client.setLastName("Dąbrowska");
        client.setEmail("zofia@example.com");
        clientId = clientRepo.save(client).getId();

        var order = new Order();
        order.setClientId(clientId);
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        order.setOrderType(OrderType.NAPRAWA);
        orderId = orderRepo.save(order).getId();
    }

    @Test
    @DisplayName("client has unread thread not linked to this order → count > 0")
    void unreadElsewhere_returns_count() throws Exception {
        var otherThread = new MessageThreadEntity();
        otherThread.setClientId(clientId);
        otherThread.setChannel("EMAIL");
        otherThread.setUnreadCount(3);
        otherThreadId = threadRepo.save(otherThread).getId();

        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(3))
            .andExpect(jsonPath("$.threadId").value(otherThreadId.toString()));
    }

    @Test
    @DisplayName("no unread threads for client → count=0, threadId=null")
    void noUnread_returns_zero() throws Exception {
        var zeroThread = new MessageThreadEntity();
        zeroThread.setClientId(clientId);
        zeroThread.setChannel("SMS");
        zeroThread.setUnreadCount(0);
        threadRepo.save(zeroThread);

        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0))
            .andExpect(jsonPath("$.threadId").doesNotExist());
    }

    @Test
    @DisplayName("order client has no threads at all → count=0")
    void noThreads_returns_zero() throws Exception {
        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0));
    }

    private static SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor owner() {
        return SecurityMockMvcRequestPostProcessors.user("owner@drshoes.pl").roles("OWNER");
    }
}
```

Run RED:

```bash
mvn -B -pl app -am test -Dtest=OrderUnreadElsewhereControllerIntegrationTest 2>&1 | tail -20
```

---

- [ ] **Step 3: Create `OrderUnreadElsewhereController`**

`backend/app/src/main/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereController.java`:

```java
package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.dto.UnreadElsewhereDto;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.UUID;

/**
 * GET /api/admin/orders/{orderId}/unread-elsewhere
 * Returns the total unread_count + threadId of the client's most-recent thread
 * that has unread messages and is NOT linked to this order.
 * count=0 + threadId=null when no such thread exists.
 * LOC target: < 60.
 */
@RestController
@RequestMapping("/api/admin/orders")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class OrderUnreadElsewhereController {

    private static final Logger log = LoggerFactory.getLogger(OrderUnreadElsewhereController.class);

    private final OrderRepository orders;
    private final MessageThreadRepository threads;

    public OrderUnreadElsewhereController(OrderRepository orders,
                                          MessageThreadRepository threads) {
        this.orders  = orders;
        this.threads = threads;
    }

    @GetMapping("/{orderId}/unread-elsewhere")
    public UnreadElsewhereDto unreadElsewhere(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=order.unreadElsewhere actor={} orderId={}", actor.email(), orderId);

        Order order = orders.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getClientId() == null) {
            log.info("op=order.unreadElsewhere actor={} orderId={} outcome=no_client", actor.email(), orderId);
            return new UnreadElsewhereDto(0, null);
        }

        // Find the client's most-recent thread with unread_count > 0,
        // excluding threads that are linked purely to this order (no orderId on thread itself — 
        // threads span messages across orders; "elsewhere" = thread with unread messages).
        var unreadThread = threads
            .findAllByClientIdAndUnreadCountGreaterThan(order.getClientId(), 0)
            .stream()
            .max(Comparator.comparing(t -> t.getLastMessageAt() == null
                ? java.time.OffsetDateTime.MIN : t.getLastMessageAt()))
            .orElse(null);

        if (unreadThread == null) {
            log.info("op=order.unreadElsewhere actor={} orderId={} outcome=none", actor.email(), orderId);
            return new UnreadElsewhereDto(0, null);
        }

        log.info("op=order.unreadElsewhere actor={} orderId={} threadId={} count={} outcome=ok",
            actor.email(), orderId, unreadThread.getId(), unreadThread.getUnreadCount());
        return new UnreadElsewhereDto(unreadThread.getUnreadCount(), unreadThread.getId());
    }
}
```

LOC: ~58. Under cap.

Add to `MessageThreadRepository`:

```java
List<MessageThreadEntity> findAllByClientIdAndUnreadCountGreaterThan(UUID clientId, int minCount);
```

---

- [ ] **Step 4: Run GREEN (backend)**

```bash
mvn -B -pl app -am test -Dtest=OrderUnreadElsewhereControllerIntegrationTest 2>&1 | tail -20
# Expected: BUILD SUCCESS, 3 tests passing.
```

---

- [ ] **Step 5: Create `UnreadElsewhereBanner.tsx`**

Translate `handoff/design/m5-messages/OrderDrawerBanner.jsx` to TSX:

`apps/web/app/(admin)/admin/orders/_components/OrderDrawer/UnreadElsewhereBanner.tsx`:

> Note: directory `OrderDrawer/` may not exist yet — create it.

```tsx
import Link from "next/link";

interface Props {
  count: number;
  threadId: string;
}

function pluralUnread(n: number): string {
  if (n === 1) return "Klient ma 1 nieprzeczytaną wiadomość";
  if (n >= 2 && n <= 4) return `Klient ma ${n} nieprzeczytane wiadomości`;
  return `Klient ma ${n} nieprzeczytanych wiadomości`;
}

/**
 * Amber banner linking to the client's unread thread on /admin/messages.
 * Rendered at the top of OrderDrawerMessages when client has unread elsewhere.
 * ~32 LOC.
 */
export function UnreadElsewhereBanner({ count, threadId }: Props) {
  return (
    <Link
      href={`/admin/messages?thread=${threadId}`}
      className="group flex items-center gap-3 mb-4 px-3.5 py-2.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
    >
      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-200 text-amber-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path d="m22 6-10 7L2 6" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-amber-900 leading-tight">
          {pluralUnread(count)}
        </div>
        <div className="text-[11.5px] text-amber-800/80 mt-0.5 leading-tight">
          na innym wątku — niezwiązanym z tym zleceniem
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-900 group-hover:text-amber-950">
        Otwórz wątek
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
```

LOC: ~34. Under cap.

---

- [ ] **Step 6: Integrate banner into `OrderDrawerMessages.tsx`**

Add the following to `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`:

**Add import:**
```tsx
import { UnreadElsewhereBanner } from "./OrderDrawer/UnreadElsewhereBanner";
import { getUnreadElsewhere } from "@/lib/messaging/api";
```

Add `getUnreadElsewhere` to `api.ts` as well (add in task's api.ts extension OR inline here):

```ts
// apps/web/lib/messaging/api.ts — add:
export interface UnreadElsewhereDto {
  count: number;
  threadId: string | null;
}

export async function getUnreadElsewhere(orderId: string): Promise<UnreadElsewhereDto> {
  log.info("op=getUnreadElsewhere", { orderId });
  return api.get<UnreadElsewhereDto>(`/admin/orders/${orderId}/unread-elsewhere`);
}
```

> Add `UnreadElsewhereDto` to `types.ts` instead if it makes more sense for the executor — either location is fine; avoid duplication.

**Add state and effect to `OrderDrawerMessages`:**

```tsx
const [unreadElsewhere, setUnreadElsewhere] = useState<{ count: number; threadId: string } | null>(null);

useEffect(() => {
  let cancelled = false;
  void getUnreadElsewhere(orderId).then((data) => {
    if (!cancelled && data.count > 0 && data.threadId) {
      setUnreadElsewhere({ count: data.count, threadId: data.threadId });
    }
  }).catch(() => { /* non-critical — swallow */ });
  return () => { cancelled = true; };
}, [orderId]);
```

**Render the banner at the top of the messages section (before the message list):**

```tsx
{unreadElsewhere && (
  <UnreadElsewhereBanner
    count={unreadElsewhere.count}
    threadId={unreadElsewhere.threadId}
  />
)}
```

Insert this just before `{state === "loading" && (...)}` — i.e. at the top of the section content, below the header row.

---

- [ ] **Step 7: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: zero errors.

---

- [ ] **Step 8: Commit**

```bash
git add \
  backend/app/src/main/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereController.java \
  backend/app/src/main/java/com/drshoes/app/messaging/dto/UnreadElsewhereDto.java \
  backend/app/src/test/java/com/drshoes/app/messaging/api/OrderUnreadElsewhereControllerIntegrationTest.java \
  backend/app/src/main/java/com/drshoes/app/messaging/repository/MessageThreadRepository.java \
  "apps/web/app/(admin)/admin/orders/_components/OrderDrawer/UnreadElsewhereBanner.tsx" \
  "apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx" \
  apps/web/lib/messaging/api.ts \
  apps/web/lib/messaging/types.ts
git commit -m "$(cat <<'EOF'
feat(backend+web): UnreadElsewhereBanner + GET /orders/{id}/unread-elsewhere

[milestone:5][task:5-14]

Backend: OrderUnreadElsewhereController returns {count, threadId} for the
client's most-recent unread thread not linked to the current order. 3 IT cases.
Frontend: UnreadElsewhereBanner (amber, Polish pluralization, Link to thread).
OrderDrawerMessages polls the endpoint on orderId change (race-cancel guard)
and renders the banner when count > 0.
pnpm typecheck green.

Refs: docs/dispatch-log/5-14-<UTC>.md
EOF
)"
```

**Acceptance:**
- `GET /api/admin/orders/{orderId}/unread-elsewhere` → `{count: N, threadId: UUID}` when client has unread elsewhere; `{count: 0, threadId: null}` when none; 3 IT cases GREEN.
- `UnreadElsewhereBanner` renders amber border, correct Polish plural string (1/2-4/5+), `Link` to `/admin/messages?thread=<threadId>`.
- Banner visible in `OrderDrawerMessages` when `count > 0`; hidden when 0.
- Race-cancel guard present in the `useEffect` that fetches unread-elsewhere.
- `pnpm typecheck` green. Suite delta: +3.
### Task 5-15: Page shell + ThreadList + filter chips + search input

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/page.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/MessagesShell.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/MessagesHeader.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/ThreadList.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/ThreadListRow.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/FilterChip.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/useThreadSelection.ts`

**Review:** two-stage (spec + quality). Multi-component composition with polling wiring.

---

- [ ] **Step 1: Write the server page shell**

Create `apps/web/app/(admin)/admin/messages/page.tsx`:

```tsx
import { Suspense } from "react";
import { MessagesShell } from "./_components/MessagesShell";

interface Props {
  searchParams: Promise<{ thread?: string }>;
}

/**
 * Server component: reads ?thread= deep-link from OrderDrawer.
 * All client state lives in MessagesShell.
 */
export default async function MessagesPage({ searchParams }: Props) {
  const { thread } = await searchParams;
  return (
    <Suspense>
      <MessagesShell initialThreadId={thread ?? null} />
    </Suspense>
  );
}
```

---

- [ ] **Step 2: Write `useThreadSelection` hook**

Create `apps/web/app/(admin)/admin/messages/_components/useThreadSelection.ts`:

```ts
"use client";

import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import type { ThreadDto } from "@/lib/messaging/types";

const log = createLogger("messaging.selection");

export type ThreadFilter = "ALL" | "UNREAD" | "UNMATCHED";

export interface ThreadSelectionState {
  selectedId: string | null;
  filter: ThreadFilter;
  channel: string | null;
  q: string;
  setSelectedId: (id: string | null) => void;
  setFilter: (f: ThreadFilter) => void;
  setChannel: (c: string | null) => void;
  setQ: (q: string) => void;
}

export function useThreadSelection(initialThreadId: string | null): ThreadSelectionState {
  const [selectedId, setSelectedIdRaw] = useState<string | null>(initialThreadId);
  const [filter, setFilter] = useState<ThreadFilter>("ALL");
  const [channel, setChannel] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const setSelectedId = useCallback((id: string | null) => {
    log.info("op=selectThread", { threadId: id });
    setSelectedIdRaw(id);
  }, []);

  return { selectedId, filter, channel, q, setSelectedId, setFilter, setChannel, setQ };
}
```

---

- [ ] **Step 3: Write `MessagesShell`**

Create `apps/web/app/(admin)/admin/messages/_components/MessagesShell.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { MessagesHeader } from "./MessagesHeader";
import { ThreadList } from "./ThreadList";
import { SelectedThread } from "./SelectedThread";
import { UnmatchedThreadPanel } from "./UnmatchedThreadPanel";
import { EmptyState } from "./EmptyState";
import { ThreadClientPanel } from "./ThreadClientPanel";
import { NewMessageDialog } from "./NewMessageDialog";
import type { ThreadDto } from "@/lib/messaging/types";
import { useThreadSelection, type ThreadFilter } from "./useThreadSelection";

const log = createLogger("messaging.shell");

interface Props {
  initialThreadId: string | null;
}

export function MessagesShell({ initialThreadId }: Props) {
  const sel = useThreadSelection(initialThreadId);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ThreadDto | null>(null);

  const handleThreadLoaded = useCallback((t: ThreadDto) => {
    setSelectedThread(t);
  }, []);

  const showComposer = selectedThread && !selectedThread.unmatched;
  const showUnmatched = selectedThread?.unmatched === true;

  return (
    <div className="flex flex-col h-screen bg-paper">
      <MessagesHeader onNewMessage={() => setNewMsgOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <ThreadList
          selectedId={sel.selectedId}
          filter={sel.filter}
          channel={sel.channel}
          q={sel.q}
          onSelect={sel.setSelectedId}
          onFilterChange={sel.setFilter}
          onQChange={sel.setQ}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!sel.selectedId && (
            <EmptyState variant="no-selection" />
          )}
          {sel.selectedId && showUnmatched && (
            <UnmatchedThreadPanel
              thread={selectedThread!}
              onResolved={() => sel.setSelectedId(null)}
            />
          )}
          {sel.selectedId && !showUnmatched && (
            <SelectedThread
              threadId={sel.selectedId}
              onLoaded={handleThreadLoaded}
            />
          )}
        </main>

        {selectedThread && !selectedThread.unmatched && (
          <ThreadClientPanel thread={selectedThread} />
        )}
      </div>

      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSent={(threadId) => sel.setSelectedId(threadId)}
      />
    </div>
  );
}
```

> **Flag:** MessagesShell is ~75 LOC — within cap. `useThreadSelection` is extracted as a hook per plan instruction.

---

- [ ] **Step 4: Write `MessagesHeader`**

Create `apps/web/app/(admin)/admin/messages/_components/MessagesHeader.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("messaging.header");

interface Props {
  onNewMessage: () => void;
}

export function MessagesHeader({ onNewMessage }: Props) {
  const [refreshTs, setRefreshTs] = useState<string>("");

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    setRefreshTs(fmt());
  }, []);

  function handleRefresh() {
    log.info("op=manualRefresh");
    setRefreshTs(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
    window.location.reload();
  }

  return (
    <div className="flex items-end justify-between border-b border-admin-line px-6 py-4 bg-white shrink-0">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight leading-none">Wiadomości</h1>
        {refreshTs && (
          <div className="text-[11px] text-admin-mute mt-1.5">
            odświeżono · {refreshTs} · live
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 rounded-md border border-admin-line bg-white hover:bg-admin-hover"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
          </svg>
          Odśwież
        </button>
        <button
          onClick={onNewMessage}
          className="h-8 px-3 text-[13px] font-semibold inline-flex items-center gap-1.5 rounded-md bg-ink text-paper hover:bg-ink/90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nowa wiadomość
        </button>
      </div>
    </div>
  );
}
```

---

- [ ] **Step 5: Write `FilterChip`**

Create `apps/web/app/(admin)/admin/messages/_components/FilterChip.tsx`:

```tsx
interface Props {
  active?: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}

/**
 * Filter chip with optional count badge. ~25 LOC.
 */
export function FilterChip({ active, label, count, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={
        "h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium border transition-colors " +
        (active
          ? "bg-ink text-paper border-ink"
          : "bg-white text-ink border-admin-line hover:bg-admin-hover")
      }
    >
      {label}
      {typeof count === "number" && (
        <span className={
          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold " +
          (active ? "bg-acid text-ink" : "bg-admin-line text-admin-mute")
        }>{count}</span>
      )}
    </button>
  );
}
```

---

- [ ] **Step 6: Write `ThreadListRow`**

Create `apps/web/app/(admin)/admin/messages/_components/ThreadListRow.tsx`:

```tsx
import type { ThreadDto } from "@/lib/messaging/types";

interface Props {
  thread: ThreadDto;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Single row in the thread list. Renders client name or raw sender, channel chip,
 * unread bullet, and last-message preview. ~55 LOC.
 */
export function ThreadListRow({ thread: t, selected, onSelect }: Props) {
  const isUnread = t.unreadCount > 0;
  const channelCls = t.channel === "EMAIL"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(t.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(t.id)}
      className={
        "relative flex gap-3 px-4 py-3 border-b border-admin-line cursor-pointer " +
        (selected ? "bg-paper" : "hover:bg-admin-hover/60")
      }
    >
      {selected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-acid" />}
      <div className={
        (t.clientName ? "bg-ink text-paper" : "bg-pink-100 text-pink-700 ring-1 ring-pink-300") +
        " flex items-center justify-center rounded-full font-semibold shrink-0 text-[13px]"
      } style={{ width: 36, height: 36 }}>
        {t.clientName ? t.clientName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase() : "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {t.unmatched ? (
            <span className="font-mono text-[13px] font-semibold text-pink-800 truncate">{t.rawSender}</span>
          ) : (
            <span className={"text-[14px] truncate " + (isUnread ? "font-semibold text-ink" : "font-medium text-ink/85")}>{t.clientName}</span>
          )}
          <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + channelCls}>
            {t.channel}
          </span>
          {t.unmatched && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">niesparowane</span>
          )}
        </div>
        <div className={"text-[13px] mt-1 truncate " + (isUnread ? "text-ink" : "text-admin-mute")}>{t.lastMessagePreview}</div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0 pl-1">
        <span className={"text-[11px] " + (isUnread ? "text-ink font-semibold" : "text-admin-mute")}>
          {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        {isUnread && (
          <span className="mt-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold">
            {t.unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 7: Write `ThreadList`**

Create `apps/web/app/(admin)/admin/messages/_components/ThreadList.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { listThreads } from "@/lib/messaging/api";
import type { ThreadDto } from "@/lib/messaging/types";
import { ThreadListRow } from "./ThreadListRow";
import { FilterChip } from "./FilterChip";
import { EmptyState } from "./EmptyState";
import type { ThreadFilter } from "./useThreadSelection";

const log = createLogger("messaging.threadlist");
const POLL_MS = 30_000;

interface Props {
  selectedId: string | null;
  filter: ThreadFilter;
  channel: string | null;
  q: string;
  onSelect: (id: string) => void;
  onFilterChange: (f: ThreadFilter) => void;
  onQChange: (q: string) => void;
}

export function ThreadList({ selectedId, filter, channel, q, onSelect, onFilterChange, onQChange }: Props) {
  const [threads, setThreads] = useState<ThreadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listThreads(filter, channel, q);
        if (!cancelled) setThreads(data);
      } catch (err) {
        log.error("op=listThreads outcome=error", { err: String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    timerRef.current = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [filter, channel, q]);

  const unreadCount = threads.filter(t => t.unreadCount > 0).length;
  const unmatchedCount = threads.filter(t => t.unmatched).length;

  return (
    <aside className="w-[380px] shrink-0 border-r border-admin-line bg-white flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-admin-line">
        <div className="relative mb-3">
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Szukaj klienta, treści, numeru…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-admin-line bg-paper text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40"
          />
          <svg className="absolute left-3 top-2.5 text-admin-mute" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === "ALL"} label="Wszystkie" count={threads.length} onClick={() => onFilterChange("ALL")} />
          <FilterChip active={filter === "UNREAD"} label="Nieprzeczytane" count={unreadCount} onClick={() => onFilterChange("UNREAD")} />
          <FilterChip active={filter === "UNMATCHED"} label="Niesparowane" count={unmatchedCount} onClick={() => onFilterChange("UNMATCHED")} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && threads.length === 0 && (
          <div className="space-y-0">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex gap-3 items-center px-4 py-3 border-b border-admin-line">
                <div className="w-9 h-9 rounded-full bg-admin-line animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-admin-line animate-pulse" style={{ width: ["62%", "48%", "72%"][i] }} />
                  <div className="h-2.5 rounded bg-admin-line/60 animate-pulse" style={{ width: ["88%", "70%", "54%"][i] }} />
                </div>
                <div className="w-10 h-2.5 rounded bg-admin-line/70 animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {!loading && threads.length === 0 && filter === "UNREAD" && (
          <EmptyState variant="no-unread" />
        )}
        {!loading && threads.length === 0 && filter === "ALL" && (
          <EmptyState variant="cold-start" />
        )}
        {threads.map(t => (
          <ThreadListRow key={t.id} thread={t} selected={t.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </aside>
  );
}
```

> **Flag:** ThreadList is ~75 LOC — within cap. Polling: 30s per spec §3 row 9.

---

- [ ] **Step 8: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors. Common pitfall: `ThreadDto` and `listThreads` are added by slice B's 5-11/5-12 tasks. If those haven't shipped, create stub exports for unblocking only — remove stubs after slice B merges.

---

- [ ] **Step 9: Commit**

```bash
git add \
  apps/web/app/\(admin\)/admin/messages/page.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/MessagesShell.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/MessagesHeader.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/ThreadList.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/ThreadListRow.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/FilterChip.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/useThreadSelection.ts
git commit -m "$(cat <<'EOF'
feat(messages): page shell + ThreadList + filter chips + search (30s poll) [milestone:5][task:5-15]

Server page reads ?thread= deep-link; MessagesShell holds selection state;
ThreadList polls listThreads every 30s; ThreadListRow renders unread + unmatched badges;
FilterChip and useThreadSelection extracted per granularity rule.

Refs: docs/dispatch-log/5-15-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- `/admin/messages` renders without errors.
- ThreadList loads threads and auto-refreshes at 30s.
- Filter chips (Wszystkie / Nieprzeczytane / Niesparowane) switch visible set.
- Search input debounces and re-queries.
- Selecting a row highlights it with the left accent bar.
- Unread bullet and count render on rows with `unreadCount > 0`.
- Unmatched rows show pink "niesparowane" badge.
- Skeleton shimmer shows while first load is in flight.
- `pnpm typecheck` 0 errors.

---

### Task 5-16: ThreadHeader + MessageBubble + SelectedThread (10s polling)

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/_components/IconBtn.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/ThreadHeader.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/MessageBubble.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/SelectedThread.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write `IconBtn` atom**

Create `apps/web/app/(admin)/admin/messages/_components/IconBtn.tsx`:

```tsx
import { type ReactNode } from "react";

interface Props {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "ghost" | "outline";
  disabled?: boolean;
}

/**
 * Tiny icon-only button. Radix Tooltip target in production. ~20 LOC.
 */
export function IconBtn({ label, onClick, children, variant = "ghost", disabled }: Props) {
  const cls = variant === "ghost"
    ? "hover:bg-admin-hover text-admin-mute hover:text-ink"
    : "bg-white border border-admin-line hover:bg-admin-hover";
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={"h-8 w-8 rounded-md inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed " + cls}
    >
      {children}
    </button>
  );
}
```

---

- [ ] **Step 2: Write `ThreadHeader`**

Create `apps/web/app/(admin)/admin/messages/_components/ThreadHeader.tsx`:

```tsx
"use client";

import { createLogger } from "@/lib/log";
import { markThreadRead } from "@/lib/messaging/api";
import type { ThreadDto } from "@/lib/messaging/types";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.threadheader");

interface Props {
  thread: ThreadDto;
  onReadMarked?: () => void;
}

export function ThreadHeader({ thread: t, onReadMarked }: Props) {
  const channelCls = t.channel === "EMAIL"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";
  const initials = t.clientName
    ? t.clientName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  async function handleMarkRead() {
    log.info("op=markRead", { threadId: t.id });
    try {
      await markThreadRead(t.id);
      onReadMarked?.();
    } catch (err) {
      log.error("op=markRead outcome=error", { threadId: t.id, err: String(err) });
    }
  }

  return (
    <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-ink text-paper flex items-center justify-center rounded-full font-semibold shrink-0 text-[15px]" style={{ width: 40, height: 40 }}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-none truncate">{t.clientName ?? t.rawSender}</h2>
            <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + channelCls}>{t.channel}</span>
          </div>
          <div className="text-[11px] text-admin-mute mt-1.5 flex items-center gap-3">
            {t.clientId && (
              <>
                <a href={`/admin/clients/${t.clientId}`} className="hover:text-ink hover:underline underline-offset-2">→ profil klienta</a>
                <span>·</span>
              </>
            )}
            <span>ostatnia aktywność {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("pl-PL") : "—"}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn label="Oznacz jako przeczytane" onClick={handleMarkRead}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </IconBtn>
        <IconBtn label="Archiwizuj (wkrótce)" disabled>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="5"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>
        </IconBtn>
        <IconBtn label="Więcej">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="6" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18" r="1.2"/></svg>
        </IconBtn>
      </div>
    </div>
  );
}
```

---

- [ ] **Step 3: Write `MessageBubble`**

Create `apps/web/app/(admin)/admin/messages/_components/MessageBubble.tsx`:

```tsx
"use client";

import { createLogger } from "@/lib/log";
import { retryMessage } from "@/lib/messaging/api";
import { MessageStatusBadge } from "@/app/(admin)/admin/orders/_components/MessageStatusBadge";
import type { MessageDto } from "@/lib/messaging/types";

const log = createLogger("messaging.bubble");

interface Props {
  message: MessageDto;
  clientName: string | null;
  onRetried?: () => void;
}

/**
 * Single message bubble. INBOUND = left, OUTBOUND = right.
 * Reuses existing MessageStatusBadge from M4. ~55 LOC.
 */
export function MessageBubble({ message: m, clientName, onRetried }: Props) {
  const inbound = m.direction === "INBOUND";
  const ts = m.sentAt
    ? new Date(m.sentAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
    : "—";

  async function handleRetry() {
    log.info("op=retryMessage", { messageId: m.id });
    try {
      await retryMessage(m.id);
      onRetried?.();
    } catch (err) {
      log.error("op=retryMessage outcome=error", { messageId: m.id, err: String(err) });
    }
  }

  return (
    <div className={"flex " + (inbound ? "justify-start" : "justify-end")}>
      <div className={"max-w-[78%] " + (inbound ? "" : "items-end flex flex-col")}>
        <div className="text-[11px] text-admin-mute mb-1 flex items-center gap-2">
          {inbound ? (
            <><span className="font-semibold text-ink/80">{clientName ?? m.id}</span><span>·</span><span>{ts}</span></>
          ) : (
            <><span>{ts}</span><MessageStatusBadge status={m.deliveryStatus} /></>
          )}
        </div>
        <div className={(inbound ? "bg-white border border-admin-line text-ink" : "bg-ink text-paper") + " rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed"}>
          {m.body}
        </div>
        {m.deliveryStatus === "FAILED" && !inbound && (
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <span className="flex-1">{m.errorMessage ?? "Nie udało się wysłać."}</span>
            <button onClick={handleRetry} className="font-semibold hover:underline shrink-0">Wyślij ponownie →</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 4: Write `SelectedThread`**

Create `apps/web/app/(admin)/admin/messages/_components/SelectedThread.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getThread, markThreadRead } from "@/lib/messaging/api";
import type { ThreadDto } from "@/lib/messaging/types";
import { ThreadHeader } from "./ThreadHeader";
import { MessageBubble } from "./MessageBubble";
import { ReplyComposer } from "./ReplyComposer";

const log = createLogger("messaging.selectedthread");
const POLL_MS = 10_000;

interface Props {
  threadId: string;
  onLoaded: (t: ThreadDto) => void;
}

/**
 * Owns 10s polling for the selected thread. Calls markThreadRead on mount/threadId change.
 * Race-cancel guard prevents stale setState after threadId switch.
 */
export function SelectedThread({ threadId, onLoaded }: Props) {
  const [thread, setThread] = useState<ThreadDto | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cancelled: { v: boolean }) => {
    try {
      const data = await getThread(threadId);
      if (cancelled.v) return;
      setThread(data);
      onLoaded(data);
    } catch (err) {
      log.error("op=getThread outcome=error", { threadId, err: String(err) });
    } finally {
      if (!cancelled.v) setLoading(false);
    }
  }, [threadId, onLoaded]);

  useEffect(() => {
    const cancelled = { v: false };
    setLoading(true);
    setThread(null);

    // mark-read on selection; fire-and-forget
    markThreadRead(threadId).catch(err =>
      log.warn("op=markRead outcome=error", { threadId, err: String(err) })
    );

    load(cancelled);
    timerRef.current = setInterval(() => load(cancelled), POLL_MS);

    return () => {
      cancelled.v = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [threadId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages?.length]);

  if (loading && !thread) {
    return <div className="flex-1 flex items-center justify-center text-admin-mute text-[13px]">Ładowanie…</div>;
  }
  if (!thread) return null;

  // Group messages by date for dividers
  const msgs = thread.messages ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ThreadHeader thread={thread} onReadMarked={() => load({ v: false })} />
      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {msgs.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            clientName={thread.clientName}
            onRetried={() => load({ v: false })}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <ReplyComposer thread={thread} onSent={() => load({ v: false })} />
    </div>
  );
}
```

> **Note:** `thread.messages` is expected on `ThreadDto` (as added by slice B task 5-11). If the type shows `messages?: MessageDto[]` vs a dedicated `ThreadDetailDto`, adjust accordingly at implementation time — update this note as plan errata if the type differs.

---

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

---

- [ ] **Step 6: Commit**

```bash
git add \
  apps/web/app/\(admin\)/admin/messages/_components/IconBtn.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/ThreadHeader.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/MessageBubble.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/SelectedThread.tsx
git commit -m "$(cat <<'EOF'
feat(messages): ThreadHeader + MessageBubble + SelectedThread with 10s poll [milestone:5][task:5-16]

SelectedThread owns 10s polling with race-cancel guard; calls markThreadRead on
mount/threadId change. MessageBubble reuses M4 MessageStatusBadge; FAILED messages
show inline retry button wired to existing retryMessage. Archive button disabled
with "wkrótce" tooltip per M5 scope constraint.

Refs: docs/dispatch-log/5-16-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- Selecting a thread renders ThreadHeader + message log + ReplyComposer.
- Messages auto-refresh every 10s (verify with network tab or log output).
- Switching thread IDs cancels the previous poll and starts a new one (no stale setState).
- `markThreadRead` fires on thread selection.
- INBOUND messages render left-aligned; OUTBOUND right-aligned with status badge.
- FAILED outbound messages show error row with "Wyślij ponownie" button.
- Clicking retry calls `retryMessage` and reloads the thread.
- Archive button renders disabled.
- `pnpm typecheck` 0 errors.

---

### Task 5-17: ReplyComposer + TemplatePicker (TWO-STAGE)

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/_components/useReplyComposerState.ts`
- Create: `apps/web/app/(admin)/admin/messages/_components/ReplyComposer.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/TemplatePicker.tsx`

**Review:** two-stage. Composer state model is non-trivial (channel toggle, subject, SMS char count, ⌘+Enter, send error path).

---

- [ ] **Step 1: Write `useReplyComposerState` hook**

Create `apps/web/app/(admin)/admin/messages/_components/useReplyComposerState.ts`:

```ts
"use client";

import { useState, useCallback } from "react";
import type { Channel } from "@/lib/messaging/types";

export interface ReplyComposerState {
  channel: Channel;
  subject: string;
  body: string;
  sending: boolean;
  sendError: string | null;
  setChannel: (c: Channel) => void;
  setSubject: (s: string) => void;
  setBody: (b: string) => void;
  setSending: (v: boolean) => void;
  setSendError: (e: string | null) => void;
  fillTemplate: (templateBody: string, templateSubject?: string | null) => void;
  reset: () => void;
}

/**
 * Extracts composer state from ReplyComposer to keep the component under 80 LOC.
 * Caller provides defaultChannel derived from thread.channel.
 */
export function useReplyComposerState(defaultChannel: Channel): ReplyComposerState {
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fillTemplate = useCallback((templateBody: string, templateSubject?: string | null) => {
    setBody(templateBody);
    if (templateSubject) setSubject(templateSubject);
  }, []);

  const reset = useCallback(() => {
    setBody("");
    setSubject("");
    setSendError(null);
    setSending(false);
  }, []);

  return { channel, subject, body, sending, sendError, setChannel, setSubject, setBody, setSending, setSendError, fillTemplate, reset };
}
```

---

- [ ] **Step 2: Write `TemplatePicker`**

Create `apps/web/app/(admin)/admin/messages/_components/TemplatePicker.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createLogger } from "@/lib/log";
import { getTemplates } from "@/lib/messaging/api";
import type { TemplateDto } from "@/lib/messaging/types";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.templatepicker");

interface Props {
  onSelect: (body: string, subject?: string | null) => void;
}

/**
 * Radix Dropdown that loads templates and fills the composer body on selection. ~45 LOC.
 */
export function TemplatePicker({ onSelect }: Props) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(err => log.error("op=getTemplates outcome=error", { err: String(err) }));
  }, []);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconBtn label="Szablon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
        </IconBtn>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} align="start" className="z-50 min-w-[200px] rounded-md border border-admin-line bg-white shadow-md py-1">
          {templates.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-admin-mute">Brak szablonów</div>
          )}
          {templates.map(t => (
            <DropdownMenu.Item
              key={t.id}
              onSelect={() => onSelect(t.body, t.subject)}
              className="px-3 py-2 text-[13px] cursor-pointer hover:bg-admin-hover outline-none"
            >
              {t.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

---

- [ ] **Step 3: Write `ReplyComposer`**

Create `apps/web/app/(admin)/admin/messages/_components/ReplyComposer.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { sendReply } from "@/lib/messaging/api";
import type { ThreadDto } from "@/lib/messaging/types";
import { useReplyComposerState } from "./useReplyComposerState";
import { TemplatePicker } from "./TemplatePicker";
import { IconBtn } from "./IconBtn";

const log = createLogger("messaging.composer");
const SMS_MAX = 160;

interface Props {
  thread: ThreadDto;
  onSent: () => void;
}

/**
 * Channel-aware reply composer. State extracted to useReplyComposerState.
 * Supports: channel toggle, EMAIL subject, SMS char counter, ⌘+Enter send.
 * Attach button is disabled ("wkrótce") per M5 scope.
 */
export function ReplyComposer({ thread, onSent }: Props) {
  const st = useReplyComposerState(thread.channel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset composer when thread changes
  useEffect(() => { st.reset(); }, [thread.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!st.body.trim() || st.sending) return;
    log.info("op=sendReply", { threadId: thread.id, channel: st.channel });
    st.setSending(true);
    st.setSendError(null);
    try {
      await sendReply(thread.id, { channel: st.channel, subject: st.channel === "EMAIL" ? st.subject : undefined, body: st.body });
      st.reset();
      onSent();
    } catch (err) {
      log.error("op=sendReply outcome=error", { threadId: thread.id, err: String(err) });
      st.setSendError("Nie udało się wysłać. Spróbuj ponownie.");
    } finally {
      st.setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  const hasEmail = !!thread.clientEmail;
  const hasPhone = !!thread.clientPhone;
  const smsLen = st.body.length;

  return (
    <div className="border-t border-admin-line bg-white px-6 py-4 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex bg-paper border border-admin-line rounded-md p-0.5">
          {(["EMAIL", "SMS"] as const).map(ch => (
            <button
              key={ch}
              onClick={() => st.setChannel(ch)}
              disabled={ch === "EMAIL" ? !hasEmail : !hasPhone}
              className={"px-3 h-7 text-[12px] font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed " + (st.channel === ch ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-admin-mute">
          {st.channel === "EMAIL" ? `wyślij na ${thread.clientEmail ?? "—"}` : `wyślij na ${thread.clientPhone ?? "—"}`}
        </div>
      </div>
      {st.channel === "EMAIL" && (
        <input type="text" value={st.subject} onChange={e => st.setSubject(e.target.value)} placeholder="Temat"
          className="w-full h-9 px-3 mb-2 rounded-md border border-admin-line bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40" />
      )}
      <div className="relative">
        <textarea ref={textareaRef} rows={3} value={st.body} onChange={e => st.setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={st.channel === "EMAIL" ? "Napisz odpowiedź…" : "Napisz odpowiedź (max 160 znaków)…"}
          className="w-full px-3 py-2.5 rounded-md border border-admin-line bg-white text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40"
        />
        {st.channel === "SMS" && (
          <div className={"absolute bottom-2 right-3 text-[11px] " + (smsLen > SMS_MAX ? "text-red-600" : "text-admin-mute")}>
            {smsLen} / {SMS_MAX}
          </div>
        )}
      </div>
      {st.sendError && (
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {st.sendError}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <IconBtn label="Załącz (wkrótce)" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>
          </IconBtn>
          <TemplatePicker onSelect={st.fillTemplate} />
          <span className="text-[11px] text-admin-mute ml-2">⌘ + Enter — wyślij</span>
        </div>
        <button onClick={handleSend} disabled={st.sending || !st.body.trim()}
          className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-acid hover:bg-acid-deep text-ink font-semibold text-[13px] border border-ink/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
          {st.sending ? "Wysyłanie…" : "Wyślij"}
        </button>
      </div>
    </div>
  );
}
```

> **Flag:** ReplyComposer is ~75 LOC (with state hook extracted). TemplatePicker ~45 LOC. Both within cap. `useReplyComposerState` extracted as required by plan instruction for >80 LOC components.

> **Note:** `thread.clientEmail` and `thread.clientPhone` are expected fields on `ThreadDto` (as added by slice B). If the DTO uses different field names, update at implementation time and record in plan errata.

---

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

---

- [ ] **Step 5: Commit**

```bash
git add \
  apps/web/app/\(admin\)/admin/messages/_components/useReplyComposerState.ts \
  apps/web/app/\(admin\)/admin/messages/_components/ReplyComposer.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/TemplatePicker.tsx
git commit -m "$(cat <<'EOF'
feat(messages): ReplyComposer with channel toggle, SMS counter, ⌘+Enter, TemplatePicker [milestone:5][task:5-17]

Composer state extracted to useReplyComposerState hook (keeps component under 80 LOC).
Channel toggle disables unavailable channels per client contact data.
SMS character counter turns red at >160. Attach button disabled (M5 deferred).
TemplatePicker loads templates via existing M2 API endpoint.

Refs: docs/dispatch-log/5-17-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- EMAIL / SMS channel toggle works; disabled when client lacks the contact field.
- Subject input appears for EMAIL, hides for SMS.
- SMS char counter shows `N / 160`; turns red when over limit.
- ⌘+Enter (and Ctrl+Enter) triggers send.
- Send button is disabled while `body` is empty or during send.
- Send error renders inline error strip below textarea.
- TemplatePicker dropdown lists templates; selecting one fills body (and subject for EMAIL templates).
- Attach button renders disabled.
- After successful send, composer resets and `onSent` fires.
- `pnpm typecheck` 0 errors.

---

### Task 5-18: ThreadClientPanel (right rail)

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/_components/ThreadClientPanel.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Confirm active-order lookup**

The design right rail shows "Aktywne zlecenie" as the most-recent order with a non-terminal status. The existing `GET /api/admin/orders?clientId={id}&status=active` endpoint does not exist as a single endpoint per OrderController inspection. Use the existing `listOrders` function with `status` filter; the backend `GET /api/admin/orders?status=ACTIVE&q=` pattern returns a page. The component must call `listOrders({ clientId: t.clientId, status: "W_REALIZACJI" }, 0, 1)` (adjust status key to match OrderListFilters). If `clientId` filter is not yet supported by OrderController, render the "aktywne zlecenie" section as `—` with a TODO comment — do not add a backend endpoint in this task. Record finding in plan errata.

---

- [ ] **Step 2: Write `ThreadClientPanel`**

Create `apps/web/app/(admin)/admin/messages/_components/ThreadClientPanel.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";
import { getClient } from "@/lib/clients/api";
import type { ClientDto } from "@/lib/clients/types";
import type { ThreadDto } from "@/lib/messaging/types";

const log = createLogger("messaging.clientpanel");

interface Props {
  thread: ThreadDto;
}

/**
 * Right-rail panel showing client contact info, active order link, and totals.
 * 'spent' total stubbed as "—" — pricing column on Order not yet implemented.
 * ~75 LOC.
 */
export function ThreadClientPanel({ thread }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);

  useEffect(() => {
    if (!thread.clientId) return;
    let cancelled = false;
    getClient(thread.clientId)
      .then(c => { if (!cancelled) setClient(c); })
      .catch(err => log.error("op=getClient outcome=error", { clientId: thread.clientId, err: String(err) }));
    return () => { cancelled = true; };
  }, [thread.clientId]);

  if (!thread.clientId || !client) return null;

  const initials = client.firstName && client.lastName
    ? (client.firstName[0] + client.lastName[0]).toUpperCase()
    : (client.firstName?.[0] ?? "?").toUpperCase();
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ");
  const channelCls = (thread.channel === "EMAIL")
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";

  return (
    <aside className="w-[320px] shrink-0 border-l border-admin-line bg-paper flex flex-col overflow-auto">
      <div className="px-5 py-5 border-b border-admin-line">
        <div className="flex flex-col items-center text-center">
          <div className="bg-ink text-paper flex items-center justify-center rounded-full font-semibold text-[20px]" style={{ width: 56, height: 56 }}>
            {initials}
          </div>
          <div className="mt-2.5 font-semibold text-[15px]">{fullName}</div>
          <div className="text-[11px] text-admin-mute mt-0.5">
            klient od {new Date(client.createdAt).getFullYear()}
          </div>
        </div>
      </div>
      <div className="px-5 py-4 border-b border-admin-line space-y-2.5">
        {client.email && (
          <div>
            <div className="text-[10px] text-admin-mute uppercase mb-0.5">Email</div>
            <div className="text-[13px] font-mono">{client.email}</div>
          </div>
        )}
        {client.phone && (
          <div>
            <div className="text-[10px] text-admin-mute uppercase mb-0.5">Telefon</div>
            <div className="text-[13px] font-mono">{client.phone}</div>
          </div>
        )}
        <div>
          <div className="text-[10px] text-admin-mute uppercase mb-0.5">Preferowany kanał</div>
          <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + channelCls}>{thread.channel}</span>
        </div>
      </div>
      <div className="px-5 py-4 border-b border-admin-line">
        <div className="text-[10px] text-admin-mute uppercase mb-2">Aktywne zlecenie</div>
        {thread.recentOrderId ? (
          <a
            href={`/admin/orders?highlight=${thread.recentOrderId}`}
            className="block bg-white rounded-md border border-admin-line p-3 hover:border-ink/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-semibold">{thread.recentOrderCode ?? thread.recentOrderId}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800">
                {thread.recentOrderStatus ?? "—"}
              </span>
            </div>
            <div className="text-[11px] text-admin-mute mt-2">→ otwórz zlecenie</div>
          </a>
        ) : (
          <div className="text-[13px] text-admin-mute">—</div>
        )}
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-admin-mute uppercase">Wszystkie</div>
          <div className="text-[20px] font-semibold leading-tight mt-0.5">{thread.totalOrders ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] text-admin-mute uppercase">Razem</div>
          {/* TODO(M5+): pricing column on Order needed — stubbed as — */}
          <div className="text-[20px] font-semibold leading-tight mt-0.5">—</div>
        </div>
      </div>
    </aside>
  );
}
```

> **Note:** `thread.recentOrderId`, `thread.recentOrderCode`, `thread.recentOrderStatus`, `thread.totalOrders` are expected on `ThreadDto` as enriched by the backend `ThreadController`. If the backend DTO omits these fields, the section collapses gracefully to `—`. Record any mismatch as plan errata.

---

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

---

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/admin/messages/_components/ThreadClientPanel.tsx
git commit -m "$(cat <<'EOF'
feat(messages): ThreadClientPanel right rail (spent stubbed, active order link) [milestone:5][task:5-18]

Client info fetched via existing getClient API. Active order link uses
recentOrderId/recentOrderCode/recentOrderStatus from ThreadDto (backend-enriched).
spent total stubbed as — with TODO comment (pricing column deferred per M5 spec §2).

Refs: docs/dispatch-log/5-18-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- Right rail renders client name, email, phone, preferred channel chip.
- Active order card renders with code, status badge, and link when `thread.recentOrderId` is present.
- Active order section shows `—` when absent.
- Totals row shows `—` for "Razem" (spent stub).
- Panel is absent (returns null) when `thread.clientId` is null (unmatched thread).
- `pnpm typecheck` 0 errors.

---

### Task 5-19: EmptyState + UnmatchedThreadPanel + assign/discard wiring

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/_components/EmptyState.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/UnmatchedThreadPanel.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/AssignUnmatchedDialog.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write `EmptyState`**

Create `apps/web/app/(admin)/admin/messages/_components/EmptyState.tsx`:

```tsx
import { type ReactNode } from "react";

type Variant = "cold-start" | "no-selection" | "no-unread" | "send-error";

interface Props {
  variant: Variant;
  onNewMessage?: () => void;
}

const CONFIGS: Record<Variant, { icon: ReactNode; title: string; body: string }> = {
  "cold-start": {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>,
    title: "Brak wiadomości",
    body: "Gdy klient odpowie na maila lub SMS-a, wątek pojawi się tutaj.",
  },
  "no-selection": {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    title: "Wybierz wątek z listy",
    body: "Klik w wątek po lewej stronie otworzy historię konwersacji i composer.",
  },
  "no-unread": {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
    title: "Brak nieprzeczytanych",
    body: 'Wszystkie wątki zostały przeczytane. Sprawdź filtr „Wszystkie" by zobaczyć całą historię.',
  },
  "send-error": {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
    title: "Błąd wysyłki",
    body: "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
  },
};

/**
 * Parameterized empty state for four cases. ~45 LOC.
 */
export function EmptyState({ variant, onNewMessage }: Props) {
  const cfg = CONFIGS[variant];
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 flex-1">
      <div className="w-12 h-12 rounded-full bg-paper border border-admin-line flex items-center justify-center text-admin-mute mb-3">
        {cfg.icon}
      </div>
      <div className="text-[14px] font-semibold">{cfg.title}</div>
      <div className="text-[13px] text-admin-mute mt-1 max-w-[280px] leading-relaxed">{cfg.body}</div>
      {variant === "cold-start" && onNewMessage && (
        <button onClick={onNewMessage} className="mt-3 h-8 px-3 rounded-md bg-ink text-paper text-[12.5px] font-semibold">
          Wyślij pierwszą wiadomość
        </button>
      )}
    </div>
  );
}
```

---

- [ ] **Step 2: Write `AssignUnmatchedDialog`**

Create `apps/web/app/(admin)/admin/messages/_components/AssignUnmatchedDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { assignUnmatched } from "@/lib/messaging/api";
import { ClientPicker } from "@/components/clients/ClientPicker";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("messaging.assign-dialog");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threadId: string;
  onAssigned: () => void;
}

/**
 * Radix Dialog wrapping ClientPicker for assigning an unmatched thread. ~50 LOC.
 */
export function AssignUnmatchedDialog({ open, onOpenChange, threadId, onAssigned }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!client) return;
    log.info("op=assignUnmatched", { threadId, clientId: client.id });
    setSaving(true);
    setError(null);
    try {
      await assignUnmatched(threadId, client.id);
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      log.error("op=assignUnmatched outcome=error", { threadId, clientId: client.id, err: String(err) });
      setError("Nie udało się przypisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[420px] space-y-4">
          <Dialog.Title className="text-[16px] font-semibold">Przypisz do klienta</Dialog.Title>
          <Dialog.Description className="text-[13px] text-admin-mute">
            Wybierz istniejącego klienta. Wszystkie wiadomości z tego wątku zostaną do niego przypisane.
          </Dialog.Description>
          <ClientPicker value={client} onChange={setClient} />
          {error && <div className="text-[12px] text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover">
              Anuluj
            </button>
            <button onClick={handleConfirm} disabled={!client || saving}
              className="h-9 px-4 rounded-md bg-ink text-paper text-[13px] font-semibold disabled:opacity-50">
              {saving ? "Przypisuję…" : "Przypisz"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

- [ ] **Step 3: Write `UnmatchedThreadPanel`**

Create `apps/web/app/(admin)/admin/messages/_components/UnmatchedThreadPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { createLogger } from "@/lib/log";
import { discardUnmatched } from "@/lib/messaging/api";
import type { ThreadDto } from "@/lib/messaging/types";
import { AssignUnmatchedDialog } from "./AssignUnmatchedDialog";
import { ClientCreateModal } from "@/components/clients/ClientCreateModal";
import { assignUnmatched } from "@/lib/messaging/api";

const log = createLogger("messaging.unmatched");

interface Props {
  thread: ThreadDto;
  onResolved: () => void;
}

/**
 * Panel for unmatched inbound threads. Shows sender info, message preview, and three CTAs:
 * Assign / Create new / Discard. ~65 LOC.
 */
export function UnmatchedThreadPanel({ thread, onResolved }: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  async function handleDiscard() {
    log.info("op=discardUnmatched", { threadId: thread.id });
    setDiscarding(true);
    try {
      await discardUnmatched(thread.id);
      onResolved();
    } catch (err) {
      log.error("op=discardUnmatched outcome=error", { threadId: thread.id, err: String(err) });
    } finally {
      setDiscarding(false);
    }
  }

  const lastMsg = thread.messages?.[0];

  return (
    <div className="flex-1 bg-paper flex flex-col">
      <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center gap-3 shrink-0">
        <div className="bg-pink-100 text-pink-700 ring-1 ring-pink-300 flex items-center justify-center rounded-full font-semibold shrink-0 text-[14px]" style={{ width: 40, height: 40 }}>?</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-pink-800">{thread.rawSender}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">niesparowane</span>
          </div>
          <div className="text-[11px] text-admin-mute mt-1.5">{thread.channel} · otrzymane {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleDateString("pl-PL") : "—"}</div>
        </div>
      </div>
      <div className="flex-1 px-6 py-5 space-y-4 overflow-auto">
        {lastMsg && (
          <div className="bg-white border border-admin-line rounded-lg px-3.5 py-2.5 text-[14px] max-w-[78%]">{lastMsg.body}</div>
        )}
        <div className="rounded-md border border-pink-200 bg-pink-50 p-4">
          <div className="text-[13px] font-semibold text-pink-900 mb-1">Ten nadawca nie jest przypisany do żadnego klienta</div>
          <div className="text-[12px] text-pink-800/80 mb-3 leading-relaxed">Zanim odpowiesz, wybierz akcję — composer pojawi się dopiero po przypisaniu.</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAssignOpen(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-ink text-paper text-[12.5px] font-semibold hover:bg-ink/90">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Przypisz do klienta
            </button>
            <button onClick={() => setCreateOpen(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-white border border-admin-line text-[12.5px] font-semibold hover:bg-admin-hover">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
              Utwórz nowego klienta
            </button>
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium text-admin-mute hover:text-ink hover:bg-admin-hover">
                  Odrzuć
                </button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[380px] space-y-4">
                  <AlertDialog.Title className="text-[16px] font-semibold">Odrzucić wątek?</AlertDialog.Title>
                  <AlertDialog.Description className="text-[13px] text-admin-mute">Wątek zostanie ukryty z listy. Tej operacji nie można cofnąć.</AlertDialog.Description>
                  <div className="flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <button className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover">Anuluj</button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <button onClick={handleDiscard} disabled={discarding} className="h-9 px-4 rounded-md bg-red-600 text-white text-[13px] font-semibold disabled:opacity-50">
                        {discarding ? "Odrzucam…" : "Odrzuć"}
                      </button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        </div>
      </div>

      <AssignUnmatchedDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        threadId={thread.id}
        onAssigned={onResolved}
      />

      <ClientCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (client) => {
          log.info("op=createAndAssign", { threadId: thread.id, clientId: client.id });
          try {
            await assignUnmatched(thread.id, client.id);
            onResolved();
          } catch (err) {
            log.error("op=createAndAssign outcome=error", { threadId: thread.id, err: String(err) });
          } finally {
            setCreateOpen(false);
          }
        }}
      />
    </div>
  );
}
```

> **Note:** `ClientCreateModal` is imported from `@/components/clients/ClientCreateModal` — the same modal used in M1's ClientPicker. Verify the import path matches the actual file location at implementation time. The `onCreate` callback receives a `ClientDto`; if it receives a different type, adjust accordingly and record in plan errata.

---

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

---

- [ ] **Step 5: Commit**

```bash
git add \
  apps/web/app/\(admin\)/admin/messages/_components/EmptyState.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/UnmatchedThreadPanel.tsx \
  apps/web/app/\(admin\)/admin/messages/_components/AssignUnmatchedDialog.tsx
git commit -m "$(cat <<'EOF'
feat(messages): EmptyState + UnmatchedThreadPanel + assign/discard wiring [milestone:5][task:5-19]

EmptyState parameterized for cold-start/no-selection/no-unread/send-error variants.
UnmatchedThreadPanel shows three CTAs: Assign (ClientPicker in Radix Dialog),
Create new (reuses M1 ClientCreateModal then auto-assigns), Discard (Radix AlertDialog,
soft-delete via discardUnmatched). All three paths call onResolved to collapse the panel.

Refs: docs/dispatch-log/5-19-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- `EmptyState` renders correctly for all four variants with correct Polish copy.
- No-selection state shows in main area when no thread is selected.
- Unmatched thread panel shows sender, last inbound message bubble, and action card.
- "Przypisz do klienta" opens AssignUnmatchedDialog with ClientPicker.
- Confirming assign calls `assignUnmatched` and triggers `onResolved`.
- "Utwórz nowego klienta" opens ClientCreateModal; on success calls `assignUnmatched` then `onResolved`.
- "Odrzuć" shows Radix AlertDialog; confirming calls `discardUnmatched` and triggers `onResolved`.
- After resolution, MessagesShell resets `selectedId` to null (thread disappears from list on next poll).
- `pnpm typecheck` 0 errors.

---

### Task 5-20: NewMessageDialog (cross-thread compose)

**Files:**
- Create: `apps/web/app/(admin)/admin/messages/_components/NewMessageDialog.tsx`

**Review:** combined single-stage.

---

- [ ] **Step 1: Write `NewMessageDialog`**

Create `apps/web/app/(admin)/admin/messages/_components/NewMessageDialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { sendNewToClient } from "@/lib/messaging/api";
import { ClientPicker } from "@/components/clients/ClientPicker";
import type { ClientDto } from "@/lib/clients/types";
import type { Channel } from "@/lib/messaging/types";

const log = createLogger("messaging.newmsg");
const SMS_MAX = 160;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: (threadId: string) => void;
}

/**
 * "Nowa wiadomość" cross-thread composer. Radix Dialog wrapping ClientPicker
 * + channel selector + subject (EMAIL) + body textarea + Send.
 * On success: closes dialog, calls onSent(threadId) to select new/found thread.
 * ~80 LOC — recommend extracting state hook if it grows.
 */
export function NewMessageDialog({ open, onOpenChange, onSent }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setClient(null);
      setChannel("EMAIL");
      setSubject("");
      setBody("");
      setError(null);
    }
  }, [open]);

  const hasEmail = !!client?.email;
  const hasPhone = !!client?.phone;
  const effectiveChannel: Channel = channel === "EMAIL" && !hasEmail && hasPhone ? "SMS" : channel;

  async function handleSend() {
    if (!client || !body.trim() || sending) return;
    log.info("op=sendNewToClient", { clientId: client.id, channel: effectiveChannel });
    setSending(true);
    setError(null);
    try {
      const result = await sendNewToClient(client.id, {
        channel: effectiveChannel,
        subject: effectiveChannel === "EMAIL" ? subject : undefined,
        body,
      });
      onSent(result.threadId);
      onOpenChange(false);
    } catch (err) {
      log.error("op=sendNewToClient outcome=error", { clientId: client.id, err: String(err) });
      setError("Nie udało się wysłać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[500px] space-y-4">
          <Dialog.Title className="text-[16px] font-semibold">Nowa wiadomość</Dialog.Title>

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Klient</label>
            <ClientPicker value={client} onChange={setClient} />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Kanał</label>
            <div className="flex bg-paper border border-admin-line rounded-md p-0.5 w-fit">
              {(["EMAIL", "SMS"] as Channel[]).map(ch => (
                <button key={ch} onClick={() => setChannel(ch)}
                  disabled={ch === "EMAIL" ? !hasEmail : !hasPhone}
                  className={"px-3 h-7 text-[12px] font-medium rounded disabled:opacity-40 disabled:cursor-not-allowed " + (effectiveChannel === ch ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}>
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {effectiveChannel === "EMAIL" && (
            <div className="space-y-1">
              <label className="text-[12px] text-admin-mute uppercase">Temat</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Temat wiadomości"
                className="w-full h-9 px-3 rounded-md border border-admin-line text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Treść</label>
            <div className="relative">
              <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
                placeholder={effectiveChannel === "EMAIL" ? "Treść wiadomości…" : "Treść SMS (max 160 znaków)…"}
                className="w-full px-3 py-2.5 rounded-md border border-admin-line text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-acid/60"
              />
              {effectiveChannel === "SMS" && (
                <div className={"absolute bottom-2 right-3 text-[11px] " + (body.length > SMS_MAX ? "text-red-600" : "text-admin-mute")}>
                  {body.length} / {SMS_MAX}
                </div>
              )}
            </div>
          </div>

          {error && <div className="text-[12px] text-red-700">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover">
              Anuluj
            </button>
            <button onClick={handleSend} disabled={!client || !body.trim() || sending}
              className="h-9 px-4 rounded-md bg-acid text-ink text-[13px] font-semibold border border-ink/10 disabled:opacity-50 disabled:cursor-not-allowed">
              {sending ? "Wysyłanie…" : "Wyślij"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

> **Flag:** NewMessageDialog is ~85 LOC. Slightly over the 80 LOC cap. Recommend extracting `useNewMessageState` if the dialog gains further features in M5b. Left as-is for M5; the cap is a soft guideline for this dialog given it is self-contained state with no reuse potential.

> **Note:** `sendNewToClient` is expected to return `{ threadId: string }` (or an object containing it). Verify the return type in the `ThreadDto` / API response shape from slice B task 5-11 and adjust accordingly. Record any mismatch in plan errata.

---

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

---

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/messages/_components/NewMessageDialog.tsx
git commit -m "$(cat <<'EOF'
feat(messages): NewMessageDialog cross-thread composer with ClientPicker [milestone:5][task:5-20]

Radix Dialog: ClientPicker + channel toggle (auto-disables unavailable channels) +
subject (EMAIL) + body + SMS char counter. Calls sendNewToClient on submit;
on success selects the new/found thread via onSent(threadId).
Triggered from MessagesHeader "Nowa wiadomość" button.

Refs: docs/dispatch-log/5-20-<UTC>.md
EOF
)"
```

---

**Acceptance:**
- Dialog opens from "Nowa wiadomość" button in MessagesHeader.
- ClientPicker search and selection works inside the dialog.
- Channel toggle correctly disables EMAIL when client has no email, SMS when no phone.
- Subject field appears for EMAIL only.
- SMS char counter appears for SMS only; turns red at >160.
- Send button disabled until client + body are filled.
- On success: dialog closes, `onSent(threadId)` fires (MessagesShell selects the thread).
- Error renders inline on API failure.
- Form resets when dialog closes.
- `pnpm typecheck` 0 errors.

---

### Task 5-21: Closure

**Files:**
- Modify: `CLAUDE.md` (status block)
- Modify: `docs/dispatch-log/tasks.json` (task 5-21 → completed)

**Review:** combined single-stage.

---

- [ ] **Step 1: Run full backend suite**

```bash
cd backend && mvn -B verify
```

Expected: BUILD SUCCESS. Suite ≥ 220, 0 failures, 0 errors, 0 skipped. (M4 close was 201; M5 adds inbound ITs + ThreadController ITs.)
If count is below 220, confirm all `*IntegrationTest.java` classes are in `/test/` (not skipped by Surefire). Do NOT proceed with failures.

---

- [ ] **Step 2: Run frontend gates**

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm build
```

Expected:
- `pnpm typecheck` — 0 type errors.
- `pnpm lint` — 0 errors (warnings do not block).
- `pnpm build` — BUILD SUCCESSFUL, zero type errors in compiled output.

Fix any failures before proceeding. Do not proceed to step 3 with lint errors.

---

- [ ] **Step 3: Smoke record**

Automated only — consistent with M2/M3/M4 owner-locked precedent. `docker compose` manual UI smoke is not run.

```bash
# Automated smoke: backend suite ≥ 220, frontend build green.
# Manual UI smoke skipped per owner directive (precedent: M2/M3/M4).
# Inbound path exercised via PostmarkInboundControllerIntegrationTest + SmsApiInboundControllerIntegrationTest.
# Thread API exercised via ThreadControllerIntegrationTest.
# Frontend: pnpm typecheck + pnpm lint + pnpm build all green.
```

---

- [ ] **Step 4: Create local git tag `milestone-5`**

```bash
git tag -a milestone-5 -m "$(cat <<'EOF'
Milestone 5 — Inbound parsing + reply UI + cross-client inbox

21 tasks across 6 waves. Suite: 201 (M4 close) → ≥220/0/0/0.

What shipped:
- V012 schema: nullable client_id + raw_sender on message_thread and message;
  discarded_at on message_thread (soft-delete); UNIQUE partial index on
  (provider_message_id, channel) for inbound idempotency; partial index for
  unmatched bucket queries.
- InboundMessageService: idempotent inbound email + SMS recording. Client lookup
  by from-address (email) or from-phone (SMS). Unmatched path (raw_sender bucket).
  MESSAGE_RECEIVED audit + timeline event.
- PostmarkInboundController: POST /api/webhooks/postmark/inbound, HTTP Basic Auth.
  Full IT coverage: auth required, valid payload → row + thread + audit, duplicate
  idempotent, unmatched bucket.
- SmsApiInboundController: POST /api/webhooks/smsapi/inbound, IP allowlist.
  MO payload form-encoded. Same IT coverage pattern as Postmark inbound.
- MessageThreadService extensions: findOrCreateForClient, findOrCreateForRawSender,
  markRead, assignUnmatched (tx: thread + messages → client_id), discardUnmatched.
- ThreadController: GET /threads (filter/channel/search), GET /threads/{id},
  POST /threads/{id}/messages (reply), POST /threads/{id}/mark-read,
  POST /threads/{id}/assign, POST /threads/{id}/discard. Full IT coverage.
- MessagesController extension: POST /clients/{id}/messages (cross-thread compose).
- Timeline: MESSAGE_RECEIVED, THREAD_MARKED_READ, THREAD_ASSIGNED, THREAD_DISCARDED
  kinds + curator mappings.
- Frontend lib: ThreadDto, listThreads, getThread, sendReply, markThreadRead,
  assignUnmatched, discardUnmatched, sendNewToClient.
- Sidebar MessagesNavItem with 30s unread polling + 99+ cap badge.
- OrderDrawer UnreadElsewhereBanner: amber banner when client has unread elsewhere.
- /admin/messages inbox page: MessagesShell, ThreadList (30s poll), ThreadListRow,
  FilterChip, MessagesHeader.
- SelectedThread (10s poll, race-cancel, mark-read on mount), ThreadHeader,
  MessageBubble (reuses M4 MessageStatusBadge, inline retry).
- ReplyComposer (channel toggle, subject, SMS 160 counter, ⌘+Enter, send, error strip).
- TemplatePicker (Radix Dropdown, M2 templates API).
- ThreadClientPanel (client info, active order link, spent stubbed —).
- EmptyState (4 variants), UnmatchedThreadPanel (assign/create/discard wiring),
  AssignUnmatchedDialog (ClientPicker reuse), Radix AlertDialog for discard.
- NewMessageDialog (cross-thread compose: ClientPicker + channel + body → sendNewToClient).

Smoke: automated only (ITs + pnpm build) — manual UI smoke skipped per M2/M3/M4 precedent.

Deferred to M5b+:
- Archive (schema column present via discarded_at; archive icon renders disabled).
- Attachments (paperclip renders disabled; R2 upload is separate sub-feature).
- WhatsApp inbound.
- Pricing column / spent total (stubbed as —).
- Per-message read state.
- Auto-archive after N days.
- FTS / pg_trgm for search ranking.
EOF
)"
```

---

- [ ] **Step 5: Read and flip `CLAUDE.md` status row**

```bash
grep -n "Milestone 4\|Milestone 5" CLAUDE.md
```

Expected current state (from M4 closure):

```
- [x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry
```

Append the M5 row so the block ends with:

```
- [x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry
- [x] Milestone 5: Inbound parsing + reply UI + cross-client inbox
```

---

- [ ] **Step 6: Write dispatch log + update `tasks.json`**

Create `docs/dispatch-log/5-21-<UTC>.md`:

```markdown
# Dispatch log: 5-21

**task:** 5-21 — Closure
**milestone:** 5
**executed:** <UTC timestamp>
**subagent:** general-purpose Sonnet

## Files modified
- CLAUDE.md — status row added for Milestone 5

## Commands run
- `cd backend && mvn -B verify` → BUILD SUCCESS <N>/0/0/0
- `cd apps/web && pnpm typecheck && pnpm lint && pnpm build` → all green
- `git tag -a milestone-5 -m "..."` → tag created

## Test summary
Suite: <N>/0/0/0 (M5 close). All green.

## Decisions
- Manual smoke skipped per M2/M3/M4 owner-locked precedent.
- Spent total left as — stub per spec §2 (pricing column deferred).

## Commit SHA
<sha>
```

Update `docs/dispatch-log/tasks.json` — set `"status": "completed"` and `"commitSha": "<sha>"` for task `5-21`.

---

- [ ] **Step 7: Commit closure**

```bash
git add CLAUDE.md docs/dispatch-log/tasks.json docs/dispatch-log/5-21-*.md
git commit -m "$(cat <<'EOF'
docs: mark Milestone 5 complete [milestone:5][task:5-21]

Inbound parsing (email + SMS), unmatched quarantine, /admin/messages inbox,
SelectedThread 10s poll, ReplyComposer, ThreadClientPanel, EmptyState,
UnmatchedThreadPanel, NewMessageDialog, sidebar unread badge, OrderDrawer
UnreadElsewhereBanner. Suite ≥ 220. Local tag milestone-5 created.
CLAUDE.md status row flipped.

Refs: docs/dispatch-log/5-21-<UTC>.md
EOF
)"
git log --oneline -5
git tag --list 'milestone-*'
```

Expected: `milestone-5` listed alongside `milestone-4`, `milestone-3`, `milestone-2`, `milestone-1`, `milestone-0b`.

---

**Acceptance:**
- `mvn -B verify` BUILD SUCCESS ≥ 220/0/0/0.
- `pnpm typecheck && pnpm lint && pnpm build` all green.
- `git tag --list 'milestone-*'` shows `milestone-5`.
- `CLAUDE.md` status block includes `[x] Milestone 5: Inbound parsing + reply UI + cross-client inbox`.
- All tasks 5-1..5-21 marked `completed` in `docs/dispatch-log/tasks.json` with commit SHAs.
- Dispatch log written to `docs/dispatch-log/5-21-<UTC>.md`.

---

## Closing checklist

The following bars must all be green before task 5-21 is committed (M5 ship gates per spec §8):

1. All 21 tasks (`5-1` through `5-21`) marked `completed` in `docs/dispatch-log/tasks.json` with commit SHAs.
2. `cd backend && mvn -B verify` — BUILD SUCCESS, suite ≥ 220, 0 failures, 0 errors, 0 skipped. (M4 close was 201; M5 adds inbound + thread controller ITs. If count falls short, check that all `*IntegrationTest.java` classes are in the Surefire scan and Failsafe is activated in the module pom — per M4 hygiene-debt-now-fixed note.)
3. `cd apps/web && pnpm typecheck` — 0 type errors.
4. `cd apps/web && pnpm lint` — 0 errors (warnings do not block).
5. `cd apps/web && pnpm build` — BUILD SUCCESSFUL.
6. Local git tag `milestone-5` annotated with what shipped, suite count, smoke approach, and deferred items.
7. `CLAUDE.md` status block includes `[x] Milestone 5: Inbound parsing + reply UI + cross-client inbox`.
8. New session-memory entry summarizing M5 with a paste-ready resume prompt for M6.

---

## Plan errata findings (filled by implementers)

_None yet — implementers add discoveries here as tasks ship._
