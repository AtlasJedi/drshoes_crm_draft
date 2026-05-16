package com.drshoes.app.order.domain;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import static org.assertj.core.api.Assertions.assertThat;

class OrderUrgencyTest {

    private static final Instant NOW = Instant.parse("2026-06-01T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void urgent_whenReceivedFifteenDaysAgoAndInProgress() {
        Instant recv = NOW.minusSeconds(15 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.W_REALIZACJI, CLOCK)).isTrue();
    }

    @Test
    void notUrgent_whenReceivedExactlyThirteenDaysAgo() {
        Instant recv = NOW.minusSeconds(13 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.W_REALIZACJI, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenReceivedAtNull() {
        assertThat(OrderUrgency.isUrgent(null, OrderStatus.W_REALIZACJI, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenStatusWydane() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.WYDANE, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenStatusAnulowane() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.ANULOWANE, CLOCK)).isFalse();
    }

    @Test
    void notUrgent_whenStatusWstepniePrzyjete() {
        Instant recv = NOW.minusSeconds(100 * 86400);
        assertThat(OrderUrgency.isUrgent(recv, OrderStatus.WSTEPNIE_PRZYJETE, CLOCK)).isFalse();
    }
}
