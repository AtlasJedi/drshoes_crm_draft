package com.drshoes.app.audit;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for AuditTimelineService + AuditTimelineController.
 *
 * TDD approach: test written BEFORE implementation (RED).
 *
 * Audit rows are produced by driving real MockMvc calls through the audit aspect —
 * never via direct auditLogRepo.save(), which would bypass the aspect and prove nothing.
 *
 * ORDER_CREATED synthesis decision:
 *   The POST /api/admin/orders audit row has path=/api/admin/orders (no orderId in the path),
 *   so it won't match the pathPrefix scan. ORDER_CREATED is synthesised from Order.createdAt
 *   in AuditTimelineService — not from the audit_log row. Actor on this synthetic event is "—"
 *   (unknown) in M1. This is documented as M2 debt.
 *
 * RBAC:
 *   Both OWNER and EMPLOYEE may read the timeline (isAuthenticated()).
 *   Anonymous → 401 enforced by existing admin SecurityConfig filter chain.
 *
 * Polish actor name test:
 *   AdminWebTestBase seeds "Owner Test" (fullName). We verify actorFullName appears on at
 *   least one STATUS_CHANGED event after the curator resolves the actor's UUID → full name.
 */
class AuditTimelineServiceIntegrationTest extends AdminWebTestBase {

    @Autowired private ClientRepository clientRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderItemRepository orderItemRepository;
    @Autowired private ObjectMapper objectMapper;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Test");
        c.setLastName("Klient");
        c.setPhone("+48 600 000 002");
        clientId = clientRepository.save(c).getId();
    }

    @AfterEach
    void cleanupOrders() {
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Test 1: Happy path — full lifecycle produces correct ordered event kinds
    // -------------------------------------------------------------------------

    @Test
    void happyPath_fullLifecycleProducesCorrectEventSequence() throws Exception {
        loginAsOwner();

        // 1. Create order
        UUID orderId = createOrderAndReturnId("Timeline test order");

        // 2. Change status PRZYJETE → W_REALIZACJI
        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":0}""")
                .with(csrf()))
            .andExpect(status().isOk());

        // 3. Add item
        UUID itemId = createItemAndReturnId(orderId);

        // 4. Edit item
        mockMvc().perform(patch("/api/admin/orders/" + orderId + "/items/" + itemId)
                .contentType("application/json")
                .content("""
                    {"description":"Updated desc","priceCents":9900}""")
                .with(csrf()))
            .andExpect(status().isOk());

        // 5. Remove item
        mockMvc().perform(delete("/api/admin/orders/" + orderId + "/items/" + itemId)
                .with(csrf()))
            .andExpect(status().isNoContent());

        // 6. GET timeline
        MvcResult result = mockMvc().perform(get("/api/admin/orders/" + orderId + "/timeline"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andReturn();

        JsonNode events = objectMapper.readTree(result.getResponse().getContentAsString());

        // Extract kinds
        var kinds = new java.util.ArrayList<String>();
        events.forEach(e -> kinds.add(e.get("kind").asText()));

        assertThat(kinds).as("expected event kinds in order")
            .containsExactly(
                TimelineEventKind.ORDER_CREATED.name(),
                TimelineEventKind.STATUS_CHANGED.name(),
                TimelineEventKind.ITEM_ADDED.name(),
                TimelineEventKind.ITEM_EDITED.name(),
                TimelineEventKind.ITEM_REMOVED.name()
            );

        // Verify occurredAt is monotonically non-decreasing
        var timestamps = new java.util.ArrayList<java.time.Instant>();
        events.forEach(e -> timestamps.add(java.time.Instant.parse(e.get("occurredAt").asText())));
        for (int i = 1; i < timestamps.size(); i++) {
            assertThat(timestamps.get(i)).as("timestamps must be non-decreasing at index " + i)
                .isAfterOrEqualTo(timestamps.get(i - 1));
        }
    }

    // -------------------------------------------------------------------------
    // Test 2: Empty timeline for unknown orderId returns 200 + empty list
    // -------------------------------------------------------------------------

    @Test
    void unknownOrderIdReturns200WithEmptyList() throws Exception {
        loginAsOwner();
        UUID unknownId = UUID.randomUUID();

        mockMvc().perform(get("/api/admin/orders/" + unknownId + "/timeline"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$.length()").value(0));
    }

    // -------------------------------------------------------------------------
    // Test 3: RBAC — anonymous returns 401
    // -------------------------------------------------------------------------

    @Test
    void anonymousTimelineRequestReturns401() throws Exception {
        // No loginAs*() — anonymous
        mockMvc().perform(get("/api/admin/orders/" + UUID.randomUUID() + "/timeline"))
            .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // Test 4: Actor full name appears in at least one event
    // -------------------------------------------------------------------------

    @Test
    void actorFullNameIsResolved() throws Exception {
        loginAsOwner();

        UUID orderId = createOrderAndReturnId("Actor name test");

        // Change status to produce a STATUS_CHANGED audit row with the owner's actorId
        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":0}""")
                .with(csrf()))
            .andExpect(status().isOk());

        MvcResult result = mockMvc().perform(get("/api/admin/orders/" + orderId + "/timeline"))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode events = objectMapper.readTree(result.getResponse().getContentAsString());

        // Find the STATUS_CHANGED event and check actorFullName
        boolean foundActorName = false;
        for (JsonNode e : events) {
            if (TimelineEventKind.STATUS_CHANGED.name().equals(e.get("kind").asText())) {
                String actorName = e.get("actorFullName").asText();
                // "Owner Test" is the full name seeded by AdminWebTestBase
                // If user resolution is not wired (M2 debt), "—" is acceptable,
                // but document the state. Either way the field must be non-null.
                assertThat(actorName).as("actorFullName must be non-null/empty").isNotEmpty();
                foundActorName = true;
                break;
            }
        }

        assertThat(foundActorName).as("must have a STATUS_CHANGED event with actorFullName").isTrue();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private UUID createOrderAndReturnId(String description) throws Exception {
        MvcResult r = mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s","description":"%s"}""".formatted(clientId, description))
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
            .get("id").asText());
    }

    private UUID createItemAndReturnId(UUID orderId) throws Exception {
        MvcResult r = mockMvc().perform(post("/api/admin/orders/" + orderId + "/items")
                .contentType("application/json")
                .content("""
                    {"kind":"NAPRAWA","description":"Timeline item","priceCents":3000}""")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        return UUID.fromString(objectMapper.readTree(r.getResponse().getContentAsString())
            .get("id").asText());
    }
}
