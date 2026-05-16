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
     * Unified DTO for all calendar entries.
     *
     * <p>Contract (updated v2-B 2026-05-17):</p>
     * <ul>
     *   <li>{@code receivedAt} always non-null — green marker day.</li>
     *   <li>{@code effectivePickupAt} always non-null — red marker day.
     *       Computed as {@code plannedPickupAt ?? receivedAt + 14 days}.</li>
     *   <li>{@code pickupAtDefaulted true} when no explicit {@code plannedPickupAt}
     *       was set — frontend renders a dashed red border.</li>
     *   <li>{@code plannedPickupAt} kept for backward compat; may be null.</li>
     *   <li>{@code unscheduled} array is always empty — every order is now scheduled.</li>
     * </ul>
     */
    public record CalendarOrderDto(
        UUID id,
        String code,
        String clientName,
        OrderStatus status,
        Instant plannedPickupAt,      // may be null; kept for compat
        Instant receivedAt,            // always non-null — green marker
        Instant effectivePickupAt,     // always non-null — red marker (planned ?? received+14d)
        boolean pickupAtDefaulted,     // true when effectivePickupAt was computed from +14d
        String itemSummary,
        boolean urgent
    ) {}
}
