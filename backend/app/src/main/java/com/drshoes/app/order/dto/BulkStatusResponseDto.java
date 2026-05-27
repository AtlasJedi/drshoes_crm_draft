package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.util.List;
import java.util.UUID;
public record BulkStatusResponseDto(
    List<SucceededItem> succeeded,
    List<FailedItem> failed
) {
    public record SucceededItem(UUID orderId, String code, OrderStatus fromStatus, OrderStatus toStatus) {}
    public record FailedItem(UUID orderId, String code, OrderStatus fromStatus, String error) {}
}
