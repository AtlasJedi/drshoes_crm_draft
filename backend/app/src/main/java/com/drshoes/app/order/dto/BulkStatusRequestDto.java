package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;
public record BulkStatusRequestDto(
    @NotEmpty List<@NotNull UUID> orderIds,
    @NotNull OrderStatus newStatus,
    String reason,
    Boolean sendTriggers
) {
    public BulkStatusRequestDto {
        if (sendTriggers == null) sendTriggers = Boolean.TRUE;
    }
}
