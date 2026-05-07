package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;

public record DeliveryReceipt(
        String providerMessageId,
        DeliveryStatus initialStatus,
        Instant acceptedAt,
        String errorCode,
        String errorMessage) {

    public DeliveryReceipt {
        Objects.requireNonNull(initialStatus, "initialStatus");
        Objects.requireNonNull(acceptedAt, "acceptedAt");
    }

    public static DeliveryReceipt accepted(String providerMessageId) {
        return new DeliveryReceipt(providerMessageId, DeliveryStatus.SENT, Instant.now(), null, null);
    }

    public static DeliveryReceipt failed(String code, String message) {
        return new DeliveryReceipt(null, DeliveryStatus.FAILED, Instant.now(), code, message);
    }
}
