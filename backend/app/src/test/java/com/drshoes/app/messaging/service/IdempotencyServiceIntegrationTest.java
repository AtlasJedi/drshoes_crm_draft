package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class IdempotencyServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired IdempotencyService svc;
    @Autowired TriggerRepository triggers;
    @Autowired JdbcTemplate jdbc;

    // Track inserted rows so @AfterEach can clean up without touching other tests' data.
    private UUID insertedOrderId;
    private UUID insertedClientId;

    /**
     * Inserts a minimal client row + order_ row via JdbcTemplate and returns the order id.
     *
     * Minimal client columns: id, first_name, phone (satisfies client_contact_present CHECK).
     * Minimal order_ columns: id, code, client_id, status, version (V004 added version NOT NULL).
     * No AbstractIntegrationTest helper exists for orders — local JDBC approach per plan note.
     */
    private UUID createMinimalOrder() {
        UUID clientId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        String code = "TST-" + orderId.toString().substring(0, 8).toUpperCase();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone) VALUES (?::uuid, ?, ?)",
                clientId.toString(), "Test", "+48 600 000 000");

        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, version) VALUES (?::uuid, ?, ?::uuid, ?, 0)",
                orderId.toString(), code, clientId.toString(), "WSTEPNIE_PRZYJETE");

        insertedOrderId = orderId;
        insertedClientId = clientId;
        return orderId;
    }

    @AfterEach
    void cleanup() {
        if (insertedOrderId != null) {
            jdbc.update("DELETE FROM trigger_fire WHERE order_id = ?::uuid", insertedOrderId.toString());
            jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", insertedOrderId.toString());
            insertedOrderId = null;
        }
        if (insertedClientId != null) {
            jdbc.update("DELETE FROM client WHERE id = ?::uuid", insertedClientId.toString());
            insertedClientId = null;
        }
    }

    @Test
    void firstClaimSucceedsSecondReturnsFalse() {
        var trg = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE).get(0);
        UUID orderId = createMinimalOrder();
        String disc = "to:PRZYJETE";

        boolean first = svc.claimTriggerFire(trg.getId(), orderId, disc);
        boolean second = svc.claimTriggerFire(trg.getId(), orderId, disc);

        assertThat(first).isTrue();
        assertThat(second).isFalse();
    }

    @Test
    void differentDiscriminatorsAreIndependent() {
        var trg = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE).get(0);
        UUID orderId = createMinimalOrder();

        assertThat(svc.claimTriggerFire(trg.getId(), orderId, "to:PRZYJETE")).isTrue();
        assertThat(svc.claimTriggerFire(trg.getId(), orderId, "to:W_REALIZACJI")).isTrue();
    }
}
