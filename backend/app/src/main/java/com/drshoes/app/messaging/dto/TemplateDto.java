package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TemplateDto(
    UUID id,
    String name,
    String channel,
    String subject,
    String body,
    Boolean active,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
