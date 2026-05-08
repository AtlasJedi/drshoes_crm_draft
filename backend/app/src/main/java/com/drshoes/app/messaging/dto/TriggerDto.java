package com.drshoes.app.messaging.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TriggerDto(
    UUID id, String name, Boolean enabled, String event, String eventParams,
    String channels, UUID templateId, String templateName,
    Integer delayMinutes, Boolean requiresManualConfirmation,
    OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
