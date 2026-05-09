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
 *   <li>{@code status} — nullable; DELIVERED or FAILED after provider mapping.
 *       Null means the event type is not a delivery outcome (e.g. Click, Open) —
 *       the reconciler treats null status as DROPPED.</li>
 *   <li>{@code occurredAt} — required; provider-supplied event timestamp.</li>
 *   <li>{@code rawPayload} — required; original payload string for forensics log.</li>
 *   <li>{@code errorCode} — optional; provider-specific error code for FAILED events
 *       (e.g. Postmark bounce Type, SMSAPI status_name). Null for DELIVERED events.</li>
 *   <li>{@code errorMessage} — optional; human-readable error detail. Null for
 *       DELIVERED events.</li>
 * </ul>
 * </p>
 */
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
