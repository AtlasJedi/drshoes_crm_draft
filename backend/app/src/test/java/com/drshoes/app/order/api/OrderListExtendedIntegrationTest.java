package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Extended GET /api/admin/orders: tag=, plannedPickupAtFrom/To=, multi-status. */
class OrderListExtendedIntegrationTest extends AdminWebTestBase {

    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID orderA; // pilne tag, 2026-06-01, W_REALIZACJI
    private UUID orderB; // pilne tag, 2026-06-10, PRZYJETE
    private UUID orderC; // no tag, no date, GOTOWE_DO_ODBIORU

    @BeforeEach
    void seed() {
        loginAsOwner();

        clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
            "VALUES (?::uuid, 'Filter', 'TestClient', ?, '+48000999001', 'EMAIL')",
            clientId, "filter-test-" + clientId + "@test.pl");

        orderA = UUID.randomUUID();
        jdbc.update("INSERT INTO order_ (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'W_REALIZACJI', 'ADMIN', '[\"pilne\"]'::jsonb, " +
            "'2026-06-01T10:00:00Z', now(), 1000, 'PLN', 0)",
            orderA, "EXT-A-" + orderA.toString().substring(0, 6), clientId);

        orderB = UUID.randomUUID();
        jdbc.update("INSERT INTO order_ (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'PRZYJETE', 'ADMIN', '[\"pilne\"]'::jsonb, " +
            "'2026-06-10T10:00:00Z', now(), 1000, 'PLN', 0)",
            orderB, "EXT-B-" + orderB.toString().substring(0, 6), clientId);

        orderC = UUID.randomUUID();
        jdbc.update("INSERT INTO order_ (id, code, client_id, status, source, tags, " +
            "planned_pickup_at, received_at, total_price_cents, currency, version) " +
            "VALUES (?::uuid, ?, ?::uuid, 'GOTOWE_DO_ODBIORU', 'ADMIN', '[]'::jsonb, " +
            "NULL, now(), 1000, 'PLN', 0)",
            orderC, "EXT-C-" + orderC.toString().substring(0, 6), clientId);
    }

    @AfterEach
    void cleanupOrders() {
        // Delete seeded orders before AdminWebTestBase.cleanupUsers() runs
        if (orderA != null) jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderA);
        if (orderB != null) jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderB);
        if (orderC != null) jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderC);
        if (clientId != null) jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId);
    }

    @Test
    @DisplayName("tag=pilne returns only orders with pilne tag")
    void filterByTag() throws Exception {
        mockMvc().perform(get("/api/admin/orders?tag=pilne"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderA + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderB + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderC + "')]").doesNotExist());
    }

    @Test
    @DisplayName("plannedPickupAtFrom + plannedPickupAtTo filters by date range")
    void filterByDateRange() throws Exception {
        mockMvc().perform(get("/api/admin/orders?plannedPickupAtFrom=2026-06-01&plannedPickupAtTo=2026-06-05"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderA + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderB + "')]").doesNotExist());
    }

    @Test
    @DisplayName("multi-value status= returns orders matching any of the statuses")
    void filterByMultiStatus() throws Exception {
        mockMvc().perform(get("/api/admin/orders?status=W_REALIZACJI&status=GOTOWE_DO_ODBIORU"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderA + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderC + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderB + "')]").doesNotExist());
    }

    @Test
    @DisplayName("tag + date range + multi-status combined")
    void filterCombined() throws Exception {
        mockMvc().perform(get("/api/admin/orders?tag=pilne" +
            "&plannedPickupAtFrom=2026-05-01&plannedPickupAtTo=2026-06-30" +
            "&status=W_REALIZACJI&status=PRZYJETE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderA + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderB + "')]").exists())
            .andExpect(jsonPath("$.content[?(@.id=='" + orderC + "')]").doesNotExist());
    }
}
