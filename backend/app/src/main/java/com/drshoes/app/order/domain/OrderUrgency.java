package com.drshoes.app.order.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/** Computes the "pilne" flag — >= 14 days in shop, not yet delivered/cancelled. */
public final class OrderUrgency {

    public static final int THRESHOLD_DAYS = 14;
    private static final Set<OrderStatus> EXCLUDED =
        Set.of(OrderStatus.WYDANE, OrderStatus.ANULOWANE, OrderStatus.WSTEPNIE_PRZYJETE);

    private OrderUrgency() {}

    public static boolean isUrgent(Instant receivedAt, OrderStatus status, Clock clock) {
        if (receivedAt == null) return false;
        if (EXCLUDED.contains(status)) return false;
        return Duration.between(receivedAt, clock.instant()).toDays() >= THRESHOLD_DAYS;
    }

    public static boolean isUrgent(Instant receivedAt, OrderStatus status) {
        return isUrgent(receivedAt, status, Clock.systemUTC());
    }
}
