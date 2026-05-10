package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CalendarResponseDto(
    List<CalendarOrderDto> scheduled,
    List<CalendarOrderDto> unscheduled
) {
    /**
     * Unified DTO for both scheduled and unscheduled calendar entries.
     * plannedPickupAt is non-null for scheduled; receivedAt is non-null for unscheduled.
     * urgent follows the same derivation as OrderMapper.toDto (tag "pilne" OR within 48h of plannedPickupAt).
     */
    public record CalendarOrderDto(
        UUID id,
        String code,
        String clientName,
        OrderStatus status,
        Instant plannedPickupAt,  // null for unscheduled entries
        Instant receivedAt,        // null for scheduled entries
        String itemSummary,
        boolean urgent
    ) {}
}
