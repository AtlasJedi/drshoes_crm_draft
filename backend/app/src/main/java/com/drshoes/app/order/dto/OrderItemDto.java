package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemKind;

import java.time.Instant;
import java.util.UUID;

public record OrderItemDto(
    UUID id,
    UUID orderId,
    int position,
    OrderItemKind kind,
    String description,
    String craftsmanNotes,
    int priceCents,
    Instant createdAt,
    Instant updatedAt
) {
    public static OrderItemDto of(OrderItem item) {
        return new OrderItemDto(
            item.getId(), item.getOrderId(), item.getPosition(),
            item.getKind(), item.getDescription(), item.getCraftsmanNotes(),
            item.getPriceCents(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
