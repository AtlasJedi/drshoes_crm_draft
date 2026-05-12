package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderSource;
import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderDto(
    UUID id,
    String code,
    UUID clientId,
    OrderStatus status,
    OrderSource source,
    Instant receivedAt,
    Instant plannedPickupAt,
    Instant pickedUpAt,
    UUID assignedCraftsmanId,
    UUID currentStorageLocationId,
    String tags,
    int totalPriceCents,
    String currency,
    String description,
    String cancelledReason,
    int version,
    Instant createdAt,
    Instant updatedAt,
    List<OrderItemDto> items,
    int quotedPriceCents,
    int advancePaidCents
) {
    public static OrderDto of(Order o, List<OrderItemDto> items) {
        return new OrderDto(
            o.getId(), o.getCode(), o.getClientId(), o.getStatus(), o.getSource(),
            o.getReceivedAt(), o.getPlannedPickupAt(), o.getPickedUpAt(),
            o.getAssignedCraftsmanId(), o.getCurrentStorageLocationId(),
            o.getTags(), o.getTotalPriceCents(), o.getCurrency(),
            o.getDescription(), o.getCancelledReason(),
            o.getVersion(), o.getCreatedAt(), o.getUpdatedAt(),
            items,
            o.getQuotedPriceCents(), o.getAdvancePaidCents());
    }
}
