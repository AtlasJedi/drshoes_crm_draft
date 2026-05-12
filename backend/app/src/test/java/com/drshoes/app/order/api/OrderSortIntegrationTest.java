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

/**
 * Verifies sort behaviour for GET /api/admin/orders:
 *  - default sort is createdAt DESC (most recent first)
 *  - sort=receivedAt,asc works
 *  - sort on a disallowed field returns 400
 */
class OrderSortIntegrationTest extends AdminWebTestBase {

    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID orderOlder;
    private UUID orderNewer;

    @BeforeEach
    void seed() {
        loginAsOwner();

        clientId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
            "VALUES (?::uuid, 'Sort', 'Test', ?, '+48000111222', 'EMAIL')",
            clientId, "sort-test-" + clientId + "@test.pl");

        // older order — created first (smaller created_at via pg clock; we force it via now()-interval)
        orderOlder = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO order_ (id, code, client_id, status, source, tags, " +
            "received_at, total_price_cents, currency, version, created_at, updated_at) " +
            "VALUES (?::uuid, ?, ?::uuid, 'PRZYJETE', 'ADMIN', '[]'::jsonb, " +
            "'2026-01-01T08:00:00Z', 500, 'PLN', 0, " +
            "now() - interval '2 minutes', now() - interval '2 minutes')",
            orderOlder, "SORT-OLD-" + orderOlder.toString().substring(0, 6), clientId);

        // newer order — created more recently
        orderNewer = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO order_ (id, code, client_id, status, source, tags, " +
            "received_at, total_price_cents, currency, version, created_at, updated_at) " +
            "VALUES (?::uuid, ?, ?::uuid, 'PRZYJETE', 'ADMIN', '[]'::jsonb, " +
            "'2026-06-01T08:00:00Z', 500, 'PLN', 0, " +
            "now(), now())",
            orderNewer, "SORT-NEW-" + orderNewer.toString().substring(0, 6), clientId);
    }

    @AfterEach
    void cleanup() {
        if (orderOlder != null) jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderOlder);
        if (orderNewer != null) jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderNewer);
        if (clientId  != null) jdbc.update("DELETE FROM client  WHERE id = ?::uuid", clientId);
    }

    @Test
    @DisplayName("sortByCreatedAtDescIsDefault: newer order appears at index 0")
    void sortByCreatedAtDescIsDefault() throws Exception {
        mockMvc().perform(get("/api/admin/orders"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(orderNewer.toString()));
    }

    @Test
    @DisplayName("sortByReceivedAtAscWorks: order with earlier receivedAt appears first")
    void sortByReceivedAtAscWorks() throws Exception {
        // orderOlder has receivedAt=2026-01-01, orderNewer has receivedAt=2026-06-01
        mockMvc().perform(get("/api/admin/orders?sort=receivedAt,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(orderOlder.toString()));
    }

    @Test
    @DisplayName("sortByDisallowedFieldReturns400: sort on unknown field is rejected")
    void sortByDisallowedFieldReturns400() throws Exception {
        mockMvc().perform(get("/api/admin/orders?sort=clientEmail,asc"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_SORT_FIELD"));
    }
}
