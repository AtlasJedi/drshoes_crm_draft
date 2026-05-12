package com.drshoes.app.order.dto;

import java.time.Instant;
import java.util.UUID;

public record UpdateOrderRequest(
    String description,
    Instant plannedPickupAt,
    UUID assignedCraftsmanId,
    UUID currentStorageLocationId,
    String cancelledReason,
    String tags,
    Integer version,
    Integer quotedPriceCents,
    Integer advancePaidCents
) {}
