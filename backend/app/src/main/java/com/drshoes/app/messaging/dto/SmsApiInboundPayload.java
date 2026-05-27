package com.drshoes.app.messaging.dto;
public record SmsApiInboundPayload(
    String smsId,
    String smsFrom,
    String smsTo,
    String smsText,
    long   smsDate
) {}
