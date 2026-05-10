package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request body for single-order and bulk status transitions.
 * sendTriggers defaults to true via @JsonProperty(defaultValue) so existing callers
 * that omit the field (single-order API) continue to fire triggers without change.
 */
public record ChangeStatusRequest(
    OrderStatus targetStatus,
    int expectedVersion,
    @JsonProperty(defaultValue = "true") boolean sendTriggers
) {}
