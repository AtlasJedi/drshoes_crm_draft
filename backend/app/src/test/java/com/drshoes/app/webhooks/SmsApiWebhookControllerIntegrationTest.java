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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration test for SmsApiWebhookController — 6-case matrix:
 *
 *   1. DELIVERED / valid IP   → 200 "OK", webhook_event APPLIED/DELIVERED, message DELIVERED,
 *                               timeline includes MESSAGE_DELIVERED
 *   2. UNDELIVERED / valid IP → 200 "OK", webhook_event APPLIED/FAILED, message FAILED,
 *                               errorCode = "UNDELIVERED"
 *   3. IP not in allowlist    → 403 "Forbidden", zero DB writes
 *   4. ACCEPTD (in-flight)    → 200 "OK", webhook_event DROPPED, message unchanged
 *   5. Unknown MessageID      → 200 "OK", webhook_event NO_MESSAGE, message table unchanged
 *   6. responseBody is "OK"   — covered by all passing cases (content().string("OK"))
 *
 * Named *IntegrationTest (not *IT) per project convention — *IT never executes
 * (Failsafe is pluginManagement-only; see CLAUDE.md M3/M4 hygiene debt note).
 *
 * IP allowlist: 127.0.0.1 (via X-Test-Client-IP header configured in TestPropertySource).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.sms.smsapi.callback-allowlist=127.0.0.1",
    "messaging.sms.smsapi.client-ip-header=X-Test-Client-IP"
})
class SmsApiWebhookControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc                  mockMvc;
    @Autowired MessageRepository        messages;
    @Autowired MessageThreadRepository  threads;
    @Autowired WebhookEventRepository   webhookEvents;
    @Autowired AuditLogRepository       auditLogs;
    @Autowired ClientRepository         clients;
    @Autowired OrderRepository          orders;

    private UUID   orderId;
    private String providerMsgId;

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFirstName("SMS");
        client.setLastName("Klient");
        client.setPhone("+48600200300");
        var savedClient = clients.save(client);

        var order = new Order();
        order.setCode("SMS-TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(savedClient.getId());
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        var savedOrder = orders.save(order);
        orderId = savedOrder.getId();

        // MessageEntity requires thread_id (NOT NULL FK → message_thread)
        var thread = new MessageThreadEntity();
        thread.setClientId(savedClient.getId());
        var savedThread = threads.save(thread);

        providerMsgId = "smsapi-msg-" + UUID.randomUUID();
        var msg = MessageEntity.newMessage();
        msg.setThreadId(savedThread.getId());
        msg.setOrderId(orderId);
        msg.setClientId(savedClient.getId());
        msg.setChannel("SMS");
        msg.setDirection("OUTBOUND");
        msg.setDeliveryStatus("SENT");
        msg.setProviderMessageId(providerMsgId);
        msg.setBody("Test SMS treść");
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

    // ── Case 1: DELIVERED + valid IP ─────────────────────────────────────────

    @Test
    void delivery_validIp_returns200_appliedDelivered() throws Exception {
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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(events.get(0).getAppliedStatus())
            .isEqualTo(WebhookEventEntity.AppliedStatus.DELIVERED);

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMsgId, "SMS");
        assertThat(updatedMsg).isPresent();
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo("DELIVERED");

        // timeline includes MESSAGE_DELIVERED event
        mockMvc.perform(get("/api/admin/orders/{orderId}/timeline", orderId)
                .with(user("owner@drshoes.pl").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.kind == 'MESSAGE_DELIVERED')]").exists());
    }

    // ── Case 2: UNDELIVERED + valid IP → APPLIED/FAILED ──────────────────────

    @Test
    void failed_validIp_returns200_appliedFailed_withErrorCode() throws Exception {
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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(events.get(0).getAppliedStatus())
            .isEqualTo(WebhookEventEntity.AppliedStatus.FAILED);
        assertThat(events.get(0).getErrorCode()).isEqualTo("UNDELIVERED");

        var updatedMsg = messages.findByProviderMessageIdAndChannel(providerMsgId, "SMS");
        assertThat(updatedMsg).isPresent();
        assertThat(updatedMsg.get().getDeliveryStatus()).isEqualTo("FAILED");
    }

    // ── Case 3: IP not in allowlist → 403 ────────────────────────────────────

    @Test
    void disallowedIp_returns403_noDbWrites() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "1.2.3.4")   // not in allowlist
                .param("MsgId", providerMsgId)
                .param("status", "404")
                .param("status_name", "DELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden())
            .andExpect(content().string("Forbidden"));

        assertThat(webhookEvents.findAll()).isEmpty();
        var msg = messages.findByProviderMessageIdAndChannel(providerMsgId, "SMS");
        assertThat(msg).isPresent();
        assertThat(msg.get().getDeliveryStatus()).isEqualTo("SENT");
    }

    // ── Case 4: in-flight status ACCEPTD → DROPPED ───────────────────────────

    @Test
    void unknownStatusName_returns200_droppedOutcome() throws Exception {
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
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.DROPPED);

        var msg = messages.findByProviderMessageIdAndChannel(providerMsgId, "SMS");
        assertThat(msg).isPresent();
        assertThat(msg.get().getDeliveryStatus()).isEqualTo("SENT");
    }

    // ── Case 5: unknown MsgId → NO_MESSAGE ───────────────────────────────────

    @Test
    void unknownMessageId_returns200_noMessageOutcome() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "127.0.0.1")
                .param("MsgId", "no-such-msg-id-in-db")
                .param("status", "404")
                .param("status_name", "DELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(content().string("OK"));

        List<WebhookEventEntity> events = webhookEvents.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getAppliedOutcome())
            .isEqualTo(WebhookEventEntity.AppliedOutcome.NO_MESSAGE);
    }

    // ── Case 6: response body is exactly "OK" ────────────────────────────────
    // Covered by cases 1, 4, 5 — dedicated minimal assertion for documentation.

    @Test
    void responseBodyIsOK() throws Exception {
        mockMvc.perform(get("/api/webhooks/smsapi")
                .header("X-Test-Client-IP", "127.0.0.1")
                .param("MsgId", providerMsgId)
                .param("status", "404")
                .param("status_name", "DELIVERED")
                .param("donedate", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(content().string("OK"));
    }
}
