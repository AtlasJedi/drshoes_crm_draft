package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.UUID;

public record OrderListRow(
    UUID id,
    String code,
    UUID clientId,
    OrderStatus status,
    int totalPriceCents,
    String currency,
    String description,
    Instant plannedPickupAt,
    int version,
    Instant updatedAt
) {
    public static OrderListRow of(Order o) {
        return new OrderListRow(
            o.getId(), o.getCode(), o.getClientId(), o.getStatus(),
            o.getTotalPriceCents(), o.getCurrency(), o.getDescription(),
            o.getPlannedPickupAt(), o.getVersion(), o.getUpdatedAt());
    }
}
