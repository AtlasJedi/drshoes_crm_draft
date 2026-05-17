package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test asserting that sendNewToClient (EMAIL) and sendReply (EMAIL)
 * wrap the operator body in the followup HTML template (V026) while storing the
 * plain user text as the bubble body.
 *
 * Uses LoggingEmailGateway (no real SMTP; returns SENT immediately).
 */
class MessageRouterFollowupIntegrationTest extends AbstractIntegrationTest {

    @Autowired MessageRouter router;
    @Autowired MessageRepository messages;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    private UUID createClient(String email) {
        UUID clientId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Anna", "+48600000001", email);
        insertedClientId = clientId;
        return clientId;
    }

    private UUID createOrder(UUID clientId) {
        UUID orderId = UUID.randomUUID();
        String code = "TST-" + orderId.toString().substring(0, 8).toUpperCase();
        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "PRZYJETE");
        insertedOrderId = orderId;
        return orderId;
    }

    /** Pass null actor so sent_by is NULL — avoids FK constraint against user_ table in tests. */
    private AdminPrincipal nullActor() {
        return null;
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
            jdbc.update("DELETE FROM message WHERE client_id = ?::uuid", insertedClientId.toString());
            jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid", insertedClientId.toString());
            jdbc.update("DELETE FROM client WHERE id = ?::uuid", insertedClientId.toString());
            insertedClientId = null;
        }
    }

    // ============================================================
    // Test 1: sendNewToClient — EMAIL stores plain body + wrapped HTML
    // ============================================================
    @Test
    void sendNewToClient_email_stores_plain_body_and_wrapped_html() {
        UUID clientId = createClient("anna@example.com");

        UUID messageId = router.sendNewToClient(
                clientId, "EMAIL", null, "Cześć, gotowe jutro!", nullActor());

        MessageEntity msg = messages.findById(messageId).orElseThrow();

        // Bubble body: exact user input (no template markup)
        assertThat(msg.getBody()).isEqualTo("Cześć, gotowe jutro!");

        // Outbound HTML: wrapped by followup template
        assertThat(msg.getBodyHtml()).isNotNull();
        assertThat(msg.getBodyHtml()).contains("Cześć, gotowe jutro!");
        assertThat(msg.getBodyHtml()).contains("<table");   // wrapper marker
        // Footer must contain address, phone, and map CTA (V031: acid yellow button, 20px Impact)
        assertThat(msg.getBodyHtml()).contains("Aleje Karola Marcinkowskiego 26");
        assertThat(msg.getBodyHtml()).contains("514 296 809");
        assertThat(msg.getBodyHtml()).contains("Mapa dojazdu");
        assertThat(msg.getBodyHtml()).contains("https://www.google.com/maps/dir/");
        // V031: footer button must be acid-yellow background with black text (not inverted)
        assertThat(msg.getBodyHtml()).contains("background:#d8ff3a;padding:0;");
        assertThat(msg.getBodyHtml()).contains("color:#0a0a0a;text-decoration:none;font-family:Impact");
        // V031: workshop name font-size 20px Impact
        assertThat(msg.getBodyHtml()).contains("font-size:20px");
        // V031: address weight 600
        assertThat(msg.getBodyHtml()).contains("font-weight:600");
        // V031: in-body "Zobacz na mapie" CTA
        assertThat(msg.getBodyHtml()).contains("Zobacz na mapie");
        // V031: sign-off line present
        assertThat(msg.getBodyHtml()).contains("Pozdrawiamy");
        // V031: footer is inside the card (not orphaned) — 2px solid border separator
        assertThat(msg.getBodyHtml()).contains("border-top:2px solid #0a0a0a");

        // Subject: rendered from template
        assertThat(msg.getSubject()).isEqualTo("Dr Shoes — followup");

        // Gateway dispatched successfully
        assertThat(msg.getDeliveryStatus()).isEqualTo("SENT");
    }

    // ============================================================
    // Test 1b: followup template body composition (V031)
    //   - multi-line operator message preserved via white-space:pre-wrap
    //   - in-body "Zobacz na mapie" CTA present
    //   - sign-off "Pozdrawiamy" present
    //   - footer block: acid-yellow button, 20px Impact, address weight 600
    //   - footer is inside the card (2px solid separator, not orphaned)
    // ============================================================
    @Test
    void sendNewToClient_email_followup_v031_body_composition() {
        UUID clientId = createClient("test.body@example.com");

        String multiLineMessage = "Cześć,\n\nDziękujemy za zlecenie. Buty będą gotowe w piątek.";
        UUID messageId = router.sendNewToClient(
                clientId, "EMAIL", null, multiLineMessage, nullActor());

        MessageEntity msg = messages.findById(messageId).orElseThrow();

        // Plain body stored verbatim
        assertThat(msg.getBody()).isEqualTo(multiLineMessage);

        String html = msg.getBodyHtml();
        assertThat(html).isNotNull();

        // Message body rendered inside the cream card with line-break support
        assertThat(html).contains("Cześć,");
        assertThat(html).contains("Dziękujemy za zlecenie. Buty będą gotowe w piątek.");
        assertThat(html).contains("white-space:pre-wrap");

        // In-body acid-yellow CTA
        assertThat(html).contains("Zobacz na mapie");
        assertThat(html).containsPattern("background:#d8ff3a.*Zobacz na mapie");

        // Sign-off line
        assertThat(html).contains("Pozdrawiamy");

        // Footer: acid-yellow map button (not inverted black)
        assertThat(html).contains("background:#d8ff3a;padding:0;");
        assertThat(html).contains("color:#0a0a0a;text-decoration:none;font-family:Impact");

        // Footer: 20px Impact workshop name
        assertThat(html).contains("font-size:20px");

        // Footer: address weight 600
        assertThat(html).contains("font-weight:600");

        // Footer: phone and map URL present
        assertThat(html).contains("514 296 809");
        assertThat(html).contains("Mapa dojazdu");
        assertThat(html).contains("https://www.google.com/maps/dir/");

        // Footer: 2px solid separator — inside card structure, not orphaned
        assertThat(html).contains("border-top:2px solid #0a0a0a");
    }

    // ============================================================
    // Test 2: sendNewToClient — SMS path unchanged (no HTML wrap)
    // ============================================================
    @Test
    void sendNewToClient_sms_does_not_wrap_html() {
        UUID clientId = createClient("anna@example.com");

        UUID messageId = router.sendNewToClient(
                clientId, "SMS", null, "Gotowe, zapraszamy!", nullActor());

        MessageEntity msg = messages.findById(messageId).orElseThrow();

        assertThat(msg.getBody()).isEqualTo("Gotowe, zapraszamy!");
        assertThat(msg.getBodyHtml()).isNull();
        assertThat(msg.getSubject()).isNull();
    }

    // ============================================================
    // Test 3: sendReply — EMAIL wraps in followup template
    // ============================================================
    @Test
    void sendReply_email_stores_plain_body_and_wrapped_html() {
        UUID clientId = createClient("anna@example.com");
        UUID orderId  = createOrder(clientId);

        // Find-or-create thread first via sendNewToClient, then get the threadId
        UUID firstMsgId = router.sendNewToClient(
                clientId, "EMAIL", null, "Pierwsze pytanie", nullActor());
        UUID threadId = messages.findById(firstMsgId).orElseThrow().getThreadId();

        // Clean up the first message from the message table to simplify assertions
        jdbc.update("DELETE FROM message WHERE id = ?::uuid", firstMsgId.toString());

        UUID replyId = router.sendReply(
                threadId, clientId, "EMAIL", null, "Odpowiedź operatora", orderId, nullActor());

        MessageEntity reply = messages.findById(replyId).orElseThrow();

        assertThat(reply.getBody()).isEqualTo("Odpowiedź operatora");
        assertThat(reply.getBodyHtml()).isNotNull();
        assertThat(reply.getBodyHtml()).contains("Odpowiedź operatora");
        assertThat(reply.getBodyHtml()).contains("<table");
        assertThat(reply.getSubject()).isEqualTo("Dr Shoes — followup");
    }
}
