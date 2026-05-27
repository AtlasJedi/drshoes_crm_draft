package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CalendarResponseDto(
    List<CalendarOrderDto> scheduled,
    List<CalendarOrderDto> unscheduled
) {
    public record CalendarOrderDto(
        UUID id,
        String code,
        String clientName,
        OrderStatus status,
        Instant plannedPickupAt,
        Instant receivedAt,
        Instant effectivePickupAt,
        boolean pickupAtDefaulted,
        String itemSummary,
        boolean urgent
    ) {}
}
