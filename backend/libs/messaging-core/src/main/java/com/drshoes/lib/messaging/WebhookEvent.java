package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;
public record WebhookEvent(
        Provider provider,
        String providerMessageId,
        String providerEventId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload,
        String errorCode,
        String errorMessage) {

    public WebhookEvent {
        Objects.requireNonNull(provider, "provider");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(rawPayload, "rawPayload");
    }
}
