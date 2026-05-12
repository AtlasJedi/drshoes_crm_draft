package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderSource;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateOrderRequest(
    UUID clientId,
    String description,
    Instant receivedAt,
    Instant plannedPickupAt,
    UUID assignedCraftsmanId,
    OrderSource source,
    List<CreateOrderItemRequest> items,
    Integer quotedPriceCents,
    Integer advancePaidCents
) {}
