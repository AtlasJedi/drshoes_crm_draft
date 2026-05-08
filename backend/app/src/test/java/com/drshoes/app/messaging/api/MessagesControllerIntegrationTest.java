package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for MessagesController.
 *
 * Uses AdminWebTestBase session-aware mockMvc() pattern.
 * Isolation: orders and messages are cleaned up @AfterEach before AdminWebTestBase
 * removes clients/users to avoid FK violations.
 */
class MessagesControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private MessageThreadRepository threadRepository;

    private UUID clientId;
    private UUID orderId;

    @BeforeEach
    void seedOrder() {
        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Kowalski");
        client.setPhone("+48 600 111 222");
        client.setEmail("jan@test.pl");
        clientId = clientRepository.save(client).getId();

        var order = new Order();
        order.setCode("TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(clientId);
        order.setStatus(OrderStatus.PRZYJETE);
        orderId = orderRepository.save(order).getId();
    }

    @AfterEach
    void cleanupOrdersAndMessages() {
        // Delete in FK order: messages → threads → orders.
        // AdminWebTestBase.cleanupUsers() runs after (JUnit 5 subclass @AfterEach first)
        // and removes clients+users. Threads must be gone before clients are deleted
        // to avoid message_thread_client_id_fkey violation.
        messageRepository.deleteAll();
        threadRepository.deleteAll();
        orderRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/orders/{orderId}/messages — empty thread
    // -------------------------------------------------------------------------

    @Test
    void emptyThreadReturnsEmptyList() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/orders/" + orderId + "/messages"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/orders/{orderId}/messages — manual send creates message
    // -------------------------------------------------------------------------

    @Test
    void postSendCreatesMessage() throws Exception {
        loginAsOwner();

        // Fetch a real seeded template id via the templates endpoint
        String templateList = mockMvc().perform(get("/api/admin/templates"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        // Pick the first template id — V006 seeds 4 templates (all EMAIL by default)
        String templateId = templateList.split("\"id\":\"")[1].split("\"")[0];
        // Find the channel for that template
        String channelSegment = templateList.split("\"id\":\"" + templateId + "\"")[1];
        String channel = channelSegment.split("\"channel\":\"")[1].split("\"")[0];

        // POST send
        String response = mockMvc().perform(post("/api/admin/orders/" + orderId + "/messages")
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"templateId":"%s","channel":"%s"}""".formatted(templateId, channel)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.deliveryStatus").value("SENT"))
            .andExpect(jsonPath("$.orderId").value(orderId.toString()))
            .andExpect(jsonPath("$.channel").value(channel))
            .andReturn().getResponse().getContentAsString();

        // GET thread and assert one message
        mockMvc().perform(get("/api/admin/orders/" + orderId + "/messages"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].deliveryStatus").value("SENT"));
    }
}
