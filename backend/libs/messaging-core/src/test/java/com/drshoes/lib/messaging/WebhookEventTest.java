package com.drshoes.lib.messaging;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

class WebhookEventTest {

    private static final Instant NOW = Instant.parse("2026-05-09T12:00:00Z");

    @Test
    @DisplayName("valid WebhookEvent with all required fields constructs successfully")
    void constructsWithRequiredFields() {
        WebhookEvent event = new WebhookEvent(
                Provider.POSTMARK,
                "pm-msg-abc",
                null,           // providerEventId — nullable
                DeliveryStatus.DELIVERED,
                NOW,
                "{\"RecordType\":\"Delivery\"}"
        );

        assertThat(event.provider()).isEqualTo(Provider.POSTMARK);
        assertThat(event.providerMessageId()).isEqualTo("pm-msg-abc");
        assertThat(event.providerEventId()).isNull();
        assertThat(event.status()).isEqualTo(DeliveryStatus.DELIVERED);
        assertThat(event.occurredAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("provider is required — null throws NullPointerException")
    void providerRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        null,
                        "pm-msg-abc",
                        null,
                        DeliveryStatus.DELIVERED,
                        NOW,
                        "{}"
                ))
                .withMessageContaining("provider");
    }

    @Test
    @DisplayName("status is required — null throws NullPointerException")
    void statusRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        Provider.SMSAPI,
                        "sms-msg-xyz",
                        null,
                        null,
                        NOW,
                        "{}"
                ))
                .withMessageContaining("status");
    }

    @Test
    @DisplayName("occurredAt is required — null throws NullPointerException")
    void occurredAtRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        Provider.SMSAPI,
                        "sms-msg-xyz",
                        null,
                        DeliveryStatus.FAILED,
                        null,
                        "{}"
                ))
                .withMessageContaining("occurredAt");
    }

    @Test
    @DisplayName("providerEventId may be null without throwing")
    void providerEventIdNullable() {
        WebhookEvent event = new WebhookEvent(
                Provider.SMSAPI,
                "sms-msg-123",
                null,
                DeliveryStatus.FAILED,
                NOW,
                "{\"status_name\":\"UNDELIVERED\"}"
        );

        assertThat(event.providerEventId()).isNull();
        assertThat(event.providerMessageId()).isEqualTo("sms-msg-123");
    }
}
