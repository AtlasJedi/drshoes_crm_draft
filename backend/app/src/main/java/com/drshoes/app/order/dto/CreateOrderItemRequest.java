package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderItemKind;

public record CreateOrderItemRequest(
    OrderItemKind kind,
    String description,
    String craftsmanNotes,
    int priceCents
) {}
