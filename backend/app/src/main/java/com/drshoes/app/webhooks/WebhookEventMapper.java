package com.drshoes.app.webhooks;

import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import org.springframework.stereotype.Component;

/**
 * Maps provider-specific webhook payloads to the normalised {@link WebhookEvent} DTO.
 *
 * Postmark RecordType → DeliveryStatus mapping (per spec §3.6.3):
 *   Delivery           → DELIVERED
 *   Bounce             → FAILED  (error from Type+TypeCode+Description)
 *   SpamComplaint      → FAILED  (error_code=SPAM_COMPLAINT)
 *   Open/Click/SubscriptionChange/other → null (caller treats as DROPPED)
 *
 * SMSAPI status_name → DeliveryStatus mapping is added in task 4-8.
 */
@Component
public class WebhookEventMapper {

    /**
     * Maps a Postmark payload to {@link WebhookEvent}.
     *
     * @param payload  deserialized Postmark payload
     * @param rawJson  original raw JSON string — stored verbatim in webhook_event.raw_payload
     * @return normalized event; status() is null for non-delivery record types (DROPPED path)
     */
    public WebhookEvent fromPostmark(PostmarkWebhookPayload payload, String rawJson) {
        DeliveryStatus status = mapPostmarkRecordType(payload);

        String errorCode    = null;
        String errorMessage = null;

        if ("Bounce".equalsIgnoreCase(payload.recordType())) {
            errorCode    = payload.bounceType();
            errorMessage = buildBounceMessage(payload.bounceType(),
                                              payload.bounceTypeCode(),
                                              payload.bounceDescription());
        } else if ("SpamComplaint".equalsIgnoreCase(payload.recordType())) {
            errorCode = "SPAM_COMPLAINT";
        }

        return new WebhookEvent(
            Provider.POSTMARK,
            payload.messageId(),
            null,          // Postmark has no per-event id; dedup relies on state-guarded UPDATE
            status,
            payload.occurredAt(),
            rawJson,
            errorCode,
            errorMessage
        );
    }

    // fromSmsApi is added in task 4-8.

    // ── private helpers ────────────────────────────────────────────────────────

    private DeliveryStatus mapPostmarkRecordType(PostmarkWebhookPayload p) {
        if (p.recordType() == null) return null;
        return switch (p.recordType()) {
            case "Delivery"                   -> DeliveryStatus.DELIVERED;
            case "Bounce", "SpamComplaint"    -> DeliveryStatus.FAILED;
            // Open, Click, SubscriptionChange, and any unknown → null (DROPPED)
            default                           -> null;
        };
    }

    private String buildBounceMessage(String type, Integer typeCode, String description) {
        var sb = new StringBuilder();
        if (type        != null) sb.append("Type=").append(type);
        if (typeCode    != null) sb.append(" TypeCode=").append(typeCode);
        if (description != null && !description.isBlank()) sb.append(" ").append(description);
        return sb.toString().trim();
    }
}
