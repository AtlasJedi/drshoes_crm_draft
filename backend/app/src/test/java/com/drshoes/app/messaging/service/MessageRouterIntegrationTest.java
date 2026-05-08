package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for MessageRouter — end-to-end send pipeline via the
 * LoggingEmailGateway (no real SMTP; returns delivery_status=SENT immediately).
 *
 * Seed data: uses "Zlecenie przyjete (EMAIL)" template from V006 migration.
 * Client and order rows are inserted via JdbcTemplate (same minimal-row
 * pattern used in IdempotencyServiceIntegrationTest and MessageThreadServiceIntegrationTest).
 */
class MessageRouterIntegrationTest extends AbstractIntegrationTest {

    @Autowired MessageRouter router;
    @Autowired MessageRepository messages;
    @Autowired MessageThreadRepository threads;
    @Autowired MessageTemplateRepository templates;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    /**
     * Inserts a minimal client + order row, wires them together, returns the order id.
     * Client gets email so the LoggingEmailGateway recipient check doesn't short-circuit.
     */
    private UUID createOrderAndClient() {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "TST-" + orderId.toString().substring(0, 8).toUpperCase();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Anna", "+48600000001", "anna@example.com");

        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "PRZYJETE");

        insertedClientId = clientId;
        insertedOrderId  = orderId;
        return orderId;
    }

    /** Returns the client_id stored on the given order row. */
    private UUID clientIdFor(UUID orderId) {
        return UUID.fromString(
                jdbc.queryForObject(
                        "SELECT client_id FROM order_ WHERE id = ?::uuid",
                        String.class, orderId.toString()));
    }

    @AfterEach
    void cleanup() {
        if (insertedOrderId != null) {
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

    // ============================================================
    // Test 1: sendManual persists message row with status=SENT
    // ============================================================
    @Test
    void manualSendPersistsMessageAsSent() {
        UUID orderId   = createOrderAndClient();
        UUID clientId  = clientIdFor(orderId);
        var template   = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

        UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

        var msg = messages.findById(messageId).orElseThrow();
        assertThat(msg.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(msg.getOrderId()).isEqualTo(orderId);
        // LoggingEmailGateway returns "logging-<UUID>" as provider id
        assertThat(msg.getProviderMessageId()).startsWith("logging-");
        assertThat(msg.getBody()).isNotNull();
    }

    // ============================================================
    // Test 2: sendManual bumps thread.lastMessageAt
    // ============================================================
    @Test
    void manualSendBumpsThreadLastMessageAt() {
        UUID orderId  = createOrderAndClient();
        UUID clientId = clientIdFor(orderId);
        var template  = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

        router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

        var thread = threads.findFirstByClientIdOrderByCreatedAtAsc(clientId).orElseThrow();
        assertThat(thread.getLastMessageAt()).isNotNull();
    }

    // ============================================================
    // Test 3: renderer substitutes placeholders
    // ============================================================
    @Test
    void rendersPlaceholdersInBody() {
        UUID orderId  = createOrderAndClient();
        UUID clientId = clientIdFor(orderId);
        var template  = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();

        UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

        var msg = messages.findById(messageId).orElseThrow();
        assertThat(msg.getBody()).doesNotContain("{imie_klienta}");
        assertThat(msg.getBody()).doesNotContain("{numer_zlecenia}");
    }
}
