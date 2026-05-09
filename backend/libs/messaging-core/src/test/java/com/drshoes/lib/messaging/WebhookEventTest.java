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
                "{\"RecordType\":\"Delivery\"}",
                null,           // errorCode — nullable for DELIVERED
                null            // errorMessage — nullable for DELIVERED
        );

        assertThat(event.provider()).isEqualTo(Provider.POSTMARK);
        assertThat(event.providerMessageId()).isEqualTo("pm-msg-abc");
        assertThat(event.providerEventId()).isNull();
        assertThat(event.status()).isEqualTo(DeliveryStatus.DELIVERED);
        assertThat(event.occurredAt()).isEqualTo(NOW);
        assertThat(event.errorCode()).isNull();
        assertThat(event.errorMessage()).isNull();
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
                        "{}",
                        null,
                        null
                ))
                .withMessageContaining("provider");
    }

    @Test
    @DisplayName("status may be null for non-delivery event types (DROPPED path)")
    void statusNullable() {
        // Null status = non-delivery record type (e.g. Click, Open) — reconciler treats as DROPPED.
        WebhookEvent event = new WebhookEvent(
                Provider.POSTMARK,
                "pm-msg-xyz",
                null,
                null,           // null status — DROPPED path
                NOW,
                "{}",
                null,
                null
        );

        assertThat(event.status()).isNull();
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
                        "{}",
                        null,
                        null
                ))
                .withMessageContaining("occurredAt");
    }

    @Test
    @DisplayName("rawPayload is required — null throws NullPointerException")
    void rawPayloadRequired() {
        assertThatNullPointerException()
                .isThrownBy(() -> new WebhookEvent(
                        Provider.SMSAPI,
                        "sms-msg-xyz",
                        null,
                        DeliveryStatus.FAILED,
                        NOW,
                        null,
                        null,
                        null
                ))
                .withMessageContaining("rawPayload");
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
                "{\"status_name\":\"UNDELIVERED\"}",
                "UNDELIVERED",
                "SMS delivery failed"
        );

        assertThat(event.providerEventId()).isNull();
        assertThat(event.providerMessageId()).isEqualTo("sms-msg-123");
        assertThat(event.errorCode()).isEqualTo("UNDELIVERED");
        assertThat(event.errorMessage()).isEqualTo("SMS delivery failed");
    }
}
