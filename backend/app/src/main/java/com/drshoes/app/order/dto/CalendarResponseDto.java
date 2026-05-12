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
     *
     * <p>Contract (updated ux-2 2026-05-12):</p>
     * <ul>
     *   <li>Scheduled entries: {@code plannedPickupAt} non-null, {@code receivedAt} non-null
     *       — both timestamps are always populated so week/day views can render the same
     *       order as two distinct markers (received marker on received date, pickup marker
     *       on planned pickup date).</li>
     *   <li>Unscheduled entries: {@code plannedPickupAt} null, {@code receivedAt} non-null.</li>
     * </ul>
     * urgent follows the same derivation as OrderMapper.toDto (tag "pilne" OR within 48h of plannedPickupAt).
     */
    public record CalendarOrderDto(
        UUID id,
        String code,
        String clientName,
        OrderStatus status,
        Instant plannedPickupAt,  // null for unscheduled entries
        Instant receivedAt,        // always non-null (both scheduled and unscheduled)
        String itemSummary,
        boolean urgent
    ) {}
}
