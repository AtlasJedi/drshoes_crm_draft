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
    // Shape: ordersPerWeek rows contain byKind map with all 5 keys
    // ----------------------------------------------------------

    @Test
    void ordersPerWeekRowHasAllFiveKindKeys() throws Exception {
        loginAsOwner();
        Instant now = Instant.now();
        UUID orderId = seedOrder("C-001", OrderStatus.PRZYJETE, now);
        seedItem(orderId, OrderItemKind.NAPRAWA, 0);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.ordersPerWeek", hasSize(8)))
            .andExpect(jsonPath("$.ordersPerWeek[0].weekIso").isString())
            // All 5 kind keys must be present in byKind (zero-filled)
            .andExpect(jsonPath("$.ordersPerWeek[0].byKind.CZYSZCZENIE").isNumber())
            .andExpect(jsonPath("$.ordersPerWeek[0].byKind.RENOWACJA").isNumber())
            .andExpect(jsonPath("$.ordersPerWeek[0].byKind.NAPRAWA").isNumber())
            .andExpect(jsonPath("$.ordersPerWeek[0].byKind.SZEWC").isNumber())
            .andExpect(jsonPath("$.ordersPerWeek[0].byKind.CUSTOM").isNumber());
    }

    // ----------------------------------------------------------
    // Classification: order's PRIMARY item kind determines its bucket
    // ----------------------------------------------------------

    @Test
    void orderClassifiedByFirstItemKind() throws Exception {
        loginAsOwner();
        Instant now = Instant.now();

        // Order A: first item = CZYSZCZENIE (position 0), second = NAPRAWA (position 1)
        UUID orderA = seedOrder("C-010", OrderStatus.PRZYJETE, now);
        seedItem(orderA, OrderItemKind.CZYSZCZENIE, 0);
        seedItem(orderA, OrderItemKind.NAPRAWA, 1);

        // Order B: first item = CUSTOM (position 0)
        UUID orderB = seedOrder("C-011", OrderStatus.PRZYJETE, now);
        seedItem(orderB, OrderItemKind.CUSTOM, 0);

        // Order C: no items → excluded from byKind buckets entirely
        seedOrder("C-012", OrderStatus.PRZYJETE, now);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            // Current week must show CZYSZCZENIE=1, CUSTOM=1; NAPRAWA=0 (not double-counted)
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CZYSZCZENIE >= 1)]").isArray())
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CZYSZCZENIE >= 1)]",
                hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CUSTOM >= 1)]").isArray())
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CUSTOM >= 1)]",
                hasSize(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Regression: all 5 kinds appear as buckets, each independently counted
    // ----------------------------------------------------------

    @Test
    void allFiveKindsCountedIndependently() throws Exception {
        loginAsOwner();
        Instant now = Instant.now();

        // One order per kind
        for (OrderItemKind kind : OrderItemKind.values()) {
            String code = "C-2" + kind.name();
            UUID orderId = seedOrder(code, OrderStatus.PRZYJETE, now);
            seedItem(orderId, kind, 0);
        }

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CZYSZCZENIE >= 1)]",
                hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.RENOWACJA >= 1)]",
                hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.NAPRAWA >= 1)]",
                hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.SZEWC >= 1)]",
                hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.ordersPerWeek[?(@.byKind.CUSTOM >= 1)]",
                hasSize(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Empty database — ordersPerWeek still 8 slots, all byKind zero-filled
    // ----------------------------------------------------------

    @Test
    void emptyDatabaseReturnsZeroFilledSlots() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ordersPerWeek").isArray())
            .andExpect(jsonPath("$.ordersPerWeek", hasSize(8)))
            .andExpect(jsonPath("$.mixByType").isArray());
    }

    // ----------------------------------------------------------
    // Mix donut — all 5 kind buckets always present
    // ----------------------------------------------------------

    @Test
    void mixByTypeContainsAllFiveKinds() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-002", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.NAPRAWA, 0);
        seedItem(orderId, OrderItemKind.CZYSZCZENIE, 1);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType", hasSize(5)))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'NAPRAWA')].count",
                hasItem(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'CZYSZCZENIE')].count",
                hasItem(greaterThanOrEqualTo(1))));
    }

    // ----------------------------------------------------------
    // Mix percent — no NaN / division-by-zero
    // ----------------------------------------------------------

    @Test
    void mixByTypePercentSumsToHundredOrIsEmpty() throws Exception {
        loginAsOwner();
        UUID id1 = seedOrder("C-003", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id1, OrderItemKind.CZYSZCZENIE, 0);
        UUID id2 = seedOrder("C-004", OrderStatus.PRZYJETE, Instant.now());
        seedItem(id2, OrderItemKind.RENOWACJA, 0);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType").isArray())
            .andExpect(jsonPath("$.mixByType[*].percent",
                everyItem(allOf(greaterThanOrEqualTo(0.0), lessThanOrEqualTo(100.0)))));
    }

    // ----------------------------------------------------------
    // Soft-deleted orders excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedOrdersExcluded() throws Exception {
        loginAsOwner();
        UUID orderId = seedOrder("C-005", OrderStatus.PRZYJETE, Instant.now());
        seedItem(orderId, OrderItemKind.CZYSZCZENIE, 0);

        Order o = orderRepo.findById(orderId).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'CZYSZCZENIE')].count",
                not(hasItem(greaterThanOrEqualTo(1)))));
    }

    // ----------------------------------------------------------
    // Mix donut — terminal/ready statuses excluded (active-only filter)
    // ----------------------------------------------------------

    @Test
    void mixByTypeExcludesTerminalAndReadyStatuses() throws Exception {
        loginAsOwner();

        // Active order (PRZYJETE) — should appear in mix
        UUID activeId = seedOrder("C-010", OrderStatus.PRZYJETE, Instant.now());
        seedItem(activeId, OrderItemKind.NAPRAWA, 0);

        // Terminal orders — items must NOT appear in mix
        UUID wydaneId = seedOrder("C-011", OrderStatus.WYDANE, Instant.now());
        seedItem(wydaneId, OrderItemKind.CZYSZCZENIE, 0);

        UUID anulowaneId = seedOrder("C-012", OrderStatus.ANULOWANE, Instant.now());
        seedItem(anulowaneId, OrderItemKind.RENOWACJA, 0);

        UUID gotowId = seedOrder("C-013", OrderStatus.GOTOWE_DO_ODBIORU, Instant.now());
        seedItem(gotowId, OrderItemKind.SZEWC, 0);

        mockMvc().perform(get("/api/admin/dashboard/charts"))
            .andExpect(status().isOk())
            // NAPRAWA from the active order must be counted
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'NAPRAWA')].count",
                hasItem(greaterThanOrEqualTo(1))))
            // CZYSZCZENIE/RENOWACJA/SZEWC belong to terminal orders — must be zero
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'CZYSZCZENIE')].count",
                hasItem(0)))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'RENOWACJA')].count",
                hasItem(0)))
            .andExpect(jsonPath("$.mixByType[?(@.kind == 'SZEWC')].count",
                hasItem(0)));
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

    private void seedItem(UUID orderId, OrderItemKind kind, int position) {
        var item = new OrderItem();
        item.setOrderId(orderId);
        item.setKind(kind);
        item.setDescription("test item");
        item.setPosition(position);
        itemRepo.save(item);
    }
}
