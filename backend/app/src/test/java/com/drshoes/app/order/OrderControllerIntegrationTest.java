package com.drshoes.app.order;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for OrderController.
 *
 * TDD Red: written before the controller exists.
 *
 * RBAC coverage:
 *   - unauthenticated GET → 401
 *   - EMPLOYEE DELETE → 403
 *   - OWNER DELETE → 204
 *
 * Audit coverage regression:
 *   - postCreateWritesAuditRow: POST must land inside AuditLogAspect's pointcut
 *     (com.drshoes.app..api..*Controller) — would fail if controller lived outside .api.
 */
class OrderControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private AuditLogRepository auditLogs;
    @Autowired private ClientRepository clientRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderItemRepository orderItemRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        // AdminWebTestBase.seedUsers() runs first via @BeforeEach order.
        // Create a minimal client for use in order creation payloads.
        var c = new Client();
        c.setFirstName("Test");
        c.setLastName("Klient");
        c.setPhone("+48 600 000 099");
        // Email is required so that the PRZYJETE trigger (now fired on every order create
        // since fix-C) and the GOTOWE_DO_ODBIORU trigger can persist a Message row instead
        // of bailing at null_or_blank_recipient.
        c.setEmail("test.klient@example.com");
        clientId = clientRepository.save(c).getId();
    }

    /**
     * JUnit 5: subclass @AfterEach runs before superclass @AfterEach.
     * Delete messages, items, then orders before AdminWebTestBase tries to delete clients,
     * to avoid FK violations.
     */
    @AfterEach
    void cleanupOrders() {
        messageRepository.deleteAll();
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Audit aspect regression
    // -------------------------------------------------------------------------

    @Test
    void postCreateWritesAuditRow() throws Exception {
        // Regression guard: OrderController must be in com.drshoes.app.order.api so
        // AuditLogAspect's pointcut (execution(public * com.drshoes.app..api..*Controller.*(..)))
        // fires. This test would fail if controller lived outside .api.
        //
        // Filter by path/method since fix-C now also fires the PRZYJETE trigger on
        // create — that emits an additional internal audit row from MessageRouter.
        loginAsOwner();
        long before = auditLogs.findAll().stream()
            .filter(a -> "POST".equals(a.getMethod()) && "/api/admin/orders".equals(a.getPath()))
            .count();

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s"}""".formatted(clientId))
                .with(csrf()))
            .andExpect(status().isCreated());

        long written = auditLogs.findAll().stream()
            .filter(a -> "POST".equals(a.getMethod()) && "/api/admin/orders".equals(a.getPath()))
            .count() - before;
        assertThat(written)
            .as("AuditLogAspect must write exactly one row for POST /api/admin/orders")
            .isEqualTo(1);
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/orders — create
    // -------------------------------------------------------------------------

    @Test
    void postCreateReturns201WithLocation() throws Exception {
        loginAsOwner();

        MvcResult result = mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s","description":"Nowe zlecenie"}""".formatted(clientId))
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PRZYJETE"))
            .andExpect(jsonPath("$.clientId").value(clientId.toString()))
            .andReturn();

        String location = result.getResponse().getHeader("Location");
        assertThat(location).isNotNull().contains("/api/admin/orders/");
    }

    @Test
    void postCreateWithInvalidClientReturns404() throws Exception {
        loginAsOwner();
        UUID missingClient = UUID.randomUUID();

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s"}""".formatted(missingClient))
                .with(csrf()))
            .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/orders — list
    // -------------------------------------------------------------------------

    @Test
    void listReturnsPagedResult() throws Exception {
        loginAsOwner();
        // Create two orders
        createOrderAndReturnId("Zlecenie A");
        createOrderAndReturnId("Zlecenie B");

        mockMvc().perform(get("/api/admin/orders?page=0&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    @Test
    void listWithStatusFilterReturnMatchingOrders() throws Exception {
        loginAsOwner();
        createOrderAndReturnId("Przyjete order");

        mockMvc().perform(get("/api/admin/orders?status=PRZYJETE&page=0&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content[0].status").value("PRZYJETE"));
    }

    @Test
    void listWithQFilterMatchesDescription() throws Exception {
        loginAsOwner();
        createOrderAndReturnId("NajwazniejszeZlecenie");

        mockMvc().perform(get("/api/admin/orders?q=NajwazniejszeZlecenie&page=0&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content[0].description").value("NajwazniejszeZlecenie"));
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/orders/{id} — single
    // -------------------------------------------------------------------------

    @Test
    void getByIdReturnsFullDto() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Szczegoly zlecenia");

        mockMvc().perform(get("/api/admin/orders/" + orderId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(orderId.toString()))
            .andExpect(jsonPath("$.description").value("Szczegoly zlecenia"))
            .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void getByIdNonExistentReturns404() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/orders/00000000-0000-0000-0000-000000000000"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
    }

    // -------------------------------------------------------------------------
    // PATCH /api/admin/orders/{id} — update
    // -------------------------------------------------------------------------

    @Test
    void patchUpdatesDescription() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Przed aktualizacja");

        mockMvc().perform(patch("/api/admin/orders/" + orderId)
                .contentType("application/json")
                .content("""
                    {"description":"Po aktualizacji"}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.description").value("Po aktualizacji"));
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/orders/{id}/status — change status
    // -------------------------------------------------------------------------

    @Test
    void postStatusHappyPath() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Status change");

        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":0}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.order.status").value("W_REALIZACJI"))
            .andExpect(jsonPath("$.order.version").value(1));
    }

    @Test
    void postStatusWithStaleVersionReturns409() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Stale version");

        // Send wrong expectedVersion (1 instead of 0)
        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":99}""")
                .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_VERSION_CONFLICT"))
            .andExpect(jsonPath("$.currentVersion").value(0));
    }

    // -------------------------------------------------------------------------
    // DELETE /api/admin/orders/{id}
    // -------------------------------------------------------------------------

    @Test
    void deleteAsEmployeeReturns403() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Delete RBAC test");

        loginAsEmployee();
        mockMvc().perform(delete("/api/admin/orders/" + orderId).with(csrf()))
            .andExpect(status().isForbidden());
    }

    @Test
    void deleteAsOwnerReturns204ThenGetReturns404() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Delete and get 404");

        mockMvc().perform(delete("/api/admin/orders/" + orderId).with(csrf()))
            .andExpect(status().isNoContent());

        mockMvc().perform(get("/api/admin/orders/" + orderId))
            .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/orders/{id}/items — add item
    // -------------------------------------------------------------------------

    @Test
    void addItemHappyPath() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Z pozycja");

        MvcResult result = mockMvc().perform(post("/api/admin/orders/" + orderId + "/items")
                .contentType("application/json")
                .content("""
                    {"kind":"NAPRAWA","description":"Heel replacement","priceCents":4500}""")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.kind").value("NAPRAWA"))
            .andReturn();

        String location = result.getResponse().getHeader("Location");
        assertThat(location).isNotNull().contains("/items/");
    }

    // -------------------------------------------------------------------------
    // PATCH /api/admin/orders/{id}/items/{itemId} — update item
    // -------------------------------------------------------------------------

    @Test
    void updateItemHappyPath() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Order with item");
        UUID itemId = createItemAndReturnId(orderId);

        mockMvc().perform(patch("/api/admin/orders/" + orderId + "/items/" + itemId)
                .contentType("application/json")
                .content("""
                    {"description":"Updated description","priceCents":9900}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.description").value("Updated description"));
    }

    // -------------------------------------------------------------------------
    // DELETE /api/admin/orders/{id}/items/{itemId} — remove item
    // -------------------------------------------------------------------------

    @Test
    void removeItemHappyPath() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Order remove item");
        UUID itemId = createItemAndReturnId(orderId);

        mockMvc().perform(delete("/api/admin/orders/" + orderId + "/items/" + itemId)
                .with(csrf()))
            .andExpect(status().isNoContent());
    }

    // -------------------------------------------------------------------------
    // Anonymous → 401
    // -------------------------------------------------------------------------

    @Test
    void unauthenticatedGetReturns401() throws Exception {
        // No loginAs*() call — anonymous
        mockMvc().perform(get("/api/admin/orders"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedPostReturns401() throws Exception {
        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s"}""".formatted(UUID.randomUUID()))
                .with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/orders?clientId=<uuid> — client filter
    // -------------------------------------------------------------------------

    @Test
    void listFiltersByClientId() throws Exception {
        loginAsOwner();

        // Seed a second client whose orders must NOT appear in the filtered list.
        var otherClient = new Client();
        otherClient.setFirstName("Other");
        otherClient.setPhone("+48 600 999 111");
        UUID otherClientId = clientRepository.save(otherClient).getId();

        // Create one order for our seeded clientId and one for otherClientId.
        String orderForClient = """
            {"clientId":"%s","description":"for main client"}""".formatted(clientId);
        String orderForOther  = """
            {"clientId":"%s","description":"for other client"}""".formatted(otherClientId);

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content(orderForClient)
                .with(csrf()))
            .andExpect(status().isCreated());

        mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content(orderForOther)
                .with(csrf()))
            .andExpect(status().isCreated());

        // GET /api/admin/orders?clientId=<clientId> must return exactly 1 row.
        mockMvc().perform(get("/api/admin/orders?clientId=" + clientId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].description").value("for main client"));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    // POST /api/admin/orders/{id}/status — audit_log.note persistence (M8 m8-fb-1b)
    // -------------------------------------------------------------------------

    @Test
    void changeStatus_persistsNoteOnAuditRow() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("Note test order");

        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":0,"note":"Klient zapłacił z góry"}""")
                .with(csrf()))
            .andExpect(status().isOk());

        String storedNote = jdbc.queryForObject(
            "SELECT note FROM audit_log WHERE path = ? ORDER BY created_at DESC LIMIT 1",
            String.class, "/api/admin/orders/" + orderId + "/status");
        assertThat(storedNote).isEqualTo("Klient zapłacił z góry");
    }

    @Test
    void changeStatus_nullNoteLeavesAuditNoteNull() throws Exception {
        loginAsOwner();
        UUID orderId = createOrderAndReturnId("No note order");

        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"W_REALIZACJI","expectedVersion":0}""")
                .with(csrf()))
            .andExpect(status().isOk());

        String storedNote = jdbc.queryForObject(
            "SELECT note FROM audit_log WHERE path = ? ORDER BY created_at DESC LIMIT 1",
            String.class, "/api/admin/orders/" + orderId + "/status");
        assertThat(storedNote).isNull();
    }

    // -------------------------------------------------------------------------
    // POST /api/admin/orders/{id}/status — sendTriggers flag (Slice F)
    // -------------------------------------------------------------------------

    @Test
    void changeStatus_sendTriggersFalse_doesNotCreateMessageRow() throws Exception {
        loginAsOwner();
        // Create order (starts as PRZYJETE); transition to GOTOWE_DO_ODBIORU which has
        // a seeded trigger (V006). sendTriggers=false must suppress message creation.
        UUID orderId = createOrderAndReturnId("sendTriggers=false test");

        long messagesBefore = messageRepository.count();

        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"GOTOWE_DO_ODBIORU","expectedVersion":0,"sendTriggers":false}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.order.status").value("GOTOWE_DO_ODBIORU"));

        long messagesAfter = messageRepository.count();
        assertThat(messagesAfter)
            .as("sendTriggers=false must not create any Message row")
            .isEqualTo(messagesBefore);
    }

    @Test
    void changeStatus_sendTriggersTrue_createsMessageRow() throws Exception {
        loginAsOwner();
        // sendTriggers=true (or omitted) with a matching seeded trigger must produce a Message.
        UUID orderId = createOrderAndReturnId("sendTriggers=true test");

        long messagesBefore = messageRepository.count();

        mockMvc().perform(post("/api/admin/orders/" + orderId + "/status")
                .contentType("application/json")
                .content("""
                    {"targetStatus":"GOTOWE_DO_ODBIORU","expectedVersion":0,"sendTriggers":true}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.order.status").value("GOTOWE_DO_ODBIORU"));

        long messagesAfter = messageRepository.count();
        assertThat(messagesAfter)
            .as("sendTriggers=true with a matching trigger must create at least one Message row")
            .isGreaterThan(messagesBefore);
    }

    // -------------------------------------------------------------------------

    private UUID createOrderAndReturnId(String description) throws Exception {
        MvcResult r = mockMvc().perform(post("/api/admin/orders")
                .contentType("application/json")
                .content("""
                    {"clientId":"%s","description":"%s"}""".formatted(clientId, description))
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        String json = r.getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(json).get("id").asText());
    }

    private UUID createItemAndReturnId(UUID orderId) throws Exception {
        MvcResult r = mockMvc().perform(post("/api/admin/orders/" + orderId + "/items")
                .contentType("application/json")
                .content("""
                    {"kind":"NAPRAWA","description":"Test item","priceCents":1000}""")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        String json = r.getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(json).get("id").asText());
    }
}
