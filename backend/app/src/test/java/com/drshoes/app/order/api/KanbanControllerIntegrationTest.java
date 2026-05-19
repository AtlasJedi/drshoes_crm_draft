package com.drshoes.app.order.api;

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

class KanbanControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Kanban");
        c.setLastName("Client");
        c.setPhone("+48 600 000 066");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Full board — 5 columns present
    // ----------------------------------------------------------

    @Test
    void fullBoardReturnsFiveColumns() throws Exception {
        loginAsOwner();
        seedOrder("KB-001", OrderStatus.PRZYJETE);
        seedOrder("KB-002", OrderStatus.W_REALIZACJI);
        seedOrder("KB-003", OrderStatus.CZEKA_NA_KLIENTA);
        seedOrder("KB-004", OrderStatus.GOTOWE_DO_ODBIORU);
        seedOrder("KB-005", OrderStatus.WYDANE);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns").isArray())
            .andExpect(jsonPath("$.columns", hasSize(5)))
            .andExpect(jsonPath("$.columns[0].status").value("PRZYJETE"))
            .andExpect(jsonPath("$.columns[4].status").value("WYDANE"));
    }

    // ----------------------------------------------------------
    // Empty board — all columns present with zero counts
    // ----------------------------------------------------------

    @Test
    void emptyBoardStillReturnsFiveColumns() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns", hasSize(5)))
            .andExpect(jsonPath("$.columns[0].total").value(0))
            .andExpect(jsonPath("$.columns[0].cards").isEmpty());
    }

    // ----------------------------------------------------------
    // limitPerColumn enforced — hasMore=true when over cap
    // ----------------------------------------------------------

    @Test
    void hasMoreTrueWhenOverCap() throws Exception {
        loginAsOwner();
        for (int i = 0; i < 3; i++) {
            seedOrder("KB-10" + i, OrderStatus.PRZYJETE);
        }

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].total").value(3))
            .andExpect(jsonPath("$.columns[0].cards", hasSize(2)))
            .andExpect(jsonPath("$.columns[0].hasMore").value(true));
    }

    // ----------------------------------------------------------
    // WYDANE always capped at 10 even when limitPerColumn is higher
    // ----------------------------------------------------------

    @Test
    void wydaneCappedAt10RegardlessOfLimit() throws Exception {
        loginAsOwner();
        for (int i = 0; i < 12; i++) {
            seedOrder("KB-W" + i, OrderStatus.WYDANE);
        }

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=50"))
            .andExpect(status().isOk())
            // WYDANE is last column (index 4)
            .andExpect(jsonPath("$.columns[4].cards", hasSize(10)))
            .andExpect(jsonPath("$.columns[4].total").value(12))
            .andExpect(jsonPath("$.columns[4].hasMore").value(true));
    }

    // ----------------------------------------------------------
    // Soft-deleted excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedExcluded() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("KB-DEL", OrderStatus.PRZYJETE);
        Order o = orderRepo.findById(id).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].total").value(0));
    }

    // ----------------------------------------------------------
    // Invalid limitPerColumn → 400
    // ----------------------------------------------------------

    @Test
    void invalidLimitPerColumnReturns400() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/orders/kanban?limitPerColumn=300"))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // receivedAt is populated in the card projection (ux-3 errata)
    // ----------------------------------------------------------

    @Test
    void cardProjectionIncludesReceivedAt() throws Exception {
        loginAsOwner();
        Instant received = Instant.parse("2026-05-01T09:00:00Z");
        var o = new Order();
        o.setCode("KB-RCV");
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setReceivedAt(received);
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].cards[0].receivedAt").value("2026-05-01T09:00:00Z"));
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // urgent flag: PRZYJETE + receivedAt >= 4d → urgent=true
    // ----------------------------------------------------------

    @Test
    void urgentTrueWhenPrzyjeteFourDaysOld() throws Exception {
        loginAsOwner();
        var o = new Order();
        o.setCode("KB-URG-1");
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setReceivedAt(Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS));
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.columns[0].cards[?(@.code=='KB-URG-1')].urgent")
                .value(hasItem(true)));
    }

    @Test
    void urgentFalseWhenNotPrzyjete() throws Exception {
        loginAsOwner();
        var o = new Order();
        o.setCode("KB-URG-2");
        o.setClientId(clientId);
        o.setStatus(OrderStatus.W_REALIZACJI);
        o.setReceivedAt(Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS));
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/kanban"))
            .andExpect(status().isOk())
            // W_REALIZACJI column is index 1
            .andExpect(jsonPath("$.columns[1].cards[?(@.code=='KB-URG-2')].urgent")
                .value(hasItem(false)));
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now());
        return orderRepo.save(o).getId();
    }
}
