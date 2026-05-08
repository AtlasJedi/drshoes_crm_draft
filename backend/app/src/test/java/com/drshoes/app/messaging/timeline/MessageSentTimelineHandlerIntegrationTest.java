package com.drshoes.app.messaging.timeline;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditTimelineService;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for MessageSentTimelineHandler wired through the full curator chain.
 *
 * <h2>Coverage</h2>
 * Test 1: sendManual → audit row produced → curator emits MESSAGE_SENT with correct labels.
 * Test 2: sendForTrigger → audit row produced → curator also emits MESSAGE_SENT (dual-path
 *         requirement from task 2-7 review concern E).
 *
 * <h2>Seed data</h2>
 * Client and order are inserted via JdbcTemplate (same minimal-row pattern as
 * MessageRouterIntegrationTest). Template "Zlecenie przyjete (EMAIL)" from V006.
 * Owner actorId from the seeded user_ row (misza@drshoes.pl) — looked up at runtime.
 *
 * <h2>AuditTimelineService method</h2>
 * {@code timelineForOrder(UUID)} is the public API under test — it drives the curator
 * over all audit rows for the given order and returns the curated event list.
 */
class MessageSentTimelineHandlerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MessageRouter router;
    @Autowired MessageTemplateRepository templates;
    @Autowired AuditTimelineService auditTimelineService;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    // ── helpers ──────────────────────────────────────────────────────────────

    private UUID createOrderAndClient() {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "TST-" + orderId.toString().substring(0, 8).toUpperCase();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Anna", "+48600000099", "anna.timeline@example.com");

        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "PRZYJETE");

        insertedClientId = clientId;
        insertedOrderId  = orderId;
        return orderId;
    }

    /** Returns a real trigger UUID from V006 seed (any enabled trigger will do). */
    private UUID seededTriggerId() {
        return UUID.fromString(
                jdbc.queryForObject(
                        "SELECT id FROM trigger_ WHERE enabled = TRUE LIMIT 1",
                        String.class));
    }

    @AfterEach
    void cleanup() {
        if (insertedOrderId != null) {
            jdbc.update("DELETE FROM audit_log WHERE parent_entity_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM message WHERE order_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM trigger_fire WHERE order_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", insertedOrderId.toString());
            insertedOrderId = null;
        }
        if (insertedClientId != null) {
            jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid", insertedClientId.toString());
            jdbc.update("DELETE FROM client WHERE id = ?::uuid", insertedClientId.toString());
            insertedClientId = null;
        }
    }

    // ── Test 1: sendManual ───────────────────────────────────────────────────

    /**
     * Calling sendManual produces an INTERNAL audit row (via @Audited).
     * The curator must translate it into a MESSAGE_SENT timeline event
     * with labels: messageId, channel, templateName.
     */
    @Test
    void messageSentEmitsTimelineEvent() {
        UUID orderId  = createOrderAndClient();
        var  template = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

        // actorId=null is acceptable for sendManual (same pattern as MessageRouterIntegrationTest).
        // The V002 seed users can be wiped by AdminWebTestBase.cleanupUsers() in other tests,
        // so we must not depend on misza@drshoes.pl being present in the shared container.
        UUID messageId = router.sendManual(orderId, insertedClientId, template.getId(), "EMAIL", null);

        List<TimelineEvent> events = auditTimelineService.timelineForOrder(orderId);

        List<TimelineEvent> messageSentEvents = events.stream()
                .filter(e -> e.kind() == TimelineEventKind.MESSAGE_SENT)
                .toList();

        assertThat(messageSentEvents)
                .as("exactly one MESSAGE_SENT event expected after sendManual")
                .hasSize(1);

        TimelineEvent evt = messageSentEvents.get(0);
        assertThat(evt.labels()).as("labels must contain messageId")
                .containsKey("messageId");
        assertThat(evt.labels().get("messageId"))
                .as("messageId label must match the persisted message id")
                .isEqualTo(messageId.toString());
        assertThat(evt.labels()).as("labels must contain channel")
                .containsEntry("channel", "EMAIL");
        assertThat(evt.labels()).as("labels must contain templateName")
                .containsKey("templateName");
        assertThat(evt.labels().get("templateName"))
                .as("templateName must not be blank fallback")
                .isNotBlank()
                .isNotEqualTo("—");
    }

    // ── Test 2: sendForTrigger (dual-path requirement) ───────────────────────

    /**
     * Calling sendForTrigger also produces an INTERNAL audit row (via @Audited on that
     * method). The curator must match BOTH sendManual AND sendForTrigger paths — this
     * test covers the second path explicitly (task 2-7 review concern E).
     */
    @Test
    void triggerFiredMessageAlsoEmitsTimelineEvent() {
        UUID orderId   = createOrderAndClient();
        var  template  = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

        // sendForTrigger has no actorId; triggerId must be a real FK — look up from V006 seed.
        UUID realTriggerId = seededTriggerId();
        UUID messageId     = router.sendForTrigger(orderId, insertedClientId, template.getId(), realTriggerId, "EMAIL");

        List<TimelineEvent> events = auditTimelineService.timelineForOrder(orderId);

        List<TimelineEvent> messageSentEvents = events.stream()
                .filter(e -> e.kind() == TimelineEventKind.MESSAGE_SENT)
                .toList();

        assertThat(messageSentEvents)
                .as("exactly one MESSAGE_SENT event expected after sendForTrigger")
                .hasSize(1);

        TimelineEvent evt = messageSentEvents.get(0);
        assertThat(evt.labels()).containsKey("messageId");
        assertThat(evt.labels().get("messageId")).isEqualTo(messageId.toString());
        assertThat(evt.labels()).containsEntry("channel", "EMAIL");
        // triggerId label must be present for trigger-fired messages
        assertThat(evt.labels())
                .as("triggerId label must be set for trigger-fired messages")
                .containsKey("triggerId");
        assertThat(evt.labels().get("triggerId")).isEqualTo(realTriggerId.toString());
    }
}
