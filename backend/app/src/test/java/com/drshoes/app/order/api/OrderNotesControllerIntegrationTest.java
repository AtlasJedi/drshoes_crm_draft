package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OrderNotesControllerIntegrationTest extends AdminWebTestBase {

    @Autowired OrderRepository orders;
    @Autowired StorageLocationRepository locations;
    @Autowired AuditLogRepository audits;

    private UUID clientId;

    @BeforeEach
    void setup() {
        clientId = createClientAndReturnId();
        loginAsOwner();
    }

    @AfterEach
    void cleanupLocations() {
        locations.deleteAll();
    }

    @Test
    void POST_note_only_writes_audit_row_with_note_no_location_change() throws Exception {
        Order o = persistOrderWithLocation(null);

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"note\":\"wyczyszczony elo\"}")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.note").value("wyczyszczony elo"))
            .andExpect(jsonPath("$.locationFrom").isEmpty())
            .andExpect(jsonPath("$.locationTo").isEmpty());

        Order reread = orders.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isNull();
        // audit row count for this order should be > 0
        assertThat(audits.findOrderTimelineRows(
            "/api/admin/orders/" + o.getId() + "%", o.getId())).isNotEmpty();
    }

    @Test
    void POST_location_only_updates_order_and_audit_row_carries_diff() throws Exception {
        persistLocation("suszarka");
        Order o = persistOrderWithLocation("półka 1");

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"location\":\"suszarka\"}")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.locationFrom").value("półka 1"))
            .andExpect(jsonPath("$.locationTo").value("suszarka"));

        Order reread = orders.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isEqualTo("suszarka");
    }

    @Test
    void POST_note_and_move_both_visible_in_response() throws Exception {
        persistLocation("suszarka");
        Order o = persistOrderWithLocation(null);

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"note\":\"po cleaningu\",\"location\":\"suszarka\"}")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.note").value("po cleaningu"))
            .andExpect(jsonPath("$.locationTo").value("suszarka"));
    }

    @Test
    void POST_both_empty_returns_400_at_least_one_required() throws Exception {
        Order o = persistOrderWithLocation(null);

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{}")
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("NOTE_VALIDATION"));
    }

    @Test
    void POST_location_same_as_current_and_no_note_returns_400_no_op() throws Exception {
        persistLocation("półka 1");
        Order o = persistOrderWithLocation("półka 1");

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"location\":\"półka 1\"}")
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("NOTE_VALIDATION"));
    }

    @Test
    void POST_unknown_location_returns_409() throws Exception {
        Order o = persistOrderWithLocation(null);

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"location\":\"brak-takiej-lokacji\"}")
                .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("UNKNOWN_LOCATION"));
    }

    @Test
    void POST_inactive_location_returns_409() throws Exception {
        StorageLocation l = persistLocation("staraSzuflada");
        l.setActive(false);
        locations.save(l);
        Order o = persistOrderWithLocation(null);

        mockMvc().perform(post("/api/admin/orders/" + o.getId() + "/notes")
                .contentType("application/json")
                .content("{\"location\":\"staraSzuflada\"}")
                .with(csrf()))
            .andExpect(status().isConflict());
    }

    @Test
    void POST_unknown_order_returns_404() throws Exception {
        UUID random = UUID.randomUUID();

        mockMvc().perform(post("/api/admin/orders/" + random + "/notes")
                .contentType("application/json")
                .content("{\"note\":\"x\"}")
                .with(csrf()))
            .andExpect(status().isNotFound());
    }

    // --- helpers ---

    private StorageLocation persistLocation(String name) {
        StorageLocation l = new StorageLocation();
        l.setName(name);
        l.setActive(true);
        return locations.save(l);
    }

    private Order persistOrderWithLocation(String loc) {
        Order o = new Order();
        o.setCode("TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setLocation(loc);
        return orders.save(o);
    }
}
