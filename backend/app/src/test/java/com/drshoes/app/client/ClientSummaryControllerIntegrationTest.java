package com.drshoes.app.client;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/admin/clients/{id}/summary.
 *
 * Verifies:
 *  - happy path returns correct counts for orders + threads
 *  - soft-deleted orders are excluded from orderCount
 *  - WYDANE orders are excluded from openOrderCount
 *  - discarded threads are excluded from unreadThreadCount
 *  - 404 for unknown clientId
 *  - 401 for unauthenticated request
 */
class ClientSummaryControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private ClientRepository  clientRepo;
    @Autowired private OrderRepository   orderRepo;
    @Autowired private MessageThreadRepository threadRepo;

    @AfterEach
    void cleanupDependents() {
        threadRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    @Test
    void summaryHappyPath() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Anna", "+48600111000");

        // 3 active orders, 1 WYDANE (closed), 1 soft-deleted (must not count)
        seedOrder(clientId, OrderStatus.PRZYJETE, false);
        seedOrder(clientId, OrderStatus.W_REALIZACJI, false);
        seedOrder(clientId, OrderStatus.GOTOWE_DO_ODBIORU, false);
        seedOrder(clientId, OrderStatus.WYDANE, false);
        seedOrder(clientId, OrderStatus.PRZYJETE, true); // soft-deleted

        // 1 unread EMAIL thread, 1 discarded EMAIL unread (excluded from index), 1 read SMS thread
        seedThread(clientId, 2, false, "EMAIL");
        seedThread(clientId, 1, true,  "EMAIL");  // discarded — excluded from unique index
        seedThread(clientId, 0, false, "SMS");    // read — unreadCount=0, different channel

        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clientId").value(clientId.toString()))
            .andExpect(jsonPath("$.orderCount").value(4))       // 3 active + 1 WYDANE (not deleted)
            .andExpect(jsonPath("$.openOrderCount").value(3))   // 4 total - 1 WYDANE
            .andExpect(jsonPath("$.lastOrderAt").isNotEmpty())
            .andExpect(jsonPath("$.unreadThreadCount").value(1)); // only non-discarded unread
    }

    @Test
    void summaryExcludesSoftDeletedOrders() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Bartek", "+48600222000");
        seedOrder(clientId, OrderStatus.PRZYJETE, true);  // deleted
        seedOrder(clientId, OrderStatus.PRZYJETE, true);  // deleted

        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderCount").value(0))
            .andExpect(jsonPath("$.openOrderCount").value(0))
            .andExpect(jsonPath("$.lastOrderAt").doesNotExist());
    }

    @Test
    void summaryReturns404ForUnknownClient() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/clients/00000000-0000-0000-0000-000000000000/summary"))
            .andExpect(status().isNotFound());
    }

    @Test
    void summaryReturns401ForUnauthenticated() throws Exception {
        // No loginAs* — anonymous request
        UUID clientId = seedClient("Anon", "+48600333000");
        mockMvc().perform(get("/api/admin/clients/" + clientId + "/summary"))
            .andExpect(status().isUnauthorized());
    }

    // ---- helpers ----

    private UUID seedClient(String firstName, String phone) {
        Client c = new Client();
        c.setFirstName(firstName);
        c.setPhone(phone);
        return clientRepo.save(c).getId();
    }

    private void seedOrder(UUID clientId, OrderStatus status, boolean softDeleted) {
        Order o = new Order();
        o.setClientId(clientId);
        o.setStatus(status);
        o.setCode("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setReceivedAt(Instant.now());
        if (softDeleted) o.setDeletedAt(Instant.now());
        orderRepo.save(o);
    }

    private void seedThread(UUID clientId, int unreadCount, boolean discarded, String channel) {
        MessageThreadEntity t = new MessageThreadEntity();
        t.setClientId(clientId);
        t.setChannel(channel);
        t.setUnreadCount(unreadCount);
        if (discarded) t.setDiscardedAt(OffsetDateTime.now());
        threadRepo.save(t);
    }
}
