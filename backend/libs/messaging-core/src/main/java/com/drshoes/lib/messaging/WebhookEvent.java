package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;

public record WebhookEvent(
        String providerMessageId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload) {

    public WebhookEvent {
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredAt, "occurredAt");
    }
}
