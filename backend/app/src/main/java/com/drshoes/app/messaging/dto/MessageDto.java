package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageDto(
    UUID id,
    UUID orderId,
    UUID clientId,
    String direction,
    String channel,
    UUID templateId,
    UUID triggerId,
    String subject,
    String body,
    String deliveryStatus,
    String providerMessageId,
    OffsetDateTime sentAt,
    OffsetDateTime createdAt) {}
