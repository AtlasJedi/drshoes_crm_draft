package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for POST /api/admin/messages/{id}/retry.
 *
 * Seeds FAILED / DELIVERED messages directly in DB (bypassing MessageRouter/template pipeline)
 * to test the retry endpoint in isolation. The retry service calls MessageRouter.sendRetry
 * which uses stored body/subject without re-rendering a template, so no template seed required.
 *
 * Isolation: messages → threads → orders cleaned up @AfterEach before AdminWebTestBase removes clients+users.
 */
class MessageRetryControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private ClientRepository        clientRepository;
    @Autowired private OrderRepository         orderRepository;
    @Autowired private MessageRepository       messageRepository;
    @Autowired private MessageThreadRepository threadRepository;
    @Autowired private ObjectMapper            objectMapper;
    @Autowired private JdbcTemplate            jdbc;

    private UUID clientId;
    private UUID orderId;

    @BeforeEach
    void seedClientAndOrder() {
        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Kowalski");
        client.setPhone("+48600000001");
        client.setEmail("jan@example.com");
        clientId = clientRepository.save(client).getId();

        var order = new Order();
        order.setCode("RETRY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(clientId);
        order.setStatus(OrderStatus.PRZYJETE);
        orderId = orderRepository.save(order).getId();
    }

    @AfterEach
    void cleanupOrdersAndMessages() {
        // message.retry_of_message_id is a self-referential FK — JPA deleteAll() fails when
        // retry rows exist. Use native SQL to delete all messages in one statement, then
        // threads and orders. AdminWebTestBase.cleanupUsers() removes clients+users after.
        jdbc.execute("DELETE FROM message");
        threadRepository.deleteAll();
        orderRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/messages/{id}/retry — happy path: FAILED → new SENT row
    // -------------------------------------------------------------------------

    @Test
    void retry_happyPath_createsNewRowLinkedToOriginal() throws Exception {
        loginAsOwner();
        UUID origId = seedFailedMessage(orderId, clientId);

        var result = mockMvc().perform(post("/api/admin/messages/{id}/retry", origId)
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deliveryStatus").value("SENT"))
            .andExpect(jsonPath("$.retryOfMessageId").value(origId.toString()))
            .andExpect(jsonPath("$.retryAttempt").value(2))
            .andReturn();

        // Verify new row in DB
        var body  = objectMapper.readTree(result.getResponse().getContentAsString());
        var newId = UUID.fromString(body.get("id").asText());
        var newMsg = messageRepository.findById(newId).orElseThrow();
        assertThat(newMsg.getRetryOfMessageId()).isEqualTo(origId);
        assertThat(newMsg.getRetryAttempt()).isEqualTo(2);

        // Original row still FAILED
        var origMsg = messageRepository.findById(origId).orElseThrow();
        assertThat(origMsg.getDeliveryStatus()).isEqualTo(DeliveryStatus.FAILED.name());
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/messages/{id}/retry — 409 on non-FAILED message
    // -------------------------------------------------------------------------

    @Test
    void retry_notFailed_returns409() throws Exception {
        loginAsOwner();
        UUID deliveredId = seedDeliveredMessage(orderId, clientId);

        mockMvc().perform(post("/api/admin/messages/{id}/retry", deliveredId)
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("NOT_RETRYABLE"));
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/messages/{id}/retry — 404 on unknown id
    // -------------------------------------------------------------------------

    @Test
    void retry_messageNotFound_returns404() throws Exception {
        loginAsOwner();
        mockMvc().perform(post("/api/admin/messages/{id}/retry", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .with(csrf()))
            .andExpect(status().isNotFound());
    }

    // ---- seed helpers ----

    private UUID seedFailedMessage(UUID orderId, UUID clientId) {
        var m = buildMessage(orderId, clientId, DeliveryStatus.FAILED.name());
        m.setErrorCode("PROVIDER_5XX");
        m.setErrorMessage("Simulated 5xx from seed");
        return messageRepository.saveAndFlush(m).getId();
    }

    private UUID seedDeliveredMessage(UUID orderId, UUID clientId) {
        return messageRepository.saveAndFlush(
            buildMessage(orderId, clientId, DeliveryStatus.DELIVERED.name())).getId();
    }

    /**
     * Builds a minimal MessageEntity with a real persisted thread
     * so the thread_id FK constraint is satisfied. The retry endpoint
     * calls MessageRouter.sendRetry which finds/creates its own thread
     * for the new row; the original row's threadId is only for FK integrity.
     */
    private MessageEntity buildMessage(UUID orderId, UUID clientId, String status) {
        // Create a real thread to satisfy message.thread_id FK
        var thread = new MessageThreadEntity();
        thread.setClientId(clientId);
        UUID threadId = threadRepository.saveAndFlush(thread).getId();

        var m = MessageEntity.newMessage();
        m.setThreadId(threadId);
        m.setOrderId(orderId);
        m.setClientId(clientId);
        m.setDirection("OUTBOUND");
        m.setChannel("EMAIL");
        m.setSubject("Re: Zamówienie testowe");  // EMAIL channel requires non-blank subject
        m.setBody("Treść testowa");
        m.setDeliveryStatus(status);
        m.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        m.setRetryAttempt(1);
        return m;
    }
}
