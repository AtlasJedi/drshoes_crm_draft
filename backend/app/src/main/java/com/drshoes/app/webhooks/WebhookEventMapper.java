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

    /**
     * Maps SMSAPI GET callback query params to {@link WebhookEvent}.
     *
     * status_name (preferred) mapping per spec §3.6.2:
     *   DELIVERED                              → DELIVERED
     *   UNDELIVERED, EXPIRED, FAILED,
     *   REJECTD, UNKNOWN                       → FAILED  (errorCode = status_name)
     *   QUEUE, ACCEPTD, SENT                   → null    (DROPPED — still in-flight)
     *
     * Numeric status fallback (when status_name absent):
     *   404 → DELIVERED. Others → null (DROPPED, conservative until spec §10 errata pins them).
     *
     * @param msgId         MsgId query parameter (provider_message_id and dedup key)
     * @param statusName    status_name query param (preferred; may be null)
     * @param statusCode    numeric status param (used only when statusName is null)
     * @param occurredAt    parsed donedate (UNIX seconds → Instant)
     * @param rawQueryJson  JSON encoding of all query params for archival
     * @return normalized event; status() is null for in-flight statuses (DROPPED path)
     */
    public WebhookEvent fromSmsApi(String msgId, String statusName, Integer statusCode,
                                   java.time.Instant occurredAt, String rawQueryJson) {
        DeliveryStatus status;
        String errorCode = null;

        if (statusName != null && !statusName.isBlank()) {
            status = mapSmsApiStatusName(statusName);
            if (status == DeliveryStatus.FAILED) {
                errorCode = statusName;
            }
        } else {
            status = mapSmsApiNumericStatus(statusCode);
            if (status == DeliveryStatus.FAILED) {
                errorCode = statusCode != null ? String.valueOf(statusCode) : "UNKNOWN";
            }
        }

        return new WebhookEvent(
            Provider.SMSAPI,
            msgId,
            null,           // SMSAPI has no per-event id; dedupe via state-guarded UPDATE
            status,
            occurredAt,
            rawQueryJson,
            errorCode,
            null            // errorMessage not provided by SMSAPI callback
        );
    }

    private DeliveryStatus mapSmsApiStatusName(String name) {
        return switch (name.toUpperCase()) {
            case "DELIVERED"                                    -> DeliveryStatus.DELIVERED;
            case "UNDELIVERED", "EXPIRED", "FAILED",
                 "REJECTD",     "UNKNOWN"                       -> DeliveryStatus.FAILED;
            case "QUEUE", "ACCEPTD", "SENT"                    -> null;   // in-flight: DROPPED
            default                                             -> null;   // unknown: DROPPED
        };
    }

    private DeliveryStatus mapSmsApiNumericStatus(Integer code) {
        if (code == null) return null;
        return switch (code) {
            case 404 -> DeliveryStatus.DELIVERED;   // SMSAPI legacy: 404 = delivered
            default  -> null;                       // conservative: DROPPED pending spec §10 errata
        };
    }

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
