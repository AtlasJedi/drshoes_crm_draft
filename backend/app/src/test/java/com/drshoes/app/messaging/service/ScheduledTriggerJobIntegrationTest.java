package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.support.CronExpression;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Integration tests for ScheduledTriggerJob cron methods.
 *
 * Uses the V006-seeded triggers:
 *   - "Przypomnienie o odbiorze" BEFORE_PICKUP_X_DAYS days=1 channel=SMS
 *   - "Prosba o opinie"          AFTER_HANDOVER_Y_DAYS days=3 channel=EMAIL
 *
 * Each test seeds its own order and cleans up in @AfterEach.
 * The real system Clock is used; target dates are computed dynamically to avoid boundary flake.
 */
class ScheduledTriggerJobIntegrationTest extends AbstractIntegrationTest {

    private static final ZoneId PL = ZoneId.of("Europe/Warsaw");

    @Autowired ScheduledTriggerJob job;
    @Autowired MessageRepository messages;
    @Autowired JdbcTemplate jdbc;

    private final List<UUID> insertedOrderIds  = new ArrayList<>();
    private final List<UUID> insertedClientIds = new ArrayList<>();

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private UUID createOrderWithPlannedPickupOn(LocalDate d) {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "SCH-" + orderId.toString().substring(0, 8).toUpperCase();
        Instant pickupAt = d.atStartOfDay(PL).toInstant();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Jan", "+48600111222", "jan@example.com");
        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, planned_pickup_at, version)"
                + " VALUES (?::uuid, ?, ?::uuid, ?, ?::timestamptz, 0)",
                orderId.toString(), code, clientId.toString(), "WSTEPNIE_PRZYJETE",
                pickupAt.toString());

        insertedClientIds.add(clientId);
        insertedOrderIds.add(orderId);
        return orderId;
    }

    private UUID createOrderHandedOverOn(LocalDate d) {
        UUID clientId = UUID.randomUUID();
        UUID orderId  = UUID.randomUUID();
        String code   = "SCH-" + orderId.toString().substring(0, 8).toUpperCase();
        Instant deliveredAt = d.atStartOfDay(PL).toInstant();

        jdbc.update(
                "INSERT INTO client (id, first_name, phone, email) VALUES (?::uuid, ?, ?, ?)",
                clientId.toString(), "Ewa", "+48600333444", "ewa@example.com");
        jdbc.update(
                "INSERT INTO order_ (id, code, client_id, status, delivered_at, version)"
                + " VALUES (?::uuid, ?, ?::uuid, ?, ?::timestamptz, 0)",
                orderId.toString(), code, clientId.toString(), "WYDANE",
                deliveredAt.toString());

        insertedClientIds.add(clientId);
        insertedOrderIds.add(orderId);
        return orderId;
    }

    @AfterEach
    void cleanup() {
        for (UUID orderId : insertedOrderIds) {
            jdbc.update("DELETE FROM message WHERE order_id = ?::uuid", orderId.toString());
            jdbc.update("DELETE FROM trigger_fire WHERE order_id = ?::uuid", orderId.toString());
            jdbc.update("DELETE FROM order_ WHERE id = ?::uuid", orderId.toString());
        }
        for (UUID clientId : insertedClientIds) {
            jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid", clientId.toString());
            jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId.toString());
        }
        insertedOrderIds.clear();
        insertedClientIds.clear();
    }

    // ----------------------------------------------------------------
    // Tests
    // ----------------------------------------------------------------

    @Test
    void beforePickupFiresOneDayBefore() {
        // Seed order with pickup exactly 1 day from now (Warsaw) — matches days=1 trigger
        LocalDate target = LocalDate.now(PL).plusDays(1);
        UUID orderId = createOrderWithPlannedPickupOn(target);

        job.runBeforePickup();

        var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        assertThat(msgs).hasSize(1);
        assertThat(msgs.get(0).getTriggerId()).isNotNull();
    }

    @Test
    void beforePickupSkipsOrdersWithoutMatchingDate() {
        // Pickup +5 days — BEFORE_PICKUP days=1 should NOT match
        UUID orderId = createOrderWithPlannedPickupOn(LocalDate.now(PL).plusDays(5));

        job.runBeforePickup();

        assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).isEmpty();
    }

    @Test
    void afterHandoverFiresThreeDaysAfter() {
        // Delivered exactly 3 days ago (Warsaw) — matches days=3 trigger
        LocalDate handoverDate = LocalDate.now(PL).minusDays(3);
        UUID orderId = createOrderHandedOverOn(handoverDate);

        job.runAfterHandover();

        var msgs = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        assertThat(msgs).hasSize(1);
        assertThat(msgs.get(0).getTriggerId()).isNotNull();
    }

    @Test
    void rerunDoesNotProduceDuplicate() {
        LocalDate target = LocalDate.now(PL).plusDays(1);
        UUID orderId = createOrderWithPlannedPickupOn(target);

        job.runBeforePickup();
        job.runBeforePickup();

        // Idempotency guard must prevent the second fire from producing a second message
        assertThat(messages.findAllByOrderIdOrderByCreatedAtAsc(orderId)).hasSize(1);
    }

    @Test
    void cronStringsAreValid() {
        assertThatCode(() -> CronExpression.parse("0 0 9 * * *")).doesNotThrowAnyException();
        assertThatCode(() -> CronExpression.parse("0 0 11 * * *")).doesNotThrowAnyException();
    }
}
