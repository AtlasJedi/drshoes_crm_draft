package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

import java.util.List;
import java.util.UUID;

/**
 * Response body for POST /api/admin/orders/bulk/status.
 * Always 200 unless the request itself is malformed.
 * succeeded: orders whose status was changed; failed: orders that could not be transitioned.
 */
public record BulkStatusResponseDto(
    List<SucceededItem> succeeded,
    List<FailedItem> failed
) {
    public record SucceededItem(UUID orderId, String code, OrderStatus fromStatus, OrderStatus toStatus) {}
    public record FailedItem(UUID orderId, String code, OrderStatus fromStatus, String error) {}
}
