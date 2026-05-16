package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderSource;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderUrgency;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderDto(
    UUID id,
    String code,
    UUID clientId,
    String clientName,
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
    String location,
    String description,
    String cancelledReason,
    int version,
    Instant createdAt,
    Instant updatedAt,
    List<OrderItemDto> items,
    int quotedPriceCents,
    int advancePaidCents,
    boolean urgent
) {
    public static OrderDto of(Order o, List<OrderItemDto> items, String clientName) {
        return new OrderDto(
            o.getId(), o.getCode(), o.getClientId(), clientName, o.getStatus(), o.getSource(),
            o.getReceivedAt(), o.getPlannedPickupAt(), o.getPickedUpAt(),
            o.getAssignedCraftsmanId(), o.getCurrentStorageLocationId(),
            o.getTags(), o.getTotalPriceCents(), o.getCurrency(),
            o.getLocation(),
            o.getDescription(), o.getCancelledReason(),
            o.getVersion(), o.getCreatedAt(), o.getUpdatedAt(),
            items,
            o.getQuotedPriceCents(), o.getAdvancePaidCents(),
            OrderUrgency.isUrgent(o.getReceivedAt(), o.getStatus()));
    }
}
