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
 * Sister test to MessageRouterEmailHtmlTest — asserts the persisted message
 * body column is PLAIN TEXT (no HTML markup), while body_html holds the HTML.
 */
class MessageRouterPlainBodyTest extends AbstractIntegrationTest {

    @Autowired MessageRouter router;
    @Autowired MessageRepository messages;
    @Autowired MessageTemplateRepository templates;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    private UUID createOrderAndClient() {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
            clientId.toString(), "Test", "+48601000200", "t@example.com");
        jdbc.update("INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
            orderId.toString(), "PLN-1", clientId.toString(), "GOTOWE_DO_ODBIORU");
        insertedClientId = clientId;
        insertedOrderId  = orderId;
        return orderId;
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
    void sendManual_persistsPlainTextInBodyColumn() {
        UUID orderId  = createOrderAndClient();
        UUID clientId = insertedClientId;

        var template = templates.findByName("Gotowe do odbioru (EMAIL)")
                .orElseThrow(() -> new IllegalStateException(
                        "Template 'Gotowe do odbioru (EMAIL)' not found — V006 must be applied"));

        assertThat(template.getBodyHtml())
                .as("template.body_html must be seeded by V022")
                .isNotNull()
                .contains("<table");

        UUID messageId = router.sendManual(orderId, clientId, template.getId(), "EMAIL", null);

        var msg = messages.findById(messageId).orElseThrow();

        assertThat(msg.getBody())
                .as("persisted message.body must be plain text — no HTML markup")
                .isNotNull()
                .isNotBlank()
                .doesNotContain("<table")
                .doesNotContain("<html")
                .doesNotContain("</");

        assertThat(msg.getBodyHtml())
                .as("body_html must still contain the designer HTML")
                .isNotNull()
                .contains("<table");
    }
}
