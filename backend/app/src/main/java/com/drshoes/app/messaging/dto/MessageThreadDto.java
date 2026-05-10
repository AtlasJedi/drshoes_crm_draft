package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageThreadDto(
    UUID id,
    UUID clientId,
    String rawSender,
    String channel,
    String subject,
    OffsetDateTime lastMessageAt,
    int unreadCount,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String lastMessagePreview,
    boolean unmatched,
    String clientName,
    String clientEmail,
    String clientPhone,
    OffsetDateTime discardedAt
) {}
