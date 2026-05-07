package com.drshoes.lib.messaging;

import java.time.Instant;

public record WebhookEvent(
        String providerMessageId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload) {}
