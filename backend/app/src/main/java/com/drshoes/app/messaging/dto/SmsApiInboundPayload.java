package com.drshoes.app.messaging.dto;

/**
 * Minimal stub for SMSAPI MO (inbound SMS) payload.
 * Full DTO with form-encoded binding and field validation ships in task 5-6.
 * Only the fields consumed by InboundMessageService are declared here.
 */
public record SmsApiInboundPayload(
    String smsId,
    String smsFrom,
    String smsText,
    long smsDate
) {}
