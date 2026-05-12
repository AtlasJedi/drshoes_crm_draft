package com.drshoes.app.order.dto;

import com.drshoes.app.order.domain.OrderStatus;
import jakarta.validation.constraints.Size;

/**
 * Request body for single-order and bulk status transitions.
 * sendTriggers defaults to true (boxed Boolean, compact constructor normalises null → true)
 * so existing callers that omit the field (single-order API) continue to fire triggers.
 *
 * note is optional free-text (max 1000 chars). It is included in the request body
 * and therefore captured in audit_log.body_hash (SHA-256 of the full request).
 * IMPORTANT: the note text itself is NOT stored in a readable column — audit_log
 * has no free-text field. The note is logged at INFO level as noteLen (char count)
 * for PII safety. Full note persistence in the timeline requires a future migration
 * (owner decision deferred — see dispatch-log m8-fb-1).
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
) {
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
}
