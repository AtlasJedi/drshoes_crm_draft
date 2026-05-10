package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.ChangeStatusRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for TriggerEngine STATUS_CHANGE post-commit hook.
 *
 * Uses the seeded "Zlecenie przyjete" trigger (STATUS_CHANGE → PRZYJETE) from V006.
 * Orders start in WSTEPNIE_PRZYJETE so transitioning to PRZYJETE fires that trigger.
 *
 * Three tests:
 *   1. Happy path: status change fires exactly one message row with non-null triggerId.
 *   2. Rollback: version conflict prevents trigger fire.
 *   3. Idempotency: re-entering PRZYJETE fires only once total.
 */
class TriggerEngineIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderService orderService;
    @Autowired MessageRepository messages;
    @Autowired JdbcTemplate jdbc;

    private UUID insertedClientId;
    private UUID insertedOrderId;

    /**
     * Inserts a minimal client + order in WSTEPNIE_PRZYJETE at version 0.
     * Client gets an email so LoggingEmailGateway has a valid recipient.
     */
    private UUID createOrderInWstepnie() {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "TRG-" + orderId.toString().substring(0, 8).toUpperCase();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Anna", "+48600000001", "anna@example.com");

        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "WSTEPNIE_PRZYJETE");

        insertedClientId = clientId;
        insertedOrderId  = orderId;
        return orderId;
    }

    @AfterEach
    void cleanup() {
        if (insertedOrderId != null) {
            jdbc.update("DELETE FROM message WHERE order_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM trigger_fire WHERE order_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM message_thread WHERE client_id IN (SELECT id FROM client WHERE id = ?::uuid)", insertedClientId.toString());
            jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", insertedOrderId.toString());
            insertedOrderId = null;
        }
        if (insertedClientId != null) {
            jdbc.update("DELETE FROM client WHERE id = ?::uuid", insertedClientId.toString());
            insertedClientId = null;
        }
    }

    // ============================================================
    // Test 1: STATUS_CHANGE to PRZYJETE fires one message with triggerId
    // ============================================================
    @Test
    void statusChangeToPRZYJETEFiresMessageOnce() {
        UUID orderId = createOrderInWstepnie();

        orderService.changeStatus(orderId, new ChangeStatusRequest(OrderStatus.PRZYJETE, 0, true));

        var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        assertThat(msgs).hasSize(1);
        assertThat(msgs.get(0).getTriggerId()).isNotNull();
    }

    // ============================================================
    // Test 2: Rollback (version conflict) prevents trigger fire
    // ============================================================
    @Test
    void rollbackPreventsTriggerFire() {
        UUID orderId = createOrderInWstepnie();

        try {
            // Wrong expectedVersion (999) forces OrderVersionConflictException → transaction rolls back
            orderService.changeStatus(orderId, new ChangeStatusRequest(OrderStatus.PRZYJETE, 999, true));
        } catch (RuntimeException expected) {
            // expected — optimistic lock collision
        }

        assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).isEmpty();
    }

    // ============================================================
    // Test 3: Re-entering PRZYJETE fires only once (idempotency on "to:PRZYJETE")
    // ============================================================
    @Test
    void doubleStatusChangeFiresOnceDueToIdempotency() {
        UUID orderId = createOrderInWstepnie();

        // version=0 → PRZYJETE (fires trigger, version becomes 1)
        orderService.changeStatus(orderId, new ChangeStatusRequest(OrderStatus.PRZYJETE, 0, true));

        // version=1 → W_REALIZACJI (no STATUS_CHANGE trigger for W_REALIZACJI, version becomes 2)
        orderService.changeStatus(orderId, new ChangeStatusRequest(OrderStatus.W_REALIZACJI, 1, true));

        // version=2 → PRZYJETE again (idempotency guard: discriminator "to:PRZYJETE" already claimed)
        orderService.changeStatus(orderId, new ChangeStatusRequest(OrderStatus.PRZYJETE, 2, true));

        var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        long przyjeteFires = msgs.stream().filter(m -> m.getTriggerId() != null).count();
        assertThat(przyjeteFires).isEqualTo(1);
    }
}
