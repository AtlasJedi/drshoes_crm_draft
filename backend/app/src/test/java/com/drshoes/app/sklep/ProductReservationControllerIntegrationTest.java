package com.drshoes.app.sklep;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for ProductReservationController.
 *
 * Tests:
 *   - GET returns empty list for unknown product
 *   - GET returns active reservations for a known product
 *   - GET does not return cancelled reservations
 *   - DELETE cancels a reservation (204)
 *   - GET /reservations?limit=N returns latest across all products
 *   - Unauthenticated GET returns 401
 *
 * NOTE: uses *IntegrationTest.java suffix — *IT.java is excluded from Failsafe
 * in this project (M3 hygiene, locked 2026-05-09, task 4-1).
 * Extends AdminWebTestBase (Testcontainers Postgres + MockMvc + Spring Security).
 */
class ProductReservationControllerIntegrationTest extends AdminWebTestBase {

    @Autowired
    private ProductReservationRepository repo;

    @AfterEach
    void cleanupReservations() {
        repo.deleteAll();
    }

    @Test
    void list_returns_empty_for_unknown_product() throws Exception {
        loginAsOwner();
        mockMvc().perform(
            get("/api/admin/sklep/" + UUID.randomUUID() + "/reservations")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
    }

    @Test
    void list_returns_active_reservations_for_product() throws Exception {
        loginAsOwner();
        UUID productId = UUID.randomUUID();
        var r = new ProductReservation(productId, "Jan Kowalski", "+48 600 000 001", "pilne");
        repo.save(r);

        mockMvc().perform(
            get("/api/admin/sklep/" + productId + "/reservations")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].clientName", is("Jan Kowalski")))
            .andExpect(jsonPath("$[0].clientPhone", is("+48 600 000 001")))
            .andExpect(jsonPath("$[0].note", is("pilne")))
            .andExpect(jsonPath("$[0].status", is("PENDING")));
    }

    @Test
    void list_excludes_cancelled_reservations() throws Exception {
        loginAsOwner();
        UUID productId = UUID.randomUUID();
        var r1 = new ProductReservation(productId, "Aktywna", "+48 600 000 002", null);
        var r2 = new ProductReservation(productId, "Anulowana", "+48 600 000 003", null);
        r2.cancel();
        repo.saveAll(java.util.List.of(r1, r2));

        mockMvc().perform(
            get("/api/admin/sklep/" + productId + "/reservations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].clientName", is("Aktywna")));
    }

    @Test
    void cancel_sets_status_to_cancelled() throws Exception {
        loginAsOwner();
        UUID productId = UUID.randomUUID();
        var r = new ProductReservation(productId, "Do anulowania", "+48 600 000 004", null);
        UUID rid = repo.save(r).getId();

        mockMvc().perform(
            delete("/api/admin/sklep/" + productId + "/reservations/" + rid)
                .with(csrf()))
            .andExpect(status().isNoContent());

        var updated = repo.findById(rid).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(updated.getStatus()).isEqualTo("CANCELLED");
        org.assertj.core.api.Assertions.assertThat(updated.getCancelledAt()).isNotNull();
    }

    @Test
    void listLatest_returns_across_all_products() throws Exception {
        loginAsOwner();
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        repo.save(new ProductReservation(p1, "Klient A", null, null));
        repo.save(new ProductReservation(p2, "Klient B", null, null));

        mockMvc().perform(
            get("/api/admin/sklep/reservations?limit=5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void get_requires_authentication() throws Exception {
        // No loginAs call — unauthenticated
        mockMvc().perform(
            get("/api/admin/sklep/" + UUID.randomUUID() + "/reservations"))
            .andExpect(status().isUnauthorized());
    }
}
