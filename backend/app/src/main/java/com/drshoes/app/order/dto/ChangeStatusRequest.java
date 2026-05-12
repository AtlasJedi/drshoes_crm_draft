package com.drshoes.app.order.dto;

import com.drshoes.app.audit.HasAuditNote;
import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.Size;

/**
 * Request body for single-order and bulk status transitions.
 * sendTriggers defaults to true (boxed Boolean, compact constructor normalises null → true)
 * so existing callers that omit the field (single-order API) continue to fire triggers.
 *
 * note is optional free-text (max 1000 chars). Persisted in audit_log.note via
 * HasAuditNote — AuditLogAspect reads auditNote() from the method args and threads
 * the value through to AuditLogWriter (M8 task m8-fb-1b).
 *
 * Note: @JsonProperty(defaultValue="true") is a no-op for primitive boolean in Jackson
 * records — it only affects schema generation. Using boxed Boolean + compact constructor
 * is the correct approach to default an absent JSON field to true.
 */
public record ChangeStatusRequest(
    OrderStatus targetStatus,
    int expectedVersion,
    Boolean sendTriggers,
    @Size(max = 1000, message = "Notatka nie może przekraczać 1000 znaków") String note
) implements HasAuditNote {
    public ChangeStatusRequest {
        if (sendTriggers == null) sendTriggers = Boolean.TRUE;
    }

    /** Backward-compat constructor for callers (tests, seed) that pre-date the note field. */
    public ChangeStatusRequest(OrderStatus targetStatus, int expectedVersion, Boolean sendTriggers) {
        this(targetStatus, expectedVersion, sendTriggers, null);
    }

    /** Backward-compat constructor accepting primitive boolean (used by older test sites). */
    public ChangeStatusRequest(OrderStatus targetStatus, int expectedVersion, boolean sendTriggers) {
        this(targetStatus, expectedVersion, Boolean.valueOf(sendTriggers), null);
    }

    /** HasAuditNote bridge — delegates to the record's note() accessor. */
    @Override
    public String auditNote() { return note; }
}
