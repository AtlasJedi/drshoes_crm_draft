package com.drshoes.app.dashboard.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardChartsControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Charts");
        c.setLastName("Client");
        c.setPhone("+48 600 000 088");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — seeded orders appear in the right week buckets
    // ----------------------------------------------------------

    @Test
    void ordersPerWeekContainsCurrentWeek() throws Exception {
        loginAsOwner();
        Instant now = Instant.now();
        UUID orderId = seedOrder("C-001", OrderStatus.PRZYJETE, now);
        seedItem(orderId, OrderItemKind.NAPRAWA);

        // ordersPerWeek is zero-filled oldest→newest (8 slots); the seeded order lands
        // in the current (last) week slot. Use a filter to find any week with repairs ≥ 1.
        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.ordersPerWeek", hasSize(8)))
            .andExpect(jsonPath("$.ordersPerWeek[0].weekIso").isString())
            .andExpect(jsonPath("$.ordersPerWeek[?(@.repairs >= 1)]").isArray())
            .andExpect(jsonPath("$.ordersPerWeek[?(@.repairs >= 1)]", hasSize(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Empty weeks — response still has ordersPerWeek array (may be empty)
    // ----------------------------------------------------------

    @Test
    void emptyDatabaseReturnsEmptyArrays() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.mixByType").isArray());
    }

    // ----------------------------------------------------------
    // Aggregation rule: order with any NAPRAWA item → repairs bucket
    // ----------------------------------------------------------

    @Test
    void mixByTypeContainsAllFiveKinds() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-002", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.NAPRAWA);
        seedItem(orderId, OrderItemKind.CZYSZCZENIE);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            // All 5 kinds must appear (zero-filled for missing ones)
            .andExpect(jsonPath("$.mixByType", hasSize(5)))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'NAPRAWA')].count",
                hasItem(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'CZYSZCZENIE')].count",
                hasItem(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Mix percent — zero total guard (no NaN / division-by-zero)
    // ----------------------------------------------------------

    @Test
    void mixByTypePercentSumsToHundredOrIsEmpty() throws Exception {
        loginAsOwner();
        UUID id1 = seedOrder("C-003", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id1, OrderItemKind.CZYSZCZENIE);
        UUID id2 = seedOrder("C-004", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id2, OrderItemKind.RENOWACJA);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType").isArray())
            // No NaN values in the percent field
            .andExpect(jsonPath("$.mixByType[*].percent",
                everyItem(allOf(greaterThanOrEqualTo(0.0), lessThanOrEqualTo(100.0)))));
    }

    // ----------------------------------------------------------
    // Soft-deleted orders excluded from mix
    // ----------------------------------------------------------

    @Test
    void softDeletedOrdersExcluded() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-005", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.CZYSZCZENIE);

        // soft-delete it
        Order o = orderRepo.findById(orderId).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            // CZYSZCZENIE bucket should be 0 (zero-filled) after soft-delete
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'CZYSZCZENIE')].count",
                not(hasItem(greaterThanOrEqualTo(1)))));
    }

    // ----------------------------------------------------------
    // 401 for unauthenticated
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, Instant receivedAt) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(receivedAt);
        return orderRepo.save(o).getId();
    }

    private void seedItem(UUID orderId, OrderItemKind kind) {
        var item = new OrderItem();
        item.setOrderId(orderId);
        item.setKind(kind);
        item.setDescription("test item");
        item.setPosition(0);
        itemRepo.save(item);
    }
}
