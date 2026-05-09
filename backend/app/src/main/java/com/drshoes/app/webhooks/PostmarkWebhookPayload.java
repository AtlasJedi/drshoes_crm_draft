package com.drshoes.app.webhooks;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Jackson record for Postmark webhook payload.
 * Only the fields used for delivery reconciliation are bound.
 * Additional fields pass through silently (@JsonIgnoreProperties).
 *
 * RecordType discriminates the event kind:
 *   Delivery       → DELIVERED
 *   Bounce         → FAILED (error from Type+TypeCode+Description)
 *   SpamComplaint  → FAILED (error_code=SPAM_COMPLAINT)
 *   Open/Click/SubscriptionChange/other → null (DROPPED)
 *
 * MessageID is the provider-assigned message identifier;
 * correlates to message.provider_message_id.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PostmarkWebhookPayload(

    @JsonProperty("RecordType")
    String recordType,

    @JsonProperty("MessageID")
    String messageId,

    // Delivery
    @JsonProperty("DeliveredAt")
    Instant deliveredAt,

    // Bounce
    @JsonProperty("BouncedAt")
    Instant bouncedAt,

    @JsonProperty("Type")
    String bounceType,

    @JsonProperty("TypeCode")
    Integer bounceTypeCode,

    @JsonProperty("Description")
    String bounceDescription,

    // SpamComplaint
    @JsonProperty("ReceivedAt")
    Instant receivedAt
) {
    /** Returns the best-available occurred-at timestamp across record types. */
    public Instant occurredAt() {
        if (deliveredAt != null) return deliveredAt;
        if (bouncedAt   != null) return bouncedAt;
        if (receivedAt  != null) return receivedAt;
        return Instant.now();
    }
}
