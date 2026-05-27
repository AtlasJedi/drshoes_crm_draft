package com.drshoes.app.order.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
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
