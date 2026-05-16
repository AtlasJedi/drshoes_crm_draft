package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression guard: after POST /api/admin/orders/{id}/messages, the inserted
 * message row must have sent_by equal to the authenticated user's UUID (not null).
 *
 * Also asserts the audit_log row carries the same actor_id (non-null).
 */
class MessagesControllerActorTest extends AdminWebTestBase {

    @Autowired MessageRepository messages;
    @Autowired MessageTemplateRepository templates;
    @Autowired ClientRepository clients;
    @Autowired OrderRepository orders;
    @Autowired AuditLogRepository auditLogs;
    @Autowired MessageThreadRepository threads;

    @AfterEach
    void cleanupOrdersAndMessages() {
        // Delete in FK order before AdminWebTestBase.cleanupUsers() removes clients+users.
        messages.deleteAll();
        threads.deleteAll();
        orders.deleteAll();
    }

    @Test
    void send_messageSentByCarriesAuthenticatedUserId() throws Exception {
        UUID ownerId = loginAsOwner();

        // Seed a client and order inline (no helper overload with args exists yet).
        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Nowak");
        client.setPhone("+48600100200");
        client.setEmail("anna@example.com");
        UUID clientId = clients.save(client).getId();

        var order = new Order();
        order.setCode("TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(clientId);
        order.setStatus(OrderStatus.PRZYJETE);
        UUID orderId = orders.save(order).getId();

        // Pick an EMAIL template explicitly — the first from findAll() could be SMS (null subject).
        UUID templateId = templates.findAll().stream()
                .filter(t -> "EMAIL".equals(t.getChannel()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No EMAIL template seeded"))
                .getId();

        mockMvc().perform(post("/api/admin/orders/{orderId}/messages", orderId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"templateId\":\"" + templateId + "\",\"channel\":\"EMAIL\"}"))
            .andExpect(status().isCreated());

        var sent = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).getSentBy())
            .as("sent_by must carry the logged-in owner's UUID, not null")
            .isEqualTo(ownerId);

        // Audit row actor_id must also be the owner's UUID.
        var audits = auditLogs.findAll().stream()
            .filter(a -> "POST".equals(a.getMethod()) && a.getPath().contains("/messages"))
            .toList();
        assertThat(audits).isNotEmpty();
        assertThat(audits.get(audits.size() - 1).getActorId())
            .as("audit_log.actor_id must equal the owner's UUID")
            .isEqualTo(ownerId);
    }
}
