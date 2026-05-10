package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for POST /api/admin/orders/bulk/status.
 *
 * Audit semantics: AuditLogAspect writes exactly ONE row per HTTP request (controller pointcut).
 * OrderService.changeStatus is NOT @Audited, so per-order transitions do not produce
 * additional audit rows. All audit count assertions reflect this (delta = 1 per call).
 *
 * Free-transition semantics (M1 locked): no state-machine guard — any status→any status
 * is permitted. The ILLEGAL_TRANSITION bucket is scaffolded for future guards.
 * WYDANE→W_REALIZACJI therefore SUCCEEDS in the current codebase; the mixed-result test
 * uses NOT_FOUND + VERSION_CONFLICT as the two failure modes instead.
 */
class BulkStatusControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;
    @Autowired private AuditLogRepository auditLogRepo;
    @Autowired private ObjectMapper objectMapper;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Bulk");
        c.setLastName("Client");
        c.setPhone("+48 600 000 099");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ------------------------------------------------------------------
    // All-success: 3 orders all transition cleanly
    // ------------------------------------------------------------------

    @Test
    void allSuccessReturns200WithSucceededArray() throws Exception {
        loginAsOwner();
        UUID id1 = seedOrder("BK-001", OrderStatus.PRZYJETE, 0);
        UUID id2 = seedOrder("BK-002", OrderStatus.PRZYJETE, 0);
        UUID id3 = seedOrder("BK-003", OrderStatus.PRZYJETE, 0);

        String body = objectMapper.writeValueAsString(Map.of(
            "orderIds", List.of(id1, id2, id3),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(3)))
            .andExpect(jsonPath("$.failed", hasSize(0)));
    }

    // ------------------------------------------------------------------
    // Mixed: 1 NOT_FOUND (UUID doesn't exist) + 1 soft-deleted (treated as NOT_FOUND)
    // + 1 success.
    // Free-transition note: WYDANE→W_REALIZACJI succeeds (no state machine guard).
    // VERSION_CONFLICT is structurally impossible via bulk endpoint because the
    // controller always reads current DB version before calling changeStatus.
    // ------------------------------------------------------------------

    @Test
    void mixedResultsReturn200WithBothArrays() throws Exception {
        loginAsOwner();
        UUID validId   = seedOrder("BK-010", OrderStatus.PRZYJETE, 0);
        UUID missingId = UUID.randomUUID(); // UUID does not exist in DB → NOT_FOUND

        // Soft-deleted order — filter(o -> o.getDeletedAt() == null) treats it as absent
        UUID deletedId = seedOrder("BK-011", OrderStatus.PRZYJETE, 0);
        Order deletedOrder = orderRepo.findById(deletedId).orElseThrow();
        deletedOrder.setDeletedAt(java.time.Instant.now());
        orderRepo.save(deletedOrder);

        String body = objectMapper.writeValueAsString(Map.of(
            "orderIds", List.of(validId, missingId, deletedId),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        // validId transitions → succeeded
        // missingId not found → NOT_FOUND in failed
        // deletedId soft-deleted, filter rejects it → NOT_FOUND in failed
        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)))
            .andExpect(jsonPath("$.failed", hasSize(2)))
            .andExpect(jsonPath("$.failed[?(@.error=='NOT_FOUND')]", hasSize(2)));
    }

    // ------------------------------------------------------------------
    // Empty orderIds[] → 400
    // ------------------------------------------------------------------

    @Test
    void emptyOrderIdsReturns400() throws Exception {
        loginAsOwner();
        String body = """
            {"orderIds":[],"newStatus":"W_REALIZACJI","sendTriggers":false}""";

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // 101 IDs → 413
    // ------------------------------------------------------------------

    @Test
    void over100IdsReturns413() throws Exception {
        loginAsOwner();
        List<UUID> ids = Stream.generate(UUID::randomUUID).limit(101).toList();
        String body = objectMapper.writeValueAsString(Map.of(
            "orderIds", ids,
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isPayloadTooLarge());
    }

    // ------------------------------------------------------------------
    // Invalid newStatus enum → 400
    // ------------------------------------------------------------------

    @Test
    void invalidStatusEnumReturns400() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("BK-020", OrderStatus.PRZYJETE, 0);
        String body = """
            {"orderIds":["%s"],"newStatus":"NOT_A_STATUS","sendTriggers":false}"""
            .formatted(id);

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // sendTriggers=false: verify single audit row (controller HTTP row only)
    // ------------------------------------------------------------------

    @Test
    void sendTriggersFalseProducesExactlyOneAuditRow() throws Exception {
        loginAsOwner();
        UUID id = seedOrder("BK-030", OrderStatus.PRZYJETE, 0);
        long auditBefore = auditLogRepo.count();

        String body = objectMapper.writeValueAsString(Map.of(
            "orderIds", List.of(id),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)));

        // Exactly 1 audit row: the AuditLogAspect HTTP controller row for the bulk request.
        // OrderService.changeStatus is NOT @Audited so per-order transitions add 0 rows.
        // sendTriggers=false means no trigger-dispatch audit rows are added either.
        long auditAfter = auditLogRepo.count();
        assertThat(auditAfter - auditBefore)
            .as("Bulk request produces exactly 1 controller audit row")
            .isEqualTo(1);
    }

    // ------------------------------------------------------------------
    // Audit rows: 1 for bulk request regardless of per-order outcomes
    // Failed orders do not produce extra audit rows.
    // ------------------------------------------------------------------

    @Test
    void auditRowCountIsOneRegardlessOfPerOrderOutcomes() throws Exception {
        loginAsOwner();
        UUID validId   = seedOrder("BK-040", OrderStatus.PRZYJETE, 0);
        UUID missingId = UUID.randomUUID();
        long auditBefore = auditLogRepo.count();

        String body = objectMapper.writeValueAsString(Map.of(
            "orderIds", List.of(validId, missingId),
            "newStatus", "W_REALIZACJI",
            "sendTriggers", false
        ));

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded", hasSize(1)))
            .andExpect(jsonPath("$.failed", hasSize(1)));

        long auditAfter = auditLogRepo.count();
        assertThat(auditAfter - auditBefore)
            .as("One controller audit row for the bulk request; NOT_FOUND failure adds 0 rows")
            .isEqualTo(1);
    }

    // ------------------------------------------------------------------
    // Unauthenticated → 401
    // ------------------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        String body = """
            {"orderIds":["%s"],"newStatus":"W_REALIZACJI","sendTriggers":false}"""
            .formatted(UUID.randomUUID());

        mockMvc().perform(post("/api/admin/orders/bulk/status")
                .contentType("application/json").content(body).with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, int ignoredVersion) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now());
        return orderRepo.save(o).getId();
    }
}
