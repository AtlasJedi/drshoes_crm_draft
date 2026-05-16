package com.drshoes.lib.messaging;

import java.util.List;
import java.util.Objects;

public record OutboundMessage(
        Channel channel,
        String recipient,
        String subject,
        String body,
        List<Attachment> attachments,
        String idempotencyKey,
        String bodyHtml) {

    /** Canonical compact constructor — validates all fields. */
    public OutboundMessage {
        Objects.requireNonNull(channel, "channel");
        if (recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("recipient must not be blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("body must not be blank");
        }
        if (channel == Channel.EMAIL && (subject == null || subject.isBlank())) {
            throw new IllegalArgumentException("subject required for EMAIL");
        }
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
        // bodyHtml is optional — null means plain-text only
    }

    /**
     * Convenience 6-arg factory that omits bodyHtml (plain-text only).
     * Preserves backward compatibility for SMS, WhatsApp, and plain-email callers.
     */
    public static OutboundMessage of(Channel channel, String recipient, String subject,
                                     String body, List<Attachment> attachments,
                                     String idempotencyKey) {
        return new OutboundMessage(channel, recipient, subject, body, attachments,
                idempotencyKey, null);
    }
}
