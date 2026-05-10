package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class OrderUnreadElsewhereControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired OrderRepository orderRepo;
    @Autowired ClientRepository clientRepo;
    @Autowired MessageThreadRepository threadRepo;

    private UUID orderId;
    private UUID clientId;
    private UUID otherThreadId;

    @BeforeEach
    void setUp() {
        threadRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Zofia");
        client.setLastName("Dąbrowska");
        client.setEmail("zofia@example.com");
        clientId = clientRepo.save(client).getId();

        var order = new Order();
        order.setCode("TST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(clientId);
        order.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        orderId = orderRepo.save(order).getId();
    }

    @Test
    @DisplayName("client has unread thread not linked to this order → count > 0")
    void unreadElsewhere_returns_count() throws Exception {
        var otherThread = new MessageThreadEntity();
        otherThread.setClientId(clientId);
        otherThread.setChannel("EMAIL");
        otherThread.setUnreadCount(3);
        otherThreadId = threadRepo.save(otherThread).getId();

        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(3))
            .andExpect(jsonPath("$.threadId").value(otherThreadId.toString()));
    }

    @Test
    @DisplayName("no unread threads for client → count=0, threadId=null")
    void noUnread_returns_zero() throws Exception {
        var zeroThread = new MessageThreadEntity();
        zeroThread.setClientId(clientId);
        zeroThread.setChannel("SMS");
        zeroThread.setUnreadCount(0);
        threadRepo.save(zeroThread);

        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0))
            .andExpect(jsonPath("$.threadId").doesNotExist());
    }

    @Test
    @DisplayName("order client has no threads at all → count=0")
    void noThreads_returns_zero() throws Exception {
        mockMvc.perform(get("/api/admin/orders/{orderId}/unread-elsewhere", orderId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0));
    }

    /**
     * Injects an AdminPrincipal-backed authentication so that
     * {@code @AuthenticationPrincipal AdminPrincipal actor} resolves in controllers.
     * Uses a synthetic UUID since no DB user is required for these tests.
     */
    private static RequestPostProcessor owner() {
        var principal = new AdminPrincipal(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "owner@drshoes.pl", "OWNER");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        return authentication(auth);
    }
}
