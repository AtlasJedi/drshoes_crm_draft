package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Request body for POST /api/admin/orders/bulk/status.
 * orderIds: 1–100 order UUIDs; newStatus: target status for all; sendTriggers: gate trigger fanout.
 *
 * NOTE: max-size enforcement is intentionally absent from @NotEmpty to keep validation simple.
 * The 100-ID cap is enforced by BulkStatusController and returns 413 (not 400) per API contract.
 *
 * sendTriggers defaults to true via boxed Boolean + compact constructor (null → true).
 * reason: accepted for API symmetry, currently unused (no storage target defined).
 */
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
