package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;

/**
 * Normalised representation of an inbound provider webhook callback.
 *
 * <p>Constructed inside {@code WebhookEventMapper} from raw provider payloads.
 * Consumed by {@code WebhookStatusReconciler} to drive state-guarded UPDATEs
 * on {@code message.delivery_status}.</p>
 *
 * <p>Field contract:
 * <ul>
 *   <li>{@code provider} — required; identifies Postmark or SMSAPI.</li>
 *   <li>{@code providerMessageId} — the provider's outbound message reference
 *       (Postmark {@code MessageID}, SMSAPI {@code MsgId}). May be null if the
 *       provider does not supply one in the callback (treated as NO_MESSAGE).</li>
 *   <li>{@code providerEventId} — optional per-event unique ID. Null for both
 *       Postmark and SMSAPI in current integrations. Reserved for future providers
 *       that supply one (drives the UNIQUE dedupe index in webhook_event).</li>
 *   <li>{@code status} — required; DELIVERED or FAILED (caller has already mapped
 *       the raw provider status; DROPPED events are short-circuited before
 *       WebhookEvent is constructed).</li>
 *   <li>{@code occurredAt} — required; provider-supplied event timestamp.</li>
 *   <li>{@code rawPayload} — required; original payload string for forensics log.</li>
 * </ul>
 * </p>
 */
public record WebhookEvent(
        Provider provider,
        String providerMessageId,
        String providerEventId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload) {

    public WebhookEvent {
        Objects.requireNonNull(provider, "provider");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredAt, "occurredAt");
    }
}
