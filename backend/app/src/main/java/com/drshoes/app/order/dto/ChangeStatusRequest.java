package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

/**
 * Request body for single-order and bulk status transitions.
 * sendTriggers defaults to true (boxed Boolean, compact constructor normalises null → true)
 * so existing callers that omit the field (single-order API) continue to fire triggers.
 *
 * Note: @JsonProperty(defaultValue="true") is a no-op for primitive boolean in Jackson
 * records — it only affects schema generation. Using boxed Boolean + compact constructor
 * is the correct approach to default an absent JSON field to true.
 */
public record ChangeStatusRequest(
    OrderStatus targetStatus,
    int expectedVersion,
    Boolean sendTriggers
) {
    public ChangeStatusRequest {
        if (sendTriggers == null) sendTriggers = Boolean.TRUE;
    }
}
