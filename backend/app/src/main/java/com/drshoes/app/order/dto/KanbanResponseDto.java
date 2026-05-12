package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record KanbanResponseDto(List<KanbanColumnDto> columns) {

    public record KanbanColumnDto(
        OrderStatus status,
        long total,
        List<KanbanCardDto> cards,
        boolean hasMore
    ) {}

    public record KanbanCardDto(
        UUID id,
        String code,
        String clientName,
        String itemSummary,
        Instant plannedPickupAt,
        /** ISO-8601 timestamp when the order was received; may be null for legacy/draft orders. */
        Instant receivedAt,
        boolean urgent
    ) {}
}
