package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test for PostmarkWebhookController — 6-case matrix:
 *
 *   1. Delivery / valid auth   → 200, webhook_event APPLIED/DELIVERED, message DELIVERED
 *   2. Bounce / valid auth     → 200, webhook_event APPLIED/FAILED, message FAILED, errorMessage set
 *   3. Bad Basic-auth          → 401, no DB writes
 *   4. Click (unknown type)    → 200, webhook_event DROPPED, message unchanged
 *   5. Unknown MessageID       → 200, webhook_event NO_MESSAGE, message table unchanged
 *   6. Malformed JSON          → 400, no DB writes
 *
 * Timeline assertion (case 1): GET /api/admin/orders/{id}/timeline returns
 * a MESSAGE_DELIVERED kind after a successful reconcile.
 *
 * Named *IntegrationTest (not *IT) per project convention — *IT never executes
 * (Failsafe is pluginManagement-only; see CLAUDE.md M3/M4 hygiene debt note).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.email.postmark.webhook-username=drshoes",
    "messaging.email.postmark.webhook-secret=test-secret"
})
class PostmarkWebhookControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc                mockMvc;
    @Autowired MessageRepository      messages;
    @Autowired MessageThreadRepository threads;
    @Autowired WebhookEventRepository  webhookEvents;
    @Autowired AuditLogRepository      auditLogs;
    @Autowired ClientRepository        clients;
    @Autowired OrderRepository         orders;

    private static final String VALID_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:test-secret".getBytes(StandardCharsets.UTF_8));
    private static final String BAD_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:wrong-password".getBytes(StandardCharsets.UTF_8));

    private UUID   orderId;
    private String providerMessageId;

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFirstName("Testowy");
        client.setLastName("Klient");
        client.setPhone("+48600100200");
        var savedClient = clients.save(client);

        var order = new Order();
        order.setCode("WH-TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(savedClient.getId());
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        var savedOrder = orders.save(order);
        orderId = savedOrder.getId();

        // message requires a thread_id (NOT NULL FK → message_thread)
        var thread = new MessageThreadEntity();
        thread.setClientId(savedClient.getId());
        var savedThread = threads.save(thread);

        providerMessageId = "postmark-msg-" + UUID.randomUUID();
        var msg = MessageEntity.newMessage();
        msg.setThreadId(savedThread.getId());
        msg.setOrderId(orderId);
        msg.setClientId(savedClient.getId());
        msg.setChannel("EMAIL");
        msg.setDirection("OUTBOUND");
        msg.setDeliveryStatus("SENT");
        msg.setProviderMessageId(providerMessageId);
        msg.setSubject("Test");
        msg.setBody("Treść");
        messages.save(msg);
    }

    @AfterEach
    void tearDown() {
        // FK order: audit_log → none; webhook_events → message; messages → thread; threads → client; orders → client
        auditLogs.deleteAll();
        webhookEvents.deleteAll();
        messages.deleteAll();
        threads.deleteAll();
        orders.deleteAll();
        clients.deleteAll();
    }

    // ── Case 1: Delivery + valid auth ────────────────────────────────────────

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

        // webhook_event row
        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        WebhookEventEntity ev = events.get(0);
        assertThat(ev.getAppliedOutcome()).isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(ev.getAppliedStatus()).isEqualTo(WebhookEventEntity.AppliedStatus.DELIVERED);

        // message row updated to DELIVERED
        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMessageId, "EMAIL");
        assertThat(updatedMsg).isPresent();
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo("DELIVERED");

        // audit_log row written with WebhookStatusReconciler#apply in path
        var reconcilerAudits = auditLogs.findAll().stream()
            .filter(a -> a.getPath() != null
                      && a.getPath().contains("WebhookStatusReconciler#apply"))
            .toList();
        assertThat(reconcilerAudits).isNotEmpty();

        // timeline includes MESSAGE_DELIVERED event
        mockMvc.perform(get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.kind == 'MESSAGE_DELIVERED')]").exists());
    }

    // ── Case 2: Bounce + valid auth ──────────────────────────────────────────

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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(events.get(0).getAppliedStatus())
            .isEqualTo(WebhookEventEntity.AppliedStatus.FAILED);
        assertThat(events.get(0).getErrorMessage()).isNotBlank();

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMessageId, "EMAIL");
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo("FAILED");

        // timeline must emit MESSAGE_FAILED (not MESSAGE_DELIVERED) for a bounce
        mockMvc.perform(get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.kind == 'MESSAGE_FAILED')]").exists());
    }

    // ── Case 3: Bad auth ─────────────────────────────────────────────────────

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
        var msg = messages.findByProviderMessageIdAndChannel(providerMessageId, "EMAIL");
        assertThat(msg.get().getDeliveryStatus()).isEqualTo("SENT");
    }

    // ── Case 4: Unknown RecordType (Click) → DROPPED ─────────────────────────

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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.DROPPED);

        var msg = messages.findByProviderMessageIdAndChannel(providerMessageId, "EMAIL");
        assertThat(msg.get().getDeliveryStatus()).isEqualTo("SENT");
    }

    // ── Case 5: Unknown MessageID → NO_MESSAGE ───────────────────────────────

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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.NO_MESSAGE);
    }

    // ── Case 6: Malformed JSON → 400 ─────────────────────────────────────────

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
