package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression guard for the HTML body delivery pipeline.
 *
 * Proves that {@link MessageRouter#sendManual} with the "Gotowe do odbioru (EMAIL)"
 * template — which has a designer-shipped {@code body_html} (seeded by V022) — results in
 * a persisted {@link com.drshoes.app.messaging.domain.MessageEntity} whose
 * {@code body_html} column is:
 *   1. non-null
 *   2. length > 1000 (proves the full HTML was not truncated mid-write)
 *   3. contains the string {@code <table role="presentation"} (proves the designer HTML
 *      survived placeholder rendering without corruption or stripping)
 *
 * This test uses the LoggingEmailGateway (active in test profile) — no real SMTP needed.
 * The gateway receives the rendered HTML via MessageGatewayDispatcher and the persisted
 * message row captures it before dispatch.
 */
class MessageRouterEmailHtmlTest extends AbstractIntegrationTest {

    @Autowired MessageRouter router;
    @Autowired MessageRepository messages;
    @Autowired MessageTemplateRepository templates;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    /**
     * Inserts a minimal client (with email, so EmailGateway recipient check passes)
     * and order row, returning the order id.
     */
    private UUID createOrderAndClient() {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "TST-" + orderId.toString().substring(0, 8).toUpperCase();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Zofia", "+48601000100", "zofia@example.com");

        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "GOTOWE_DO_ODBIORU");

        insertedClientId = clientId;
        insertedOrderId  = orderId;
        return orderId;
    }

    private UUID clientIdFor(UUID orderId) {
        return UUID.fromString(
                jdbc.queryForObject(
                        "SELECT client_id FROM order_ WHERE id = ?::uuid",
                        String.class, orderId.toString()));
    }

    @AfterEach
    void cleanup() {
        if (insertedOrderId != null) {
            jdbc.update("DELETE FROM message       WHERE order_id  = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM trigger_fire  WHERE order_id  = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM order_        WHERE id        = ?::uuid", insertedOrderId.toString());
            insertedOrderId = null;
        }
        if (insertedClientId != null) {
            jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid", insertedClientId.toString());
            jdbc.update("DELETE FROM client          WHERE id        = ?::uuid", insertedClientId.toString());
            insertedClientId = null;
        }
    }

    @Test
    void sendManual_withGotodoOdbioru_persistsBodyHtmlNonNullAndContainsDesignerMarker() {
        UUID orderId  = createOrderAndClient();
        UUID clientId = clientIdFor(orderId);

        var template = templates.findByName("Gotowe do odbioru (EMAIL)")
                .orElseThrow(() -> new IllegalStateException(
                        "Template 'Gotowe do odbioru (EMAIL)' not found — V022 must be applied"));

        assertThat(template.getBodyHtml())
                .as("template.body_html must be seeded by V022")
                .isNotNull()
                .hasSizeGreaterThan(1000);

        UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

        var msg = messages.findById(messageId).orElseThrow();

        assertThat(msg.getBodyHtml())
                .as("persisted message.body_html must be non-null after sendManual with an HTML template")
                .isNotNull();

        assertThat(msg.getBodyHtml().length())
                .as("body_html length must exceed 1000 chars (no truncation)")
                .isGreaterThan(1000);

        assertThat(msg.getBodyHtml())
                .as("body_html must contain the <table role=\"presentation\" marker from the designer HTML")
                .contains("<table role=\"presentation\"");

        // Also verify the plain-text body was rendered (baseline health check)
        assertThat(msg.getBody())
                .as("plain-text body must be non-null and non-empty")
                .isNotNull()
                .isNotBlank();

        assertThat(msg.getDeliveryStatus())
                .as("message must be SENT via LoggingEmailGateway")
                .isEqualTo("SENT");
    }
}
