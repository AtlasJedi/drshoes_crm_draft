package com.drshoes.lib.messaging;

/**
 * Identifies the external messaging provider that sent an outbound message
 * or delivered an inbound webhook callback.
 *
 * <p>Values mirror the CHECK constraint in V010 {@code webhook_event.provider}
 * and the {@code WebhookEventEntity.provider} JPA column.</p>
 */
public enum Provider {
    POSTMARK,
    SMSAPI
}
