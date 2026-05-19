package com.drshoes.app.order.domain;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import static org.assertj.core.api.Assertions.assertThat;

class OrderUrgencyTest {

    private static final Instant NOW = Instant.parse("2026-06-01T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    // -------------------------------------------------------------------------
    // Positive: PRZYJETE + age >= 4 days
    // -------------------------------------------------------------------------

    @Test
    void urgent_whenPrzyjeteFiveDaysAgo() {
        Instant recv = NOW.minusSeconds(5 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.PRZYJETE, CLOCK)).isTrue();
    }

    @Test
    void urgent_whenPrzyjeteExactlyFourDaysAgo() {
        Instant recv = NOW.minusSeconds(4 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.PRZYJETE, CLOCK)).isTrue();
    }

    // -------------------------------------------------------------------------
    // Negative: PRZYJETE but too fresh
    // -------------------------------------------------------------------------

    @Test
    void notUrgent_whenPrzyjeteThreeDaysAgo() {
        Instant recv = NOW.minusSeconds(3 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.PRZYJETE, CLOCK)).isFalse();
    }

    // -------------------------------------------------------------------------
    // Negative: null receivedAt
    // -------------------------------------------------------------------------

    @Test
    void notUrgent_whenReceivedAtNull() {
        assertThat(OrderUrgency.isUrgent(null, OrderStatus.PRZYJETE, CLOCK)).isFalse();
    }

    // -------------------------------------------------------------------------
    // Regression: status != PRZYJETE → always false, even if very old
    // -------------------------------------------------------------------------

    @Test
    void notUrgent_whenWRealizacjiThirtyDaysAgo() {
        Instant recv = NOW.minusSeconds(30 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.W_REALIZACJI, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenGotoweDoOdbioru() {
        Instant recv = NOW.minusSeconds(30 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.GOTOWE_DO_ODBIORU, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenCzekaKlienta() {
        Instant recv = NOW.minusSeconds(30 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.CZEKA_NA_KLIENTA, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenWydane() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.WYDANE, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenAnulowane() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.ANULOWANE, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenWstepniePrzyjete() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.WSTEPNIE_PRZYJETE, CLOCK)).isFalse();
    }
}
