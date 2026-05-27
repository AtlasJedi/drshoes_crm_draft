package com.drshoes.app.order.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/**
 * Computes the "pilne" (urgent) flag.
 *
 * <p>Rule (2026-05-19): an order is urgent iff its status is {@link OrderStatus#PRZYJETE}
 * AND it has been in the shop for at least {@value #THRESHOLD_DAYS} days.
 * Any status transition away from PRZYJETE clears the flag automatically because
 * the flag is computed — not stored.
 */
@Setter
@Getter
public final class OrderUrgency {

    public static final int THRESHOLD_DAYS = 4;

    private OrderUrgency() {}

    public static boolean isUrgent(Instant receivedAt, OrderStatus status, Clock clock) {
        if (receivedAt == null) return false;
        if (status != OrderStatus.PRZYJETE) return false;
        return Duration.between(receivedAt, clock.instant()).toDays() >= THRESHOLD_DAYS;
    }

    public static boolean isUrgent(Instant receivedAt, OrderStatus status) {
        return isUrgent(receivedAt, status, Clock.systemUTC());
    }
}
