package com.drshoes.app.messaging.dto;

/**
 * Minimal stub for Postmark inbound webhook payload.
 * Full DTO with Jackson annotations and field validation ships in task 5-5.
 * Only the fields consumed by InboundMessageService are declared here.
 */
public record PostmarkInboundPayload(
    String messageId,
    String from,
    String subject,
    String textBody,
    String strippedTextReply,
    String date
) {}
