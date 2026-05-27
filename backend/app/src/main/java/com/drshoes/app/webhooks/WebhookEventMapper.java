package com.drshoes.app.webhooks;

import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import org.springframework.stereotype.Component;
@Component
public class WebhookEventMapper {
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
            null,
            status,
            payload.occurredAt(),
            rawJson,
            errorCode,
            errorMessage
        );
    }
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
            null,
            status,
            occurredAt,
            rawQueryJson,
            errorCode,
            null
        );
    }

    private DeliveryStatus mapSmsApiStatusName(String name) {
        return switch (name.toUpperCase()) {
            case "DELIVERED"                                    -> DeliveryStatus.DELIVERED;
            case "UNDELIVERED", "EXPIRED", "FAILED",
                 "REJECTD",     "UNKNOWN"                       -> DeliveryStatus.FAILED;
            case "QUEUE", "ACCEPTD", "SENT"                    -> null;
            default                                             -> null;
        };
    }

    private DeliveryStatus mapSmsApiNumericStatus(Integer code) {
        if (code == null) return null;
        return switch (code) {
            case 404 -> DeliveryStatus.DELIVERED;
            default  -> null;
        };
    }

    private DeliveryStatus mapPostmarkRecordType(PostmarkWebhookPayload p) {
        if (p.recordType() == null) return null;
        return switch (p.recordType()) {
            case "Delivery"                   -> DeliveryStatus.DELIVERED;
            case "Bounce", "SpamComplaint"    -> DeliveryStatus.FAILED;
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
