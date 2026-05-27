package com.drshoes.app.order.dto;

import com.drshoes.app.audit.HasAuditNote;
import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.Size;
public record ChangeStatusRequest(
    OrderStatus targetStatus,
    int expectedVersion,
    Boolean sendTriggers,
    @Size(max = 1000, message = "Notatka nie może przekraczać 1000 znaków") String note
) implements HasAuditNote {
    public ChangeStatusRequest {
        if (sendTriggers == null) sendTriggers = Boolean.TRUE;
    }
    public ChangeStatusRequest(OrderStatus targetStatus, int expectedVersion, Boolean sendTriggers) {
        this(targetStatus, expectedVersion, sendTriggers, null);
    }
    public ChangeStatusRequest(OrderStatus targetStatus, int expectedVersion, boolean sendTriggers) {
        this(targetStatus, expectedVersion, Boolean.valueOf(sendTriggers), null);
    }
    @Override
    public String auditNote() { return note; }
}
