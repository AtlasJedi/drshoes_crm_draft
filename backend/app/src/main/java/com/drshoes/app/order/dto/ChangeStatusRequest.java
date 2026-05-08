package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;

public record ChangeStatusRequest(
    OrderStatus targetStatus,
    int expectedVersion
) {}
