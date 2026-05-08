package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderItemKind;

public record UpdateOrderItemRequest(
    OrderItemKind kind,
    String description,
    String craftsmanNotes,
    Integer priceCents
) {}
