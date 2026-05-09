package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for MessageReconcileTimelineHandler — no Spring context, no DB.
 *
 * Verifies that:
 *   - AUDIT_PATH_DELIVERED path → MESSAGE_DELIVERED kind
 *   - AUDIT_PATH_FAILED path    → MESSAGE_FAILED kind
 *   - unrelated path            → null (skip)
 *   - non-zero status           → null (skip)
 *   - null path                 → null (skip)
 */
class MessageReconcileTimelineHandlerTest {

    private static final String ACTOR = "System";
    private static final UUID   ORDER_ID = UUID.fromString("b0000000-0000-0000-0000-000000000002");

    private MessageReconcileTimelineHandler handler;

    @BeforeEach
    void setUp() {
        handler = new MessageReconcileTimelineHandler();
    }

    // ── applyDelivered path → MESSAGE_DELIVERED ──────────────────────────────

    @Test
    void applyDeliveredPath_emitsMessageDeliveredKind() {
        AuditLog row = auditLog(WebhookStatusReconciler.AUDIT_PATH_DELIVERED, 0, ORDER_ID);

        TimelineEvent event = handler.toEvent(row, ACTOR);

        assertThat(event).isNotNull();
        assertThat(event.kind()).isEqualTo(TimelineEventKind.MESSAGE_DELIVERED);
        assertThat(event.actorFullName()).isEqualTo(ACTOR);
        assertThat(event.labels()).containsEntry("orderId", ORDER_ID.toString());
    }

    // ── applyFailed path → MESSAGE_FAILED ───────────────────────────────────

    @Test
    void applyFailedPath_emitsMessageFailedKind() {
        AuditLog row = auditLog(WebhookStatusReconciler.AUDIT_PATH_FAILED, 0, ORDER_ID);

        TimelineEvent event = handler.toEvent(row, ACTOR);

        assertThat(event).isNotNull();
        assertThat(event.kind()).isEqualTo(TimelineEventKind.MESSAGE_FAILED);
        assertThat(event.actorFullName()).isEqualTo(ACTOR);
        assertThat(event.labels()).containsEntry("orderId", ORDER_ID.toString());
    }

    // ── unrelated path → null ────────────────────────────────────────────────

    @Test
    void unrelatedPath_returnsNull() {
        AuditLog row = auditLog("MessageRouter#sendManual", 0, ORDER_ID);

        TimelineEvent event = handler.toEvent(row, ACTOR);

        assertThat(event).isNull();
    }

    // ── non-zero status → null ───────────────────────────────────────────────

    @Test
    void nonZeroStatus_returnsNull() {
        AuditLog row = auditLog(WebhookStatusReconciler.AUDIT_PATH_DELIVERED, 500, ORDER_ID);

        TimelineEvent event = handler.toEvent(row, ACTOR);

        assertThat(event).isNull();
    }

    // ── null path → null ─────────────────────────────────────────────────────

    @Test
    void nullPath_returnsNull() {
        AuditLog row = auditLog(null, 0, ORDER_ID);

        TimelineEvent event = handler.toEvent(row, ACTOR);

        assertThat(event).isNull();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private AuditLog auditLog(String path, int status, UUID parentEntityId) {
        AuditLog log = new AuditLog();
        log.setMethod("INTERNAL");
        log.setPath(path);
        log.setStatus(status);
        if (parentEntityId != null) log.setParentEntityId(parentEntityId);
        return log;
    }
}
