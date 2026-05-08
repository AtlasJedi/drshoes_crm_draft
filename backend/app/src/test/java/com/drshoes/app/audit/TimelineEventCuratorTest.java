package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for TimelineEventCurator — no Spring context, no DB.
 * Each test constructs a fake AuditLog row and asserts the curated event kind
 * and label values.
 *
 * Two-row audit semantics: every successful admin item-op produces TWO rows —
 * one HTTP row (from controller advice) and one INTERNAL row (from @Audited
 * service advice, method=INTERNAL, status=0). The curator skips HTTP item-op
 * rows and emits only the INTERNAL row to avoid double-counting.
 */
class TimelineEventCuratorTest {

    private static final String ORDER_UUID = "a0000000-0000-0000-0000-000000000001";
    private static final String ACTOR = "Jan Kowalski";

    private TimelineEventCurator curator;

    @BeforeEach
    void setUp() {
        curator = new TimelineEventCurator();
    }

    // ── ORDER_CREATED ────────────────────────────────────────────────────────

    @Test
    void orderCreated_emitsOrderCreatedEvent() {
        AuditLog log = auditLog("POST", "/api/admin/orders", 201, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        TimelineEvent event = result.get();
        assertThat(event.kind()).isEqualTo(TimelineEventKind.ORDER_CREATED);
        assertThat(event.actorFullName()).isEqualTo(ACTOR);
        assertThat(event.labels()).containsKey("path");
        assertThat(event.occurredAt()).isEqualTo(log.getCreatedAt());
    }

    // ── ORDER_UPDATED ────────────────────────────────────────────────────────

    @Test
    void orderUpdated_emitsOrderUpdatedEvent() {
        AuditLog log = auditLog("PATCH", "/api/admin/orders/" + ORDER_UUID, 200, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.ORDER_UPDATED);
        assertThat(result.get().labels()).containsKey("path");
    }

    // ── STATUS_CHANGED ───────────────────────────────────────────────────────

    @Test
    void statusChanged_emitsStatusChangedEvent() {
        AuditLog log = auditLog("POST", "/api/admin/orders/" + ORDER_UUID + "/status", 200, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.STATUS_CHANGED);
        assertThat(result.get().actorFullName()).isEqualTo(ACTOR);
    }

    // ── ORDER_SOFT_DELETED ───────────────────────────────────────────────────

    @Test
    void orderSoftDeleted_emitsOrderSoftDeletedEvent() {
        AuditLog log = auditLog("DELETE", "/api/admin/orders/" + ORDER_UUID, 204, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.ORDER_SOFT_DELETED);
    }

    // ── ITEM_ADDED ───────────────────────────────────────────────────────────

    @Test
    void itemAdded_internalRow_emitsItemAddedEvent() {
        UUID orderId = UUID.fromString(ORDER_UUID);
        AuditLog log = auditLog("INTERNAL", "OrderService#addItem", 0, null, orderId);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.ITEM_ADDED);
        assertThat(result.get().labels()).containsEntry("orderId", ORDER_UUID);
    }

    // ── ITEM_EDITED ──────────────────────────────────────────────────────────

    @Test
    void itemEdited_internalRow_emitsItemEditedEvent() {
        UUID orderId = UUID.fromString(ORDER_UUID);
        AuditLog log = auditLog("INTERNAL", "OrderService#updateItem", 0, null, orderId);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.ITEM_EDITED);
    }

    // ── ITEM_REMOVED ─────────────────────────────────────────────────────────

    @Test
    void itemRemoved_internalRow_emitsItemRemovedEvent() {
        UUID orderId = UUID.fromString(ORDER_UUID);
        AuditLog log = auditLog("INTERNAL", "OrderService#removeItem", 0, null, orderId);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.ITEM_REMOVED);
    }

    // ── SKIP: HTTP item-op rows ───────────────────────────────────────────────

    @Test
    void httpItemOpRow_isSkipped_toAvoidDoubleCount() {
        // The HTTP row for item operations is skipped; only INTERNAL row is emitted.
        AuditLog log = auditLog("POST", "/api/admin/orders/" + ORDER_UUID + "/items", 201, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isEmpty();
    }

    // ── SKIP: unknown paths ───────────────────────────────────────────────────

    @Test
    void unknownPath_returnsEmpty() {
        AuditLog log = auditLog("GET", "/api/admin/orders", 200, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isEmpty();
    }

    // ── SKIP: malformed UUID in path ──────────────────────────────────────────

    @Test
    void malformedUuidInPath_returnsEmpty() {
        AuditLog log = auditLog("PATCH", "/api/admin/orders/not-a-uuid", 200, null, null);

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isEmpty();
    }

    // ── SKIP: INTERNAL row with unknown method ────────────────────────────────

    @Test
    void internalRow_unknownMethod_returnsEmpty() {
        AuditLog log = auditLog("INTERNAL", "OrderService#unknownOp", 0, null, UUID.randomUUID());

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isEmpty();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private AuditLog auditLog(String method, String path, int status,
                               UUID actorId, UUID parentEntityId) {
        AuditLog log = new AuditLog();
        log.setMethod(method);
        log.setPath(path);
        log.setStatus(status);
        if (actorId != null) log.setActorId(actorId);
        if (parentEntityId != null) log.setParentEntityId(parentEntityId);
        return log;
    }
}
