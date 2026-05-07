package com.drshoes.lib.messaging;

import java.util.List;
import java.util.Objects;

public record OutboundMessage(
        Channel channel,
        String recipient,
        String subject,
        String body,
        List<Attachment> attachments,
        String idempotencyKey) {

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
    }
}
