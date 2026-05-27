package com.drshoes.app.order.api;

import com.drshoes.app.audit.HasAuditNote;
import jakarta.validation.constraints.Size;
public record AddOrderNoteRequest(
    @Size(max = 1000) String note,
    @Size(max = 64)   String location
) implements HasAuditNote {
    @Override
    public String auditNote() { return note; }
}
