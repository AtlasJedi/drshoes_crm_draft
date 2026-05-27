package com.drshoes.app.webhooks;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
@JsonIgnoreProperties(ignoreUnknown = true)
public record PostmarkWebhookPayload(

    @JsonProperty("RecordType")
    String recordType,

    @JsonProperty("MessageID")
    String messageId,
    @JsonProperty("DeliveredAt")
    Instant deliveredAt,
    @JsonProperty("BouncedAt")
    Instant bouncedAt,

    @JsonProperty("Type")
    String bounceType,

    @JsonProperty("TypeCode")
    Integer bounceTypeCode,

    @JsonProperty("Description")
    String bounceDescription,
    @JsonProperty("ReceivedAt")
    Instant receivedAt
) {
    public Instant occurredAt() {
        if (deliveredAt != null) return deliveredAt;
        if (bouncedAt   != null) return bouncedAt;
        if (receivedAt  != null) return receivedAt;
        return Instant.now();
    }
}
